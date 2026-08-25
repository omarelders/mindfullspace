import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRoot } from 'solid-js'
import { createWorkspace } from './useWorkspace'
import { useAuth } from './useAuth'
import { writeJsonStorage, getInitialWorkspaceState } from '../utils/storage'
import { WORKSPACE_STORAGE_KEY_PREFIX } from '../utils/constants'

// Mocking necessary audio utility (matches the real module's exports)
vi.mock('../utils/audio', () => ({
  playBeep: vi.fn(),
  fireNotification: vi.fn(),
  playAchievementSound: vi.fn(),
  playTaskCompleteSound: vi.fn(),
}))

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}))

describe('useWorkspace hook', () => {
  let workspaceRef
  let activeDisposables = []

  // Solid replacement for renderHook: run the factory inside a reactive root
  // and expose the workspace API object.
  function mountWorkspace(id) {
    let ws
    createRoot((dispose) => {
      ws = createWorkspace(id, workspaceRef)
      activeDisposables.push(dispose)
    })
    return ws
  }

  beforeEach(() => {
    localStorage.clear()
    workspaceRef = { current: document.createElement('div') }
    useAuth.mockImplementation(() => ({ user: null }))
    vi.useFakeTimers()
  })

  afterEach(() => {
    for (const dispose of activeDisposables) dispose()
    activeDisposables = []
    vi.useRealTimers()
  })

  it('initializes with default workspace state when storage is empty', async () => {
    const ws = mountWorkspace('ws-default')
    expect(ws.state.notes.length).toBeGreaterThan(0) // Has default note
    expect(ws.state.timers.length).toBeGreaterThan(0) // Has default timer
  })

  it('adds, updates, and deletes a note card', async () => {
    const ws = mountWorkspace('ws-default')

    // Add Note
    ws.actions.handleQuickAction('note', null, { x: 100, y: 100 })

    // Default note exists + 1 added
    expect(ws.state.notes.length).toBe(2)
    const addedNote = ws.state.notes[1]

    // Update Note Title
    ws.actions.updateNoteTitle(addedNote.id, 'My Custom Note')
    expect(ws.state.notes[1].title).toBe('My Custom Note')

    // Update Note Text
    ws.actions.updateNoteText(addedNote.id, 'Hello World')
    expect(ws.state.notes[1].text).toBe('Hello World')

    // Delete Note Card
    ws.actions.deleteNoteCard(addedNote.id)
    expect(ws.state.notes.length).toBe(1)
  })

  it('duplicates a timer card', async () => {
    const ws = mountWorkspace('ws-default')
    const initialTimer = ws.state.timers[0]
    expect(ws.state.timers.length).toBe(1)

    // Duplicate Timer
    ws.actions.duplicateTimerCard(initialTimer.id)

    expect(ws.state.timers.length).toBe(2)
    expect(ws.state.timers[1].initialSeconds).toBe(initialTimer.initialSeconds)
    expect(ws.state.timers[1].title).toBe(initialTimer.title ? `${initialTimer.title} Copy` : '')
  })

  it('handles undo and redo on deleting a note card', async () => {
    const ws = mountWorkspace('ws-default')
    const initialNoteCount = ws.state.notes.length

    // Add a note
    ws.actions.handleQuickAction('note', null, { x: 100, "y": 100 })
    expect(ws.state.notes.length).toBe(initialNoteCount + 1)
    const newNoteId = ws.state.notes[ws.state.notes.length - 1].id

    // Action: Delete the note card (this calls saveSnapshot)
    ws.actions.deleteNoteCard(newNoteId)
    expect(ws.state.notes.length).toBe(initialNoteCount)

    // Undo action (restore deleted note)
    ws.actions.handleUndo()
    expect(ws.state.notes.length).toBe(initialNoteCount + 1)
    expect(ws.state.notes[ws.state.notes.length - 1].id).toBe(newNoteId)

    // Redo action (delete the note again)
    ws.actions.handleRedo()
    expect(ws.state.notes.length).toBe(initialNoteCount)
  })

  it('preserves and loads workspace switch state correctly from localStorage', async () => {
    // Write workspace 1 state
    const ws1State = {
      ...getInitialWorkspaceState('ws-1'),
      notes: [{ id: 'note-ws1', title: 'Workspace 1 Note', text: '', color: null, minimized: false }]
    }
    writeJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}ws-1`, ws1State)

    // Write workspace 2 state
    const ws2State = {
      ...getInitialWorkspaceState('ws-2'),
      notes: [{ id: 'note-ws2', title: 'Workspace 2 Note', text: '', color: null, minimized: false }]
    }
    writeJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}ws-2`, ws2State)

    // Mount workspace 1
    const ws1 = mountWorkspace('ws-1')
    expect(ws1.state.notes[0].title).toBe('Workspace 1 Note')

    // Mount workspace 2 (fresh factory — no rerender needed in Solid)
    const ws2 = mountWorkspace('ws-2')
    expect(ws2.state.notes[0].title).toBe('Workspace 2 Note')
  })

  it('imports cards from json without replacing existing workspace cards', async () => {
    vi.useRealTimers()
    const ws = mountWorkspace('ws-default')
    const initialNoteCount = ws.state.notes.length

    const importedCards = [
      { type: 'note', title: 'Imported Note 1', text: 'Content 1' },
      { type: 'note', title: 'Imported Note 2', text: 'Content 2' },
      { type: 'todo', title: 'Imported Todo', items: [{ text: 'task 1' }] }
    ]
    const file = new File([JSON.stringify(importedCards)], 'import.json', { type: 'application/json' })

    await ws.actions.importCardsFromJson(file)

    expect(ws.state.notes.length).toBe(initialNoteCount + 2)
    expect(ws.state.columns.length).toBeGreaterThan(0)
    const titles = ws.state.notes.map((n) => n.title)
    expect(titles).toContain('Imported Note 1')
    expect(titles).toContain('Imported Note 2')
    vi.useFakeTimers()
  })
})
