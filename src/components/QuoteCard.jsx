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
  onUpdateFontSize,
  onUpdateDimensions,
  scale,
  isPopping,
  cardId,
}) {
  const customStyle = quote.fontSize ? { fontSize: `${quote.fontSize}px` } : undefined
  const authorStyle = quote.fontSize ? { fontSize: `${Math.max(10, Math.round(quote.fontSize * 0.7))}px` } : undefined
  const [isEditingText, setIsEditingText] = useState(false)
  const [isEditingAuthor, setIsEditingAuthor] = useState(false)

  const [editText, setEditText] = useState(quote.text || '')
  const [editAuthor, setEditAuthor] = useState(quote.author || '')

  const handleResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const cardEl = e.currentTarget.closest('.quote-card')
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = quote.width || 320
    const startHeight = quote.height || 200
    let currentWidth = startWidth
    let currentHeight = startHeight
    let rafId = null

    const handlePointerMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale

      currentWidth = Math.max(220, startWidth + deltaX)
      currentHeight = Math.max(120, startHeight + deltaY)

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
      data-card-id={cardId}
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
      <header className="card-header" onPointerDown={(e) => onPointerDown(cardId, e)} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
        <span className="card-title">{quote.title}</span>
        <CardContextMenu
          title={quote.title}
          minimized={Boolean(quote.minimized)}
          fontSize={quote.fontSize || 22}
          onTitleChange={(nextTitle) => onUpdateTitle(quote.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(quote.id, color)}
          onFontSizeChange={(nextSize) => onUpdateFontSize && onUpdateFontSize(quote.id, nextSize)}
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
                style={customStyle}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleCommitText}
                onKeyDown={handleTextKeyDown}
                autoFocus
                placeholder="Enter quote here..."
              />
            ) : (
              <p className="quote-body" style={customStyle} onClick={handleStartEditText}>
                {quote.text ? `"${quote.text}"` : '"Click to edit quote..."'}
              </p>
            )}
          </div>

          <div className="quote-author-container">
            {isEditingAuthor ? (
              <input
                type="text"
                className="quote-author-edit"
                style={authorStyle}
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                onBlur={handleCommitAuthor}
                onKeyDown={handleAuthorKeyDown}
                autoFocus
                placeholder="Author name"
              />
            ) : (
              <span className="quote-author" style={authorStyle} onClick={handleStartEditAuthor}>
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
