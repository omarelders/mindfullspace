import { useState, useEffect, useRef, memo } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'
import { formatSecondsToTimer } from '../utils/dateUtils'

export const StopwatchCard = memo(function StopwatchCard({
  stopwatch,
  position,
  onPointerDown,
  onUpdateTitle,
  onUpdateColor,
  onUpdateStopwatchState,
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

  const isRunning = Boolean(stopwatch.isRunning)
  const lastStartTime = stopwatch.lastStartTime || null

  const getElapsedSeconds = () => {
    if (!isRunning || !lastStartTime) return persistedSeconds
    const diff = Math.floor((Date.now() - lastStartTime) / 1000)
    return persistedSeconds + diff
  }

  const [elapsedSeconds, setElapsedSeconds] = useState(getElapsedSeconds())

  // Sync initial render and external updates when paused
  useEffect(() => {
    if (!isRunning) {
      setElapsedSeconds(persistedSeconds)
    }
  }, [persistedSeconds, isRunning])

  // Interval loop
  useEffect(() => {
    if (!isRunning || !lastStartTime) return undefined

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(getElapsedSeconds())
    }, 100) // update frequently for smooth logic without drifting

    return () => window.clearInterval(intervalId)
  }, [isRunning, lastStartTime, persistedSeconds])

  const toggleRunning = () => {
    if (!onUpdateStopwatchState) return

    if (isRunning) {
      // Pause
      onUpdateStopwatchState(stopwatch.id, {
        isRunning: false,
        elapsedSeconds,
        lastStartTime: null,
      })
    } else {
      // Start
      onUpdateStopwatchState(stopwatch.id, {
        isRunning: true,
        lastStartTime: Date.now(),
      })
    }
  }

  const resetStopwatch = () => {
    if (!onUpdateStopwatchState) return

    onUpdateStopwatchState(stopwatch.id, {
      isRunning: false,
      elapsedSeconds: 0,
      initialSeconds: 0,
      lastStartTime: null,
    })
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
      <div className="stopwatch-drag-handle" onPointerDown={onPointerDown} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
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
