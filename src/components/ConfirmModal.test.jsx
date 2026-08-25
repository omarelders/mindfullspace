import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { ConfirmModal } from './ConfirmModal'

describe('ConfirmModal', () => {
  it('renders when open and handles actions', () => {
    const mockOnConfirm = vi.fn()
    const mockOnCancel = vi.fn()

    render(() => (
      <ConfirmModal
        isOpen={true}
        title="Delete Item?"
        message="Are you sure you want to delete this?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    ))

    expect(screen.getByText('Delete Item?')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete this?')).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(confirmBtn)
    expect(mockOnConfirm).toHaveBeenCalled()

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('does not render when closed', () => {
    render(() => (
      <ConfirmModal
        isOpen={false}
        title="Hidden Modal"
      />
    ))

    expect(screen.queryByText('Hidden Modal')).not.toBeInTheDocument()
  })

  it('listens for Escape key and stops propagation', () => {
    const mockOnCancel = vi.fn()
    const stopPropagationMock = vi.fn()

    render(() => (
      <ConfirmModal
        isOpen={true}
        onCancel={mockOnCancel}
      />
    ))

    const event = new window.KeyboardEvent('keydown', { key: 'Escape' })
    event.stopPropagation = stopPropagationMock
    document.dispatchEvent(event)

    expect(mockOnCancel).toHaveBeenCalled()
    expect(stopPropagationMock).toHaveBeenCalled()
  })
})
