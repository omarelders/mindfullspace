import { useState, memo } from 'react'
import { CardContextMenu } from './CardContextMenu'
import { Quote } from 'lucide-react'

export const QuoteCard = memo(function QuoteCard({
  quote,
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
  onUpdateAuthor,
  onUpdateDimensions,
  scale,
  isPopping,
}) {
  const [isEditingText, setIsEditingText] = useState(false)
  const [isEditingAuthor, setIsEditingAuthor] = useState(false)

  const [editText, setEditText] = useState(quote.text || '')
  const [editAuthor, setEditAuthor] = useState(quote.author || '')

  const handleResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = quote.width || 320
    const startHeight = quote.height || 200

    const handlePointerMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale

      const newWidth = Math.max(220, startWidth + deltaX)
      const newHeight = Math.max(120, startHeight + deltaY)

      onUpdateDimensions(newWidth, newHeight)
    }

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const handleStartEditText = (e) => {
    e.stopPropagation()
    setEditText(quote.text || '')
    setIsEditingText(true)
  }

  const handleStartEditAuthor = (e) => {
    e.stopPropagation()
    setEditAuthor(quote.author || '')
    setIsEditingAuthor(true)
  }

  const handleCommitText = () => {
    setIsEditingText(false)
    if (onUpdateText && editText !== quote.text) {
      onUpdateText(quote.id, editText)
    }
  }

  const handleCommitAuthor = () => {
    setIsEditingAuthor(false)
    if (onUpdateAuthor && editAuthor !== quote.author) {
      onUpdateAuthor(quote.id, editAuthor)
    }
  }

  const handleTextKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditingText(false)
      setEditText(quote.text || '')
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCommitText()
    }
  }

  const handleAuthorKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditingAuthor(false)
      setEditAuthor(quote.author || '')
    } else if (e.key === 'Enter') {
      handleCommitAuthor()
    }
  }

  return (
    <section
      className={`floating-card quote-card ${quote.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        width: quote.width || 320,
        height: quote.height || 200,
        margin: position ? 0 : undefined,
        backgroundColor: quote.color || undefined,
      }}
    >
      <header className="card-header" onPointerDown={onPointerDown} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
        <span className="card-title">{quote.title}</span>
        <CardContextMenu
          title={quote.title}
          minimized={Boolean(quote.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(quote.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(quote.id, color)}
          onMove={(targetId) => onMoveCard(quote.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(quote.id)}
          onDuplicate={() => onDuplicateCard(quote.id)}
          onArchive={() => onArchiveCard(quote.id)}
          onDelete={() => onDeleteCard(quote.id)}
        />
      </header>

      {!quote.minimized && (
        <div className="quote-content-wrapper">
          <Quote className="quote-watermark" aria-hidden="true" size={48} strokeWidth={1} />

          <div className="quote-body-container">
            {isEditingText ? (
              <textarea
                className="quote-text-edit"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleCommitText}
                onKeyDown={handleTextKeyDown}
                autoFocus
                placeholder="Enter quote here..."
              />
            ) : (
              <p className="quote-body" onClick={handleStartEditText}>
                {quote.text ? `"${quote.text}"` : '"Click to edit quote..."'}
              </p>
            )}
          </div>

          <div className="quote-author-container">
            {isEditingAuthor ? (
              <input
                type="text"
                className="quote-author-edit"
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                onBlur={handleCommitAuthor}
                onKeyDown={handleAuthorKeyDown}
                autoFocus
                placeholder="Author name"
              />
            ) : (
              <span className="quote-author" onClick={handleStartEditAuthor}>
                {quote.author ? `- ${quote.author}` : '- Click to add author'}
              </span>
            )}
          </div>

          <div
            className="card-resizer"
            onPointerDown={handleResizeStart}
            title="Resize quote"
          />
        </div>
      )}
    </section>
  )
})
