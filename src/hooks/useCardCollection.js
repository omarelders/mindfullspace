import { createStore } from 'solid-js/store'
import { createId } from '../utils/id'

export function createCardCollection(options) {
  const {
    initialItems,
    idPrefix,
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
    onDelete,
    onDuplicate,
  } = options

  const [items, setItems] = createStore(initialItems)

  // Snapshot responsibility belongs to callers (matching the original
  // codebase: tagged saves happen BEFORE mutation in useWorkspace actions,
  // removals save their own pre-delete state here).
  function update(id, patch) {
    setItems(
      (item) => item.id === id,
      typeof patch === 'function'
        ? (item) => ({ ...item, ...patch(item) })
        : patch
    )
  }

  function updateTitle(id, title) {
    update(id, { title })
  }

  function updateColor(id, color) {
    update(id, { color })
  }

  function toggleMinimize(id) {
    update(id, (item) => ({ minimized: !item.minimized }))
  }

  function remove(id) {
    // Save BEFORE mutating so undo can restore the deleted card.
    saveSnapshot?.()
    setItems((items) => items.filter((item) => item.id !== id))
    removeCardPosition?.(id)
    if (setDraggingCard) setDraggingCard((c) => (c?.id === id ? null : c))
    onDelete?.(id)
  }

  function archive(id) {
    saveSnapshot?.()
    // Read from the store before filtering — updaters must stay pure.
    const source = items.find((item) => item.id === id)
    if (source) archiveCardSnapshot?.(idPrefix, JSON.parse(JSON.stringify(source)))
    setItems((items) => items.filter((item) => item.id !== id))
    removeCardPosition?.(id)
    if (setDraggingCard) setDraggingCard((c) => (c?.id === id ? null : c))
    onDelete?.(id)
  }

  function duplicate(id) {
    const source = items.find((item) => item.id === id)
    if (!source) return
    const dupId = createId(idPrefix)
    setCardPositions?.((pos) => ({
      ...pos,
      [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 },
    }))
    let dupData = { ...JSON.parse(JSON.stringify(source)), id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }
    if (onDuplicate) {
      dupData = onDuplicate(source, dupData, dupId)
    }
    setItems((prev) => [...prev, dupData])
  }

  return { items, setItems, update, updateTitle, updateColor, toggleMinimize, remove, archive, duplicate }
}
