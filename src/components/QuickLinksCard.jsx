import React, { useState, useRef, useEffect, memo } from 'react'
import { Plus, Trash2, Edit2, Check, X, GripVertical, Link2 } from 'lucide-react'
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

export const QuickLinksCard = memo(function QuickLinksCard({
  quickLinkCard,
  position,
  onPointerDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onAddLink,
  onUpdateLink,
  onRemoveLink,
  onReorderLinks,
  onUpdateFontSize,
  isPopping,
  cardId
}) {
  const cardStyle = quickLinkCard.color ? { '--card-custom-bg': quickLinkCard.color } : {}
  const fontStyle = quickLinkCard.fontSize ? { fontSize: `${quickLinkCard.fontSize}px` } : undefined
  const [isAdding, setIsAdding] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  
  // Form state
  const [formUrl, setFormUrl] = useState('')
  const [formLabel, setFormLabel] = useState('')

  // Drag state for reordering
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverItem, setDragOverItem] = useState(null)

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
    if (!formUrl.trim()) return

    // Single source of truth for URL validation: rejects dangerous schemes
    // (javascript:, data:, ...) and prepends https:// to bare domains.
    const finalUrl = sanitizeUrl(formUrl)
    if (!finalUrl) return

    let parsedHostname = ''
    try {
      parsedHostname = new URL(finalUrl).hostname
    } catch {
      return
    }

    const finalLabel = formLabel.trim() || parsedHostname

    if (isAdding) {
      onAddLink(quickLinkCard.id, finalUrl, finalLabel)
    } else if (editingItemId) {
      onUpdateLink(quickLinkCard.id, editingItemId, finalUrl, finalLabel)
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
    if (draggedItem !== null && draggedItem !== dropIndex) {
      onReorderLinks(quickLinkCard.id, draggedItem, dropIndex)
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
      className={`floating-card quick-links-card ${quickLinkCard.color ? 'has-custom-color' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        ...cardStyle,
        ...fontStyle,
      }}
      onPointerDown={(e) => onPointerDown(cardId, e)}
      data-card-id={cardId}
    >
      <header className="card-header">
        <input
          className="card-title-input"
          value={quickLinkCard.title}
          onChange={(e) => onUpdateTitle(quickLinkCard.id, e.target.value)}
          placeholder="Quick Links"
          spellCheck="false"
        />
        <CardContextMenu
          showTitleInput={false}
          minimized={quickLinkCard.minimized}
          fontSize={quickLinkCard.fontSize || 13}
          onColorChange={(color) => onUpdateColor(quickLinkCard.id, color)}
          onFontSizeChange={(nextSize) => onUpdateFontSize && onUpdateFontSize(quickLinkCard.id, nextSize)}
          onMove={(targetId) => onMoveCard(quickLinkCard.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(quickLinkCard.id)}
          onDuplicate={() => onDuplicateCard(quickLinkCard.id)}
          onArchive={() => onArchiveCard(quickLinkCard.id)}
          onDelete={() => onDeleteCard(quickLinkCard.id)}
        />
      </header>

      {!quickLinkCard.minimized && (
        <div className="quick-links-body">
          <ul className="quick-links-list">
            {(quickLinkCard.links || []).map((link, index) => {
              const isEditingThis = editingItemId === link.id
              // Render-boundary validation: imported/legacy data may contain
              // unsafe schemes, so the href is always re-checked here.
              const safeUrl = sanitizeUrl(link.url)
              const faviconUrl = safeUrl ? getFaviconUrl(safeUrl) : null
              const linkContent = (
                <>
                  {faviconUrl ? (
                    <img src={faviconUrl} alt="" className="ql-favicon" onError={(e) => e.target.style.display = 'none'} />
                  ) : (
                    <Link2 size={14} className="ql-favicon-fallback" />
                  )}
                  <span className="ql-label" style={fontStyle} title={link.url}>{link.label}</span>
                </>
              )

              if (isEditingThis) {
                return (
                  <li key={link.id} className="quick-links-form-item">
                    <form onSubmit={handleSubmitForm} className="quick-links-form">
                      <input
                        autoFocus
                        placeholder="URL (e.g., example.com)"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        className="quick-links-input"
                      />
                      <input
                        placeholder="Label (optional)"
                        value={formLabel}
                        onChange={(e) => setFormLabel(e.target.value)}
                        className="quick-links-input"
                      />
                      <div className="quick-links-form-actions">
                        <button type="submit" className="ql-btn ql-btn-primary"><Check size={14} /></button>
                        <button type="button" onClick={handleCancelForm} className="ql-btn ql-btn-secondary"><X size={14} /></button>
                      </div>
                    </form>
                  </li>
                )
              }

              return (
                <li
                  key={link.id}
                  className={`quick-links-item ${dragOverItem === index ? 'is-drag-over' : ''} ${draggedItem === index ? 'is-dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleItemDragStart(e, index)}
                  onDragOver={(e) => handleItemDragOver(e, index)}
                  onDrop={(e) => handleItemDrop(e, index)}
                  onDragEnd={handleItemDragEnd}
                >
                  <div className="ql-drag-handle">
                    <GripVertical size={14} />
                  </div>

                  {safeUrl ? (
                    <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="ql-link-content" onPointerDown={(e) => e.stopPropagation()}>
                      {linkContent}
                    </a>
                  ) : (
                    <span className="ql-link-content ql-link-invalid" title="Invalid or unsafe link" onPointerDown={(e) => e.stopPropagation()}>
                      {linkContent}
                    </span>
                  )}

                  <div className="ql-item-actions">
                    <button type="button" onClick={() => handleStartEdit(link)} className="ql-action-btn" title="Edit">
                      <Edit2 size={12} />
                    </button>
                    <button type="button" onClick={() => onRemoveLink(quickLinkCard.id, link.id)} className="ql-action-btn ql-action-delete" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {isAdding ? (
            <div className="quick-links-form-item">
              <form onSubmit={handleSubmitForm} className="quick-links-form">
                <input
                  autoFocus
                  placeholder="URL (e.g., example.com)"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="quick-links-input"
                />
                <input
                  placeholder="Label (optional)"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="quick-links-input"
                />
                <div className="quick-links-form-actions">
                  <button type="submit" className="ql-btn ql-btn-primary" disabled={!formUrl.trim()}><Check size={14} /></button>
                  <button type="button" onClick={handleCancelForm} className="ql-btn ql-btn-secondary"><X size={14} /></button>
                </div>
              </form>
            </div>
          ) : (
            <button className="quick-links-add-btn" onClick={handleStartAdd}>
              <Plus size={14} /> Add Link
            </button>
          )}
        </div>
      )}
    </section>
  )
})
