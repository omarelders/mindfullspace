import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncEngine } from './useSyncEngine'
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

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    window.localStorage.clear()
    realtimeCallback = null

    pushSpy = vi.spyOn(cloudDb, 'pushWorkspace')
    pullSpy = vi.spyOn(cloudDb, 'pullWorkspace')
    backupSpy = vi.spyOn(cloudDb, 'saveConflictBackup').mockImplementation(() => 'backup-key')
    metaSpy = vi.spyOn(cloudDb, 'getLastPushMeta').mockReturnValue(null)

    // Defaults: empty cloud — reconcile finds nothing to adopt.
    pullSpy.mockResolvedValue(null)
    pushSpy.mockResolvedValue({ success: true, version: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const mockUser = { id: 'u-sync-1', email: 'sync@example.com' }
  const mockSnapshot = { columns: [{ id: 'col-1', items: [] }] }

  it('debounces local state changes and pushes to cloud', async () => {
    const { result } = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-1',
        captureSnapshot: () => mockSnapshot,
        user: mockUser,
        debounceMs: 1000,
      })
    )

    await act(async () => {}) // let mount reconciliation settle
    expect(result.current.syncStatus).toBe('idle')

    act(() => {
      result.current.notifyChange()
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(pushSpy).not.toHaveBeenCalled()

    // Another rapid change resets the timer
    act(() => {
      result.current.notifyChange()
    })
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(pushSpy).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(result.current.syncStatus).toBe('idle')
    expect(result.current.lastSyncedAt).toBeTruthy()
  })

  it('sends the known cloud version as expectedVersion (optimistic locking)', async () => {
    pullSpy.mockResolvedValue({
      data: null,
      version: 7,
      syncedAt: new Date().toISOString(),
    })
    pushSpy.mockResolvedValue({ success: true, version: 8 })

    const { result } = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-ol',
        captureSnapshot: () => ({ columns: [] }),
        user: mockUser,
        debounceMs: 100,
      })
    )

    // Reconcile learns cloud version 7 even without adopting data.
    await act(async () => {})
    await act(async () => {})

    act(() => {
      result.current.notifyChange()
    })
    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    expect(pushSpy).toHaveBeenCalledWith(
      'u-sync-1',
      'ws-ol',
      expect.anything(),
      expect.objectContaining({ expectedVersion: 7 })
    )
  })

  it('manual syncNow executes immediately', async () => {
    const { result } = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-1',
        captureSnapshot: () => mockSnapshot,
        user: mockUser,
      })
    )
    await act(async () => {})

    await act(async () => {
      const success = await result.current.syncNow()
      expect(success).toBe(true)
    })

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

    const { result } = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-1',
        captureSnapshot: () => mockSnapshot,
        user: mockUser,
        onRemoteWorkspaceLoaded: onLoaded,
      })
    )

    await act(async () => {
      const data = await result.current.pullFromCloud()
      expect(data).toEqual(pulledData)
    })

    expect(onLoaded).toHaveBeenCalledWith(pulledData)
    expect(result.current.syncStatus).toBe('idle')
  })

  it('handles push error and schedules capped retries with backoff', async () => {
    pushSpy.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-1',
        captureSnapshot: () => mockSnapshot,
        user: mockUser,
        debounceMs: 500,
      })
    )
    await act(async () => {})

    act(() => {
      result.current.notifyChange()
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(result.current.syncStatus).toBe('error')

    // Retry fires after the first backoff step (1s)
    pushSpy.mockResolvedValueOnce({ success: true, version: 1 })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(pushSpy).toHaveBeenCalledTimes(2)
    expect(result.current.syncStatus).toBe('idle')
  })

  it('stops auto-retrying after the cap and explains how to recover', async () => {
    pushSpy.mockRejectedValue(new Error('Still down'))

    const { result } = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-retry-cap',
        captureSnapshot: () => mockSnapshot,
        user: mockUser,
        debounceMs: 100,
      })
    )
    await act(async () => {})

    act(() => {
      result.current.notifyChange()
    })

    for (let i = 0; i <= 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(65000)
      })
    }

    const callsAfterCap = pushSpy.mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(600000)
    })
    expect(pushSpy.mock.calls.length).toBe(callsAfterCap)
    expect(result.current.syncError).toMatch(/sync now/i)
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

    const { result } = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-conflict',
        captureSnapshot: () => mockSnapshot,
        user: mockUser,
        debounceMs: 100,
        onRemoteWorkspaceLoaded: onLoaded,
      })
    )
    await act(async () => {})

    act(() => {
      result.current.notifyChange()
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // Local state preserved in a conflict backup before adoption
    expect(backupSpy).toHaveBeenCalledWith('ws-conflict', mockSnapshot)
    // Remote data applied through callback and recorded as new baseline
    expect(onLoaded).toHaveBeenCalledWith(remoteWinner)
    expect(result.current.syncStatus).toBe('idle')
    expect(result.current.syncError).toMatch(/backed up/i)
  })

  it('flushes a pending change when the engine unmounts', async () => {
    const { result, unmount } = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-unmount',
        captureSnapshot: () => mockSnapshot,
        user: mockUser,
        debounceMs: 3000,
      })
    )
    await act(async () => {})

    act(() => {
      result.current.notifyChange()
    })
    // Only 500ms elapsed — the debounced push has NOT fired yet.
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(pushSpy).not.toHaveBeenCalled()

    unmount()
    // Unmount flush pushes immediately instead of dropping the change.
    await Promise.resolve()
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalledWith(
      'u-sync-1',
      'ws-unmount',
      expect.anything(),
      expect.objectContaining({ expectedVersion: null })
    )
  })

  it('receives Realtime remote updates, backs up local, and adopts remote', () => {
    const onLoaded = vi.fn()
    const localData = { columns: [{ id: 'col-local', items: [] }] }
    const remoteData = { columns: [{ id: 'col-remote-updated', items: [] }] }

    renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-realtime-1',
        captureSnapshot: () => localData,
        user: mockUser,
        onRemoteWorkspaceLoaded: onLoaded,
      })
    )

    expect(mockSubscribe).toHaveBeenCalled()
    expect(typeof realtimeCallback).toBe('function')

    act(() => {
      realtimeCallback({
        new: {
          data: remoteData,
          version: 10,
        },
      })
    })

    expect(onLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        // validateWorkspaceState normalizes column items (adds `items: []`)
        columns: [{ id: 'col-remote-updated', items: [] }],
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
    const deviceA = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-race',
        captureSnapshot: () => deviceAData,
        user: mockUser,
        debounceMs: 100,
      })
    )
    await act(async () => {}) // A's reconcile -> empty cloud

    pushSpy.mockImplementation(serverPush)
    act(() => {
      deviceA.result.current.notifyChange()
    })
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(server.version).toBe(1)

    // ── Device B: mounts, learns version 1, keeps newer local edits ──
    let resolveBPullRef = resolveBPull
    const onBRemoteLoaded = vi.fn()
    const deviceB = renderHook(() =>
      useSyncEngine({
        workspaceId: 'ws-race',
        captureSnapshot: () => deviceBData,
        user: mockUser,
        debounceMs: 100,
        onRemoteWorkspaceLoaded: onBRemoteLoaded,
      })
    )

    await act(async () => {
      resolveBPullRef({
        data: deviceAData,
        version: 1,
        syncedAt: new Date().toISOString(),
      })
    })
    await act(async () => {})

    // ── Device A writes again (v2) while B is still editing locally ──
    deviceAData = { columns: [{ id: 'A-v2' }] }
    act(() => {
      deviceA.result.current.notifyChange()
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(server.version).toBe(2)

    // ── Device B attempts its write using stale information (v1) ──
    act(() => {
      deviceB.result.current.notifyChange()
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

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
    expect(deviceB.result.current.syncStatus).toBe('idle')
    expect(deviceB.result.current.syncError).toMatch(/backed up/i)
  })
})
