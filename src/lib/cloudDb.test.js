import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getDeviceId,
  computeStateHash,
  pushWorkspace,
  pullWorkspace,
  ensureCloudWorkspace,
  renameCloudWorkspace,
  syncWorkspaceList,
  fetchCloudWorkspaces,
  deleteCloudWorkspace,
  recordSyncMetadata,
  saveConflictBackup,
  pruneConflictBackups,
  getLastPushMeta,
  setLastPushMeta,
  LAST_PUSH_META_PREFIX,
  CONFLICT_BACKUP_PREFIX,
} from './cloudDb'

const mockRpc = vi.fn()
const mockMaybeSingle = vi.fn()
const mockSelect = vi.fn()
const mockUpsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
let workspaceListResult = { data: [{ id: 'ws-1', name: 'Work', sort_order: 0 }], error: null }
let mockFallbackUpdateResult = { data: [{ version: 2 }], error: null }
let mockInsertResult = { error: null }

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    rpc: (...args) => mockRpc(...args),
    from: (table) => ({
      select: (...args) => {
        mockSelect(table, ...args)
        return {
          eq: (f1, v1) => {
            mockEq(f1, v1)
            return {
              eq: (f2, v2) => {
                mockEq(f2, v2)
                return {
                  maybeSingle: () => mockMaybeSingle(),
                }
              },
              maybeSingle: () => mockMaybeSingle(),
              order: (...orderArgs) => {
                mockOrder(...orderArgs)
                return Promise.resolve(workspaceListResult)
              },
            }
          },
          order: (...orderArgs) => {
            mockOrder(...orderArgs)
            return Promise.resolve(workspaceListResult)
          },
        }
      },
      upsert: (rows, options) => {
        mockUpsert(table, rows, options)
        return {
          select: () => Promise.resolve({ data: rows, error: null }),
          then: (resolve) => Promise.resolve({ error: null }).then(resolve),
          catch: (reject) => Promise.resolve({ error: null }).catch(reject),
        }
      },
      update: (patch) => {
        mockUpdate(table, patch)
        let eqCount = 0
        const query = {
          eq: (f1, v1) => {
            mockEq(f1, v1)
            eqCount += 1
            if (eqCount >= 3) {
              return {
                select: () => Promise.resolve(mockFallbackUpdateResult),
              }
            }
            if (eqCount === 2) return Promise.resolve({ error: null })
            return query
          },
        }
        return query
      },
      insert: (row) => {
        mockUpsert(table, row, { insert: true })
        return Promise.resolve(mockInsertResult)
      },
      delete: () => ({
        eq: (f1, v1) => ({
          eq: (f2, v2) => {
            mockDelete(table, f1, v1, f2, v2)
            return Promise.resolve({ error: null })
          },
        }),
      }),
    }),
  },
}))

