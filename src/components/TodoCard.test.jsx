import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { TodoCard } from './TodoCard'

describe('TodoCard', () => {
  it('handles item addition, toggle complete, and deletion', () => {
    const mockOnAdd = vi.fn()
    const mockOnUpdateItemDetails = vi.fn()
    const mockOnDeleteItem = vi.fn()
    const mockOnDraftChange = vi.fn()

    const column = {
      id: 'col-1',
      title: 'My Todos',
      items: [
        { id: 'item-1', text: 'Buy milk', status: 'Todo', completed: false }
      ]
    }

    render(() => (
      <TodoCard
        column={column}
        cardId="col-1"
        draft="New task"
        onAdd={mockOnAdd}
        onUpdateItemDetails={mockOnUpdateItemDetails}
        onDeleteItem={mockOnDeleteItem}
        onDraftChange={mockOnDraftChange}
      />
    ))

    // Check title
    expect(screen.getByText('My Todos')).toBeInTheDocument()

    // Test toggle complete
    const toggleBtn = screen.getByRole('button', { name: 'toggle Buy milk' })
    fireEvent.click(toggleBtn)
    expect(mockOnUpdateItemDetails).toHaveBeenCalledWith('col-1', 'item-1', { status: 'In Progress', completed: false })

    // Test deletion
    const deleteBtn = screen.getByRole('button', { name: 'delete Buy milk' })
    fireEvent.click(deleteBtn)
    expect(mockOnDeleteItem).toHaveBeenCalledWith('col-1', 'item-1')

    // Test item addition
    const addBtn = screen.getByRole('button', { name: 'add todo' })
    fireEvent.click(addBtn)
    expect(mockOnAdd).toHaveBeenCalledWith('col-1')

    // Test draft change
    const draftInput = screen.getByPlaceholderText('Type your todo...')
    fireEvent.input(draftInput, { target: { value: 'Buy eggs' } })
    expect(mockOnDraftChange).toHaveBeenCalledWith('col-1', 'Buy eggs')
  })
})
