import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  enqueuePendingWorkspaceDelete,
  flushPendingWorkspaceDeletes,
  readPendingWorkspaceDeletes,
} from './pendingWorkspaceDeletes'

describe('pending workspace deletes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps pending deletions isolated by user account', async () => {
    enqueuePendingWorkspaceDelete('user-a', 'ws-a')
    enqueuePendingWorkspaceDelete('user-b', 'ws-b')
    const deleteCloudWorkspace = vi.fn().mockResolvedValue(undefined)

    await flushPendingWorkspaceDeletes('user-a', deleteCloudWorkspace)

    expect(deleteCloudWorkspace).toHaveBeenCalledWith('user-a', 'ws-a')
    expect(deleteCloudWorkspace).not.toHaveBeenCalledWith('user-b', 'ws-b')
    expect(readPendingWorkspaceDeletes('user-b')).toEqual([{ userId: 'user-b', workspaceId: 'ws-b' }])
  })

  it('preserves a deletion queued while an earlier flush is in flight', async () => {
    enqueuePendingWorkspaceDelete('user-a', 'ws-a')
    let resolveDelete
    const deleteCloudWorkspace = vi.fn(() => new Promise((resolve) => { resolveDelete = resolve }))

    const flushing = flushPendingWorkspaceDeletes('user-a', deleteCloudWorkspace)
    enqueuePendingWorkspaceDelete('user-a', 'ws-b')
    resolveDelete()
    await flushing

    expect(readPendingWorkspaceDeletes('user-a')).toEqual([{ userId: 'user-a', workspaceId: 'ws-b' }])
  })
})
