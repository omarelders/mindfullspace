import { useState, useEffect, memo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'

export const CounterCard = memo(function CounterCard({
  counter,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateValue,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  const initialValue = counter.initialValue ?? 0
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(counter.initialValue ?? 0)
  }, [counter.initialValue, counter.id])

  const handleIncrement = () => {
    const nextVal = value + 1
    setValue(nextVal)
    if (onUpdateValue) onUpdateValue(counter.id, nextVal)
  }

  const handleDecrement = () => {
    const nextVal = value - 1
    setValue(nextVal)
    if (onUpdateValue) onUpdateValue(counter.id, nextVal)
  }

  const resetCounter = () => {
    setValue(0)
    if (onUpdateValue) onUpdateValue(counter.id, 0)
  }

  return (
    <section
      className={`floating-card counter-card card-counter ${counter.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: counter.color || undefined,
      }}
    >
      <header className="card-header counter-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        {counter.title ? <span className="card-title">{counter.title}</span> : null}
        <CardContextMenu
          title={counter.title}
          minimized={Boolean(counter.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(counter.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(counter.id, color)}
          onMove={(targetId) => onMoveCard(counter.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(counter.id)}
          onDuplicate={() => onDuplicateCard(counter.id)}
          onArchive={() => onArchiveCard(counter.id)}
          onDelete={() => onDeleteCard(counter.id)}
        />
      </header>
      {!counter.minimized && (
        <div className="counter-panel">
          <button
            type="button"
            className="counter-chevron-btn"
            onClick={handleIncrement}
            aria-label="increase counter"
          >
            <ChevronUp aria-hidden="true" />
          </button>

          <div className="counter-large-value" onDoubleClick={resetCounter} title="Double-click to reset to 0">
            {value}
          </div>

          <button
            type="button"
            className="counter-chevron-btn"
            onClick={handleDecrement}
            aria-label="decrease counter"
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
})
