import { fetchCloudWorkspaces, pullWorkspace, pushWorkspace, syncWorkspaceList } from './cloudDb'
import { syncAllLocalImages, downloadMissingImages } from './imageSync'
import {
  readJsonStorage,
  writeJsonStorage,
  getInitialAppState,
  getInitialWorkspaceState,
} from '../utils/storage'
import {
  APP_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY_PREFIX,
  INITIAL_COLUMNS,
  NOTE_TEXT,
} from '../utils/constants'
import { saveConflictBackup, pruneConflictBackups, getLastPushMeta } from './cloudDb'

const MIGRATION_MARKER_PREFIX = 'mindfulspace-migration-done:'

/**
 * Checks if a workspace state has user-created or modified data.
 * Pristine empty boards (or standard unedited templates) return false.
 */
export function hasMeaningfulWorkspaceData(state) {
  if (!state || typeof state !== 'object') return false

  // Check collections with 0 initial items
  const zeroInitialKeys = [
    'singleNotes',
    'counters',
    'stopwatches',
    'calendars',
    'habits',
    'pictures',
    'quickLinks',
    'quotes',
    'archivedCards',
  ]

  for (const key of zeroInitialKeys) {
    if (Array.isArray(state[key]) && state[key].length > 0) {
      return true
    }
  }

  // Check custom notes (default template has 1 note with NOTE_TEXT)
  if (Array.isArray(state.notes)) {
    if (state.notes.length > 1) return true
    if (state.notes.length === 1 && state.notes[0].text !== NOTE_TEXT) return true
  }

  // Check columns / todos
  if (Array.isArray(state.columns)) {
    if (state.columns.length !== INITIAL_COLUMNS.length) return true
    // Check if any item completed status was changed or text added
    const totalItems = state.columns.reduce((sum, col) => sum + (col.items?.length || 0), 0)
    const initialItemCount = INITIAL_COLUMNS.reduce((sum, col) => sum + (col.items?.length || 0), 0)
    if (totalItems !== initialItemCount) return true
  }

  return false
}

/**
 * Checks if the entire local app state has meaningful data across any workspace.
 */
export function hasMeaningfulLocalData(workspaces) {
  if (!Array.isArray(workspaces) || workspaces.length === 0) return false

  // If user created multiple workspaces, that's meaningful data
  if (workspaces.length > 1) return true

  // If the single workspace has a custom name (not "Welcome 👋")
  if (workspaces[0].name !== 'Welcome 👋') return true

  // Check if the single workspace content is modified
  const wsState = readJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${workspaces[0].id}`)
  return hasMeaningfulWorkspaceData(wsState)
}

// ─── Once-per-login marker ───────────────────────────────────────
// Session restores (page reloads) must NOT rerun heavy migration:
// a quick reload within the sync debounce window would let the cloud
// overwrite edits that were never pushed yet.

export function hasMigrationCompleted(userId) {
  if (!userId) return false
  try {
    return Boolean(window.localStorage.getItem(`${MIGRATION_MARKER_PREFIX}${userId}`))
  } catch {
    return false
  }
}

function markMigrationCompleted(userId) {
  try {
    window.localStorage.setItem(
      `${MIGRATION_MARKER_PREFIX}${userId}`,
      JSON.stringify({ at: Date.now() })
    )
  } catch {
    // Non-fatal; worst case migration runs once more next login.
  }
}

/**
 * Migrates all local workspaces and images to the user's Supabase account.
 */
export async function migrateGuestToCloud(userId, onProgress = null) {
  const localAppState = getInitialAppState()
  const localWorkspaces = localAppState.workspaces || []
  if (localWorkspaces.length === 0) return

  // 1. Sync workspace registry
  await syncWorkspaceList(userId, localWorkspaces)

  // 2. Push data snapshot and images for each workspace
  for (let i = 0; i < localWorkspaces.length; i++) {
    const ws = localWorkspaces[i]
    const storageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${ws.id}`
    const wsState = readJsonStorage(storageKey) || getInitialWorkspaceState(ws.id)

    if (wsState) {
      // workspaceName lets the server-side RPC create the parent registry
      // row atomically (prevents FK violations on first-ever pushes).
      await pushWorkspace(userId, ws.id, wsState, { workspaceName: ws.name })
      await syncAllLocalImages(userId, wsState)
    }

    onProgress?.(i + 1, localWorkspaces.length)
  }
}

/**
 * Pulls all workspaces and images from Supabase to the local client.
 */
