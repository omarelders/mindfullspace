import { createSignal, Show, For } from 'solid-js'
import { GripVertical, Check, Clock3, ChevronDown, Trash2 } from 'lucide-solid'
import { CardContextMenu } from './CardContextMenu'
import { playTaskCompleteSound } from '../utils/audio'

export function TodoCard(props) {
  const customStyle = () => props.column.fontSize ? { "font-size": `${props.column.fontSize}px` } : undefined
  const [editingItemId, setEditingItemId] = createSignal(null)
  const [editingValue, setEditingValue] = createSignal('')
  const [expandedItems, setExpandedItems] = createSignal(new Set())
  const [activeDragHandleId, setActiveDragHandleId] = createSignal(null)

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
    if (props.onUpdateItemDetails) props.onUpdateItemDetails(props.column.id, itemId, { description })
  }

  const updateItemStatus = (itemId, status) => {
    if (status === 'Done') {
      playTaskCompleteSound()
    }
    if (props.onUpdateItemDetails) {
      props.onUpdateItemDetails(props.column.id, itemId, { status, completed: status === 'Done' })
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
    const nextText = editingValue().trim()
    if (!nextText) {
      cancelEditingItem()
      return
    }

    props.onUpdateItemText(props.column.id, itemId, nextText)
    cancelEditingItem()
  }

  return (
    <section
      data-card-id={props.cardId}
      class={`floating-card todo-card tone-${props.column.tone} ${props.column.positionClass} ${props.column.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.column.color || undefined,
      }}
    >
      <header class="card-header" onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)} style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}>
        <span class="card-title">{props.column.title}</span>
        <CardContextMenu
          title={props.column.title}
          minimized={Boolean(props.column.minimized)}
          fontSize={props.column.fontSize || 13}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.column.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.column.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.column.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.column.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.column.id)}
          onDuplicate={() => props.onDuplicateCard(props.column.id)}
          onArchive={() => props.onArchiveCard(props.column.id)}
          onDelete={() => props.onDeleteCard(props.column.id)}
        />
      </header>

      <Show when={!props.column.minimized}>
        <>
          <ul class="todo-list" onDragOver={props.onDragOverItem} onDrop={(event) => props.onDropOnList(props.column.id, event)}>
            <For each={props.column.items}>
              {(item) => {
                const isExpanded = () => expandedItems().has(item.id)
                const status = () => item.status || (item.completed ? 'Done' : 'Todo')
                return (
                  <li
                    class={`todo-row ${item.completed ? 'is-done' : ''} ${props.draggingItemId === item.id ? 'dragging' : ''} ${isExpanded() ? 'is-expanded' : ''}`}
                    draggable={activeDragHandleId() === item.id}
                    onDragOver={props.onDragOverItem}
                    onDrop={(event) => props.onDropOnItem(props.column.id, item.id, event)}
                    onDragStart={(event) => props.onDragStartItem(props.column.id, item.id, event)}
                    onDragEnd={props.onDragEndItem}
                  >
                    <div class="todo-row-main">
                      <button
                        type="button"
                        class="drag-grid"
                        aria-label={`drag ${item.text}`}
                        onMouseEnter={() => setActiveDragHandleId(item.id)}
                        onMouseLeave={() => setActiveDragHandleId(null)}
                      >
                        <GripVertical aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        class={`todo-check ${status() === 'Done' ? 'checked' : ''} ${status() === 'In Progress' ? 'in-progress' : ''}`}
                        onClick={() => {
                          const nextStatus = status() === 'Todo' ? 'In Progress' : status() === 'In Progress' ? 'Done' : 'Todo'
                          updateItemStatus(item.id, nextStatus)
                        }}
                        aria-label={`toggle ${item.text}`}
                      >
                        <Show when={status() === 'Done'}>
                          <Check aria-hidden="true" />
                        </Show>
                        <Show when={status() === 'In Progress'}>
                          <Clock3 aria-hidden="true" />
                        </Show>
                      </button>

                      <Show
                        when={editingItemId() === item.id}
                        fallback={
                          <button
                            type="button"
                            class={`todo-text ${item.completed ? 'completed' : ''}`}
                            style={customStyle()}
                            onClick={() => startEditingItem(item)}
                            aria-label={`edit ${item.text}`}
                          >
                            {item.text}
                          </button>
                        }
                      >
                        <input
                          type="text"
                          class="todo-text-edit"
                          style={customStyle()}
                          value={editingValue()}
                          onInput={(event) => setEditingValue(event.currentTarget.value)}
                          onBlur={() => commitEditingItem(item.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              commitEditingItem(item.id)
                            }

                            if (event.key === 'Escape') {
                              cancelEditingItem()
                            }
                          }}
                        />
                      </Show>

                      <div class="todo-actions">
                        <button
                          type="button"
                          class="todo-arrow-btn"
                          onClick={(e) => toggleItemExpanded(item.id, e)}
                          aria-label={`more actions for ${item.text}`}
                        >
                          <ChevronDown
                            aria-hidden="true"
                            style={{ transform: isExpanded() ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                          />
                        </button>
                        <button
                          type="button"
                          class="todo-delete-btn"
                          onClick={() => props.onDeleteItem(props.column.id, item.id)}
                          aria-label={`delete ${item.text}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <Show when={isExpanded()}>
                      <div class="todo-row-expanded">
                        <textarea
                          class="todo-description-input"
                          placeholder="Description..."
                          value={item.description || ''}
                          onInput={(e) => updateItemDescription(item.id, e.currentTarget.value)}
                        />
                        <div class="todo-status-group">
                          <For each={['Todo', 'In Progress', 'Done']}>
                            {(s) => (
                              <button
                                type="button"
                                class={`todo-status-btn ${status() === s ? 'active' : ''}`}
                                onClick={() => updateItemStatus(item.id, s)}
                              >
                                {s}
                              </button>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </li>
                )
              }}
            </For>
          </ul>

          <div class="todo-input-row">
            <input
              type="text"
              placeholder="Type your todo..."
              value={props.draft}
              onInput={(event) => props.onDraftChange(props.column.id, event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  props.onAdd(props.column.id)
                }
              }}
            />
            <button type="button" onClick={() => props.onAdd(props.column.id)} aria-label="add todo">
              +
            </button>
          </div>
        </>
      </Show>
    </section>
  )
}
