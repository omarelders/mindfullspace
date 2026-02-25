import { useState, useEffect, useRef, memo } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'
import { formatSecondsToTimer } from '../utils/dateUtils'

export const StopwatchCard = memo(function StopwatchCard({
  stopwatch,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onUpdateElapsedSeconds,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  const initialSeconds = Number.isFinite(stopwatch.initialSeconds) ? stopwatch.initialSeconds : 0
  const persistedSeconds = Number.isFinite(stopwatch.elapsedSeconds)
    ? stopwatch.elapsedSeconds
    : initialSeconds
  const [elapsedSeconds, setElapsedSeconds] = useState(persistedSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const startTimeRef = useRef(null)
  const baseSecondsRef = useRef(persistedSeconds)

  useEffect(() => {
    if (!isRunning) {
      setElapsedSeconds(persistedSeconds)
      baseSecondsRef.current = persistedSeconds
    }
  }, [stopwatch.id, persistedSeconds, isRunning])

  useEffect(() => {
    if (!isRunning) return undefined

    startTimeRef.current = Date.now()
    baseSecondsRef.current = elapsedSeconds

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      const diffSeconds = Math.floor((now - startTimeRef.current) / 1000)
      setElapsedSeconds(baseSecondsRef.current + diffSeconds)
    }, 100) // update frequently for smooth logic without drifting

    return () => window.clearInterval(intervalId)
  }, [isRunning]) // Only re-run when isRunning changes

  // Auto save on pause
  useEffect(() => {
    if (!isRunning) {
      onUpdateElapsedSeconds(stopwatch.id, elapsedSeconds)
    }
  }, [onUpdateElapsedSeconds, stopwatch.id, elapsedSeconds, isRunning])

  const toggleRunning = () => {
    if (isRunning) {
      // pause
      onUpdateElapsedSeconds(stopwatch.id, elapsedSeconds) // save exact current
    }
    setIsRunning((running) => !running)
  }

  const resetStopwatch = () => {
    setIsRunning(false)
    setElapsedSeconds(0)
    baseSecondsRef.current = 0
    onUpdateElapsedSeconds(stopwatch.id, 0)
  }

  const [h, m, s] = formatSecondsToTimer(elapsedSeconds).split(':')

  return (
    <section
      className={`floating-card stopwatch-card card-stopwatch ${stopwatch.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: stopwatch.color || '#86ECA0',
      }}
    >
      <div className="stopwatch-drag-handle" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <CardContextMenu
          title={stopwatch.title || 'Stopwatch'}
          minimized={Boolean(stopwatch.minimized)}
          showTitleInput={false}
          onTitleChange={(nextTitle) => onUpdateTitle(stopwatch.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(stopwatch.id, color)}
          onMove={(targetId) => onMoveCard(stopwatch.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(stopwatch.id)}
          onDuplicate={() => onDuplicateCard(stopwatch.id)}
          onArchive={() => onArchiveCard(stopwatch.id)}
          onDelete={() => onDeleteCard(stopwatch.id)}
        />
      </div>

      {!stopwatch.minimized && (
        <div className="stopwatch-panel">
          <div className="stopwatch-value">
            {h} <span className="stopwatch-colon">:</span> {m} <span className="stopwatch-colon">:</span> {s}
          </div>
          <div className="stopwatch-controls">
            <button
              type="button"
              className={`stopwatch-control play ${isRunning ? 'is-running' : ''}`}
              onClick={toggleRunning}
              aria-label={isRunning ? 'pause stopwatch' : 'start stopwatch'}
            >
              {isRunning ? (
                <Pause aria-hidden="true" style={{ paddingLeft: '0px' }} />
              ) : (
                <Play aria-hidden="true" style={{ paddingLeft: '2px' }} />
              )}
            </button>

            <button type="button" className="stopwatch-control reset" onClick={resetStopwatch} aria-label="reset stopwatch">
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  )
})
