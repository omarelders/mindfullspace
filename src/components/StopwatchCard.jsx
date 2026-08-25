import { createSignal, createEffect, onCleanup, Show } from 'solid-js'
import { Play, Pause, RotateCcw } from 'lucide-solid'
import { CardContextMenu } from './CardContextMenu'
import { formatSecondsToTimer } from '../utils/dateUtils'

export function StopwatchCard(props) {
  const customStyle = () => props.stopwatch.fontSize ? { "font-size": `${props.stopwatch.fontSize}px` } : undefined
  const initialSeconds = () => Number.isFinite(props.stopwatch.initialSeconds) ? props.stopwatch.initialSeconds : 0
  const persistedSeconds = () => Number.isFinite(props.stopwatch.elapsedSeconds)
    ? props.stopwatch.elapsedSeconds
    : initialSeconds()

  const isRunning = () => Boolean(props.stopwatch.isRunning)
  const lastStartTime = () => props.stopwatch.lastStartTime || null

  const getElapsedSeconds = () => {
    if (!isRunning() || !lastStartTime()) return persistedSeconds()
    const diff = Math.floor((Date.now() - lastStartTime()) / 1000)
    return persistedSeconds() + diff
  }

  const [elapsedSeconds, setElapsedSeconds] = createSignal(getElapsedSeconds())

  // Sync display when paused / external updates arrive
  createEffect(() => {
    if (!isRunning()) {
      setElapsedSeconds(persistedSeconds())
    }
  })

  // Animation loop updating display only when visible second changes.
  // onCleanup inside createEffect clears the interval on re-evaluation AND disposal.
  createEffect(() => {
    if (!isRunning() || !lastStartTime()) return

    let intervalId
    const tick = () => {
      const current = getElapsedSeconds()
      setElapsedSeconds((prev) => (prev !== current ? current : prev))
    }

    tick()
    intervalId = setInterval(tick, 200)
    onCleanup(() => clearInterval(intervalId))
  })

  const toggleRunning = () => {
    if (!props.onUpdateStopwatchState) return

    if (isRunning()) {
      // Pause
      props.onUpdateStopwatchState(props.stopwatch.id, {
        isRunning: false,
        elapsedSeconds: elapsedSeconds(),
        lastStartTime: null,
      })
    } else {
      // Start
      props.onUpdateStopwatchState(props.stopwatch.id, {
        isRunning: true,
        lastStartTime: Date.now(),
      })
    }
  }

  const resetStopwatch = () => {
    if (!props.onUpdateStopwatchState) return

    props.onUpdateStopwatchState(props.stopwatch.id, {
      isRunning: false,
      elapsedSeconds: 0,
      initialSeconds: 0,
      lastStartTime: null,
    })
  }

  const timeParts = () => formatSecondsToTimer(elapsedSeconds()).split(':')

  return (
    <section
      data-card-id={props.cardId}
      class={`floating-card stopwatch-card card-stopwatch ${props.stopwatch.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.stopwatch.color || 'var(--card-stopwatch-bg)',
      }}
    >
      <div class="stopwatch-drag-handle" onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)} style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}>
        <CardContextMenu
          title={props.stopwatch.title || 'Stopwatch'}
          minimized={Boolean(props.stopwatch.minimized)}
          showTitleInput={false}
          fontSize={props.stopwatch.fontSize || 42}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.stopwatch.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.stopwatch.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.stopwatch.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.stopwatch.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.stopwatch.id)}
          onDuplicate={() => props.onDuplicateCard(props.stopwatch.id)}
          onArchive={() => props.onArchiveCard(props.stopwatch.id)}
          onDelete={() => props.onDeleteCard(props.stopwatch.id)}
        />
      </div>

      <Show when={!props.stopwatch.minimized}>
        <div class="stopwatch-panel">
          <div class="stopwatch-value" style={customStyle()}>
            {timeParts()[0]} <span class="stopwatch-colon">:</span> {timeParts()[1]} <span class="stopwatch-colon">:</span> {timeParts()[2]}
          </div>
          <div class="stopwatch-controls">
            <button
              type="button"
              class={`stopwatch-control play ${isRunning() ? 'is-running' : ''}`}
              onClick={toggleRunning}
              aria-label={isRunning() ? 'pause stopwatch' : 'start stopwatch'}
            >
              {isRunning() ? (
                <Pause aria-hidden="true" style={{ "padding-left": '0px' }} />
              ) : (
                <Play aria-hidden="true" style={{ "padding-left": '2px' }} />
              )}
            </button>

            <button type="button" class="stopwatch-control reset" onClick={resetStopwatch} aria-label="reset stopwatch">
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        </div>
      </Show>
    </section>
  )
}
