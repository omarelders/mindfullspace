import { useState, memo } from 'react'
import { GripVertical, Check, Clock3, Pencil, ChevronDown, Trash2 } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'

export const TodoCard = memo(function TodoCard({
  column,
  draft,
  onDraftChange,
  onAdd,
  onToggle,
  onUpdateItemText,
  onDeleteItem,
  onDragStartItem,
  onDragOverItem,
  onDropOnItem,
  onDropOnList,
  onDragEndItem,
  draggingItemId,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onUpdateItemDetails,
  isPopping,
}) {
  const [editingItemId, setEditingItemId] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [activeDragHandleId, setActiveDragHandleId] = useState(null)

  const toggleItemExpanded = (itemId, e) => {
    e.stopPropagation()
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const updateItemDescription = (itemId, description) => {
    if (onUpdateItemDetails) onUpdateItemDetails(column.id, itemId, { description })
  }

  const updateItemStatus = (itemId, status) => {
    if (onUpdateItemDetails) {
      onUpdateItemDetails(column.id, itemId, { status, completed: status === 'Done' })
    }
  }

  const startEditingItem = (item) => {
    setEditingItemId(item.id)
    setEditingValue(item.text)
  }

  const cancelEditingItem = () => {
    setEditingItemId(null)
    setEditingValue('')
  }

  const commitEditingItem = (itemId) => {
    const nextText = editingValue.trim()
    if (!nextText) {
      cancelEditingItem()
      return
    }

    onUpdateItemText(column.id, itemId, nextText)
    cancelEditingItem()
  }

  return (
    <section
      className={`floating-card todo-card tone-${column.tone} ${column.positionClass} ${column.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: column.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{column.title}</span>
        <CardContextMenu
          title={column.title}
          minimized={Boolean(column.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(column.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(column.id, color)}
          onMove={(targetId) => onMoveCard(column.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(column.id)}
          onDuplicate={() => onDuplicateCard(column.id)}
          onArchive={() => onArchiveCard(column.id)}
          onDelete={() => onDeleteCard(column.id)}
        />
      </header>

      {!column.minimized && (
        <>
          <ul className="todo-list" onDragOver={onDragOverItem} onDrop={(event) => onDropOnList(column.id, event)}>
            {column.items.map((item) => {
              const isExpanded = expandedItems.has(item.id)
              const status = item.status || (item.completed ? 'Done' : 'Todo')
              return (
              <li
                className={`todo-row ${item.completed ? 'is-done' : ''} ${draggingItemId === item.id ? 'dragging' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                key={item.id}
                draggable={activeDragHandleId === item.id}
                onDragOver={onDragOverItem}
                onDrop={(event) => onDropOnItem(column.id, item.id, event)}
                onDragStart={(event) => onDragStartItem(column.id, item.id, event)}
                onDragEnd={onDragEndItem}
              >
                <div className="todo-row-main">
                  <button
                    type="button"
                    className="drag-grid"
                    aria-label={`drag ${item.text}`}
                    onMouseEnter={() => setActiveDragHandleId(item.id)}
                    onMouseLeave={() => setActiveDragHandleId(null)}
                  >
                    <GripVertical aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className={`todo-check ${status === 'Done' ? 'checked' : ''} ${status === 'In Progress' ? 'in-progress' : ''}`}
                    onClick={() => {
                      const nextStatus = status === 'Todo' ? 'In Progress' : status === 'In Progress' ? 'Done' : 'Todo'
                      updateItemStatus(item.id, nextStatus)
                    }}
                    aria-label={`toggle ${item.text}`}
                  >
                    {status === 'Done' && (
                      <Check aria-hidden="true" />
                    )}
                    {status === 'In Progress' && (
                      <Clock3 aria-hidden="true" />
                    )}
                  </button>

                  {editingItemId === item.id ? (
                    <input
                      type="text"
                      className="todo-text-edit"
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onBlur={() => commitEditingItem(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitEditingItem(item.id)
                        }

                        if (event.key === 'Escape') {
                          cancelEditingItem()
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className={`todo-text ${item.completed ? 'completed' : ''}`}
                      onClick={() => startEditingItem(item)}
                      aria-label={`edit ${item.text}`}
                    >
                      {item.text}
                    </button>
                  )}

                  <div className="todo-actions">
                    <button 
                      type="button" 
                      className="todo-arrow-btn" 
                      onClick={(e) => toggleItemExpanded(item.id, e)} 
                      aria-label={`more actions for ${item.text}`}
                    >
                      <ChevronDown
                        aria-hidden="true"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      />
                    </button>
                    <button
                      type="button"
                      className="todo-delete-btn"
                      onClick={() => onDeleteItem(column.id, item.id)}
                      aria-label={`delete ${item.text}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="todo-row-expanded">
                    <textarea
                      className="todo-description-input"
                      placeholder="Description..."
                      value={item.description || ''}
                      onChange={(e) => updateItemDescription(item.id, e.target.value)}
                    />
                    <div className="todo-status-group">
                      {['Todo', 'In Progress', 'Done'].map(s => (
                        <button
                          key={s}
                          type="button"
                          className={`todo-status-btn ${status === s ? 'active' : ''}`}
                          onClick={() => updateItemStatus(item.id, s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
              )
            })}
          </ul>

          <div className="todo-input-row">
            <input
              type="text"
              placeholder="Type your todo..."
              value={draft}
              onChange={(event) => onDraftChange(column.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onAdd(column.id)
                }
              }}
            />
            <button type="button" onClick={() => onAdd(column.id)} aria-label="add todo">
              +
            </button>
          </div>
        </>
      )}
    </section>
  )
})
