import { createSignal, createEffect, onMount, onCleanup } from 'solid-js'
import {
  pushWorkspace,
  pullWorkspace,
  saveConflictBackup,
  getLastPushMeta,
} from '../lib/cloudDb'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { validateWorkspaceState, writeJsonStorage } from '../utils/storage'
import { WORKSPACE_STORAGE_KEY_PREFIX } from '../utils/constants'

// Auto-retries after a failed push stop here; manual Sync Now / the
// browser 'online' event reset the counter. Prevents infinite loops
// against a persistently failing backend.
const MAX_AUTO_RETRIES = 5

// Canonical JSON: object keys are sorted recursively before stringifying.
// Postgres jsonb does not preserve key order and validateWorkspaceState
// rebuilds objects, so plain JSON.stringify of a local snapshot NEVER
// string-equals the same content echoed back from the cloud. Without this,
// every push's own realtime echo looked like a foreign remote update, which
// re-imported the workspace (toast + full restore) and pushed again forever.
function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    const out = new Array(value.length)
    for (let i = 0; i < value.length; i++) out[i] = canonicalize(value[i])
    return out
  }
  const keys = Object.keys(value).sort()
  const out = {}
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const entry = value[key]
    if (entry === undefined) continue
    out[key] = canonicalize(entry)
  }
  return out
}

function serializeState(state) {
  try {
    return JSON.stringify(canonicalize(state ?? null))
  } catch {
    return String(Date.now())
  }
}

