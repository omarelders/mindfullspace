import { useState, memo } from 'react'
import { CardContextMenu } from './CardContextMenu'

export const NoteCard = memo(function NoteCard({
  note,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onUpdateText,
  isPopping,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(note.text)

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
      className={`floating-card note-card card-note ${note.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: note.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
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
        isEditing ? (
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
        )
      )}
    </section>
  )
})
