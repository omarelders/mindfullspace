import { createSignal, Show, For } from 'solid-js'
import { Plus, Trash2, Edit2, Check, X, GripVertical, Link2 } from 'lucide-solid'
import { CardContextMenu } from './CardContextMenu'
import { sanitizeUrl } from '../utils/urlSafety'

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname
    return `https://s2.googleusercontent.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return null
  }
}

export function QuickLinksCard(props) {
  const cardStyle = () => props.quickLinkCard.color ? { '--card-custom-bg': props.quickLinkCard.color } : {}
  const fontStyle = () => props.quickLinkCard.fontSize ? { "font-size": `${props.quickLinkCard.fontSize}px` } : undefined
  const [isAdding, setIsAdding] = createSignal(false)
  const [editingItemId, setEditingItemId] = createSignal(null)

  // Form state
  const [formUrl, setFormUrl] = createSignal('')
  const [formLabel, setFormLabel] = createSignal('')

  // Drag state for reordering
  const [draggedItem, setDraggedItem] = createSignal(null)
  const [dragOverItem, setDragOverItem] = createSignal(null)

  const handleStartAdd = () => {
    setFormUrl('')
    setFormLabel('')
    setIsAdding(true)
    setEditingItemId(null)
  }

  const handleStartEdit = (item) => {
    setFormUrl(item.url)
    setFormLabel(item.label)
    setEditingItemId(item.id)
    setIsAdding(false)
  }

  const handleCancelForm = () => {
    setIsAdding(false)
    setEditingItemId(null)
  }

  const handleSubmitForm = (e) => {
    e.preventDefault()
    if (!formUrl().trim()) return

    // Single source of truth for URL validation: rejects dangerous schemes
    // (javascript:, data:, ...) and prepends https:// to bare domains.
    const finalUrl = sanitizeUrl(formUrl())
    if (!finalUrl) return

    let parsedHostname = ''
    try {
      parsedHostname = new URL(finalUrl).hostname
    } catch {
      return
    }

    const finalLabel = formLabel().trim() || parsedHostname

    if (isAdding()) {
      props.onAddLink(props.quickLinkCard.id, finalUrl, finalLabel)
    } else if (editingItemId()) {
      props.onUpdateLink(props.quickLinkCard.id, editingItemId(), finalUrl, finalLabel)
    }

    handleCancelForm()
  }

  // --- Drag and Drop Handlers for List Items ---
  const handleItemDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem(index)
  }

  const handleItemDragOver = (e, index) => {
    e.preventDefault()
    setDragOverItem(index)
  }

  const handleItemDrop = (e, dropIndex) => {
    e.preventDefault()
    if (draggedItem() !== null && draggedItem() !== dropIndex) {
      props.onReorderLinks(props.quickLinkCard.id, draggedItem(), dropIndex)
    }
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleItemDragEnd = () => {
    setDraggedItem(null)
    setDragOverItem(null)
  }

  return (
    <section
      class={`floating-card quick-links-card ${props.quickLinkCard.color ? 'has-custom-color' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        ...cardStyle(),
        ...fontStyle(),
      }}
      onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)}
      data-card-id={props.cardId}
    >
      <header class="card-header">
        <input
          class="card-title-input"
          value={props.quickLinkCard.title}
          onInput={(e) => props.onUpdateTitle(props.quickLinkCard.id, e.currentTarget.value)}
          placeholder="Quick Links"
          spellcheck={false}
        />
        <CardContextMenu
          showTitleInput={false}
          minimized={props.quickLinkCard.minimized}
          fontSize={props.quickLinkCard.fontSize || 13}
          onColorChange={(color) => props.onUpdateColor(props.quickLinkCard.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.quickLinkCard.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.quickLinkCard.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.quickLinkCard.id)}
          onDuplicate={() => props.onDuplicateCard(props.quickLinkCard.id)}
          onArchive={() => props.onArchiveCard(props.quickLinkCard.id)}
          onDelete={() => props.onDeleteCard(props.quickLinkCard.id)}
        />
      </header>

      <Show when={!props.quickLinkCard.minimized}>
        <div class="quick-links-body">
          <ul class="quick-links-list">
            <For each={props.quickLinkCard.links || []}>
              {(link, index) => {
                const isEditingThis = () => editingItemId() === link.id
                // Render-boundary validation: imported/legacy data may contain
                // unsafe schemes, so the href is always re-checked here.
                const safeUrl = sanitizeUrl(link.url)
                const faviconUrl = safeUrl ? getFaviconUrl(safeUrl) : null

                return (
                  <Show when={isEditingThis()} fallback={
                    <li
                      class={`quick-links-item ${dragOverItem() === index() ? 'is-drag-over' : ''} ${draggedItem() === index() ? 'is-dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, index())}
                      onDragOver={(e) => handleItemDragOver(e, index())}
                      onDrop={(e) => handleItemDrop(e, index())}
                      onDragEnd={handleItemDragEnd}
                    >
                      <div class="ql-drag-handle">
                        <GripVertical size={14} />
                      </div>

                      {safeUrl ? (
                        <a href={safeUrl} target="_blank" rel="noopener noreferrer" class="ql-link-content" onPointerDown={(e) => e.stopPropagation()}>
                          {faviconUrl ? (
                            <img src={faviconUrl} alt="" class="ql-favicon" onError={(e) => e.currentTarget.style.display = 'none'} />
                          ) : (
                            <Link2 size={14} class="ql-favicon-fallback" />
                          )}
                          <span class="ql-label" style={fontStyle()} title={link.url}>{link.label}</span>
                        </a>
                      ) : (
                        <span class="ql-link-content ql-link-invalid" title="Invalid or unsafe link" onPointerDown={(e) => e.stopPropagation()}>
                          {faviconUrl ? (
                            <img src={faviconUrl} alt="" class="ql-favicon" onError={(e) => e.currentTarget.style.display = 'none'} />
                          ) : (
                            <Link2 size={14} class="ql-favicon-fallback" />
                          )}
                          <span class="ql-label" style={fontStyle()} title={link.url}>{link.label}</span>
                        </span>
                      )}

                      <div class="ql-item-actions">
                        <button type="button" onClick={() => handleStartEdit(link)} class="ql-action-btn" title="Edit">
                          <Edit2 size={12} />
                        </button>
                        <button type="button" onClick={() => props.onRemoveLink(props.quickLinkCard.id, link.id)} class="ql-action-btn ql-action-delete" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </li>
                  }>
                    <li class="quick-links-form-item">
                      <form onSubmit={handleSubmitForm} class="quick-links-form">
                        <input
                          placeholder="URL (e.g., example.com)"
                          value={formUrl()}
                          onInput={(e) => setFormUrl(e.currentTarget.value)}
                          class="quick-links-input"
                        />
                        <input
                          placeholder="Label (optional)"
                          value={formLabel()}
                          onInput={(e) => setFormLabel(e.currentTarget.value)}
                          class="quick-links-input"
                        />
                        <div class="quick-links-form-actions">
                          <button type="submit" class="ql-btn ql-btn-primary"><Check size={14} /></button>
                          <button type="button" onClick={handleCancelForm} class="ql-btn ql-btn-secondary"><X size={14} /></button>
                        </div>
                      </form>
                    </li>
                  </Show>
                )
              }}
            </For>
          </ul>

          <Show
            when={isAdding()}
            fallback={
              <button type="button" class="quick-links-add-btn" onClick={handleStartAdd}>
                <Plus size={14} /> Add Link
              </button>
            }
          >
            <div class="quick-links-form-item">
              <form onSubmit={handleSubmitForm} class="quick-links-form">
                <input
                  placeholder="URL (e.g., example.com)"
                  value={formUrl()}
                  onInput={(e) => setFormUrl(e.currentTarget.value)}
                  class="quick-links-input"
                />
                <input
                  placeholder="Label (optional)"
                  value={formLabel()}
                  onInput={(e) => setFormLabel(e.currentTarget.value)}
                  class="quick-links-input"
                />
                <div class="quick-links-form-actions">
                  <button type="submit" class="ql-btn ql-btn-primary" disabled={!formUrl().trim()}><Check size={14} /></button>
                  <button type="button" onClick={handleCancelForm} class="ql-btn ql-btn-secondary"><X size={14} /></button>
                </div>
              </form>
            </div>
          </Show>
        </div>
      </Show>
    </section>
  )
}
