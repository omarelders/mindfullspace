const MAX_STACK_SIZE = 10
const COALESCE_WINDOW_MS = 700

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot))
}

export function createUndoRedo() {
  let undoStack = []
  let redoStack = []
  let lastPushMeta = { tag: null, at: 0 }

  function pushSnapshot(snapshot, tag = null) {
    const now = Date.now()
    // Only tagged pushes coalesce (continuous typing → one entry per burst).
    // Untagged pushes are distinct actions and must never merge.
    if (tag && tag === lastPushMeta.tag && (now - lastPushMeta.at) < COALESCE_WINDOW_MS) {
      if (undoStack.length > 0) {
        undoStack[undoStack.length - 1] = cloneSnapshot(snapshot)
      }
      lastPushMeta.at = now
      return
    }
    undoStack.push(cloneSnapshot(snapshot))
    if (undoStack.length > MAX_STACK_SIZE) {
      undoStack.shift()
    }
    redoStack = []
    lastPushMeta = { tag: tag ?? null, at: now }
  }

  function undo(currentSnapshot) {
    if (undoStack.length === 0) return null
    const previous = undoStack.pop()
    redoStack.push(cloneSnapshot(currentSnapshot))
    return previous
  }

  function redo(currentSnapshot) {
    if (redoStack.length === 0) return null
    const next = redoStack.pop()
    undoStack.push(cloneSnapshot(currentSnapshot))
    return next
  }

  function canUndo() { return undoStack.length > 0 }
  function canRedo() { return redoStack.length > 0 }

  return { pushSnapshot, undo, redo, canUndo, canRedo }
}
