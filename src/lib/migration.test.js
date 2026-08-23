import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hasMeaningfulWorkspaceData,
  hasMeaningfulLocalData,
  migrateGuestToCloud,
  pullAllFromCloud,
  handleFirstSignIn,
} from './migration'
import * as cloudDb from './cloudDb'
import * as imageSync from './imageSync'
import { NOTE_TEXT, INITIAL_COLUMNS } from '../utils/constants'

const MIGRATION_MARKER_PREFIX = 'mindfulspace-migration-done:'

describe('migration module', () => {
  let pushSpy
  let pullSpy
  let backupSpy
  let metaSpy

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()

    pushSpy = vi.spyOn(cloudDb, 'pushWorkspace').mockResolvedValue({ success: true, version: 1 })
    pullSpy = vi.spyOn(cloudDb, 'pullWorkspace')
    backupSpy = vi.spyOn(cloudDb, 'saveConflictBackup').mockImplementation(() => 'backup-key')
    metaSpy = vi.spyOn(cloudDb, 'getLastPushMeta').mockReturnValue(null)
    vi.spyOn(cloudDb, 'pruneConflictBackups').mockImplementation(() => {})
    vi.spyOn(cloudDb, 'syncWorkspaceList').mockResolvedValue([])
  })

  it('detects pristine unedited workspace state correctly', () => {
    const pristineState = {
      columns: INITIAL_COLUMNS.map((c) => ({ ...c, items: [...c.items] })),
      notes: [{ id: 'note', text: NOTE_TEXT }],
      pictures: [],
      habits: [],
      timers: [{ id: 'timer', initialSeconds: 2700, remainingSeconds: 2700 }],
      counters: [],
      stopwatches: [],
      calendars: [],
      quickLinks: [],
      quotes: [],
      singleNotes: [],
      archivedCards: [],
    }

    expect(hasMeaningfulWorkspaceData(pristineState)).toBe(false)
  })

  it('identifies custom cards as meaningful workspace data', () => {
    const stateWithHabit = { habits: [{ id: 'h-1', title: 'Exercise' }] }
    expect(hasMeaningfulWorkspaceData(stateWithHabit)).toBe(true)

    const stateWithPicture = { pictures: [{ id: 'p-1', imageId: 'img-1' }] }
    expect(hasMeaningfulWorkspaceData(stateWithPicture)).toBe(true)

    const stateWithCustomNote = { notes: [{ id: 'n-1', text: 'My secret notes' }] }
    expect(hasMeaningfulWorkspaceData(stateWithCustomNote)).toBe(true)
  })

  it('identifies multiple workspaces as meaningful local data', () => {
    const workspaces = [
      { id: 'ws-1', name: 'Welcome 👋' },
      { id: 'ws-2', name: 'Second Board' },
    ]
    expect(hasMeaningfulLocalData(workspaces)).toBe(true)
  })

  it('Case A: pulls from cloud when cloud has data and local is empty', async () => {
    vi.spyOn(cloudDb, 'fetchCloudWorkspaces').mockResolvedValue([
      { id: 'ws-cloud-1', name: 'Cloud Space', sort_order: 0 },
    ])
    pullSpy.mockResolvedValue({
      data: { columns: [] },
      version: 1,
      syncedAt: '2026-08-23T12:00:00Z',
    })
    vi.spyOn(imageSync, 'downloadMissingImages').mockResolvedValue(true)

    const onLoaded = vi.fn()
    await handleFirstSignIn('user-case-a', onLoaded)

    expect(onLoaded).toHaveBeenCalledWith(
      [{ id: 'ws-cloud-1', name: 'Cloud Space' }],
      'ws-cloud-1'
    )
  })

  it('Case B: migrates local data to cloud when cloud is empty and local has cards', async () => {
    vi.spyOn(cloudDb, 'fetchCloudWorkspaces').mockResolvedValue([])
    const syncListSpy = vi.spyOn(cloudDb, 'syncWorkspaceList')
    vi.spyOn(imageSync, 'syncAllLocalImages').mockResolvedValue(true)

    window.localStorage.setItem(
      'mindful-space.app.v1',
      JSON.stringify({
        workspaces: [{ id: 'ws-custom', name: 'Personal Tasks' }],
        activeWorkspaceId: 'ws-custom',
      })
    )
    window.localStorage.setItem(
      'mindful-space.workspace.v1:ws-custom',
      JSON.stringify({
        habits: [{ id: 'h1', title: 'Gym' }],
      })
    )

    await handleFirstSignIn('user-case-b')

    expect(syncListSpy).toHaveBeenCalled()
    expect(pushSpy).toHaveBeenCalled()
    // Completion marker written so reloads never re-run heavy migration.
    expect(window.localStorage.getItem(`${MIGRATION_MARKER_PREFIX}user-case-b`)).toBeTruthy()
  })

  it('skips the heavy flow entirely when migration already completed for the user', async () => {
    const fetchSpy = vi
      .spyOn(cloudDb, 'fetchCloudWorkspaces')
      .mockResolvedValue([{ id: 'ws-x', name: 'X' }])

    window.localStorage.setItem(`${MIGRATION_MARKER_PREFIX}user-done`, '{"at":123}')

    const outcome = await handleFirstSignIn('user-done')

    expect(outcome).toBe('already-migrated')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Case C collision: cloud newer -> backs up local board, then adopts cloud copy', async () => {
    const cloudBoard = {
      habits: [{ id: 'from-cloud', title: 'Cloud Habit' }],
    }

    vi.spyOn(cloudDb, 'fetchCloudWorkspaces').mockResolvedValue([
      { id: 'ws-shared', name: 'Shared Board', sort_order: 0 },
    ])
    pullSpy.mockResolvedValue({
      data: cloudBoard,
      version: 8,
      syncedAt: new Date().toISOString(),
    })
    vi.spyOn(imageSync, 'downloadMissingImages').mockResolvedValue(true)

    window.localStorage.setItem(
      'mindful-space.app.v1',
      JSON.stringify({
        workspaces: [{ id: 'ws-shared', name: 'Shared Board' }],
        activeWorkspaceId: 'ws-shared',
      })
    )
    const localBoard = { habits: [{ id: 'local-only', title: 'Guest Work' }] }
    window.localStorage.setItem('mindful-space.workspace.v1:ws-shared', JSON.stringify(localBoard))

    // This device last pushed BEFORE the cloud row was written — the cloud
    // copy is strictly newer, so the policy adopts it (with local backup).
    metaSpy.mockImplementation((wsId) =>
      wsId === 'ws-shared' ? { at: Date.parse('2026-01-01T00:00:00Z'), version: 6 } : null
    )

    const outcome = await handleFirstSignIn('user-collision-cloud')

    expect(outcome).toBe('merged')
    // Local guest edits preserved in a backup BEFORE being overwritten…
    expect(backupSpy).toHaveBeenCalledWith('ws-shared', localBoard)
    // …then the cloud copy was adopted locally.
    const stored = JSON.parse(window.localStorage.getItem('mindful-space.workspace.v1:ws-shared'))
    expect(stored.habits[0].id).toBe('from-cloud')
  })

  it('Case C collision: local newer -> pushes the local copy with a version check', async () => {
    vi.spyOn(cloudDb, 'fetchCloudWorkspaces').mockResolvedValue([
      { id: 'ws-shared2', name: 'Stale Cloud', sort_order: 0 },
    ])
    pullSpy.mockResolvedValue({
      data: { columns: [{ id: 'old-from-cloud', items: [] }] },
      version: 3,
      syncedAt: '2026-01-01T00:00:00Z', // older than the local push meta below
    })
    vi.spyOn(imageSync, 'syncAllLocalImages').mockResolvedValue(true)

    window.localStorage.setItem(
      'mindful-space.app.v1',
      JSON.stringify({
        workspaces: [{ id: 'ws-shared2', name: 'Fresh Local Work' }],
        activeWorkspaceId: 'ws-shared2',
      })
    )
    const localBoard = { habits: [{ id: 'fresh-local', title: 'Newest' }] }
    window.localStorage.setItem('mindful-space.workspace.v1:ws-shared2', JSON.stringify(localBoard))

    // This device pushed more recently than the cloud row was written.
    metaSpy.mockImplementation((wsId) =>
      wsId === 'ws-shared2' ? { at: Date.now() + 5000, version: 3 } : null
    )

    const outcome = await handleFirstSignIn('user-collision-local')

    expect(outcome).toBe('merged')
    // Local content won via a version-checked push against cloud v3.
    expect(pushSpy).toHaveBeenCalledWith(
      'user-collision-local',
      'ws-shared2',
      localBoard,
      expect.objectContaining({ expectedVersion: 3 })
    )
    // Local storage untouched by a destructive pull.
    const stored = JSON.parse(window.localStorage.getItem('mindful-space.workspace.v1:ws-shared2'))
    expect(stored.habits[0].id).toBe('fresh-local')
  })

  it('Case C collision push rejected as stale -> falls back to adopting cloud with backup', async () => {
    const cloudBoard = { habits: [{ id: 'race-winner', title: 'Cloud' }] }

    vi.spyOn(cloudDb, 'fetchCloudWorkspaces').mockResolvedValue([
      { id: 'ws-shared3', name: 'Shared', sort_order: 0 },
    ])
    pullSpy.mockResolvedValue({
      data: { columns: [{ id: 'older', items: [] }] },
      version: 4,
      syncedAt: '2026-01-01T00:00:00Z',
    })
    vi.spyOn(imageSync, 'downloadMissingImages').mockResolvedValue(true)
    metaSpy.mockImplementation((wsId) => (wsId === 'ws-shared3' ? { at: Date.now(), version: 4 } : null))

    // Server says another device got in first — our expectedVersion was stale.
    pushSpy.mockResolvedValueOnce({
      success: false,
      reason: 'conflict',
      cloudVersion: 7,
      cloudData: cloudBoard,
    })

    window.localStorage.setItem(
      'mindful-space.app.v1',
      JSON.stringify({
        workspaces: [{ id: 'ws-shared3', name: 'Shared' }],
        activeWorkspaceId: 'ws-shared3',
      })
    )
    const localBoard = { habits: [{ id: 'about-to-lose', title: 'Local' }] }
    window.localStorage.setItem('mindful-space.workspace.v1:ws-shared3', JSON.stringify(localBoard))

    await handleFirstSignIn('user-collision-stale')

    expect(backupSpy).toHaveBeenCalledWith('ws-shared3', localBoard)
    const stored = JSON.parse(window.localStorage.getItem('mindful-space.workspace.v1:ws-shared3'))
    expect(stored.habits[0].id).toBe('race-winner')
  })

  it('does not write the completion marker when migration throws', async () => {
    vi.spyOn(cloudDb, 'fetchCloudWorkspaces').mockRejectedValue(new Error('offline'))

    await expect(handleFirstSignIn('user-fail')).rejects.toMatchObject({ message: 'offline' })
    expect(window.localStorage.getItem(`${MIGRATION_MARKER_PREFIX}user-fail`)).toBeNull()
  })

  it('pullAllFromCloud backs up meaningful local content before overwriting it', async () => {
    vi.spyOn(cloudDb, 'fetchCloudWorkspaces').mockResolvedValue([
      { id: 'ws-pull', name: 'Pulled', sort_order: 0 },
    ])
    pullSpy.mockResolvedValue({
      data: { quotes: [{ id: 'q-cloud' }] },
      version: 2,
      syncedAt: new Date().toISOString(),
    })
    vi.spyOn(imageSync, 'downloadMissingImages').mockResolvedValue(true)

    const existing = { quotes: [{ id: 'q-local' }], habits: [{ id: 'h-local' }] }
    window.localStorage.setItem('mindful-space.workspace.v1:ws-pull', JSON.stringify(existing))

    await pullAllFromCloud('user-pull')

    expect(backupSpy).toHaveBeenCalledWith(
      'ws-pull',
      expect.objectContaining({ habits: [{ id: 'h-local' }] })
    )
  })
})
