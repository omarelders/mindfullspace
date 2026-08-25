import { createSignal, createEffect, onCleanup, Show } from 'solid-js'
import { Play, Pause, Pencil, RotateCcw } from 'lucide-solid'
import { CardContextMenu } from './CardContextMenu'
import { formatSecondsToTimer, parseTimerValue } from '../utils/dateUtils'
import { playBeep, fireNotification } from '../utils/audio'

const POMODORO_STAGES = {
  work: { label: '🍅 Work', next: 'short-break', freq: 880 },
  'short-break': { label: '☕ Short Break', next: 'work', freq: 528 },
  'long-break': { label: '🛌 Long Break', next: 'work', freq: 440 },
}

export function TimerCard(props) {
  const customStyle = () => props.timer.fontSize ? { "font-size": `${props.timer.fontSize}px` } : undefined
  const initialSeconds = () => Number.isFinite(props.timer.initialSeconds) ? props.timer.initialSeconds : 2700
  const persistedSeconds = () => Number.isFinite(props.timer.remainingSeconds) ? props.timer.remainingSeconds : initialSeconds()
  const isRunning = () => Boolean(props.timer.isRunning)
  const endTime = () => props.timer.endTime || null

  const getSecondsLeft = () => {
    if (!isRunning() || !endTime()) return persistedSeconds()
    const left = Math.floor((endTime() - Date.now()) / 1000)
    return Math.max(0, left)
  }

  const [secondsLeft, setSecondsLeft] = createSignal(getSecondsLeft())
  const [isEditing, setIsEditing] = createSignal(false)
  const [editValue, setEditValue] = createSignal('')

  const isPomodoroMode = () => Boolean(props.timer.isPomodoroMode)
  const pomodoroWork = () => props.timer.pomodoroWork || 25 * 60
  const pomodoroShortBreak = () => props.timer.pomodoroShortBreak || 5 * 60
  const pomodoroLongBreak = () => props.timer.pomodoroLongBreak || 15 * 60
  const pomodoroStage = () => props.timer.pomodoroStage || 'work'
  const pomodoroRound = () => props.timer.pomodoroRound || 1

  const [showPomodoroConfig, setShowPomodoroConfig] = createSignal(false)
  const [configDraft, setConfigDraft] = createSignal({
    work: Math.floor(pomodoroWork() / 60),
    shortBreak: Math.floor(pomodoroShortBreak() / 60),
    longBreak: Math.floor(pomodoroLongBreak() / 60),
  })

  // Keep the config draft in sync when the stored pomodoro values change
  // externally (undo, import, cross-tab sync).
  createEffect(() => {
    const work = pomodoroWork()
    const shortBreak = pomodoroShortBreak()
    const longBreak = pomodoroLongBreak()
    setConfigDraft({
      work: Math.floor(work / 60),
      shortBreak: Math.floor(shortBreak / 60),
      longBreak: Math.floor(longBreak / 60),
    })
  })

  // Sync display when paused / external updates arrive
  createEffect(() => {
    if (!isRunning()) {
      setSecondsLeft(persistedSeconds())
    }
  })

  let hasFinished = false

  // Animation loop updating display only when visible second changes.
  // onCleanup inside createEffect clears the interval on re-evaluation AND disposal.
  createEffect(() => {
    if (!isRunning() || !endTime()) return

    // Reset notification trigger if timer is started
    if (getSecondsLeft() > 0) {
      hasFinished = false
    }

    const tick = () => {
      const left = getSecondsLeft()
      setSecondsLeft((prev) => (prev !== left ? left : prev))

      // Timer has hit zero — fire once
      if (left <= 0 && !hasFinished) {
        hasFinished = true

        const stage = pomodoroStage()
        const isPomodoro = isPomodoroMode()
        playBeep(isPomodoro ? POMODORO_STAGES[stage]?.freq || 880 : 880, 1.5)
        fireNotification(
          props.timer.title || (isPomodoro ? POMODORO_STAGES[stage]?.label : 'Timer'),
          'Time is up!'
        )

        if (!isPomodoro) {
          if (props.onUpdateTimerState) {
            props.onUpdateTimerState(props.timer.id, { isRunning: false, remainingSeconds: 0, endTime: null })
          }
        } else {
           // auto transition logic
           let nextStage = POMODORO_STAGES[stage]?.next || 'work'
           let nextRound = pomodoroRound()

           if (stage === 'work') {
             nextStage = nextRound >= 4 ? 'long-break' : 'short-break'
           } else if (stage === 'long-break') {
             nextStage = 'work'
             nextRound = 1
           } else if (stage === 'short-break') {
             nextStage = 'work'
             nextRound = nextRound + 1
           }

           const nextDuration =
             nextStage === 'work' ? pomodoroWork() :
             nextStage === 'short-break' ? pomodoroShortBreak() :
             pomodoroLongBreak()

           if (props.onUpdateTimerState) {
             props.onUpdateTimerState(props.timer.id, {
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
    }

    tick()
    const intervalId = setInterval(tick, 200)
    onCleanup(() => clearInterval(intervalId))
  })

  const toggleRunning = () => {
    if (secondsLeft() <= 0 && !isRunning()) return // don't start at 0 unless pomodoro resets
    if (!props.onUpdateTimerState) return

    if (isRunning()) {
      // Pause
      props.onUpdateTimerState(props.timer.id, {
        isRunning: false,
        remainingSeconds: secondsLeft(),
        endTime: null,
      })
    } else {
      // Start
      props.onUpdateTimerState(props.timer.id, {
        isRunning: true,
        endTime: Date.now() + secondsLeft() * 1000,
      })
    }
  }

  const resetTimer = () => {
    if (!props.onUpdateTimerState) return

    if (isPomodoroMode()) {
      props.onUpdateTimerState(props.timer.id, {
        isRunning: false,
        remainingSeconds: pomodoroWork(),
        initialSeconds: pomodoroWork(),
        endTime: null,
        pomodoroStage: 'work',
        pomodoroRound: 1,
      })
    } else {
      props.onUpdateTimerState(props.timer.id, {
        isRunning: false,
        remainingSeconds: initialSeconds(),
        endTime: null,
      })
    }
  }

  const startEditing = () => {
    if (isRunning() && props.onUpdateTimerState) {
       props.onUpdateTimerState(props.timer.id, { isRunning: false, remainingSeconds: secondsLeft(), endTime: null })
    }
    setEditValue(formatSecondsToTimer(secondsLeft()))
    setIsEditing(true)
  }

  const cancelEditing = () => { setIsEditing(false) }

  const commitEditing = () => {
    const rawValue = editValue().trim()
    if (!rawValue) { cancelEditing(); return }
    const parsed = parseTimerValue(rawValue)
    if (parsed === null) { cancelEditing(); return }
    setIsEditing(false)
    if (props.onUpdateTimerState) {
       props.onUpdateTimerState(props.timer.id, { isRunning: false, remainingSeconds: parsed, initialSeconds: parsed, endTime: null })
    }
  }

  const togglePomodoroMode = () => {
    const nextMode = !isPomodoroMode()
    if (props.onUpdateTimerState) {
      props.onUpdateTimerState(props.timer.id, {
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
    const workSec = Math.max(1, (Number(configDraft().work) || 25)) * 60
    const shortSec = Math.max(1, (Number(configDraft().shortBreak) || 5)) * 60
    const longSec = Math.max(1, (Number(configDraft().longBreak) || 15)) * 60
    if (props.onUpdateTimerState) {
      props.onUpdateTimerState(props.timer.id, {
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

  const stageLabel = () => POMODORO_STAGES[pomodoroStage()]?.label || '🍅 Work'
  const updateConfigField = (field) => (e) => setConfigDraft((d) => ({ ...d, [field]: e.currentTarget.value }))

  return (
    <section
      data-card-id={props.cardId}
      class={`floating-card timer-card card-timer ${props.timer.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''} ${isPomodoroMode() ? 'pomodoro-active' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.timer.color || undefined,
      }}
    >
      <header class="card-header" onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)} style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}>
        <span class="card-title">{props.timer.title}</span>
        <button
          type="button"
          class={`pomodoro-toggle-btn ${isPomodoroMode() ? 'is-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); togglePomodoroMode() }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={isPomodoroMode() ? 'Disable Pomodoro mode' : 'Enable Pomodoro mode'}
          title={isPomodoroMode() ? 'Disable Pomodoro' : 'Enable Pomodoro'}
        >
          🍅
        </button>
        <CardContextMenu
          title={props.timer.title}
          minimized={Boolean(props.timer.minimized)}
          fontSize={props.timer.fontSize || 38}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.timer.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.timer.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.timer.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.timer.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.timer.id)}
          onDuplicate={() => props.onDuplicateCard(props.timer.id)}
          onArchive={() => props.onArchiveCard(props.timer.id)}
          onDelete={() => props.onDeleteCard(props.timer.id)}
        />
      </header>

      <Show when={!props.timer.minimized}>
        <div class="timer-panel">
          {/* Pomodoro stage indicator */}
          <Show when={isPomodoroMode()}>
            <div class="pomodoro-stage-bar">
              <span class="pomodoro-stage-label">{stageLabel()}</span>
              <span class="pomodoro-round-badge">Round {Math.min(pomodoroRound(), 4)}/4</span>
              <button
                type="button"
                class="pomodoro-config-btn"
                onClick={() => setShowPomodoroConfig((v) => !v)}
                aria-label="Configure Pomodoro"
              >
                ⚙
              </button>
            </div>
          </Show>

          {/* Pomodoro config panel */}
          <Show when={isPomodoroMode() && showPomodoroConfig()}>
            <div class="pomodoro-config-panel">
              <label class="pomodoro-config-row">
                <span>Work (min)</span>
                <input
                  type="number"
                  class="pomodoro-config-input"
                  min={1}
                  max={120}
                  value={configDraft().work}
                  onInput={updateConfigField('work')}
                />
              </label>
              <label class="pomodoro-config-row">
                <span>Short break (min)</span>
                <input
                  type="number"
                  class="pomodoro-config-input"
                  min={1}
                  max={60}
                  value={configDraft().shortBreak}
                  onInput={updateConfigField('shortBreak')}
                />
              </label>
              <label class="pomodoro-config-row">
                <span>Long break (min)</span>
                <input
                  type="number"
                  class="pomodoro-config-input"
                  min={1}
                  max={120}
                  value={configDraft().longBreak}
                  onInput={updateConfigField('longBreak')}
                />
              </label>
              <button type="button" class="pomodoro-apply-btn" onClick={commitPomodoroConfig}>
                Apply & Reset
              </button>
            </div>
          </Show>

          {/* Timer display */}
          <Show
            when={isEditing()}
            fallback={
              <>
                <div class={`timer-value ${secondsLeft() === 0 ? 'timer-value-done' : ''}`} style={customStyle()}>
                  {formatSecondsToTimer(secondsLeft())}
                </div>
                <div class="timer-controls">
                  <button
                    type="button"
                    class={`timer-control play ${isRunning() ? 'is-running' : ''}`}
                    onClick={toggleRunning}
                    aria-label={isRunning() ? 'pause timer' : 'start timer'}
                    disabled={!isRunning() && secondsLeft() <= 0}
                  >
                    {isRunning() ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  </button>

                  <Show when={!isPomodoroMode()}>
                    <button type="button" class="timer-control" onClick={startEditing} aria-label="edit timer value">
                      <Pencil aria-hidden="true" />
                    </button>
                  </Show>

                  <button type="button" class="timer-control" onClick={resetTimer} aria-label="reset timer">
                    <RotateCcw aria-hidden="true" />
                  </button>
                </div>
              </>
            }
          >
            <input
              type="text"
              class="timer-value-edit"
              value={editValue()}
              onInput={(e) => setEditValue(e.currentTarget.value)}
              onBlur={commitEditing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEditing()
                if (e.key === 'Escape') cancelEditing()
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                "font-size": props.timer.fontSize ? `${props.timer.fontSize}px` : '2rem',
                "font-weight": '600',
                "text-align": 'center',
                width: '100%',
                outline: 'none',
              }}
            />
          </Show>
        </div>
      </Show>
    </section>
  )
}
