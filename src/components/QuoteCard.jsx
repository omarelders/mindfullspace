import { createSignal, onCleanup, Show } from 'solid-js'
import { CardContextMenu } from './CardContextMenu'
import { Quote } from 'lucide-solid'

export function QuoteCard(props) {
  const customStyle = () => props.quote.fontSize ? { "font-size": `${props.quote.fontSize}px` } : undefined
  const authorStyle = () => props.quote.fontSize ? { "font-size": `${Math.max(10, Math.round(props.quote.fontSize * 0.7))}px` } : undefined
  const [isEditingText, setIsEditingText] = createSignal(false)
  const [isEditingAuthor, setIsEditingAuthor] = createSignal(false)

  const [editText, setEditText] = createSignal(props.quote.text || '')
  const [editAuthor, setEditAuthor] = createSignal(props.quote.author || '')

  // If the card unmounts mid-resize (archive/delete/undo), remove the
  // document-level listeners so they don't leak.
  let resizeCleanup = null
  onCleanup(() => resizeCleanup?.())

  const handleResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const cardEl = e.currentTarget.closest('.quote-card')
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = props.quote.width || 320
    const startHeight = props.quote.height || 200
    let currentWidth = startWidth
    let currentHeight = startHeight
    let rafId = null

    const scale = typeof props.scale === 'function' ? props.scale() : props.scale

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

  const handleStartEditText = (e) => {
    e.stopPropagation()
    setEditText(props.quote.text || '')
    setIsEditingText(true)
  }

  const handleStartEditAuthor = (e) => {
    e.stopPropagation()
    setEditAuthor(props.quote.author || '')
    setIsEditingAuthor(true)
  }

  const handleCommitText = () => {
    setIsEditingText(false)
    if (props.onUpdateText && editText() !== props.quote.text) {
      props.onUpdateText(props.quote.id, editText())
    }
  }

  const handleCommitAuthor = () => {
    setIsEditingAuthor(false)
    if (props.onUpdateAuthor && editAuthor() !== props.quote.author) {
      props.onUpdateAuthor(props.quote.id, editAuthor())
    }
  }

  const handleTextKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditingText(false)
      setEditText(props.quote.text || '')
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCommitText()
    }
  }

  const handleAuthorKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditingAuthor(false)
      setEditAuthor(props.quote.author || '')
    } else if (e.key === 'Enter') {
      handleCommitAuthor()
    }
  }

  return (
    <section
      data-card-id={props.cardId}
      class={`floating-card quote-card ${props.quote.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        width: `${props.quote.width || 320}px`,
        height: `${props.quote.height || 200}px`,
        margin: props.position ? '0' : undefined,
        "background-color": props.quote.color || undefined,
      }}
    >
      <header class="card-header" onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)} style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}>
        <span class="card-title">{props.quote.title}</span>
        <CardContextMenu
          title={props.quote.title}
          minimized={Boolean(props.quote.minimized)}
          fontSize={props.quote.fontSize || 22}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.quote.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.quote.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.quote.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.quote.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.quote.id)}
          onDuplicate={() => props.onDuplicateCard(props.quote.id)}
          onArchive={() => props.onArchiveCard(props.quote.id)}
          onDelete={() => props.onDeleteCard(props.quote.id)}
        />
      </header>

      <Show when={!props.quote.minimized}>
        <div class="quote-content-wrapper">
          <Quote class="quote-watermark" aria-hidden="true" size={48} strokeWidth={1} />

          <div class="quote-body-container">
            <Show
              when={isEditingText()}
              fallback={
                <p class="quote-body" style={customStyle()} onClick={handleStartEditText}>
                  {props.quote.text ? `"${props.quote.text}"` : '"Click to edit quote..."'}
                </p>
              }
            >
              <textarea
                class="quote-text-edit"
                style={customStyle()}
                value={editText()}
                onInput={(e) => setEditText(e.currentTarget.value)}
                onBlur={handleCommitText}
                onKeyDown={handleTextKeyDown}
                placeholder="Enter quote here..."
              />
            </Show>
          </div>

          <div class="quote-author-container">
            <Show
              when={isEditingAuthor()}
              fallback={
                <span class="quote-author" style={authorStyle()} onClick={handleStartEditAuthor}>
                  {props.quote.author ? `- ${props.quote.author}` : '- Click to add author'}
                </span>
              }
            >
              <input
                type="text"
                class="quote-author-edit"
                style={authorStyle()}
                value={editAuthor()}
                onInput={(e) => setEditAuthor(e.currentTarget.value)}
                onBlur={handleCommitAuthor}
                onKeyDown={handleAuthorKeyDown}
                placeholder="Author name"
              />
            </Show>
          </div>

          <div
            class="card-resizer"
            onPointerDown={handleResizeStart}
            title="Resize quote"
          />
        </div>
      </Show>
    </section>
  )
}
