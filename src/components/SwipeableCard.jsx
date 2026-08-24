import { useRef, useState } from 'react'
import { Archive, Trash2 } from 'lucide-react'

const OPEN_THRESHOLD_PX = 56 // reveal width for the action buttons
const INTENT_SLOP_PX = 12

/**
 * Swipe-left wrapper for cards on the mobile column layout.
 *
 * A horizontal touch drag slides the card left to reveal archive/delete
 * actions behind it (standard iOS/Android pattern). Vertical movement hands
 * the gesture back to native scrolling, so it never fights page pan.
 * Move/up listeners bind to window while a finger is down (touch pointers
 * are implicitly captured anyway) so the gesture survives leaving the card.
 * Without callbacks the wrapper renders its children bare.
 */
export function SwipeableCard({ onArchive, onDelete, children }) {
  const canSwipe = Boolean(onArchive || onDelete)
  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)

  const stateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    decided: false,
    pointerId: null,
    horizontal: false,
  })

  const reset = () => {
    const s = stateRef.current
    s.active = false
    s.decided = false
    s.pointerId = null
    s.horizontal = false
    setIsSwiping(false)
    setOffset(0)
  }

  const handlePointerDown = (event) => {
    const s = stateRef.current
    if (!canSwipe || event.pointerType !== 'touch' || s.active) return
    if (event.button !== undefined && event.button !== 0) return
    s.active = true
    s.startX = event.clientX
    s.startY = event.clientY
    s.decided = false
    s.horizontal = false
    s.pointerId = event.pointerId

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== s.pointerId || !s.active) return
      const dx = moveEvent.clientX - s.startX
      const dy = moveEvent.clientY - s.startY

      if (!s.decided) {
        if (Math.abs(dx) < INTENT_SLOP_PX && Math.abs(dy) < INTENT_SLOP_PX) return
        s.decided = true
        // Vertical intent: release the gesture back to native scrolling.
        if (Math.abs(dy) > Math.abs(dx)) {
          cleanup()
          return
        }
        s.horizontal = true
        setIsSwiping(true)
      }
      if (!s.horizontal) return

      if (dx < 0) {
        setOffset(Math.max(dx, -OPEN_THRESHOLD_PX - 24))
      } else {
        setOffset(Math.min(dx / 3, OPEN_THRESHOLD_PX))
      }
    }

    const onEnd = (endEvent) => {
      if (endEvent.pointerId !== s.pointerId) return
      const dx = endEvent.clientX - s.startX
      if (s.horizontal && dx <= -OPEN_THRESHOLD_PX) {
        // Keep the row open on the action buttons.
        s.active = false
        s.decided = false
        s.pointerId = null
        s.horizontal = false
        setIsSwiping(false)
        setOffset(-OPEN_THRESHOLD_PX)
      } else {
        reset()
      }
      cleanup()
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onCancel)
    }

    const onCancel = () => {
      reset()
      cleanup()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onCancel)
  }

  const runAction = (action) => {
    if (!action) return
    try { action() } finally { reset() }
  }

  if (!canSwipe) {
    return <>{children}</>
  }

  return (
    <div
      className={`swipe-wrap ${isSwiping ? 'is-swiping' : ''} ${offset !== 0 ? 'is-open' : ''}`}
      onPointerDown={handlePointerDown}
    >
      <div className="swipe-actions" style={{ opacity: offset < -20 ? 1 : 0 }} aria-hidden={offset === 0}>
        {onArchive && (
          <button type="button" className="swipe-action swipe-archive" aria-label="archive card" onClick={() => runAction(onArchive)}>
            <Archive aria-hidden="true" />
          </button>
        )}
        {onDelete && (
          <button type="button" className="swipe-action swipe-delete" aria-label="delete card" onClick={() => runAction(onDelete)}>
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="swipe-card" style={{ transform: `translateX(${offset}px)` }}>
        {children}
      </div>
    </div>
  )
}
