import { useState, useEffect, useRef, memo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'

export const CounterCard = memo(function CounterCard({
  counter,
  position,
  onPointerDown,
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
  const [animKey, setAnimKey] = useState(0)
  const [direction, setDirection] = useState(null) // 'up' | 'down' | null
  const [btnAnim, setBtnAnim] = useState(null) // 'inc' | 'dec' | null
  const btnAnimTimer = useRef(null)

  useEffect(() => {
    setValue(counter.initialValue ?? 0)
  }, [counter.initialValue, counter.id])

  const triggerValueAnim = (dir) => {
    setDirection(dir)
    setAnimKey(k => k + 1)
  }

  const triggerBtnAnim = (type) => {
    if (btnAnimTimer.current) clearTimeout(btnAnimTimer.current)
    setBtnAnim(type)
    btnAnimTimer.current = setTimeout(() => setBtnAnim(null), 300)
  }

  const handleIncrement = () => {
    const nextVal = value + 1
    setValue(nextVal)
    triggerValueAnim('up')
    triggerBtnAnim('inc')
    if (onUpdateValue) onUpdateValue(counter.id, nextVal)
  }

  const handleDecrement = () => {
    const nextVal = value - 1
    setValue(nextVal)
    triggerValueAnim('down')
    triggerBtnAnim('dec')
    if (onUpdateValue) onUpdateValue(counter.id, nextVal)
  }

  const resetCounter = () => {
    setValue(0)
    setDirection(null)
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
      <header className="card-header counter-header" onPointerDown={onPointerDown} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
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
            className={`counter-chevron-btn${btnAnim === 'inc' ? ' counter-btn-pulse-up' : ''}`}
            onClick={handleIncrement}
            aria-label="increase counter"
          >
            <ChevronUp aria-hidden="true" />
          </button>

          <div className="counter-value-clip">
            <div
              key={animKey}
              className={`counter-large-value${direction === 'up' ? ' counter-slide-up' : direction === 'down' ? ' counter-slide-down' : ''}`}
              onDoubleClick={resetCounter}
              title="Double-click to reset to 0"
            >
              {value}
            </div>
          </div>

          <button
            type="button"
            className={`counter-chevron-btn${btnAnim === 'dec' ? ' counter-btn-pulse-down' : ''}`}
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
