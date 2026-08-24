import { useCallback, useEffect, useRef, useState } from 'react'
import { PULL_TO_SYNC_THRESHOLD } from '../utils/gestures'

/**
 * Pull-to-refresh for the mobile column layout.
 *
 * Attach the returned handlers to the scrollable workspace element. When the
 * user is scrolled to the very top and drags down past
 * PULL_TO_SYNC_THRESHOLD, `onRefresh` fires once and a brief "cooldown"
 * prevents immediate re-triggering. Horizontal movement cancels the gesture,
 * and the browser's native pan-y scrolling stays in charge otherwise.
 */
export function usePullToSync({ enabled = true, onRefresh } = {}) {
  const [pullDistance, setPullDistance] = useState(0)
  const stateRef = useRef({
    tracking: false,
    startY: 0,
    startX: 0,
    pulling: false,
    fired: false,
    cooldownUntil: 0,
  })

  const reset = useCallback(() => {
    const s = stateRef.current
    s.tracking = false
    s.pulling = false
    if (s.fired) {
      s.cooldownUntil = Date.now() + 1200
      s.fired = false
    }
    setPullDistance(0)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined

    const findScrollable = (target) => {
      // The .workspace element is the page scroller in the column layout;
      // listeners live on document, so resolve from the pressed element.
      return target instanceof Element ? target.closest('.workspace') : null
    }

    const onStart = (event) => {
      const s = stateRef.current
      if (event.pointerType !== 'touch') return
      if (Date.now() < s.cooldownUntil) return
      const scroller = findScrollable(event.target)
      // Only arm when the container is at its very top — otherwise this is
      // ordinary scrolling.
      if (!scroller || scroller.scrollTop > 0) return
      s.tracking = true
      s.startY = event.clientY
      s.startX = event.clientX
      s.pulling = false
      s.fired = false
    }

    const onMove = (event) => {
      const s = stateRef.current
      if (!s.tracking || event.pointerType !== 'touch') return
      const dy = event.clientY - s.startY
      const dx = event.clientX - s.startX
      // Horizontal intent cancels; downward drag arms the pull.
      if (s.pulling && Math.abs(dx) > Math.abs(dy)) {
        reset()
        return
      }
      if (dy > PULL_TO_SYNC_THRESHOLD / 3) {
        s.pulling = true
        setPullDistance(Math.max(0, Math.min(dy, PULL_TO_SYNC_THRESHOLD + 40)))
      }
      if (dy >= PULL_TO_SYNC_THRESHOLD && !s.fired) {
        s.fired = true
        try { onRefresh?.() } catch { /* refresh errors are not gesture errors */ }
        reset()
      }
    }

    const onEnd = () => {
      const s = stateRef.current
      if (!s.tracking) return
      reset()
    }

    document.addEventListener('pointerdown', onStart, true)
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerup', onEnd, true)
    document.addEventListener('pointercancel', onEnd, true)
    return () => {
      document.removeEventListener('pointerdown', onStart, true)
      document.removeEventListener('pointermove', onMove, true)
      document.removeEventListener('pointerup', onEnd, true)
      document.removeEventListener('pointercancel', onEnd, true)
    }
  }, [enabled, onRefresh, reset])

  return {
    pullDistance,
    /** True while an active pull is being tracked (drives the indicator). */
    isPulling: pullDistance > 0,
    /** Progress toward activation, 0..1 (clamped). */
    pullProgress: Math.min(1, pullDistance / PULL_TO_SYNC_THRESHOLD),
  }
}
