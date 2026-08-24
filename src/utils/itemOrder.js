/**
 * Pure todo-item ordering primitives.
 *
 * Shared by the pointer-event drag system (mobile-friendly replacement for the
 * HTML5 Drag & Drop API, which has no touch support) and by keyboard
 * reordering. Everything here is array-in/array-out so it can be unit-tested
 * without a DOM.
 */

/**
 * Move `movedId` so it occupies `overId`'s position (before it), matching the
 * classic drag-and-drop "insert above the hovered row" semantic.
 * Returns the ORIGINAL array reference when the move is a no-op.
 */
export function reorderItems(list, movedId, overId) {
  const fromIndex = list.findIndex((item) => item.id === movedId)
  const toIndex = list.findIndex((item) => item.id === overId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return list
  }
  const next = [...list]
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed)
  return next
}

/**
 * Move an item by a relative offset (keyboard reorder: ±1). Clamps to the
 * bounds of the list. Returns the ORIGINAL array reference for no-ops.
 */
export function moveListItem(list, itemId, offset) {
  const fromIndex = list.findIndex((item) => item.id === itemId)
  if (fromIndex < 0 || offset === 0) {
    return list
  }
  const toIndex = Math.min(Math.max(fromIndex + offset, 0), list.length - 1)
  if (toIndex === fromIndex) {
    return list
  }
  const next = [...list]
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed)
  return next
}

/**
 * Insert `movedItem` into `targetList` at the position of `overId`
 * (or appended when `overId` is null). Used for cross-column drops.
 */
export function insertItemInto(targetList, movedItem, overId) {
  const next = [...targetList]
  const overIndex = overId ? next.findIndex((item) => item.id === overId) : -1
  next.splice(overIndex < 0 ? next.length : overIndex, 0, movedItem)
  return next
}

/** Remove an item by id. Returns the ORIGINAL array reference when absent. */
export function removeItem(list, itemId) {
  const index = list.findIndex((item) => item.id === itemId)
  if (index < 0) {
    return list
  }
  return [...list.slice(0, index), ...list.slice(index + 1)]
}
