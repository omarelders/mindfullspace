import { createSignal, onCleanup, Show } from 'solid-js'
import { ChevronUp, ChevronDown } from 'lucide-solid'
import { CardContextMenu } from './CardContextMenu'
import { playAchievementSound } from '../utils/audio'

export function CounterCard(props) {
  const customStyle = () => props.counter.fontSize ? { "font-size": `${props.counter.fontSize}px` } : undefined
  // The store is the single source of truth for the value — no local mirror to
  // desync. Computing from props is safe even on rapid clicks.
  const value = () => props.counter.initialValue ?? 0

  // Animation remount key: bumping it makes <Show keyed> recreate the value
  // node so the slide animation restarts (replaces React's key={animKey}).
  const [animKey, setAnimKey] = createSignal(1)
  const [direction, setDirection] = createSignal(null) // 'up' | 'down' | null
  const [btnAnim, setBtnAnim] = createSignal(null) // 'inc' | 'dec' | null
  let btnAnimTimer = null

  onCleanup(() => {
    if (btnAnimTimer) clearTimeout(btnAnimTimer)
  })

  const triggerValueAnim = (dir) => {
    setDirection(dir)
    setAnimKey((k) => k + 1)
  }

  const triggerBtnAnim = (type) => {
    if (btnAnimTimer) clearTimeout(btnAnimTimer)
    setBtnAnim(type)
    btnAnimTimer = setTimeout(() => setBtnAnim(null), 300)
  }

  const handleIncrement = () => {
    triggerValueAnim('up')
    triggerBtnAnim('inc')
    playAchievementSound()
    if (props.onUpdateValue) props.onUpdateValue(props.counter.id, value() + 1)
  }

  const handleDecrement = () => {
    triggerValueAnim('down')
    triggerBtnAnim('dec')
    if (props.onUpdateValue) props.onUpdateValue(props.counter.id, value() - 1)
  }

  const resetCounter = () => {
    setDirection(null)
    if (props.onUpdateValue) props.onUpdateValue(props.counter.id, 0)
  }

  return (
    <section
      data-card-id={props.cardId}
      class={`floating-card counter-card card-counter ${props.counter.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.counter.color || undefined,
      }}
    >
      <header
        class="card-header counter-header"
        onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)}
        style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}
      >
        <Show when={props.counter.title}>
          <span class="card-title">{props.counter.title}</span>
        </Show>
        <CardContextMenu
          title={props.counter.title}
          minimized={Boolean(props.counter.minimized)}
          fontSize={props.counter.fontSize || 62}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.counter.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.counter.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.counter.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.counter.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.counter.id)}
          onDuplicate={() => props.onDuplicateCard(props.counter.id)}
          onArchive={() => props.onArchiveCard(props.counter.id)}
          onDelete={() => props.onDeleteCard(props.counter.id)}
        />
      </header>
      <Show when={!props.counter.minimized}>
        <div class="counter-panel">
          <button
            type="button"
            class={`counter-chevron-btn${btnAnim() === 'inc' ? ' counter-btn-pulse-up' : ''}`}
            onClick={handleIncrement}
            aria-label="increase counter"
          >
            <ChevronUp aria-hidden="true" />
          </button>

          <div class="counter-value-clip">
            <Show when={animKey()} keyed>
              {() => (
                <div
                  class={`counter-large-value${direction() === 'up' ? ' counter-slide-up' : direction() === 'down' ? ' counter-slide-down' : ''}`}
                  style={customStyle()}
                  onDblClick={resetCounter}
                  title="Double-click to reset to 0"
                >
                  {value()}
                </div>
              )}
            </Show>
          </div>

          <button
            type="button"
            class={`counter-chevron-btn${btnAnim() === 'dec' ? ' counter-btn-pulse-down' : ''}`}
            onClick={handleDecrement}
            aria-label="decrease counter"
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </Show>
    </section>
  )
}
