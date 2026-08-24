import { useEffect } from 'react'

const FOCUSABLE_SELECTOR = 'input[type="text"], textarea, input:not([type])'

/**
 * Keeps the focused field visible when the virtual keyboard opens.
 *
 * When an input/textarea gains focus and the visual viewport then shrinks
 * (keyboard up), the field is scrolled to the viewport center. Works with
 * both the page scroller (.workspace) and inner scroll containers. Falls
 * back to a plain scrollIntoView when the visualViewport API is missing.
 */
export function useKeyboardAwareScroll({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined

    let activeElement = null
    let lastViewportHeight = null

    const scrollFocusedIntoView = () => {
      if (!activeElement || !activeElement.isConnected) return
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const onFocusIn = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.matches(FOCUSABLE_SELECTOR)) return
      activeElement = target
      // Immediate nudge (covers partial keyboards), then re-nudge when the
      // viewport settles at its final height.
      window.setTimeout(scrollFocusedIntoView, 150)
    }

    const onFocusOut = (event) => {
      if (activeElement && event.target === activeElement) {
        activeElement = null
      }
    }

    const handleViewportResize = () => {
      const vv = window.visualViewport
      if (!vv) {
        scrollFocusedIntoView()
        return
      }
      // Only react to shrink events (keyboard appearing), not rotations.
      if (lastViewportHeight !== null && vv.height < lastViewportHeight - 40) {
        window.setTimeout(scrollFocusedIntoView, 100)
      }
      lastViewportHeight = vv.height
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize)
      lastViewportHeight = window.visualViewport.height
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize)
      }
    }
  }, [enabled])
}
