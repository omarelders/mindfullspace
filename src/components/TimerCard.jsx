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
    if (!isRunning) {
      setSecondsLeft(persistedSeconds)
      baseSecondsRef.current = persistedSeconds
    }
  }, [persistedSeconds, timer.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Accurate timing refs (same pattern as StopwatchCard) ──────────────────
  const startTimeRef = useRef(null)
  const baseSecondsRef = useRef(persistedSeconds)
  const hasFinishedRef = useRef(false)
  const justAdvancedRef = useRef(false)
  const lastPersistedRef = useRef(persistedSeconds)

  // Refs to always hold the latest pomodoro props inside the interval closure
  const isPomodoroModeRef = useRef(isPomodoroMode)
  const pomodoroStageRef = useRef(pomodoroStage)
  const timerTitleRef = useRef(timer.title)
  const timerIdRef = useRef(timer.id)
  const onUpdateRemainingSecondsRef = useRef(onUpdateRemainingSeconds)

  useEffect(() => { isPomodoroModeRef.current = isPomodoroMode }, [isPomodoroMode])
  useEffect(() => { pomodoroStageRef.current = pomodoroStage }, [pomodoroStage])
  useEffect(() => { timerTitleRef.current = timer.title }, [timer.title])
  useEffect(() => { timerIdRef.current = timer.id }, [timer.id])
  useEffect(() => { onUpdateRemainingSecondsRef.current = onUpdateRemainingSeconds }, [onUpdateRemainingSeconds])

  // ── Core timer interval — only restarted when isRunning toggles ──────────
  useEffect(() => {
    if (!isRunning) return undefined

    // Capture the wall-clock start moment and the seconds we had on resume
    startTimeRef.current = Date.now()
    baseSecondsRef.current = secondsLeft // snapshot current value at the moment of start
    hasFinishedRef.current = false

    const intervalId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const next = Math.max(0, baseSecondsRef.current - elapsed)

      setSecondsLeft(next)

      // Persist every 5 seconds to avoid hammering the parent state
      if (next !== lastPersistedRef.current && next % 5 === 0 && onUpdateRemainingSecondsRef.current) {
        lastPersistedRef.current = next
        onUpdateRemainingSecondsRef.current(timerIdRef.current, next)
      }

      // Timer has hit zero — fire once
      if (next <= 0 && !hasFinishedRef.current) {
        hasFinishedRef.current = true

        const stage = pomodoroStageRef.current
        const isPomodoro = isPomodoroModeRef.current
        playBeep(isPomodoro ? POMODORO_STAGES[stage]?.freq || 880 : 880, 1.5)
        fireNotification(
          timerTitleRef.current || (isPomodoro ? POMODORO_STAGES[stage]?.label : 'Timer'),
          'Time is up!'
        )

        if (!isPomodoro) {
          setIsRunning(false)
          if (onUpdateRemainingSecondsRef.current) onUpdateRemainingSecondsRef.current(timerIdRef.current, 0)
        } else {
          justAdvancedRef.current = true
          setIsRunning(false)
        }
      }
    }, 200) // 200ms — smooth display, no per-second drift

    return () => window.clearInterval(intervalId)
    // ⚠️  secondsLeft intentionally omitted — captured in baseSecondsRef above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning])

  // ── Pomodoro stage transition (runs after interval stops when secondsLeft = 0) ──
  useEffect(() => {
    if (
      secondsLeft === 0 &&
      isPomodoroMode &&
      justAdvancedRef.current &&
      onUpdatePomodoroConfig &&
      onUpdateRemainingSeconds &&
      onUpdateInitialSeconds
    ) {
      justAdvancedRef.current = false
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

      onUpdatePomodoroConfig(timer.id, { pomodoroStage: nextStage, pomodoroRound: nextRound })
      onUpdateInitialSeconds(timer.id, nextDuration)
      onUpdateRemainingSeconds(timer.id, nextDuration)
      setSecondsLeft(nextDuration)
      baseSecondsRef.current = nextDuration
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
    setIsRunning((prev) => !prev)
  }

  const resetTimer = () => {
    setIsRunning(false)
    if (isPomodoroMode && onUpdatePomodoroConfig) {
      onUpdatePomodoroConfig(timer.id, { pomodoroStage: 'work', pomodoroRound: 1 })
      setSecondsLeft(pomodoroWork)
      baseSecondsRef.current = pomodoroWork
      if (onUpdateRemainingSeconds) onUpdateRemainingSeconds(timer.id, pomodoroWork)
      if (onUpdateInitialSeconds) onUpdateInitialSeconds(timer.id, pomodoroWork)
    } else {
      setSecondsLeft(initialSeconds)
      baseSecondsRef.current = initialSeconds
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
    baseSecondsRef.current = parsed
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
