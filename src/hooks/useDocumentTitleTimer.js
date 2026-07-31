import { useEffect, useRef } from 'react'
import { formatSecondsToTimer } from '../utils/dateUtils'

export function useDocumentTitleTimer(timers, workspaceName) {
  const originalTitleRef = useRef(document.title)

  useEffect(() => {
    // Save the original title when the component mounts or workspace changes
    const baseTitle = workspaceName ? `MindfulSpace - ${workspaceName}` : 'MindfulSpace'
    originalTitleRef.current = baseTitle
    document.title = baseTitle

    const runningTimers = timers.filter(t => t.isRunning && t.endTime)

    if (runningTimers.length === 0) {
      document.title = baseTitle
      return
    }

    // Sort timers to find the one that will finish first
    runningTimers.sort((a, b) => a.endTime - b.endTime)
    const activeTimer = runningTimers[0]


    const tick = () => {
      const remainingSeconds = Math.max(0, Math.floor((activeTimer.endTime - Date.now()) / 1000))
      
      let formattedTime = formatSecondsToTimer(remainingSeconds)
      // Strip '00:' if the timer has less than 1 hour left
      if (formattedTime.startsWith('00:')) {
        formattedTime = formattedTime.substring(3)
      }
      
      const timerName = activeTimer.title || 'Timer'
      const newTitle = `${formattedTime} - ${timerName}`
      
      if (document.title !== newTitle) {
        document.title = newTitle
      }
      
      // Stop tracking if it reaches 0 (TimerCard will eventually update state to isRunning=false)
      if (remainingSeconds <= 0) {
        // Fallback title when timer finishes before state updates
        document.title = `00:00 - ${timerName}`
      }
    }
    
    // Call tick immediately to set the title without delay
    tick()

    // Use setInterval instead of requestAnimationFrame so it keeps ticking in background tabs
    const intervalId = setInterval(tick, 500)
    
    return () => {
      clearInterval(intervalId)
      // When unmounting or cleaning up the effect, reset the title
      document.title = baseTitle
    }
  }, [timers, workspaceName])
}