export function createSyncEngine({
  workspaceId,
  captureSnapshot,
  user: initialUser,
  getUser,
  workspaceName = null,
  onRemoteWorkspaceLoaded,
  debounceMs = 3000,
}) {
  const [syncStatus, setSyncStatus] = createSignal(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  )
  const [lastSyncedAt, setLastSyncedAt] = createSignal(null)
  const [syncError, setSyncError] = createSignal(null)

  function resolveCurrentUser() {
    if (typeof getUser === 'function') return getUser()
    if (typeof initialUser === 'function') return initialUser()
    return initialUser ?? null
  }

  // Closure variables replace React refs — the factory body runs exactly once.
  // Last snapshot (serialized) this client knows is identical to the cloud row.
  let lastPushedSnapshot = null
  // Snapshot currently being written by an in-flight push (echo guard for realtime).
  let inFlightSnapshot = null
  // Last confirmed cloud version — sent back as p_expected_version on pushes.
  let knownVersion = null
  // True when local state changed and has not been confirmed by the cloud yet.
  let pendingChange = false

  let debounceTimer = null
  let retryTimer = null
  let retryCount = 0
  let mounted = true
  let reconcileGate = Promise.resolve()

  let activeRealtimeChannel = null
  let cleanupReconcile = null
  let lastHandledUserId = null
  let userGeneration = 0
  let reconcileFailed = false
  let skipEmptyInitialization = false

  function safeSetStatus(status) {
    if (mounted) setSyncStatus(status)
  }

  function safeSetError(message) {
    if (mounted) setSyncError(message)
  }

  function cleanupRealtime() {
    if (activeRealtimeChannel) {
      supabase?.removeChannel?.(activeRealtimeChannel)
      activeRealtimeChannel = null
    }
  }

  function setupRealtime(userId, generation = userGeneration) {
    cleanupRealtime()
    if (!userId || !isSupabaseConfigured() || !supabase?.channel || !workspaceId) return

    activeRealtimeChannel = supabase
      .channel(`workspace-sync-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspace_data',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (generation !== userGeneration || resolveCurrentUser()?.id !== userId) return
          if (!payload?.new?.data) return
          const remoteStr = serializeState(payload.new.data)

          // Ignore echoes of our own writes (in-flight or already synced).
          if (
            remoteStr === lastPushedSnapshot ||
            remoteStr === inFlightSnapshot
          ) {
            return
          }

          const localCurrent = captureSnapshot?.()

          if (pendingChange && localCurrent) {
            // Local unsynced edits exist — never silently drop them.
            // Back them up and let the server arbitrate via the next
            // version-checked push (conflict path preserves the local copy).
            saveConflictBackup(workspaceId, localCurrent)
            if (debounceTimer) clearTimeout(debounceTimer)
            performPush()
            return
          }

          try {
            adoptRemoteData(validateWorkspaceState(payload.new.data), payload.new.version)
          } catch {
            // Malformed remote payload — ignore.
          }
        }
      )
      .subscribe()
  }

  function startReconciliation(user, generation = userGeneration) {
    if (!user || !isSupabaseConfigured() || !workspaceId) {
      reconcileFailed = false
      reconcileGate = Promise.resolve()
      return null
    }

    let cancelled = false
    reconcileFailed = true
    let resolveGate
    let gateSettled = false
    reconcileGate = new Promise((resolve) => {
      resolveGate = () => {
        if (!gateSettled) {
          gateSettled = true
          resolve()
        }
      }
    })

    pullWorkspace(user.id, workspaceId)
      .then((record) => {
        if (cancelled || generation !== userGeneration || resolveCurrentUser()?.id !== user.id) return
        if (!record) {
          knownVersion = null
          const localSnap = captureSnapshot?.()
          if (skipEmptyInitialization) {
            // A live engine may observe a new account before the board is
            // remounted. Its old in-memory state must never initialize the
            // new account's empty cloud workspace.
            reconcileFailed = true
            resolveGate()
          } else {
            reconcileFailed = false
          }
          if (localSnap && !skipEmptyInitialization) {
            // Cloud is completely empty for this workspace. Initialize it with local data!
            pendingChange = true
            lastPushedSnapshot = null
            resolveGate()
            performPush()
          } else {
            resolveGate()
          }
          return
        }

        knownVersion = Number.isFinite(record.version) ? record.version : null

        try {
          const localSnap = captureSnapshot?.()
          const localStr = serializeState(localSnap)
          const cloudStr = record.data ? serializeState(record.data) : null

          if (cloudStr === localStr) {
            // Already identical — suppress the redundant mount-time push.
            lastPushedSnapshot = localStr
            pendingChange = false
            setLastSyncedAt(record.syncedAt ? Date.parse(record.syncedAt) : Date.now())
            safeSetStatus('idle')
            safeSetError(null)
            reconcileFailed = false
            return
          }

          const localMeta = getLastPushMeta(workspaceId, user.id)
          const localTime = localMeta?.at ?? 0
          const cloudTime = record.syncedAt ? Date.parse(record.syncedAt) : 0

          if (record.data && cloudTime > localTime) {
            // Cloud is strictly newer than anything this device pushed.
            // adoptRemoteData backs up any unsynced local edits first.
            adoptRemoteData(record.data, record.version)
            safeSetStatus('idle')
            safeSetError(null)
          }
          reconcileFailed = false
        } catch {
          reconcileFailed = true
          safeSetStatus('error')
          safeSetError('Failed to reconcile workspace data')
        }
      })
      .catch((err) => {
        if (cancelled || generation !== userGeneration || resolveCurrentUser()?.id !== user.id) return
        // Offline or read error — DO NOT treat as empty cloud workspace. Keep local-first state intact.
        reconcileFailed = true
        safeSetStatus('error')
        safeSetError(err?.message || 'Failed to fetch cloud workspace')
      })
      .finally(() => {
        resolveGate()
      })

    return () => {
      cancelled = true
      resolveGate()
    }
  }

  /**
   * Adopt a cloud snapshot locally. Backs up the current local state first —
   * but only when it actually differs from the incoming data, so identical
   * echoes never flood localStorage with conflict backups or re-render the
   * whole board.
   */
  function adoptRemoteData(remoteData, remoteVersion) {
    const remoteStr = serializeState(remoteData)
    const localCurrent = captureSnapshot?.()
    const localStr = serializeState(localCurrent)
    const contentChanged = remoteStr !== localStr

    if (contentChanged) {
      if (localCurrent) saveConflictBackup(workspaceId, localCurrent)
      writeJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`, remoteData)
      onRemoteWorkspaceLoaded?.(remoteData)
    }

    lastPushedSnapshot = remoteStr
    if (Number.isFinite(remoteVersion)) knownVersion = remoteVersion
    pendingChange = false
    setLastSyncedAt(Date.now())
  }

  function scheduleRetry(pushFn) {
    if (retryCount >= MAX_AUTO_RETRIES) return false
    const nextDelay = Math.min(60000, 1000 * Math.pow(2, retryCount))
    retryCount += 1
    if (retryTimer) clearTimeout(retryTimer)
    const retryGeneration = userGeneration
    retryTimer = setTimeout(() => {
      retryTimer = null
      if (retryGeneration === userGeneration) pushFn()
    }, nextDelay)
    return true
  }

  async function performPush() {
    const user = resolveCurrentUser()
    if (!user || !isSupabaseConfigured() || !workspaceId) return false
    const pushGeneration = userGeneration
    const pushUserId = user.id

    // Wait for the initial reconciliation so the first push carries a real
    // expectedVersion instead of blindly overwriting a newer cloud row.
    try {
      await reconcileGate
    } catch {
      /* gate never rejects */
    }
    if (
      !mounted ||
      reconcileFailed ||
      pushGeneration !== userGeneration ||
      resolveCurrentUser()?.id !== pushUserId
    ) return false

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      safeSetStatus('offline')
      return false
    }

    const snapshot = captureSnapshot?.()
    if (!snapshot) return false

    const serialized = serializeState(snapshot)
    if (serialized === lastPushedSnapshot) {
      pendingChange = false
      safeSetStatus('idle')
      return true
    }

    safeSetStatus('syncing')
    safeSetError(null)
    inFlightSnapshot = serialized

    try {
      const result = await pushWorkspace(user.id, workspaceId, snapshot, {
        expectedVersion: knownVersion,
        workspaceName,
      })

      if (pushGeneration === userGeneration && inFlightSnapshot === serialized) {
        inFlightSnapshot = null
      }
      if (pushGeneration !== userGeneration || resolveCurrentUser()?.id !== pushUserId) {
        return false
      }

      if (result?.success) {
        lastPushedSnapshot = serialized
        if (Number.isFinite(result.version)) knownVersion = result.version
        pendingChange = false
        retryCount = 0
        setLastSyncedAt(Date.now())
        safeSetStatus('idle')
        return true
      }

      if (result?.reason === 'conflict') {
        // Another device wrote a newer version between our reads/writes.
        // Preserve the local board as a backup, then adopt the cloud row.
        saveConflictBackup(workspaceId, snapshot)
        if (result.cloudData) {
          adoptRemoteData(result.cloudData, result.cloudVersion)
          safeSetStatus('idle')
          safeSetError('Sync conflict resolved — your previous board was backed up locally.')
        } else {
          knownVersion = result.cloudVersion ?? null
          safeSetStatus('error')
          safeSetError('Sync conflict — cloud has newer changes. Pulling latest…')
          scheduleRetry(performPush)
        }
        return false
      }

      return false
    } catch (err) {
      if (pushGeneration === userGeneration && inFlightSnapshot === serialized) {
        inFlightSnapshot = null
      }
      if (pushGeneration !== userGeneration || resolveCurrentUser()?.id !== pushUserId) {
        return false
      }
      console.warn('[SyncEngine] Cloud push failed:', err.message)
      safeSetStatus('error')
      safeSetError(err.message || 'Sync failed')

      // Keep local data untouched; retry in background with backoff.
      const willRetry = scheduleRetry(performPush)
      if (!willRetry) {
        safeSetError('Sync paused after repeated failures. Press “Sync Now” to retry.')
      }
      return false
    }
  }

  function restartReconciliation() {
    const user = resolveCurrentUser()
    if (!user || !isSupabaseConfigured() || !workspaceId) return
    if (typeof cleanupReconcile === 'function') cleanupReconcile()
    cleanupReconcile = startReconciliation(user, userGeneration)
    setupRealtime(user.id, userGeneration)
  }

  // Manual or external sync trigger
  async function syncNow() {
    if (debounceTimer) clearTimeout(debounceTimer)
    if (retryTimer) clearTimeout(retryTimer)
    debounceTimer = null
    retryTimer = null
    retryCount = 0
    if (reconcileFailed) restartReconciliation()
    return await performPush()
  }

  // Explicit pull (also used manually from tests / future UI)
  async function pullFromCloud() {
    const user = resolveCurrentUser()
    if (!user || !isSupabaseConfigured() || !workspaceId) return null
    const pullGeneration = userGeneration

    try {
      safeSetStatus('syncing')
      const record = await pullWorkspace(user.id, workspaceId)
      if (pullGeneration !== userGeneration || resolveCurrentUser()?.id !== user.id) return null
      if (record?.data) {
        adoptRemoteData(record.data, record.version)
        safeSetStatus('idle')
        safeSetError(null)
        reconcileFailed = false
        return record.data
      }
      if (record && Number.isFinite(record.version)) {
        knownVersion = record.version
      }
      safeSetStatus('idle')
      reconcileFailed = false
      return null
    } catch (err) {
      if (pullGeneration !== userGeneration || resolveCurrentUser()?.id !== user.id) return null
      reconcileFailed = true
      safeSetStatus('error')
      safeSetError(err.message)
      return null
    }
  }

  // Notify the engine that local state changed (schedules a debounced push).
  function notifyChange() {
    const user = resolveCurrentUser()
    if (!user || !isSupabaseConfigured()) return
    pendingChange = true
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      performPush()
    }, debounceMs)
  }

  // React to dynamic user changes / late authentication resolution
  createEffect(() => {
    const user = resolveCurrentUser()
    const currentUserId = user?.id ?? null

    if (currentUserId !== lastHandledUserId) {
      const switchingAccounts = Boolean(
        user && lastHandledUserId && lastHandledUserId !== currentUserId
      )
      lastHandledUserId = currentUserId
      userGeneration += 1
      skipEmptyInitialization = switchingAccounts
      if (debounceTimer) clearTimeout(debounceTimer)
      if (retryTimer) clearTimeout(retryTimer)
      debounceTimer = null
      retryTimer = null
      retryCount = 0
      lastPushedSnapshot = null
      inFlightSnapshot = null
      knownVersion = null
      pendingChange = false
      reconcileFailed = Boolean(user)
      if (typeof cleanupReconcile === 'function') {
        cleanupReconcile()
        cleanupReconcile = null
      }
      cleanupRealtime()

      if (user) {
        cleanupReconcile = startReconciliation(user, userGeneration)
        setupRealtime(user.id, userGeneration)
      } else {
        skipEmptyInitialization = false
        reconcileFailed = false
        reconcileGate = Promise.resolve()
        safeSetStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle')
      }
    }
  })

  onMount(() => {
    // ─── Online/offline transitions ──────────────────────────────────
    const handleOnline = () => {
      safeSetStatus('idle')
      safeSetError(null)
      retryCount = 0
      syncNow()
    }

    const handleOffline = () => {
      safeSetStatus('offline')
      if (debounceTimer) clearTimeout(debounceTimer)
      if (retryTimer) clearTimeout(retryTimer)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // ─── Flush pending changes when leaving / hiding the page ────────
    const flushPending = () => {
      const user = resolveCurrentUser()
      if (!user || !isSupabaseConfigured() || !pendingChange) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      const snapshot = captureSnapshot?.()
      if (!snapshot) return
      const serialized = serializeState(snapshot)
      if (serialized === lastPushedSnapshot) {
        pendingChange = false
        return
      }
      if (debounceTimer) clearTimeout(debounceTimer)
      // Best-effort fire-and-forget: localStorage already holds the data;
      // if the request dies with the page, reconnect reconcile resolves it.
      performPush()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPending()
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', flushPending)

    onCleanup(() => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', flushPending)
    })
  })

  // ─── Cleanup: flush on unmount (e.g. workspace switch) ───────────
  onCleanup(() => {
    mounted = false
    if (debounceTimer) clearTimeout(debounceTimer)
    if (retryTimer) clearTimeout(retryTimer)
    if (typeof cleanupReconcile === 'function') {
      cleanupReconcile()
      cleanupReconcile = null
    }
    cleanupRealtime()

    // Best-effort immediate flush of unsynced edits when the engine
    // is disposed (workspace switch / logout). Closures still hold the old
    // workspace's state at cleanup time, which is exactly what we want.
    const user = resolveCurrentUser()
    if (
      user &&
      user.id === lastHandledUserId &&
      isSupabaseConfigured() &&
      pendingChange &&
      !reconcileFailed &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      const snapshot = captureSnapshot?.()
      if (snapshot && serializeState(snapshot) !== lastPushedSnapshot) {
        pushWorkspace(user.id, workspaceId, snapshot, {
          expectedVersion: knownVersion,
          workspaceName,
        }).catch(() => {})
      }
    }
  })

  return {
    get syncStatus() { return syncStatus() },
    get lastSyncedAt() { return lastSyncedAt() },
    get syncError() { return syncError() },
    syncNow,
    pullFromCloud,
    notifyChange,
  }
}
