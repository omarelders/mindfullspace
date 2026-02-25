import { useState, useEffect, useRef, memo } from 'react'
import { Play, Pause, Pencil, RotateCcw } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'
import { formatSecondsToTimer, parseTimerValue } from '../utils/dateUtils'
import { playBeep, fireNotification } from '../utils/audio'

const POMODORO_STAGES = {
  work: { label: '🍅 Work', next: 'short-break', freq: 880 },
  'short-break': { label: '☕ Short Break', next: 'work', freq: 528 },
  'long-break': { label: '🛌 Long Break', next: 'work', freq: 440 },
}

export const TimerCard = memo(function TimerCard({
  timer,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onUpdateRemainingSeconds,
  onUpdateInitialSeconds,
  onUpdatePomodoroConfig,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  const initialSeconds = Number.isFinite(timer.initialSeconds) ? timer.initialSeconds : 2700
  const persistedSeconds = Number.isFinite(timer.remainingSeconds) ? timer.remainingSeconds : initialSeconds
  const [secondsLeft, setSecondsLeft] = useState(persistedSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const isPomodoroMode = Boolean(timer.isPomodoroMode)
  const pomodoroWork = timer.pomodoroWork || 25 * 60
  const pomodoroShortBreak = timer.pomodoroShortBreak || 5 * 60
  const pomodoroLongBreak = timer.pomodoroLongBreak || 15 * 60
  const pomodoroStage = timer.pomodoroStage || 'work'
  const pomodoroRound = timer.pomodoroRound || 1

  const [showPomodoroConfig, setShowPomodoroConfig] = useState(false)
  const [configDraft, setConfigDraft] = useState({
    work: Math.floor(pomodoroWork / 60),
    shortBreak: Math.floor(pomodoroShortBreak / 60),
    longBreak: Math.floor(pomodoroLongBreak / 60),
  })

  // Keep internal state in sync if external props force an update (e.g. duplicating/loading)
  useEffect(() => {
    setSecondsLeft(persistedSeconds)
  }, [persistedSeconds, timer.id])

  const justAdvancedRef = useRef(false)

  useEffect(() => {
    let interval = null
    if (isRunning && secondsLeft > 0) {
      interval = window.setInterval(() => {
        setSecondsLeft((current) => {
          const next = current - 1
          if (next <= 0) {
            playBeep(isPomodoroMode ? POMODORO_STAGES[pomodoroStage]?.freq || 880 : 880, 1.5)
            fireNotification(
              timer.title || (isPomodoroMode ? POMODORO_STAGES[pomodoroStage]?.label : 'Timer'),
              'Time is up!'
            )

            if (!isPomodoroMode) {
              setIsRunning(false)
              if (onUpdateRemainingSeconds) onUpdateRemainingSeconds(timer.id, 0)
              return 0
            }

            // Pomodoro auto-advance logic
            justAdvancedRef.current = true
            return 0
          }
          if (next % 5 === 0 && onUpdateRemainingSeconds) {
            onUpdateRemainingSeconds(timer.id, next)
          }
          return next
        })
      }, 1000)
    }

    return () => {
      if (interval) window.clearInterval(interval)
    }
  }, [isRunning, secondsLeft, isPomodoroMode, pomodoroStage, timer.title, timer.id, onUpdateRemainingSeconds])

  // Handle pomodoro stage transition after reaching 0 (preventing race conditions in interval)
  useEffect(() => {
    if (secondsLeft === 0 && isPomodoroMode && justAdvancedRef.current && onUpdatePomodoroConfig && onUpdateRemainingSeconds && onUpdateInitialSeconds) {
      justAdvancedRef.current = false
      let nextStage = POMODORO_STAGES[pomodoroStage]?.next || 'work'
      let nextRound = pomodoroRound

      if (pomodoroStage === 'work') {
        if (pomodoroRound >= 4) {
          nextStage = 'long-break'
        } else {
          nextStage = 'short-break'
        }
      } else if (pomodoroStage === 'long-break') {
        nextStage = 'work'
        nextRound = 1
      } else if (pomodoroStage === 'short-break') {
        nextStage = 'work'
        nextRound = pomodoroRound + 1
      }

      const nextDuration =
        nextStage === 'work' ? pomodoroWork :
        nextStage === 'short-break' ? pomodoroShortBreak :
        pomodoroLongBreak

      onUpdatePomodoroConfig(timer.id, {
        pomodoroStage: nextStage,
        pomodoroRound: nextRound,
      })
      onUpdateInitialSeconds(timer.id, nextDuration)
      onUpdateRemainingSeconds(timer.id, nextDuration)
      setSecondsLeft(nextDuration)
    }
  }, [
    secondsLeft,
    isPomodoroMode,
    pomodoroStage,
    pomodoroRound,
    pomodoroWork,
    pomodoroShortBreak,
    pomodoroLongBreak,
    timer.id,
    onUpdatePomodoroConfig,
    onUpdateInitialSeconds,
    onUpdateRemainingSeconds,
  ])

  const toggleRunning = () => {
    if (secondsLeft <= 0 && !isRunning) return // don't start at 0 unless pomodoro resets
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    setIsRunning(false)
    if (isPomodoroMode && onUpdatePomodoroConfig) {
      onUpdatePomodoroConfig(timer.id, {
        pomodoroStage: 'work',
        pomodoroRound: 1,
      })
      setSecondsLeft(pomodoroWork)
      if (onUpdateRemainingSeconds) onUpdateRemainingSeconds(timer.id, pomodoroWork)
      if (onUpdateInitialSeconds) onUpdateInitialSeconds(timer.id, pomodoroWork)
    } else {
      setSecondsLeft(initialSeconds)
      if (onUpdateRemainingSeconds) onUpdateRemainingSeconds(timer.id, initialSeconds)
    }
  }

  const startEditing = () => {
    setIsRunning(false)
    setEditValue(formatSecondsToTimer(secondsLeft))
    setIsEditing(true)
  }

  const cancelEditing = () => { setIsEditing(false) }

  const commitEditing = () => {
    const rawValue = editValue.trim()
    if (!rawValue) { cancelEditing(); return }
    const parsed = parseTimerValue(rawValue)
    if (parsed === null) { cancelEditing(); return }
    setIsEditing(false)
    setSecondsLeft(parsed)
    if (onUpdateInitialSeconds) onUpdateInitialSeconds(timer.id, parsed)
  }

  const togglePomodoroMode = () => {
    const nextMode = !isPomodoroMode
    if (onUpdatePomodoroConfig) {
      onUpdatePomodoroConfig(timer.id, {
        isPomodoroMode: nextMode,
        pomodoroStage: 'work',
        pomodoroRound: 1,
      })
    }
    setIsRunning(false)
    setShowPomodoroConfig(false)
  }

  const commitPomodoroConfig = () => {
    const workSec = Math.max(1, (Number(configDraft.work) || 25)) * 60
    const shortSec = Math.max(1, (Number(configDraft.shortBreak) || 5)) * 60
    const longSec = Math.max(1, (Number(configDraft.longBreak) || 15)) * 60
    if (onUpdatePomodoroConfig) {
      onUpdatePomodoroConfig(timer.id, {
        pomodoroWork: workSec,
        pomodoroShortBreak: shortSec,
        pomodoroLongBreak: longSec,
        pomodoroStage: 'work',
        pomodoroRound: 1,
      })
    }
    setIsRunning(false)
    setShowPomodoroConfig(false)
  }

  const stageLabel = POMODORO_STAGES[pomodoroStage]?.label || '🍅 Work'

  return (
    <section
      className={`floating-card timer-card card-timer ${timer.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''} ${isPomodoroMode ? 'pomodoro-active' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: timer.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{timer.title}</span>
        <button
          type="button"
          className={`pomodoro-toggle-btn ${isPomodoroMode ? 'is-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); togglePomodoroMode() }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={isPomodoroMode ? 'Disable Pomodoro mode' : 'Enable Pomodoro mode'}
          title={isPomodoroMode ? 'Disable Pomodoro' : 'Enable Pomodoro'}
        >
          🍅
        </button>
        <CardContextMenu
          title={timer.title}
          minimized={Boolean(timer.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(timer.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(timer.id, color)}
          onMove={(targetId) => onMoveCard(timer.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(timer.id)}
          onDuplicate={() => onDuplicateCard(timer.id)}
          onArchive={() => onArchiveCard(timer.id)}
          onDelete={() => onDeleteCard(timer.id)}
        />
      </header>

      {!timer.minimized && (
        <div className="timer-panel">
          {/* Pomodoro stage indicator */}
          {isPomodoroMode && (
            <div className="pomodoro-stage-bar">
              <span className="pomodoro-stage-label">{stageLabel}</span>
              <span className="pomodoro-round-badge">Round {Math.min(pomodoroRound, 4)}/4</span>
              <button
                type="button"
                className="pomodoro-config-btn"
                onClick={() => setShowPomodoroConfig((v) => !v)}
                aria-label="Configure Pomodoro"
              >
                ⚙
              </button>
            </div>
          )}

          {/* Pomodoro config panel */}
          {isPomodoroMode && showPomodoroConfig && (
            <div className="pomodoro-config-panel">
              <label className="pomodoro-config-row">
                <span>Work (min)</span>
                <input
                  type="number"
                  className="pomodoro-config-input"
                  min={1}
                  max={120}
                  value={configDraft.work}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, work: e.target.value }))}
                />
              </label>
              <label className="pomodoro-config-row">
                <span>Short break (min)</span>
                <input
                  type="number"
                  className="pomodoro-config-input"
                  min={1}
                  max={60}
                  value={configDraft.shortBreak}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, shortBreak: e.target.value }))}
                />
              </label>
              <label className="pomodoro-config-row">
                <span>Long break (min)</span>
                <input
                  type="number"
                  className="pomodoro-config-input"
                  min={1}
                  max={120}
                  value={configDraft.longBreak}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, longBreak: e.target.value }))}
                />
              </label>
              <button type="button" className="pomodoro-apply-btn" onClick={commitPomodoroConfig}>
                Apply & Reset
              </button>
            </div>
          )}

          {/* Timer display */}
          {isEditing ? (
            <input
              type="text"
              className="timer-value-edit"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEditing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEditing()
                if (e.key === 'Escape') cancelEditing()
              }}
              autoFocus
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontSize: '2rem',
                fontWeight: '600',
                textAlign: 'center',
                width: '100%',
                outline: 'none',
              }}
            />
          ) : (
            <>
              <div className={`timer-value ${secondsLeft === 0 ? 'timer-value-done' : ''}`}>
                {formatSecondsToTimer(secondsLeft)}
              </div>
              <div className="timer-controls">
                <button
                  type="button"
                  className={`timer-control play ${isRunning ? 'is-running' : ''}`}
                  onClick={toggleRunning}
                  aria-label={isRunning ? 'pause timer' : 'start timer'}
                  disabled={!isRunning && secondsLeft <= 0}
                >
                  {isRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>

                {!isPomodoroMode && (
                  <button type="button" className="timer-control" onClick={startEditing} aria-label="edit timer value">
                    <Pencil aria-hidden="true" />
                  </button>
                )}

                <button type="button" className="timer-control" onClick={resetTimer} aria-label="reset timer">
                  <RotateCcw aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
})
