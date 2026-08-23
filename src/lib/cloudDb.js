import { supabase } from './supabase'
import { validateWorkspaceState } from '../utils/storage'
import { createId } from '../utils/id'

const DEVICE_ID_KEY = 'mindfulspace-device-id'
export const LAST_PUSH_META_PREFIX = 'mindfulspace-last-push:'
export const CONFLICT_BACKUP_PREFIX = 'mindfulspace-conflict-backup:'
const MAX_CONFLICT_BACKUPS_PER_WORKSPACE = 3

export function getDeviceId() {
  if (typeof window === 'undefined') return 'server-device'
  try {
    let deviceId = window.localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = createId('dev')
      window.localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
  } catch {
    return 'fallback-device'
  }
}

export function computeStateHash(state) {
  if (!state) return ''
  try {
    const str = typeof state === 'string' ? state : JSON.stringify(state)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0 // Convert to 32bit integer
    }
    return hash.toString(36)
  } catch {
    return String(Date.now())
  }
}

// ─── Local sync metadata (per device) ────────────────────────────

export function getLastPushMeta(workspaceId) {
  if (!workspaceId || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`${LAST_PUSH_META_PREFIX}${workspaceId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setLastPushMeta(workspaceId, meta) {
  if (!workspaceId || typeof window === 'undefined' || !meta) return
  try {
    window.localStorage.setItem(
      `${LAST_PUSH_META_PREFIX}${workspaceId}`,
      JSON.stringify(meta)
    )
  } catch {
    // Non-fatal metadata write.
  }
}

// ─── Conflict backup storage (data preservation before overwrites) ──

export function saveConflictBackup(workspaceId, snapshot) {
  if (!workspaceId || !snapshot || typeof window === 'undefined') return null
  try {
    const key = `${CONFLICT_BACKUP_PREFIX}${workspaceId}:${Date.now()}`
    window.localStorage.setItem(key, JSON.stringify(snapshot))
    pruneConflictBackups(workspaceId)
    return key
  } catch {
    return null
  }
}

export function pruneConflictBackups(workspaceId = null, keepPerWorkspace = MAX_CONFLICT_BACKUPS_PER_WORKSPACE) {
  if (typeof window === 'undefined') return
  try {
    const byWorkspace = new Map()
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(CONFLICT_BACKUP_PREFIX)) continue
      const rest = key.slice(CONFLICT_BACKUP_PREFIX.length)
      const separatorIndex = rest.lastIndexOf(':')
      if (separatorIndex <= 0) continue
      const wsId = rest.slice(0, separatorIndex)
      const ts = Number(rest.slice(separatorIndex + 1)) || 0
      if (workspaceId && wsId !== workspaceId) continue
      if (!byWorkspace.has(wsId)) byWorkspace.set(wsId, [])
      byWorkspace.get(wsId).push({ key, ts })
    }

    for (const entries of byWorkspace.values()) {
      entries.sort((a, b) => b.ts - a.ts)
      entries.slice(keepPerWorkspace).forEach((entry) => {
        try { window.localStorage.removeItem(entry.key) } catch { /* ignore */ }
      })
    }
  } catch {
    // Best-effort GC only.
  }
}

// ─── Workspace data push/pull ────────────────────────────────────

/**
 * Push a workspace snapshot to the cloud through the atomic
 * push_workspace_snapshot RPC (real optimistic locking).
 *
 * @param {string} userId
 * @param {string} workspaceId
 * {Object} options
 * @param {number|null} options.expectedVersion  Last cloud version this client
 *   knows about. NULL forces last-write-wins (first push / no knowledge).
 *   A stale value makes the server return a conflict instead of overwriting.
 * @param {string|null} options.workspaceName   Used to create the parent
 *   workspaces registry row on first push (prevents FK violations).
 *
 * Resolves:
 *   { success: true, version }                       on insert/update
 *   { success: false, reason: 'conflict',
 *     cloudVersion, cloudData }                      stale write rejected
 *   { success: false, reason: 'missing_parameters' }
 * Throws on network/RPC errors (caller schedules retry).
 */
export async function pushWorkspace(userId, workspaceId, workspaceData, {
  expectedVersion = null,
  workspaceName = null,
} = {}) {
  if (!supabase || !userId || !workspaceId || !workspaceData) {
    return { success: false, reason: 'missing_parameters' }
  }

  const { data, error } = await supabase.rpc('push_workspace_snapshot', {
    p_workspace_id: workspaceId,
    p_data: workspaceData,
    p_workspace_name: workspaceName,
    p_expected_version: expectedVersion,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return { success: false, reason: 'no_result' }
  }

  if (row.status === 'conflict') {
    return {
      success: false,
      reason: 'conflict',
      cloudVersion: row.version ?? null,
      // Validate here so callers can adopt it directly.
      cloudData: row.data ? validateWorkspaceState(row.data) : null,
    }
  }

  const newVersion = Number(row.version) || null

  // Record local push time — used by migration and mount reconciliation
  // to decide which side is newer without extra server round-trips.
  setLastPushMeta(workspaceId, { at: Date.now(), version: newVersion })

  recordSyncMetadata(userId).catch(() => {})

  return {
    success: true,
    version: newVersion,
    syncedAt: new Date().toISOString(),
  }
}

export async function pullWorkspace(userId, workspaceId) {
  if (!supabase || !userId || !workspaceId) return null

  const { data, error } = await supabase
    .from('workspace_data')
    .select('data, version, synced_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  return {
    data: data.data ? validateWorkspaceState(data.data) : null,
    version: data.version,
    syncedAt: data.synced_at,
  }
}

// ─── Workspace registry list ─────────────────────────────────────

export async function ensureCloudWorkspace(userId, workspaceId, name = 'Workspace') {
  if (!supabase || !userId || !workspaceId) return
  const { error } = await supabase
    .from('workspaces')
    .upsert(
      { id: workspaceId, user_id: userId, name: name || 'Workspace' },
      { onConflict: 'id,user_id' }
    )
  if (error) throw error
}

export async function renameCloudWorkspace(userId, workspaceId, name) {
  if (!supabase || !userId || !workspaceId || !name) return
  const { error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', workspaceId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function syncWorkspaceList(userId, workspaces) {
  if (!supabase || !userId || !Array.isArray(workspaces) || workspaces.length === 0) return []

  const rows = workspaces.map((ws, idx) => ({
    id: ws.id,
    user_id: userId,
    name: ws.name || 'Workspace',
    sort_order: idx,
  }))

  const { data, error } = await supabase
    .from('workspaces')
    .upsert(rows, { onConflict: 'id,user_id' })
    .select('id, name, sort_order')

  if (error) throw error
  return data || rows
}

export async function fetchCloudWorkspaces(userId) {
  if (!supabase || !userId) return []

  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

export async function deleteCloudWorkspace(userId, workspaceId) {
  if (!supabase || !userId || !workspaceId) return

  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId)
    .eq('user_id', userId)

  // The FK cascade removes the workspace_data row; the images registry
  // row and its Storage object are intentionally left for v1 (documented
  // limitation) because image references may still exist in other
  // snapshots on other devices.
  if (error) console.warn('[CloudDb] Cloud workspace delete failed:', error.message)
}

export async function recordSyncMetadata(userId) {
  if (!supabase || !userId) return

  const deviceId = getDeviceId()
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'

  const { error } = await supabase
    .from('sync_metadata')
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        last_sync_at: new Date().toISOString(),
        user_agent: userAgent,
      },
      {
        onConflict: 'user_id,device_id',
      }
    )

  if (error) throw error
}