export async function pullAllFromCloud(userId, onWorkspaceListLoaded = null) {
  const cloudWorkspaces = await fetchCloudWorkspaces(userId)
  if (!cloudWorkspaces || cloudWorkspaces.length === 0) return []

  const formattedWorkspaces = cloudWorkspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
  }))

  // 1. Save workspace list to local storage
  writeJsonStorage(APP_STORAGE_KEY, {
    workspaces: formattedWorkspaces,
    activeWorkspaceId: formattedWorkspaces[0].id,
  })

  // 2. Pull data snapshots and images for each workspace
  for (const ws of formattedWorkspaces) {
    const storageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${ws.id}`
    const existingLocal = readJsonStorage(storageKey)

    // Preserve any meaningful local content before it gets overwritten.
    if (existingLocal && hasMeaningfulWorkspaceData(existingLocal)) {
      saveConflictBackup(ws.id, existingLocal)
    }

    const cloudRecord = await pullWorkspace(userId, ws.id)
    if (cloudRecord?.data) {
      writeJsonStorage(storageKey, cloudRecord.data)
      await downloadMissingImages(userId, cloudRecord.data)
    }
  }

  // 3. Notify React state handler without page reload
  onWorkspaceListLoaded?.(formattedWorkspaces, formattedWorkspaces[0].id)

  return formattedWorkspaces
}

/**
 * Resolves one colliding workspace ID (exists locally AND in the cloud).
 *
 * Policy: newest-wins by comparing the local device's last confirmed
 * push time against the cloud row's synced_at timestamp, with an
 * automatic local backup whenever the cloud side takes over.
 *   - Local never pushed (guest-era content) OR pushed more recently
 *     than the cloud write → PUSH the local copy (version-checked).
 *   - Cloud was written more recently → back up local, adopt cloud.
 *
 * @returns {'local'|'cloud'} which side won
 */
async function resolveCollidingWorkspace(userId, localWs, cloudRecord) {
  const storageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${localWs.id}`
  const localState = readJsonStorage(storageKey)
  if (!localState) return 'cloud'

  const localMeta = getLastPushMeta(localWs.id)
  const localTime = localMeta?.at ?? 0
  const cloudTime = cloudRecord?.syncedAt ? Date.parse(cloudRecord.syncedAt) : 0

  if (!localMeta || localTime >= cloudTime) {
    // Local is newer (or this device never pushed it — guest-era content).
    // The version check makes this safe: if another device wrote since our
    // last knowledge, the server rejects and we fall back to adopting.
    const result = await pushWorkspace(userId, localWs.id, localState, {
      expectedVersion: cloudRecord?.version ?? null,
      workspaceName: localWs.name,
    })

    if (result?.success) {
      await syncAllLocalImages(userId, localState)
      return 'local'
    }

    if (result?.reason === 'conflict' && result.cloudData) {
      saveConflictBackup(localWs.id, localState)
      writeJsonStorage(storageKey, result.cloudData)
      await downloadMissingImages(userId, result.cloudData)
      return 'cloud'
    }

    // Network/RPC failure: keep local untouched, do not adopt anything.
    throw new Error('Collision resolution push failed')
  }

  // Cloud is strictly newer → preserve local, then adopt the cloud copy.
  saveConflictBackup(localWs.id, localState)
  writeJsonStorage(storageKey, cloudRecord.data)
  await downloadMissingImages(userId, cloudRecord.data)
  return 'cloud'
}

/**
 * Coordinates sign-in data migration / reconciliation safely.
 * Runs the full flow ONCE per user account; afterwards the sync engine's
 * mount reconciliation keeps devices fresh without destructive pulls.
 *
 * @returns {'already-migrated'|'pulled'|'migrated'|'merged'|'fresh'|undefined}
 */
export async function handleFirstSignIn(userId, onWorkspaceListLoaded = null, onProgress = null) {
  if (!userId) return

  if (hasMigrationCompleted(userId)) {
    return 'already-migrated'
  }

  try {
    const cloudWorkspaces = await fetchCloudWorkspaces(userId)
    const localAppState = getInitialAppState()
    const localWorkspaces = localAppState.workspaces || []

    const hasCloudData = Array.isArray(cloudWorkspaces) && cloudWorkspaces.length > 0
    const hasLocal = hasMeaningfulLocalData(localWorkspaces)

    if (hasCloudData && !hasLocal) {
      // Case A: Cloud has data and local is empty/pristine -> Pull cloud data
      await pullAllFromCloud(userId, onWorkspaceListLoaded)
      markMigrationCompleted(userId)
      pruneConflictBackups()
      return 'pulled'
    }

    if (!hasCloudData && hasLocal) {
      // Case B: Cloud is empty and local has meaningful data -> Migrate local to cloud
      await migrateGuestToCloud(userId, onProgress)
      markMigrationCompleted(userId)
      pruneConflictBackups()
      return 'migrated'
    }

    if (hasCloudData && hasLocal) {
      // Case C: Both have data -> merge lists, resolve ID collisions
      // newest-wins with automatic local backups (never silent loss).
      const mergedList = [...cloudWorkspaces.map((w) => ({ id: w.id, name: w.name }))]

      for (const localWs of localWorkspaces) {
        const existsInCloud = mergedList.some((entry) => entry.id === localWs.id)

        if (!existsInCloud) {
          // Local-only workspace: upload under a distinguishable name.
          const suffixedName = `${localWs.name} (Local)`
          const wsState = readJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${localWs.id}`) || getInitialWorkspaceState(localWs.id)
          if (wsState) {
            await pushWorkspace(userId, localWs.id, wsState, { workspaceName: suffixedName })
            await syncAllLocalImages(userId, wsState)
          }
          mergedList.push({ id: localWs.id, name: suffixedName })
          continue
        }

        const cloudRecord = await pullWorkspace(userId, localWs.id)
        const winner = await resolveCollidingWorkspace(userId, localWs, cloudRecord)

        if (winner === 'local') {
          // Local content (and its name) replaced the older cloud copy.
          const entry = mergedList.find((item) => item.id === localWs.id)
          if (entry) entry.name = localWs.name
        }
      }

      await syncWorkspaceList(userId, mergedList)
      onWorkspaceListLoaded?.(mergedList, mergedList[0]?.id)
      markMigrationCompleted(userId)
      pruneConflictBackups()
      return 'merged'
    }

    // Case D: Both empty -> Initialize cloud with default workspace
    await migrateGuestToCloud(userId, onProgress)
    markMigrationCompleted(userId)
    pruneConflictBackups()
    return 'fresh'
  } catch (err) {
    console.warn('[Migration] Error during sign in sync:', err.message)
    // Marker intentionally NOT written — the flow retries next login.
    throw err
  }
}
