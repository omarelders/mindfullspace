import { useRef, useCallback } from 'react'

const MAX_STACK_SIZE = 10

export function useUndoRedo() {
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])

  const pushSnapshot = useCallback((snapshot) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_STACK_SIZE - 1)), snapshot]
    // Any new action clears the redo stack
    redoStackRef.current = []
  }, [])

  const undo = useCallback((currentSnapshot) => {
    const stack = undoStackRef.current
    if (stack.length === 0) return null
    const previous = stack[stack.length - 1]
    undoStackRef.current = stack.slice(0, -1)
    // Push current state onto redo stack so user can redo
    redoStackRef.current = [...redoStackRef.current, currentSnapshot]
    return previous
  }, [])

  const redo = useCallback((currentSnapshot) => {
    const stack = redoStackRef.current
    if (stack.length === 0) return null
    const next = stack[stack.length - 1]
    redoStackRef.current = stack.slice(0, -1)
    // Push current state onto undo stack
    undoStackRef.current = [...undoStackRef.current, currentSnapshot]
    return next
  }, [])

  const canUndo = useCallback(() => undoStackRef.current.length > 0, [])
  const canRedo = useCallback(() => redoStackRef.current.length > 0, [])

  return { pushSnapshot, undo, redo, canUndo, canRedo }
}
