import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createId } from '../utils/id'

export function useCardCollection({
  initialItems,
  idPrefix,
  saveSnapshot,
  archiveCardSnapshot,
  removeCardPosition,
  setCardPositions,
  setDraggingCard,
  onDelete,
  onDuplicate,
}) {
  const [items, setItems] = useState(initialItems)

  // Ref mirror so event handlers can read the current items without depending
  // on `items` identity (which would defeat memoization downstream).
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const update = useCallback((id, patch) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item
    ))
  }, [])

  const updateTitle = useCallback((id, title) => update(id, { title }), [update])
  const updateColor = useCallback((id, color) => update(id, { color }), [update])
  const toggleMinimize = useCallback((id) => update(id, (item) => ({ minimized: !item.minimized })), [update])

  const remove = useCallback((id) => {
    saveSnapshot()
    setItems(prev => prev.filter(item => item.id !== id))
    removeCardPosition(id)
    if (setDraggingCard) setDraggingCard(c => c?.id === id ? null : c)
    if (onDelete) onDelete(id)
  }, [saveSnapshot, removeCardPosition, setDraggingCard, onDelete])

  const archive = useCallback((id) => {
    saveSnapshot()
    // Read from the ref instead of inside the setItems updater — updaters must
    // stay pure (React may invoke them more than once, which would archive the
    // same card twice).
    const source = itemsRef.current.find(item => item.id === id)
    if (source) archiveCardSnapshot(idPrefix, source)
    setItems(prev => prev.filter(item => item.id !== id))
    removeCardPosition(id)
    if (setDraggingCard) setDraggingCard(c => c?.id === id ? null : c)
    if (onDelete) onDelete(id)
  }, [idPrefix, saveSnapshot, archiveCardSnapshot, removeCardPosition, setDraggingCard, onDelete])

  const duplicate = useCallback((id) => {
    const source = itemsRef.current.find(item => item.id === id)
    if (!source) return
    const dupId = createId(idPrefix)
    setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))

    let dupData = { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }
    if (onDuplicate) {
      dupData = onDuplicate(source, dupData, dupId)
    }
    setItems(prev => [...prev, dupData])
  }, [idPrefix, setCardPositions, onDuplicate])

  // Memoized so `[collection]` dependencies in consumers stay stable across
  // renders that don't touch this collection — this is what makes React.memo
  // on the card components actually effective.
  return useMemo(() => ({
    items,
    setItems,
    update,
    updateTitle,
    updateColor,
    toggleMinimize,
    remove,
    archive,
    duplicate,
  }), [items, update, updateTitle, updateColor, toggleMinimize, remove, archive, duplicate])
}
