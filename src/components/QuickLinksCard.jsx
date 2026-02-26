import React, { useState, useRef, useEffect, memo } from 'react'
import { Plus, Trash2, Edit2, Check, X, GripVertical, Link2 } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'

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
  onMouseDown,
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
  isPopping
}) {
  const customStyle = quickLinkCard.color ? { '--card-custom-bg': quickLinkCard.color } : {}
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

    // Ensure URL has protocol
    let finalUrl = formUrl.trim()
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`
    }

    const finalLabel = formLabel.trim() || new URL(finalUrl).hostname

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
        transform: `translate(${position?.x || 0}px, ${position?.y || 0}px)`,
        ...customStyle,
      }}
      onMouseDown={onMouseDown}
      data-card-id={quickLinkCard.id}
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
          onColorChange={(color) => onUpdateColor(quickLinkCard.id, color)}
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
              const faviconUrl = getFaviconUrl(link.url)

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
                  
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="ql-link-content" onMouseDown={(e) => e.stopPropagation()}>
                    {faviconUrl ? (
                      <img src={faviconUrl} alt="" className="ql-favicon" onError={(e) => e.target.style.display = 'none'} />
                    ) : (
                      <Link2 size={14} className="ql-favicon-fallback" />
                    )}
                    <span className="ql-label" title={link.url}>{link.label}</span>
                  </a>

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
