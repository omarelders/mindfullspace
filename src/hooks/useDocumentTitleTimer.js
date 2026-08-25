import { createEffect, onCleanup } from 'solid-js'
import { formatSecondsToTimer } from '../utils/dateUtils'

export function createDocumentTitleTimer(getTimers, getWorkspaceName) {
  let originalTitle = document.title

  createEffect(() => {
    const timers = getTimers()
    const workspaceName = getWorkspaceName()
    // Save the original title when the workspace changes
    const baseTitle = workspaceName ? `MindfulSpace - ${workspaceName}` : 'MindfulSpace'
    originalTitle = baseTitle

    const runningTimers = (timers || [])
      .filter((t) => t.isRunning && t.endTime)
      .sort((a, b) => a.endTime - b.endTime)

    if (runningTimers.length === 0) {
      document.title = baseTitle
      return
    }

    // The timer that will finish first drives the title
    const activeTimer = runningTimers[0]
    const timerName = activeTimer.title || 'Timer'

    const tick = () => {
      const remaining = Math.max(0, Math.floor((activeTimer.endTime - Date.now()) / 1000))
      let formatted = formatSecondsToTimer(remaining)
      // Strip '00:' if the timer has less than 1 hour left
      if (formatted.startsWith('00:')) formatted = formatted.slice(3)
      const newTitle = `${formatted} - ${timerName}`
      if (document.title !== newTitle) {
        document.title = newTitle
      }
      // Stop tracking if it reaches 0 (TimerCard will eventually update state to isRunning=false)
      if (remaining <= 0) {
        // Fallback title when timer finishes before state updates
        document.title = `00:00 - ${timerName}`
      }
    }

    // Call tick immediately to set the title without delay
    tick()
    // Use setInterval instead of requestAnimationFrame so it keeps ticking in background tabs
    const interval = setInterval(tick, 500)
    onCleanup(() => {
      clearInterval(interval)
      document.title = baseTitle
    })
  })
}
