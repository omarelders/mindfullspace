import { useState, useEffect, useRef, useCallback } from 'react'
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

function serializeState(state) {
  try {
    return JSON.stringify(state ?? null)
  } catch {
    return String(Date.now())
  }
}

export function useSyncEngine({
  workspaceId,
  captureSnapshot,
  user,
  workspaceName = null,
  onRemoteWorkspaceLoaded,
  debounceMs = 3000,
}) {
  const [syncStatus, setSyncStatus] = useState(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  )
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [syncError, setSyncError] = useState(null)

  // Last snapshot (serialized) this client knows is identical to the cloud row.
  const lastPushedSnapshotRef = useRef(null)
  // Snapshot currently being written by an in-flight push (echo guard for realtime).
  const inFlightSnapshotRef = useRef(null)
  // Last confirmed cloud version — sent back as p_expected_version on pushes.
  const knownVersionRef = useRef(null)
  // True when local state changed and has not been confirmed by the cloud yet.
  const pendingChangeRef = useRef(false)

  const debounceTimerRef = useRef(null)
  const retryTimerRef = useRef(null)
  const retryCountRef = useRef(0)
  const mountedRef = useRef(true)

  const captureSnapshotRef = useRef(captureSnapshot)
  const onRemoteWorkspaceLoadedRef = useRef(onRemoteWorkspaceLoaded)
  const workspaceNameRef = useRef(workspaceName)
  const reconcileGateRef = useRef(null)

  useEffect(() => {
    captureSnapshotRef.current = captureSnapshot
  }, [captureSnapshot])

  useEffect(() => {
    onRemoteWorkspaceLoadedRef.current = onRemoteWorkspaceLoaded
  }, [onRemoteWorkspaceLoaded])

  useEffect(() => {
    workspaceNameRef.current = workspaceName
  }, [workspaceName])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const safeSetStatus = useCallback((status) => {
    if (mountedRef.current) setSyncStatus(status)
  }, [])

  const safeSetError = useCallback((message) => {
    if (mountedRef.current) setSyncError(message)
  }, [])

  /**
   * Adopt a cloud snapshot locally. Always backs up the current local
   * state first — a remote takeover never destroys local work silently.
   */
  const adoptRemoteData = useCallback(
    (remoteData, remoteVersion) => {
      const localCurrent = captureSnapshotRef.current?.()
      if (localCurrent) saveConflictBackup(workspaceId, localCurrent)

      writeJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`, remoteData)
      lastPushedSnapshotRef.current = serializeState(remoteData)
      if (Number.isFinite(remoteVersion)) knownVersionRef.current = remoteVersion
      pendingChangeRef.current = false
      onRemoteWorkspaceLoadedRef.current?.(remoteData)
      setLastSyncedAt(Date.now())
    },
    [workspaceId]
  )

  const scheduleRetry = useCallback(
    (pushFn) => {
      if (retryCountRef.current >= MAX_AUTO_RETRIES) return false
      const nextDelay = Math.min(60000, 1000 * Math.pow(2, retryCountRef.current))
      retryCountRef.current += 1
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryTimerRef.current = setTimeout(() => pushFn(), nextDelay)
      return true
    },
    []
  )

  const performPush = useCallback(async () => {
    if (!user || !isSupabaseConfigured() || !workspaceId) return false

    // Wait for the initial reconciliation so the first push carries a real
    // expectedVersion instead of blindly overwriting a newer cloud row.
    try {
      await reconcileGateRef.current
    } catch {
      /* gate never rejects */
    }
    if (!mountedRef.current) return false

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      safeSetStatus('offline')
      return false
    }

    const snapshot = captureSnapshotRef.current?.()
    if (!snapshot) return false

    const serialized = serializeState(snapshot)
    if (serialized === lastPushedSnapshotRef.current) {
      pendingChangeRef.current = false
      safeSetStatus('idle')
      return true
    }

    safeSetStatus('syncing')
    safeSetError(null)
    inFlightSnapshotRef.current = serialized

    try {
      const result = await pushWorkspace(user.id, workspaceId, snapshot, {
        expectedVersion: knownVersionRef.current,
        workspaceName: workspaceNameRef.current,
      })

      inFlightSnapshotRef.current = null

      if (result?.success) {
        lastPushedSnapshotRef.current = serialized
        if (Number.isFinite(result.version)) knownVersionRef.current = result.version
        pendingChangeRef.current = false
        retryCountRef.current = 0
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
          knownVersionRef.current = result.cloudVersion ?? null
          safeSetStatus('error')
          safeSetError('Sync conflict — cloud has newer changes. Pulling latest…')
          scheduleRetry(performPush)
        }
        return false
      }

      return false
    } catch (err) {
      inFlightSnapshotRef.current = null
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaceId, adoptRemoteData, scheduleRetry, safeSetStatus, safeSetError])

  // Manual or external sync trigger
  const syncNow = useCallback(async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    retryCountRef.current = 0
    return await performPush()
  }, [performPush])

  // Explicit pull (also used manually from tests / future UI)
  const pullFromCloud = useCallback(async () => {
    if (!user || !isSupabaseConfigured() || !workspaceId) return null

    try {
      safeSetStatus('syncing')
      const record = await pullWorkspace(user.id, workspaceId)
      if (record?.data) {
        adoptRemoteData(record.data, record.version)
        safeSetStatus('idle')
        safeSetError(null)
        return record.data
      }
      if (record && Number.isFinite(record.version)) {
        knownVersionRef.current = record.version
      }
      safeSetStatus('idle')
      return null
    } catch (err) {
      safeSetStatus('error')
      safeSetError(err.message)
      return null
    }
  }, [user, workspaceId, adoptRemoteData, safeSetStatus, safeSetError])

  // Notify the engine that local state changed (schedules a debounced push).
  const notifyChange = useCallback(() => {
    if (!user || !isSupabaseConfigured()) return
    pendingChangeRef.current = true
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      performPush()
    }, debounceMs)
  }, [user, debounceMs, performPush])

  // ─── Mount reconciliation (multi-device load) ────────────────────
  // On becoming active for a workspace: learn the current cloud version,
  // adopt the cloud copy when it is strictly newer than anything this
  // device pushed, and align dedupe state when both sides already match.
  useEffect(() => {
    if (!user || !isSupabaseConfigured() || !workspaceId) {
      reconcileGateRef.current = Promise.resolve()
      return undefined
    }

    let cancelled = false
    let resolveGate
    reconcileGateRef.current = new Promise((resolve) => {
      resolveGate = resolve
    })

    pullWorkspace(user.id, workspaceId)
      .then((record) => {
        if (cancelled) return
        if (!record) {
          knownVersionRef.current = null
          return
        }

        knownVersionRef.current = Number.isFinite(record.version) ? record.version : null

        try {
          const localSnap = captureSnapshotRef.current?.()
          const localStr = serializeState(localSnap)
          const cloudStr = record.data ? serializeState(record.data) : null

          if (cloudStr === localStr) {
            // Already identical — suppress the redundant mount-time push.
            lastPushedSnapshotRef.current = localStr
            pendingChangeRef.current = false
            setLastSyncedAt(record.syncedAt ? Date.parse(record.syncedAt) : Date.now())
            safeSetStatus('idle')
            return
          }

          const localMeta = getLastPushMeta(workspaceId)
          const localTime = localMeta?.at ?? 0
          const cloudTime = record.syncedAt ? Date.parse(record.syncedAt) : 0

          if (record.data && cloudTime > localTime) {
            // Cloud is strictly newer than anything this device pushed.
            // adoptRemoteData backs up any unsynced local edits first.
            adoptRemoteData(record.data, record.version)
            safeSetStatus('idle')
            safeSetError(null)
          }
          // else: local is newer or equal precedence — leave it; the
          // debounced push runs version-protected against knownVersion.
        } catch {
          // Reconciliation is best-effort; local-first behavior continues.
        }
      })
      .catch(() => {
        // Offline/unreachable — stay fully local; pushes handle retries.
      })
      .finally(() => resolveGate())

    return () => {
      cancelled = true
    }
  }, [user, workspaceId, adoptRemoteData, safeSetStatus, safeSetError])

  // ─── Realtime remote updates from other devices/tabs ─────────────
  useEffect(() => {
    if (!user || !isSupabaseConfigured() || !supabase?.channel || !workspaceId) return undefined

    const channel = supabase
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
          if (!payload?.new?.data) return
          const remoteStr = serializeState(payload.new.data)

          // Ignore echoes of our own writes (in-flight or already synced).
          if (
            remoteStr === lastPushedSnapshotRef.current ||
            remoteStr === inFlightSnapshotRef.current
          ) {
            return
          }

          const localCurrent = captureSnapshotRef.current?.()

          if (pendingChangeRef.current && localCurrent) {
            // Local unsynced edits exist — never silently drop them.
            // Back them up and let the server arbitrate via the next
            // version-checked push (conflict path preserves the local copy).
            saveConflictBackup(workspaceId, localCurrent)
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
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

    return () => {
      supabase.removeChannel?.(channel)
    }
  }, [user, workspaceId, adoptRemoteData, performPush])

  // ─── Online/offline transitions ──────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      safeSetStatus('idle')
      safeSetError(null)
      retryCountRef.current = 0
      syncNow()
    }

    const handleOffline = () => {
      safeSetStatus('offline')
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncNow, safeSetStatus, safeSetError])

  // ─── Flush pending changes when leaving / hiding the page ────────
  useEffect(() => {
    const flushPending = () => {
      if (!user || !isSupabaseConfigured() || !pendingChangeRef.current) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      const snapshot = captureSnapshotRef.current?.()
      if (!snapshot) return
      const serialized = serializeState(snapshot)
      if (serialized === lastPushedSnapshotRef.current) {
        pendingChangeRef.current = false
        return
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      // Best-effort fire-and-forget: localStorage already holds the data;
      // if the request dies with the page, reconnect reconcile resolves it.
      performPush()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPending()
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', flushPending)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', flushPending)
    }
  }, [user, performPush])

  // ─── Cleanup: flush on unmount (e.g. workspace switch) ───────────
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)

      // Best-effort immediate flush of unsynced edits when the engine
      // unmounts (workspace switch / logout). Refs still hold the old
      // workspace's state at cleanup time, which is exactly what we want.
      if (
        user &&
        isSupabaseConfigured() &&
        pendingChangeRef.current &&
        typeof navigator !== 'undefined' &&
        navigator.onLine
      ) {
        const snapshot = captureSnapshotRef.current?.()
        if (snapshot && serializeState(snapshot) !== lastPushedSnapshotRef.current) {
          pushWorkspace(user.id, workspaceId, snapshot, {
            expectedVersion: knownVersionRef.current,
            workspaceName: workspaceNameRef.current,
          }).catch(() => {})
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaceId])

  return {
    syncStatus,
    lastSyncedAt,
    syncError,
    syncNow,
    pullFromCloud,
    notifyChange,
  }
}
