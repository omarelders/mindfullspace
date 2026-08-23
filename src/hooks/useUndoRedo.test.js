import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoRedo } from './useUndoRedo'

describe('useUndoRedo hook', () => {
  it('pushes snapshots and allows undo and redo', () => {
    const { result } = renderHook(() => useUndoRedo())

    expect(result.current.canUndo()).toBe(false)
    expect(result.current.canRedo()).toBe(false)

    act(() => {
      result.current.pushSnapshot({ count: 1 })
    })
    expect(result.current.canUndo()).toBe(true)
    expect(result.current.canRedo()).toBe(false)

    let restored
    act(() => {
      restored = result.current.undo({ count: 2 })
    })
    expect(restored).toEqual({ count: 1 })
    expect(result.current.canUndo()).toBe(false)
    expect(result.current.canRedo()).toBe(true)

    let redone
    act(() => {
      redone = result.current.redo({ count: 1 })
    })
    expect(redone).toEqual({ count: 2 })
    expect(result.current.canUndo()).toBe(true)
    expect(result.current.canRedo()).toBe(false)
  })

  it('coalesces consecutive edits with the same tag within window', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useUndoRedo())

    act(() => {
      result.current.pushSnapshot({ text: 'h' }, 'typing-note-1')
    })
    act(() => {
      vi.advanceTimersByTime(200)
      result.current.pushSnapshot({ text: 'he' }, 'typing-note-1')
    })
    act(() => {
      vi.advanceTimersByTime(200)
      result.current.pushSnapshot({ text: 'hel' }, 'typing-note-1')
    })

    // Coalesced into 1 entry in the undo stack
    let undone
    act(() => {
      undone = result.current.undo({ text: 'hello' })
    })
    expect(undone).toEqual({ text: 'h' })
    expect(result.current.canUndo()).toBe(false)

    vi.useRealTimers()
  })

  it('limits stack size to MAX_STACK_SIZE (10)', () => {
    const { result } = renderHook(() => useUndoRedo())

    for (let i = 0; i < 15; i++) {
      act(() => {
        result.current.pushSnapshot({ step: i })
      })
    }

    let undoCount = 0
    let curr = { step: 15 }
    while (result.current.canUndo()) {
      act(() => {
        curr = result.current.undo(curr)
        undoCount++
      })
    }

    // Max capacity is 10
    expect(undoCount).toBe(10)
    expect(curr).toEqual({ step: 5 })
  })

  it('clears redo stack on new action', () => {
    const { result } = renderHook(() => useUndoRedo())

    act(() => {
      result.current.pushSnapshot({ v: 1 })
    })
    act(() => {
      result.current.undo({ v: 2 })
    })
    expect(result.current.canRedo()).toBe(true)

    // New action should invalidate redo
    act(() => {
      result.current.pushSnapshot({ v: 3 })
    })
    expect(result.current.canRedo()).toBe(false)
  })
})
