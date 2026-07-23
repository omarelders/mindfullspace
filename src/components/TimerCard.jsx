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
  onPointerDown,
  onUpdateTitle,
  onUpdateColor,
  onUpdateTimerState,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  const initialSeconds = Number.isFinite(timer.initialSeconds) ? timer.initialSeconds : 2700
  const persistedSeconds = Number.isFinite(timer.remainingSeconds) ? timer.remainingSeconds : initialSeconds
  const isRunning = Boolean(timer.isRunning)
  const endTime = timer.endTime || null

  const getSecondsLeft = () => {
    if (!isRunning || !endTime) return persistedSeconds
    const left = Math.floor((endTime - Date.now()) / 1000)
    return Math.max(0, left)
  }

  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft())
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

  // Sync initial render and external updates when paused
  useEffect(() => {
    if (!isRunning) {
      setSecondsLeft(persistedSeconds)
    }
  }, [persistedSeconds, isRunning])

  const hasFinishedRef = useRef(false)

  // Interval loop
  useEffect(() => {
    if (!isRunning || !endTime) return undefined

    // Reset notification trigger if timer is started
    if (getSecondsLeft() > 0) {
      hasFinishedRef.current = false
    }

    const intervalId = window.setInterval(() => {
      const left = getSecondsLeft()
      setSecondsLeft(left)

      // Timer has hit zero — fire once
      if (left <= 0 && !hasFinishedRef.current) {
        hasFinishedRef.current = true

        const stage = pomodoroStage
        const isPomodoro = isPomodoroMode
        playBeep(isPomodoro ? POMODORO_STAGES[stage]?.freq || 880 : 880, 1.5)
        fireNotification(
          timer.title || (isPomodoro ? POMODORO_STAGES[stage]?.label : 'Timer'),
          'Time is up!'
        )

        if (!isPomodoro) {
          if (onUpdateTimerState) {
            onUpdateTimerState(timer.id, { isRunning: false, remainingSeconds: 0, endTime: null })
          }
        } else {
           // auto transition logic
           let nextStage = POMODORO_STAGES[pomodoroStage]?.next || 'work'
           let nextRound = pomodoroRound

           if (pomodoroStage === 'work') {
             nextStage = pomodoroRound >= 4 ? 'long-break' : 'short-break'
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

           if (onUpdateTimerState) {
             onUpdateTimerState(timer.id, {
               isRunning: false,
               remainingSeconds: nextDuration,
               initialSeconds: nextDuration,
               endTime: null,
               pomodoroStage: nextStage,
               pomodoroRound: nextRound,
             })
           }
        }
      }
    }, 200) // 200ms — smooth display, no per-second drift

    return () => window.clearInterval(intervalId)
  }, [isRunning, endTime, isPomodoroMode, pomodoroStage, pomodoroRound, pomodoroWork, pomodoroShortBreak, pomodoroLongBreak, timer.id, timer.title, onUpdateTimerState])

  const toggleRunning = () => {
    if (secondsLeft <= 0 && !isRunning) return // don't start at 0 unless pomodoro resets
    if (!onUpdateTimerState) return

    if (isRunning) {
      // Pause
      onUpdateTimerState(timer.id, {
        isRunning: false,
        remainingSeconds: secondsLeft,
        endTime: null,
      })
    } else {
      // Start
      onUpdateTimerState(timer.id, {
        isRunning: true,
        endTime: Date.now() + secondsLeft * 1000,
      })
    }
  }

  const resetTimer = () => {
    if (!onUpdateTimerState) return

    if (isPomodoroMode) {
      onUpdateTimerState(timer.id, {
        isRunning: false,
        remainingSeconds: pomodoroWork,
        initialSeconds: pomodoroWork,
        endTime: null,
        pomodoroStage: 'work',
        pomodoroRound: 1,
      })
    } else {
      onUpdateTimerState(timer.id, {
        isRunning: false,
        remainingSeconds: initialSeconds,
        endTime: null,
      })
    }
  }

  const startEditing = () => {
    if (isRunning && onUpdateTimerState) {
       onUpdateTimerState(timer.id, { isRunning: false, remainingSeconds: secondsLeft, endTime: null })
    }
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
    if (onUpdateTimerState) {
       onUpdateTimerState(timer.id, { isRunning: false, remainingSeconds: parsed, initialSeconds: parsed, endTime: null })
    }
  }

  const togglePomodoroMode = () => {
    const nextMode = !isPomodoroMode
    if (onUpdateTimerState) {
      onUpdateTimerState(timer.id, {
        isPomodoroMode: nextMode,
        isRunning: false,
        endTime: null,
        pomodoroStage: 'work',
        pomodoroRound: 1,
      })
    }
    setShowPomodoroConfig(false)
  }

  const commitPomodoroConfig = () => {
    const workSec = Math.max(1, (Number(configDraft.work) || 25)) * 60
    const shortSec = Math.max(1, (Number(configDraft.shortBreak) || 5)) * 60
    const longSec = Math.max(1, (Number(configDraft.longBreak) || 15)) * 60
    if (onUpdateTimerState) {
      onUpdateTimerState(timer.id, {
        pomodoroWork: workSec,
        pomodoroShortBreak: shortSec,
        pomodoroLongBreak: longSec,
        pomodoroStage: 'work',
        pomodoroRound: 1,
        isRunning: false,
        endTime: null,
      })
    }
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
      <header className="card-header" onPointerDown={onPointerDown} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
        <span className="card-title">{timer.title}</span>
        <button
          type="button"
          className={`pomodoro-toggle-btn ${isPomodoroMode ? 'is-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); togglePomodoroMode() }}
          onPointerDown={(e) => e.stopPropagation()}
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