describe('cloudDb helper functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    workspaceListResult = { data: [{ id: 'ws-1', name: 'Work', sort_order: 0 }], error: null }
    mockFallbackUpdateResult = { data: [{ version: 2 }], error: null }
    mockInsertResult = { error: null }
  })

  it('generates and persists a stable device ID in localStorage', () => {
    const id1 = getDeviceId()
    expect(id1).toBeTruthy()
    const id2 = getDeviceId()
    expect(id2).toBe(id1)
  })

  it('computes deterministic state hash', () => {
    const stateA = { columns: [{ id: 'c1', title: 'Todos' }] }
    const stateB = { columns: [{ id: 'c1', title: 'Todos' }] }
    const stateC = { columns: [{ id: 'c1', title: 'Modified' }] }

    expect(computeStateHash(stateA)).toBe(computeStateHash(stateB))
    expect(computeStateHash(stateA)).not.toBe(computeStateHash(stateC))
  })

  // ─── pushWorkspace: atomic RPC with optimistic locking ─────────

  it('rejects missing parameters without calling the RPC', async () => {
    const result = await pushWorkspace('user-1', '', { columns: [] })
    expect(result).toEqual({ success: false, reason: 'missing_parameters' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('pushes via the atomic RPC and records the last-push metadata', async () => {
    mockRpc.mockResolvedValue({
      data: [{ status: 'updated', version: 4, data: null }],
      error: null,
    })

    const result = await pushWorkspace('user-1', 'ws-1', { columns: [] }, {
      expectedVersion: 3,
      workspaceName: 'My Board',
    })

    expect(mockRpc).toHaveBeenCalledWith('push_workspace_snapshot', {
      p_workspace_id: 'ws-1',
      p_data: { columns: [] },
      p_workspace_name: 'My Board',
      p_expected_version: 3,
    })
    expect(result.success).toBe(true)
    expect(result.version).toBe(4)

    const meta = getLastPushMeta('ws-1')
    expect(meta.version).toBe(4)
    expect(meta.at).toBeGreaterThan(0)
  })

  it('returns a structured conflict result when the server rejects a stale write', async () => {
    const cloudRow = { columns: [{ id: 'left', items: [] }] }
    mockRpc.mockResolvedValue({
      data: [{ status: 'conflict', version: 9, data: cloudRow }],
      error: null,
    })

    const result = await pushWorkspace('user-1', 'ws-1', { columns: [] }, { expectedVersion: 4 })

    expect(result.success).toBe(false)
    expect(result.reason).toBe('conflict')
    expect(result.cloudVersion).toBe(9)
    // Conflict payload is validated into full workspace shape
    expect(result.cloudData.columns).toHaveLength(1)
    expect(result.cloudData.drafts).toBeDefined()
  })

  it('throws on RPC errors so callers can schedule retries', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } })
    await expect(pushWorkspace('user-1', 'ws-1', {})).rejects.toMatchObject({ message: 'network down' })
  })

  it('treats an empty RPC result as a non-success without throwing', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    const result = await pushWorkspace('user-1', 'ws-1', {})
    expect(result.success).toBe(false)
    expect(result.reason).toBe('no_result')
  })

  // ─── pullWorkspace ──────────────────────────────────────────────

  it('pulls and validates workspace snapshot', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        version: 2,
        synced_at: '2026-08-23T12:00:00Z',
        data: {
          columns: [{ id: 'left', items: [] }],
          viewport: { x: 10, y: 20, scale: 1 },
        },
      },
      error: null,
    })

    const result = await pullWorkspace('user-1', 'ws-1')

    expect(result).not.toBeNull()
    expect(result.version).toBe(2)
    expect(result.syncedAt).toBe('2026-08-23T12:00:00Z')
    expect(result.data.columns).toHaveLength(1)
    expect(result.data.viewport.x).toBe(10)
  })

  it('returns null when no cloud row exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const result = await pullWorkspace('user-1', 'ws-missing')
    expect(result).toBeNull()
  })

  it('throws on query error during pullWorkspace', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'Database connection failed' } })
    await expect(pullWorkspace('user-1', 'ws-err')).rejects.toMatchObject({
      message: 'Database connection failed',
    })
  })

  // ─── Workspace registry helpers ─────────────────────────────────

  it('ensures a parent workspace registry row exists', async () => {
    await ensureCloudWorkspace('user-1', 'ws-new', 'Fresh')
    expect(mockUpsert).toHaveBeenCalledWith(
      'workspaces',
      { id: 'ws-new', user_id: 'user-1', name: 'Fresh' },
      { onConflict: 'id,user_id' }
    )
  })

  it('renames a cloud workspace scoped to the owner', async () => {
    await renameCloudWorkspace('user-1', 'ws-1', 'Renamed')
    expect(mockUpdate).toHaveBeenCalledWith('workspaces', { name: 'Renamed' })
    expect(mockEq).toHaveBeenCalledWith('id', 'ws-1')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('syncs workspace list to cloud', async () => {
    const workspaces = [
      { id: 'ws-1', name: 'Work' },
      { id: 'ws-2', name: 'Personal' },
    ]

    const synced = await syncWorkspaceList('user-1', workspaces)

    expect(synced).toHaveLength(2)
    expect(mockUpsert).toHaveBeenCalledWith(
      'workspaces',
      [
        { id: 'ws-1', user_id: 'user-1', name: 'Work', sort_order: 0 },
        { id: 'ws-2', user_id: 'user-1', name: 'Personal', sort_order: 1 },
      ],
      { onConflict: 'id,user_id' }
    )
  })

  it('fetches ordered cloud workspaces for the owner', async () => {
    const rows = await fetchCloudWorkspaces('user-1')
    expect(rows).toHaveLength(1)
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockOrder).toHaveBeenCalledWith('sort_order', { ascending: true })
  })

  it('throws when fetching the cloud workspace list fails', async () => {
    workspaceListResult = { data: null, error: { message: 'workspace list unavailable' } }

    await expect(fetchCloudWorkspaces('user-1')).rejects.toMatchObject({
      message: 'workspace list unavailable',
    })
  })

  it('returns a conflict when a concurrent initial fallback insert wins the race', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'RPC missing' } })
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { version: 1, data: { columns: [{ id: 'remote-winner', items: [] }] } },
        error: null,
      })
    mockInsertResult = { error: { code: '23505', message: 'duplicate key value violates unique constraint' } }

    const result = await pushWorkspace('user-1', 'ws-race-insert', { columns: [] })

    expect(result).toMatchObject({
      success: false,
      reason: 'conflict',
      cloudVersion: 1,
    })
    expect(result.cloudData.columns[0].id).toBe('remote-winner')
  })

  it('deletes cloud workspace record', async () => {
    await deleteCloudWorkspace('user-1', 'ws-1')
    expect(mockDelete).toHaveBeenCalledWith('workspaces', 'id', 'ws-1', 'user_id', 'user-1')
  })

  it('records device sync metadata via upsert', async () => {
    await recordSyncMetadata('user-1')
    expect(mockUpsert).toHaveBeenCalledWith(
      'sync_metadata',
      expect.objectContaining({ user_id: 'user-1', device_id: expect.any(String) }),
      { onConflict: 'user_id,device_id' }
    )
  })

  // ─── Conflict backup storage with GC ────────────────────────────

  it('round-trips last-push metadata', () => {
    expect(getLastPushMeta('ws-none')).toBeNull()
    setLastPushMeta('ws-x', { at: 123, version: 7 })
    expect(getLastPushMeta('ws-x')).toEqual({ at: 123, version: 7 })
  })

  it('does not reuse push metadata across authenticated users', () => {
    setLastPushMeta('ws-scoped', { at: 123, version: 7, userId: 'user-a' })

    expect(getLastPushMeta('ws-scoped', 'user-a')).toEqual({
      at: 123,
      version: 7,
      userId: 'user-a',
    })
    expect(getLastPushMeta('ws-scoped', 'user-b')).toBeNull()
  })

  it('saves conflict backups and prunes beyond the retention limit', () => {
    vi.useFakeTimers()
    try {
      let t = 1000
      for (let i = 0; i < 6; i++) {
        vi.setSystemTime(t)
        t += 1000
        saveConflictBackup('ws-gc', { n: i })
      }

      const keys = Object.keys(window.localStorage).filter((k) =>
        k.startsWith(`${CONFLICT_BACKUP_PREFIX}ws-gc:`)
      )
      expect(keys).toHaveLength(3)

      // Newest backups survive (n: 3, 4, 5)
      const payloads = keys.map((k) => JSON.parse(window.localStorage.getItem(k)).n)
      expect(payloads.sort((a, b) => a - b)).toEqual([3, 4, 5])
    } finally {
      vi.useRealTimers()
    }
  })

  it('pruneConflictBackups can target all workspaces', () => {
    saveConflictBackup('ws-a', {})
    saveConflictBackup('ws-b', {})
    pruneConflictBackups(null, 0)
    const remaining = Object.keys(window.localStorage).filter((k) =>
      k.startsWith(CONFLICT_BACKUP_PREFIX)
    )
    expect(remaining).toHaveLength(0)
  })
})
