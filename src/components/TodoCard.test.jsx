import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TodoCard } from './TodoCard'

vi.mock('../utils/audio', () => ({
  playTaskCompleteSound: vi.fn(),
}))

const column = {
  id: 'col-1',
  title: 'My Todos',
  tone: 'charcoal',
  positionClass: '',
  items: [
    { id: 'item-a', text: 'First task', completed: false },
    { id: 'item-b', text: 'Second task', completed: true },
  ],
}

const baseProps = {
  column,
  draft: '',
  onDraftChange: vi.fn(),
  onAdd: vi.fn(),
  onUpdateItemText: vi.fn(),
  onDeleteItem: vi.fn(),
  onItemDragStart: vi.fn(),
  draggingItemId: null,
  overItemId: null,
  onPointerDown: null,
  onUpdateTitle: vi.fn(),
  onUpdateColor: vi.fn(),
  onMoveCard: vi.fn(),
  onToggleMinimize: vi.fn(),
  onDuplicateCard: vi.fn(),
  onArchiveCard: vi.fn(),
  onDeleteCard: vi.fn(),
}

describe('TodoCard', () => {
  it('renders every item row with data attributes for hit-testing', () => {
    render(<TodoCard {...baseProps} />)
    const rowA = document.querySelector('[data-item-id="item-a"]')
    const rowB = document.querySelector('[data-item-id="item-b"]')
    expect(rowA).not.toBeNull()
    expect(rowB).not.toBeNull()
    expect(rowA.className).toContain('todo-row')
    // The list carries the column id so cross-column drops can be resolved.
    expect(document.querySelector('[data-todo-column="col-1"]')).not.toBeNull()
    expect(screen.getByText('Second task')).toBeTruthy()
  })

  it('marks the dragged row and highlights the hover target', () => {
    render(<TodoCard {...baseProps} draggingItemId="item-a" overItemId="item-b" />)
    expect(document.querySelector('[data-item-id="item-a"]').className).toContain('dragging')
    expect(document.querySelector('[data-item-id="item-b"]').className).toContain('is-drop-target')
  })

  it('starts a pointer drag from the grip handle without HTML5 drag events', () => {
    render(<TodoCard {...baseProps} />)
    const grips = screen.getAllByLabelText(/drag /)
    expect(grips.length).toBe(2)

    const row = document.querySelector('[data-item-id="item-b"]')
    fireEvent.pointerDown(grips[1], { button: 0, clientX: 10, clientY: 10 })
    expect(baseProps.onItemDragStart).toHaveBeenCalledTimes(1)
    const [calledColumnId, calledItemId] = baseProps.onItemDragStart.mock.calls[0]
    expect(calledColumnId).toBe('col-1')
    expect(calledItemId).toBe('item-b')

    // The li itself never uses the HTML5 DnD attributes anymore.
    expect(row.getAttribute('draggable')).toBeNull()
    expect(row.ondragstart).toBeNull()
  })

  it('toggles an item status from the check button', () => {
    const props = { ...baseProps, onUpdateItemDetails: vi.fn() }
    render(<TodoCard {...props} />)
    fireEvent.click(screen.getByLabelText('toggle First task'))
    expect(props.onUpdateItemDetails).toHaveBeenCalledWith(
      'col-1',
      'item-a',
      { status: 'In Progress', completed: false },
    )
  })
})
