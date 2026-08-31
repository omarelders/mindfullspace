import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { createSyncEngine } from './useSyncEngine'
import * as cloudDb from '../lib/cloudDb'

let realtimeCallback = null
const mockSubscribe = vi.fn()
const mockRemoveChannel = vi.fn()

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    channel: (name) => ({
      on: (type, filter, callback) => {
        realtimeCallback = callback
        return {
          subscribe: () => {
            mockSubscribe()
            return { unsubscribe: vi.fn() }
          },
        }
      },
    }),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}))

describe('useSyncEngine', () => {
  let pushSpy
  let pullSpy
  let backupSpy
  let metaSpy
  let activeDisposables = []

  // Solid replacement for renderHook: run the factory inside a root and
  // expose the engine object (its getters read signals live).
  function mountEngine(options) {
    let engine
    const dispose = createRoot((d) => {
      engine = createSyncEngine(options)
      return d
    })
    activeDisposables.push(dispose)
    return { engine, dispose }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    window.localStorage.clear()
    realtimeCallback = null
    activeDisposables = []

    pushSpy = vi.spyOn(cloudDb, 'pushWorkspace')
    pullSpy = vi.spyOn(cloudDb, 'pullWorkspace')
    backupSpy = vi.spyOn(cloudDb, 'saveConflictBackup').mockImplementation(() => 'backup-key')
    metaSpy = vi.spyOn(cloudDb, 'getLastPushMeta').mockReturnValue(null)

    // Defaults: Mock that the cloud already has a record so reconcile doesn't auto-initialize.
    pullSpy.mockResolvedValue({ version: 1, data: {} })
    pushSpy.mockResolvedValue({ success: true, version: 1 })
  })

  afterEach(() => {
    for (const dispose of activeDisposables) dispose()
    activeDisposables = []
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const mockUser = { id: 'u-sync-1', email: 'sync@example.com' }
  const mockSnapshot = { columns: [{ id: 'col-1', items: [] }] }

  it('debounces local state changes and pushes to cloud', async () => {
    const { engine } = mountEngine({
      workspaceId: 'ws-1',
      captureSnapshot: () => mockSnapshot,
      user: mockUser,
      debounceMs: 1000,
    })

    await vi.advanceTimersByTimeAsync(0) // let mount reconciliation settle
    expect(engine.syncStatus).toBe('idle')

    engine.notifyChange()

    await vi.advanceTimersByTimeAsync(500)
    expect(pushSpy).not.toHaveBeenCalled()

    // Another rapid change resets the timer
    engine.notifyChange()
    await vi.advanceTimersByTimeAsync(500)
    expect(pushSpy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)

    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(engine.syncStatus).toBe('idle')
    expect(engine.lastSyncedAt).toBeTruthy()
  })

  it('sends the known cloud version as expectedVersion (optimistic locking)', async () => {
    pullSpy.mockResolvedValue({
      data: null,
      version: 7,
      syncedAt: new Date().toISOString(),
    })
    pushSpy.mockResolvedValue({ success: true, version: 8 })

    const { engine } = mountEngine({
      workspaceId: 'ws-ol',
      captureSnapshot: () => ({ columns: [] }),
      user: mockUser,
      debounceMs: 100,
    })

    // Reconcile learns cloud version 7 even without adopting data.
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)

    engine.notifyChange()
    await vi.advanceTimersByTimeAsync(200)

    expect(pushSpy).toHaveBeenCalledWith(
      'u-sync-1',
      'ws-ol',
      expect.anything(),
      expect.objectContaining({ expectedVersion: 7 })
    )
  })

  it('manual syncNow executes immediately', async () => {
    const { engine } = mountEngine({
      workspaceId: 'ws-1',
      captureSnapshot: () => mockSnapshot,
      user: mockUser,
    })
    await vi.advanceTimersByTimeAsync(0)

    const success = await engine.syncNow()
    expect(success).toBe(true)

    expect(pushSpy).toHaveBeenCalledTimes(1)
  })

  it('pulls workspace from cloud and invokes callback', async () => {
    const onLoaded = vi.fn()
    const pulledData = { columns: [{ id: 'col-pulled', items: [] }] }

    pullSpy.mockResolvedValue({
      data: pulledData,
      version: 5,
      syncedAt: '2026-08-23T12:00:00Z',
    })

    const { engine } = mountEngine({
      workspaceId: 'ws-1',
      captureSnapshot: () => mockSnapshot,
      user: mockUser,
      onRemoteWorkspaceLoaded: onLoaded,
    })

    const data = await engine.pullFromCloud()
    expect(data).toEqual(pulledData)

    expect(onLoaded).toHaveBeenCalledWith(pulledData)
    expect(engine.syncStatus).toBe('idle')
  })

  it('handles push error and schedules capped retries with backoff', async () => {
    pushSpy.mockRejectedValueOnce(new Error('Network error'))

    const { engine } = mountEngine({
      workspaceId: 'ws-1',
      captureSnapshot: () => mockSnapshot,
      user: mockUser,
      debounceMs: 500,
    })
    await vi.advanceTimersByTimeAsync(0)

    engine.notifyChange()

    await vi.advanceTimersByTimeAsync(500)

    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(engine.syncStatus).toBe('error')

    // Retry fires after the first backoff step (1s)
    pushSpy.mockResolvedValueOnce({ success: true, version: 1 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(pushSpy).toHaveBeenCalledTimes(2)
    expect(engine.syncStatus).toBe('idle')
  })

  it('stops auto-retrying after the cap and explains how to recover', async () => {
    pushSpy.mockRejectedValue(new Error('Still down'))

    const { engine } = mountEngine({
      workspaceId: 'ws-retry-cap',
      captureSnapshot: () => mockSnapshot,
      user: mockUser,
      debounceMs: 100,
    })
    await vi.advanceTimersByTimeAsync(0)

    engine.notifyChange()

    for (let i = 0; i <= 5; i++) {
      await vi.advanceTimersByTimeAsync(65000)
    }

    const callsAfterCap = pushSpy.mock.calls.length
    await vi.advanceTimersByTimeAsync(600000)
    expect(pushSpy.mock.calls.length).toBe(callsAfterCap)
    expect(engine.syncError).toMatch(/sync now/i)
  })

  it('resolves a stale-write conflict by backing up local and adopting remote', async () => {
    const onLoaded = vi.fn()
    const remoteWinner = { columns: [{ id: 'from-other-device', items: [] }] }

    pushSpy.mockImplementation(async () => ({
      success: false,
      reason: 'conflict',
      cloudVersion: 9,
      cloudData: remoteWinner,
    }))

    const { engine } = mountEngine({
      workspaceId: 'ws-conflict',
      captureSnapshot: () => mockSnapshot,
      user: mockUser,
      debounceMs: 100,
      onRemoteWorkspaceLoaded: onLoaded,
    })
    await vi.advanceTimersByTimeAsync(0)

    engine.notifyChange()
    await vi.advanceTimersByTimeAsync(300)

    // Local state preserved in a conflict backup before adoption
    expect(backupSpy).toHaveBeenCalledWith('ws-conflict', mockSnapshot)
    // Remote data applied through callback and recorded as new baseline
    expect(onLoaded).toHaveBeenCalledWith(remoteWinner)
    expect(engine.syncStatus).toBe('idle')
    expect(engine.syncError).toMatch(/backed up/i)
  })

  it('flushes a pending change when the engine unmounts', async () => {
    const { engine, dispose } = mountEngine({
      workspaceId: 'ws-unmount',
      captureSnapshot: () => mockSnapshot,
      user: mockUser,
      debounceMs: 3000,
    })
    await vi.advanceTimersByTimeAsync(0)

    engine.notifyChange()
    // Only 500ms elapsed — the debounced push has NOT fired yet.
    await vi.advanceTimersByTimeAsync(500)
    expect(pushSpy).not.toHaveBeenCalled()

    dispose()
    // Unmount flush pushes immediately instead of dropping the change.
    await Promise.resolve()
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalledWith(
      'u-sync-1',
      'ws-unmount',
      expect.anything(),
      expect.objectContaining({ expectedVersion: 1 })
    )
  })

  it('receives Realtime remote updates, backs up local, and adopts remote', async () => {
    const onLoaded = vi.fn()
    const localData = { columns: [{ id: 'col-local', items: [] }] }
    const remoteData = { columns: [{ id: 'col-remote-updated', items: [] }] }

    mountEngine({
      workspaceId: 'ws-realtime-1',
      captureSnapshot: () => localData,
      user: mockUser,
      onRemoteWorkspaceLoaded: onLoaded,
    })
    await vi.advanceTimersByTimeAsync(0)

    expect(mockSubscribe).toHaveBeenCalled()
    expect(typeof realtimeCallback).toBe('function')

    realtimeCallback({
      new: {
        data: remoteData,
        version: 10,
      },
    })

    expect(onLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: [expect.objectContaining({ id: 'col-remote-updated', items: [] })],
      })
    )
    expect(backupSpy).toHaveBeenCalled()
  })

  it('runs a real two-device stale-write race against a simulated server', async () => {
    // Simulated cloud row implementing the same conditional-increment rule
    // as the push_workspace_snapshot RPC: a write carrying an
    // expectedVersion older than the current row is rejected as a conflict.
    const server = { version: 0, data: null }
    const serverPush = async (_userId, _wsId, data, opts = {}) => {
      if (server.version === 0) {
        server.version = 1
        server.data = data
        return { success: true, version: 1 }
      }
      const expected = opts.expectedVersion ?? server.version
      if (expected < server.version) {
        return {
          success: false,
          reason: 'conflict',
          cloudVersion: server.version,
          cloudData: server.data,
        }
      }
      server.version += 1
      server.data = data
      return { success: true, version: server.version }
    }

    let deviceAData = { columns: [{ id: 'A-v1' }] }
    const deviceBData = { columns: [{ id: 'B-local-edit' }] }

    let pullCallCount = 0
    let resolveBPull
    const bPullPromise = new Promise((resolve) => {
      resolveBPull = resolve
    })
    pullSpy.mockImplementation(() => {
      pullCallCount += 1
      if (pullCallCount === 1) return Promise.resolve(null) // Device A mounts on empty cloud
      return bPullPromise // Device B mounts while A's v1 is live
    })

    // Device B pushed this workspace before, more recently than A's stale
    // cloud row claims — so B keeps its local edits instead of adopting.
    metaSpy.mockImplementation((wsId) =>
      wsId === 'ws-race' ? { at: Date.now() + 100000, version: 1 } : null
    )

    // ── Device A: mounts, edits, writes v1 ──
    pushSpy.mockImplementation(serverPush)
    const deviceA = mountEngine({
      workspaceId: 'ws-race',
      captureSnapshot: () => deviceAData,
      user: mockUser,
      debounceMs: 100,
    })
    await vi.advanceTimersByTimeAsync(0) // A's reconcile -> empty cloud, immediately pushes (initializing cloud)

    await vi.advanceTimersByTimeAsync(200)
    expect(server.version).toBe(1)

    // ── Device B: mounts, learns version 1, keeps newer local edits ──
    const onBRemoteLoaded = vi.fn()
    const deviceB = mountEngine({
      workspaceId: 'ws-race',
      captureSnapshot: () => deviceBData,
      user: mockUser,
      debounceMs: 100,
      onRemoteWorkspaceLoaded: onBRemoteLoaded,
    })

    resolveBPull({
      data: deviceAData,
      version: 1,
      syncedAt: new Date().toISOString(),
    })
    await vi.advanceTimersByTimeAsync(0)

    // ── Device A writes again (v2) while B is still editing locally ──
    deviceAData = { columns: [{ id: 'A-v2' }] }
    deviceA.engine.notifyChange()
    await vi.advanceTimersByTimeAsync(300)
    expect(server.version).toBe(2)

    // ── Device B attempts its write using stale information (v1) ──
    deviceB.engine.notifyChange()
    await vi.advanceTimersByTimeAsync(300)

    // Server rejected B's stale write and kept A's newest data…
    expect(server.version).toBe(2)
    expect(server.data.columns[0].id).toBe('A-v2')

    // …while B preserved its local copy as a conflict backup and adopted
    // the remote winner instead of silently destroying either side.
    expect(backupSpy).toHaveBeenCalledWith('ws-race', deviceBData)
    expect(onBRemoteLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: [expect.objectContaining({ id: 'A-v2' })],
      })
    )
    expect(deviceB.engine.syncStatus).toBe('idle')
    expect(deviceB.engine.syncError).toMatch(/backed up/i)
  })

  it('dynamically resolves late-loading auth and begins sync when user logs in', async () => {
    const [currentUser, setCurrentUser] = createSignal(null)
    pushSpy.mockResolvedValue({ success: true, version: 1 })
    pullSpy.mockResolvedValue(null)

    const { engine } = mountEngine({
      workspaceId: 'ws-late-auth',
      captureSnapshot: () => ({ columns: [{ id: 'local-1' }] }),
      getUser: currentUser,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(pullSpy).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()

    // Auth resolves asynchronously
    setCurrentUser({ id: 'user-late' })
    await vi.advanceTimersByTimeAsync(0)

    expect(pullSpy).toHaveBeenCalledWith('user-late', 'ws-late-auth')
    expect(pushSpy).toHaveBeenCalledWith(
      'user-late',
      'ws-late-auth',
      expect.objectContaining({ columns: [{ id: 'local-1' }] }),
      expect.anything()
    )
  })

  it('aborts reconciliation without overwriting cloud when pullWorkspace throws an error', async () => {
    pullSpy.mockRejectedValue(new Error('500 Internal Server Error'))
    pushSpy.mockResolvedValue({ success: true, version: 1 })

    const { engine } = mountEngine({
      workspaceId: 'ws-error-guard',
      captureSnapshot: () => ({ columns: [{ id: 'local-snap' }] }),
      user: { id: 'user-1' },
    })

    engine.notifyChange()
    await vi.advanceTimersByTimeAsync(3500)

    // Reconcile failed due to server error: status must be error, and it must NOT perform an initial push
    expect(engine.syncStatus).toBe('error')
    expect(engine.syncError).toMatch(/500 Internal Server Error/)
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('cancels a pending retry when the authenticated user changes', async () => {
    const [currentUser, setCurrentUser] = createSignal({ id: 'user-a' })
    pullSpy.mockResolvedValue({
      version: 1,
      data: { columns: [] },
      syncedAt: new Date().toISOString(),
    })
    pushSpy.mockRejectedValue(new Error('temporary failure'))

    const { engine } = mountEngine({
      workspaceId: 'ws-account-switch',
      captureSnapshot: () => ({ columns: [{ id: 'user-a-local' }] }),
      getUser: currentUser,
      debounceMs: 100,
    })

    await vi.advanceTimersByTimeAsync(0)
    engine.notifyChange()
    await vi.advanceTimersByTimeAsync(100)
    expect(pushSpy).toHaveBeenCalledWith('user-a', 'ws-account-switch', expect.anything(), expect.anything())

    setCurrentUser({ id: 'user-b' })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)

    expect(pushSpy).not.toHaveBeenCalledWith('user-b', 'ws-account-switch', expect.anything(), expect.anything())
  })

  it('does not initialize a new empty account from the old in-memory board', async () => {
    const [currentUser, setCurrentUser] = createSignal({ id: 'user-a' })
    pullSpy
      .mockResolvedValueOnce({
        version: 1,
        data: { columns: [] },
        syncedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce(null)
    pushSpy.mockResolvedValue({ success: true, version: 1 })

    const { engine } = mountEngine({
      workspaceId: 'ws-account-switch-empty',
      captureSnapshot: () => ({ columns: [{ id: 'user-a-local' }] }),
      getUser: currentUser,
      debounceMs: 100,
    })

    await vi.advanceTimersByTimeAsync(0)
    setCurrentUser({ id: 'user-b' })
    await vi.advanceTimersByTimeAsync(0)
    engine.notifyChange()
    await vi.advanceTimersByTimeAsync(3500)

    expect(pushSpy).not.toHaveBeenCalledWith(
      'user-b',
      'ws-account-switch-empty',
      expect.anything(),
      expect.anything()
    )
  })
})
