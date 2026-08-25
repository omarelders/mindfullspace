import { createSignal, onCleanup, Show } from 'solid-js'
import { CardContextMenu } from './CardContextMenu'

export function NoteCard(props) {
  const [isEditing, setIsEditing] = createSignal(false)
  const [editValue, setEditValue] = createSignal(props.note.text)

  // If the card unmounts mid-resize (archive/delete/undo), remove the
  // document-level listeners so they don't leak.
  let resizeCleanup = null
  onCleanup(() => resizeCleanup?.())

  const handleResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const cardEl = e.currentTarget.closest('.note-card')
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = props.note.width || 280
    const startHeight = props.note.height || 220
    let currentWidth = startWidth
    let currentHeight = startHeight
    let rafId = null

    const scale = typeof props.scale === 'function' ? props.scale() : props.scale

    const handlePointerMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale

      currentWidth = Math.max(180, startWidth + deltaX)
      currentHeight = Math.max(100, startHeight + deltaY)

      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (cardEl) {
          cardEl.style.width = `${currentWidth}px`
          cardEl.style.height = `${currentHeight}px`
        }
      })
    }

    const handlePointerUp = () => {
      resizeCleanup = null
      if (rafId) cancelAnimationFrame(rafId)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      if (props.onUpdateDimensions && (currentWidth !== startWidth || currentHeight !== startHeight)) {
        props.onUpdateDimensions(currentWidth, currentHeight)
      }
    }

    resizeCleanup = () => {
      if (rafId) cancelAnimationFrame(rafId)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const handleStartEdit = (e) => {
    e.stopPropagation()
    setEditValue(props.note.text)
    setIsEditing(true)
  }

  const handleCommitEdit = () => {
    setIsEditing(false)
    if (props.onUpdateText && editValue() !== props.note.text) {
      props.onUpdateText(props.note.id, editValue())
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(props.note.text)
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCommitEdit()
    }
  }

  return (
    <section
      data-card-id={props.cardId}
      class={`floating-card note-card card-note ${props.note.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        width: props.note.width !== undefined ? `${props.note.width}px` : undefined,
        height: props.note.height !== undefined ? `${props.note.height}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.note.color || undefined,
      }}
    >
      <header class="card-header" onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)} style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}>
        <span class="card-title">{props.note.title}</span>
        <CardContextMenu
          title={props.note.title}
          minimized={Boolean(props.note.minimized)}
          fontSize={props.note.fontSize || 14}
          maxFontSize={48}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.note.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.note.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize(props.note.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.note.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.note.id)}
          onDuplicate={() => props.onDuplicateCard(props.note.id)}
          onArchive={() => props.onArchiveCard(props.note.id)}
          onDelete={() => props.onDeleteCard(props.note.id)}
        />
      </header>
      <Show when={!props.note.minimized}>
        <>
          <Show
            when={isEditing()}
            fallback={
              <p
                class="note-content"
                onClick={handleStartEdit}
                style={{ height: 'calc(100% - 36px)', "font-size": props.note.fontSize ? `${props.note.fontSize}px` : undefined }}
              >
                {props.note.text || 'Click to edit note...'}
              </p>
            }
          >
            <textarea
              class="note-text-edit"
              value={editValue()}
              onInput={(e) => setEditValue(e.currentTarget.value)}
              onBlur={handleCommitEdit}
              onKeyDown={handleKeyDown}
              style={{
                "font-size": props.note.fontSize ? `${props.note.fontSize}px` : undefined,
              }}
            />
          </Show>
          <div
            class="note-resizer"
            onPointerDown={handleResizeStart}
            title="Resize note"
          />
        </>
      </Show>
    </section>
  )
}
