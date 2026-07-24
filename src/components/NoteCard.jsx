import { useState, memo } from 'react'
import { CardContextMenu } from './CardContextMenu'

export const NoteCard = memo(function NoteCard({
  note,
  position,
  onPointerDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onUpdateText,
  onUpdateDimensions,
  scale,
  isPopping,
  cardId,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(note.text)

  const handleResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const cardEl = e.currentTarget.closest('.note-card')
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = note.width || 280
    const startHeight = note.height || 220
    let currentWidth = startWidth
    let currentHeight = startHeight
    let rafId = null

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
      if (rafId) cancelAnimationFrame(rafId)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      if (onUpdateDimensions && (currentWidth !== startWidth || currentHeight !== startHeight)) {
        onUpdateDimensions(currentWidth, currentHeight)
      }
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const handleStartEdit = (e) => {
    e.stopPropagation()
    setEditValue(note.text)
    setIsEditing(true)
  }

  const handleCommitEdit = () => {
    setIsEditing(false)
    if (onUpdateText && editValue !== note.text) {
      onUpdateText(note.id, editValue)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(note.text)
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCommitEdit()
    }
  }

  return (
    <section
      data-card-id={cardId}
      className={`floating-card note-card card-note ${note.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        width: note.width || undefined,
        height: note.height || undefined,
        margin: position ? 0 : undefined,
        backgroundColor: note.color || undefined,
      }}
    >
      <header className="card-header" onPointerDown={(e) => onPointerDown(cardId, e)} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
        <span className="card-title">{note.title}</span>
        <CardContextMenu
          title={note.title}
          minimized={Boolean(note.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(note.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(note.id, color)}
          onMove={(targetId) => onMoveCard(note.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(note.id)}
          onDuplicate={() => onDuplicateCard(note.id)}
          onArchive={() => onArchiveCard(note.id)}
          onDelete={() => onDeleteCard(note.id)}
        />
      </header>
      {!note.minimized && (
        <>
          {isEditing ? (
            <textarea
              className="note-text-edit"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCommitEdit}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <p className="note-content" onClick={handleStartEdit} style={{ height: 'calc(100% - 36px)' }}>
              {note.text || 'Click to edit note...'}
            </p>
          )}
          <div 
            className="note-resizer" 
            onPointerDown={handleResizeStart}
            title="Resize note"
          />
        </>
      )}
    </section>
  )
})
