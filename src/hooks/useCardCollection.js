import { useState, useCallback } from 'react'

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
    setItems(prev => {
      const src = prev.find(item => item.id === id)
      if (src) archiveCardSnapshot(idPrefix, src)
      return prev.filter(item => item.id !== id)
    })
    removeCardPosition(id)
    if (setDraggingCard) setDraggingCard(c => c?.id === id ? null : c)
    if (onDelete) onDelete(id)
  }, [idPrefix, saveSnapshot, archiveCardSnapshot, removeCardPosition, setDraggingCard, onDelete])

  const duplicate = useCallback((id) => {
    setItems(prev => {
      const source = prev.find(item => item.id === id)
      if (!source) return prev
      const dupId = `${idPrefix}-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      
      let dupData = { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }
      if (onDuplicate) {
        dupData = onDuplicate(source, dupData, dupId)
      }
      return [...prev, dupData]
    })
  }, [idPrefix, setCardPositions, onDuplicate])

  return {
    items,
    setItems,
    update,
    updateTitle,
    updateColor,
    toggleMinimize,
    remove,
    archive,
    duplicate,
  }
}
