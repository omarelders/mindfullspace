import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUndoRedo } from './useUndoRedo'

describe('createUndoRedo', () => {
  let undoRedo

  beforeEach(() => {
    vi.useFakeTimers()
    undoRedo = createUndoRedo()
  })

  it('pushes snapshots and undoes them', () => {
    undoRedo.pushSnapshot({ value: 1 })
    undoRedo.pushSnapshot({ value: 2 })
    expect(undoRedo.canUndo()).toBe(true)
    const prev = undoRedo.undo({ value: 3 })
    expect(prev).toEqual({ value: 2 })
  })

  it('coalesces same-tag snapshots within window', () => {
    undoRedo.pushSnapshot({ value: 1 }, 'typing')
    vi.advanceTimersByTime(200)
    undoRedo.pushSnapshot({ value: 2 }, 'typing')
    expect(undoRedo.canUndo()).toBe(true)
    const prev = undoRedo.undo({ value: 3 })
    expect(prev).toEqual({ value: 2 })
    expect(undoRedo.canUndo()).toBe(false)
  })

  it('caps stack at 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      undoRedo.pushSnapshot({ value: i })
      vi.advanceTimersByTime(1000)
    }
    let count = 0
    while (undoRedo.canUndo()) {
      undoRedo.undo({ value: 99 })
      count++
    }
    expect(count).toBe(10)
  })

  it('clears redo stack on new push', () => {
    undoRedo.pushSnapshot({ value: 1 })
    vi.advanceTimersByTime(1000)
    undoRedo.pushSnapshot({ value: 2 })
    undoRedo.undo({ value: 3 })
    expect(undoRedo.canRedo()).toBe(true)
    vi.advanceTimersByTime(1000)
    undoRedo.pushSnapshot({ value: 4 })
    expect(undoRedo.canRedo()).toBe(false)
  })
})
