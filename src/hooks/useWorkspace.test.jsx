import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkspace } from './useWorkspace'
import { writeJsonStorage, getInitialWorkspaceState } from '../utils/storage'
import { WORKSPACE_STORAGE_KEY_PREFIX } from '../utils/constants'

// Mocking necessary audio utility
vi.mock('../utils/audio', () => ({
  playTimerCompleteSound: vi.fn(),
  playTimerTickSound: vi.fn(),
}))

describe('useWorkspace hook', () => {
  let workspaceRef

  beforeEach(() => {
    localStorage.clear()
    workspaceRef = { current: document.createElement('div') }
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with default workspace state when storage is empty', () => {
    const { result } = renderHook(() => useWorkspace('ws-default', workspaceRef))
    expect(result.current.state.notes.length).toBeGreaterThan(0) // Has default note
    expect(result.current.state.timers.length).toBeGreaterThan(0) // Has default timer
  })

  it('adds, updates, and deletes a note card', () => {
    const { result } = renderHook(() => useWorkspace('ws-default', workspaceRef))
    
    // Add Note
    act(() => {
      result.current.actions.handleQuickAction('note', null, { x: 100, y: 100 })
    })
    
    // Default note exists + 1 added
    expect(result.current.state.notes.length).toBe(2)
    const addedNote = result.current.state.notes[1]
    
    // Update Note Title
    act(() => {
      result.current.actions.updateNoteTitle(addedNote.id, 'My Custom Note')
    })
    expect(result.current.state.notes[1].title).toBe('My Custom Note')
    
    // Update Note Text
    act(() => {
      result.current.actions.updateNoteText(addedNote.id, 'Hello World')
    })
    expect(result.current.state.notes[1].text).toBe('Hello World')

    // Delete Note Card
    act(() => {
      result.current.actions.deleteNoteCard(addedNote.id)
    })
    expect(result.current.state.notes.length).toBe(1)
  })

  it('duplicates a timer card', () => {
    const { result } = renderHook(() => useWorkspace('ws-default', workspaceRef))
    const initialTimer = result.current.state.timers[0]
    expect(result.current.state.timers.length).toBe(1)

    // Duplicate Timer
    act(() => {
      result.current.actions.duplicateTimerCard(initialTimer.id)
    })

    expect(result.current.state.timers.length).toBe(2)
    expect(result.current.state.timers[1].initialSeconds).toBe(initialTimer.initialSeconds)
    expect(result.current.state.timers[1].title).toBe(initialTimer.title ? `${initialTimer.title} Copy` : '')
  })

  it('handles undo and redo on deleting a note card', () => {
    const { result } = renderHook(() => useWorkspace('ws-default', workspaceRef))
    const initialNoteCount = result.current.state.notes.length

    // Add a note
    act(() => {
      result.current.actions.handleQuickAction('note', null, { x: 100, y: 100 })
    })
    expect(result.current.state.notes.length).toBe(initialNoteCount + 1)
    const newNoteId = result.current.state.notes[result.current.state.notes.length - 1].id

    // Action: Delete the note card (this calls saveSnapshot)
    act(() => {
      result.current.actions.deleteNoteCard(newNoteId)
    })
    expect(result.current.state.notes.length).toBe(initialNoteCount)

    // Undo action (restore deleted note)
    act(() => {
      result.current.actions.handleUndo()
    })
    expect(result.current.state.notes.length).toBe(initialNoteCount + 1)
    expect(result.current.state.notes[result.current.state.notes.length - 1].id).toBe(newNoteId)

    // Redo action (delete the note again)
    act(() => {
      result.current.actions.handleRedo()
    })
    expect(result.current.state.notes.length).toBe(initialNoteCount)
  })

  it('preserves and loads workspace switch state correctly from localStorage', () => {
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
    const { result: resultWs1, rerender } = renderHook(
      ({ id }) => useWorkspace(id, workspaceRef),
      { initialProps: { id: 'ws-1' } }
    )
    expect(resultWs1.current.state.notes[0].title).toBe('Workspace 1 Note')

    // Render with workspace 2
    const { result: resultWs2 } = renderHook(() => useWorkspace('ws-2', workspaceRef))
    expect(resultWs2.current.state.notes[0].title).toBe('Workspace 2 Note')
  })
})
