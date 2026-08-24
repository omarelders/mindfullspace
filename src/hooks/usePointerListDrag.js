import { useCallback, useEffect, useRef, useState } from 'react'

export const POINTER_DRAG_THRESHOLD_PX = 8

/**
 * Pointer-event based drag-and-drop for todo rows.
 *
 * Works with touch and mouse (the HTML5 Drag & Drop API it replaces does not
 * exist on touch): press a grip handle, move ≥8px to lift the row, hover over
 * another row to target it, release to commit. Cross-column drops are
 * reported through `onMoveBetween` when the hovered row lives under a
 * different `[data-todo-column]` list.
 *
 * Window-level move/up listeners are bound per drag (they see events outside
 * the captured element), and read latest values from refs so no stale
 * closures. Every pointer-capture call is guarded — jsdom throws for
 * unregistered capture ids.
 */
export function usePointerListDrag({ onReorder, onMoveBetween } = {}) {
  const [draggingItemId, setDraggingItemId] = useState(null)
  const [overItemId, setOverItemId] = useState(null)

  const stateRef = useRef({
    active: false,
    started: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    sourceColumnId: null,
    itemId: null,
    handleEl: null,
  })
  // Latest-value mirrors read by the finish() commit path.
  const overIdRef = useRef(null)
  const overColumnRef = useRef(null)

  const releaseCapture = useCallback((s) => {
    if (s.handleEl) {
      try { s.handleEl.releasePointerCapture(s.pointerId) } catch { /* never captured / already released */ }
      s.handleEl = null
    }
  }, [])

  const cleanupState = useCallback(() => {
    const s = stateRef.current
    releaseCapture(s)
    s.active = false
    s.started = false
    s.pointerId = null
    overIdRef.current = null
    overColumnRef.current = null
    setDraggingItemId(null)
    setOverItemId(null)
  }, [releaseCapture])

  // Unmount safety net: let go of any capture still held mid-drag.
  useEffect(() => () => {
    releaseCapture(stateRef.current)
  }, [releaseCapture])

  const beginItemDrag = useCallback((columnId, itemId, event) => {
    // Primary button / finger only; never hijack multi-touch extras.
    if (event.button !== undefined && event.button !== 0) return
    if (stateRef.current.active) return

    const handleEl = /** @type {HTMLElement} */ (event.currentTarget)
    const s = stateRef.current
    s.active = true
    s.started = false
    s.pointerId = event.pointerId
    s.startX = event.clientX
    s.startY = event.clientY
    s.sourceColumnId = columnId
    s.itemId = itemId
    s.handleEl = handleEl

    try { handleEl.setPointerCapture(event.pointerId) } catch { /* unsupported target */ }

    const resolveTarget = (clientX, clientY) => {
      let el = null
      try { el = document.elementFromPoint(clientX, clientY) } catch { /* jsdom without hit-testing */ }
      const row = el?.closest?.('.todo-row')
      const listEl = el?.closest?.('[data-todo-column]')
      overIdRef.current = row?.getAttribute('data-item-id') || null
      overColumnRef.current = listEl?.getAttribute('data-todo-column') || null
      return overIdRef.current
    }

    const onMove = (moveEvent) => {
      if (!s.active || moveEvent.pointerId !== s.pointerId) return
      const dx = moveEvent.clientX - s.startX
      const dy = moveEvent.clientY - s.startY
      if (!s.started && Math.sqrt(dx * dx + dy * dy) < POINTER_DRAG_THRESHOLD_PX) return
      if (!s.started) {
        s.started = true
        setDraggingItemId(s.itemId)
      }
      moveEvent.preventDefault()

      const overId = resolveTarget(moveEvent.clientX, moveEvent.clientY)
      setOverItemId((prev) => (prev === overId ? prev : overId))
    }

    const finish = (commit) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      if (!s.active) return

      if (commit && s.started) {
        const overId = overIdRef.current
        const overColumnId = overColumnRef.current
        if (overId && overId !== s.itemId) {
          if (overColumnId && overColumnId !== s.sourceColumnId && onMoveBetween) {
            onMoveBetween({ sourceColumnId: s.sourceColumnId, itemId: s.itemId, overColumnId, overItemId: overId })
          } else if (onReorder) {
            onReorder({ columnId: s.sourceColumnId, itemId: s.itemId, overItemId: overId })
          }
        }
      }
      cleanupState()
    }

    const onUp = () => finish(true)
    const onCancel = () => finish(false)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }, [onReorder, onMoveBetween, cleanupState, releaseCapture])

  return { draggingItemId, overItemId, beginItemDrag, endDrag: cleanupState }
}
