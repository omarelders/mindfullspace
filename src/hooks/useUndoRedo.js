import { useRef, useCallback } from 'react'

const MAX_STACK_SIZE = 10

// Consecutive pushes carrying the same tag within this window coalesce into a
// single undo entry, so continuous typing produces one undo step per burst.
const COALESCE_WINDOW_MS = 700

// Snapshots are cloned on entry so the history can never be corrupted by an
// accidental in-place mutation of live state objects.
function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot))
}

export function useUndoRedo() {
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const lastPushMetaRef = useRef({ tag: null, at: 0 })

  const pushSnapshot = useCallback((snapshot, tag = null) => {
    const now = Date.now()
    const meta = lastPushMetaRef.current
    const shouldCoalesce = tag !== null && meta.tag === tag && (now - meta.at) < COALESCE_WINDOW_MS

    if (!shouldCoalesce) {
      undoStackRef.current = [
        ...undoStackRef.current.slice(-(MAX_STACK_SIZE - 1)),
        cloneSnapshot(snapshot),
      ]
    }
    // Any new action clears the redo stack
    redoStackRef.current = []
    lastPushMetaRef.current = { tag, at: now }
  }, [])

  const undo = useCallback((currentSnapshot) => {
    const stack = undoStackRef.current
    if (stack.length === 0) return null
    const previous = stack[stack.length - 1]
    undoStackRef.current = stack.slice(0, -1)
    // Push current state onto redo stack so user can redo
    redoStackRef.current = [...redoStackRef.current, cloneSnapshot(currentSnapshot)]
    lastPushMetaRef.current = { tag: null, at: 0 }
    return previous
  }, [])

  const redo = useCallback((currentSnapshot) => {
    const stack = redoStackRef.current
    if (stack.length === 0) return null
    const next = stack[stack.length - 1]
    redoStackRef.current = stack.slice(0, -1)
    // Push current state onto undo stack
    undoStackRef.current = [...undoStackRef.current, cloneSnapshot(currentSnapshot)]
    lastPushMetaRef.current = { tag: null, at: 0 }
    return next
  }, [])

  const canUndo = useCallback(() => undoStackRef.current.length > 0, [])
  const canRedo = useCallback(() => redoStackRef.current.length > 0, [])

  return { pushSnapshot, undo, redo, canUndo, canRedo }
}
