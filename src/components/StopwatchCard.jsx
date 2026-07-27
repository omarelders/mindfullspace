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
  onUpdateFontSize,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
  cardId,
}) {
  const customStyle = stopwatch.fontSize ? { fontSize: `${stopwatch.fontSize}px` } : undefined
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

  // Animation loop updating display only when visible second changes
  useEffect(() => {
    if (!isRunning || !lastStartTime) return undefined

    let animationFrameId
    const tick = () => {
      const current = getElapsedSeconds()
      setElapsedSeconds((prev) => (prev !== current ? current : prev))
      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrameId)
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
      data-card-id={cardId}
      className={`floating-card stopwatch-card card-stopwatch ${stopwatch.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: stopwatch.color || '#86ECA0',
      }}
    >
      <div className="stopwatch-drag-handle" onPointerDown={(e) => onPointerDown(cardId, e)} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
        <CardContextMenu
          title={stopwatch.title || 'Stopwatch'}
          minimized={Boolean(stopwatch.minimized)}
          showTitleInput={false}
          fontSize={stopwatch.fontSize || 42}
          onTitleChange={(nextTitle) => onUpdateTitle(stopwatch.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(stopwatch.id, color)}
          onFontSizeChange={(nextSize) => onUpdateFontSize && onUpdateFontSize(stopwatch.id, nextSize)}
          onMove={(targetId) => onMoveCard(stopwatch.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(stopwatch.id)}
          onDuplicate={() => onDuplicateCard(stopwatch.id)}
          onArchive={() => onArchiveCard(stopwatch.id)}
          onDelete={() => onDeleteCard(stopwatch.id)}
        />
      </div>

      {!stopwatch.minimized && (
        <div className="stopwatch-panel">
          <div className="stopwatch-value" style={customStyle}>
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
