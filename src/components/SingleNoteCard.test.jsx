import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { SingleNoteCard } from './SingleNoteCard'

vi.mock('./CardContextMenu', () => ({
  CardContextMenu: (props) => (
    <div data-testid="context-menu">
      <button onClick={() => props.onTitleChange('Updated Text')}>Update Text</button>
      <button onClick={() => props.onColorChange('#00ff00')}>Update Color</button>
    </div>
  )
}))

describe('SingleNoteCard', () => {
  let defaultProps

  beforeEach(() => {
    defaultProps = {
      cardId: 'test-card-1',
      singleNote: {
        id: 'note-1',
        text: 'Initial Text',
        color: '#ff0000',
        shape: 'rectangle'
      },
      onUpdateText: vi.fn(),
      onUpdateColor: vi.fn(),
      onUpdateFontSize: vi.fn(),
      onUpdateShape: vi.fn(),
      onMoveCard: vi.fn(),
      onToggleMinimize: vi.fn(),
      onDuplicateCard: vi.fn(),
      onArchiveCard: vi.fn(),
      onDeleteCard: vi.fn()
    }
  })

  it('renders with basic text and color', () => {
    const { container } = render(() => <SingleNoteCard {...defaultProps} />)
    
    const dragHandle = screen.getByText('Initial Text')
    expect(dragHandle).toBeInTheDocument()
    
    const card = container.querySelector('.single-note-card')
    expect(card).toHaveStyle({ 'background-color': '#ff0000' })
  })

  it('renders with different shapes', () => {
    const pillProps = {
      ...defaultProps,
      singleNote: { ...defaultProps.singleNote, shape: 'pill' }
    }
    const { container } = render(() => <SingleNoteCard {...pillProps} />)
    
    const card = container.querySelector('.single-note-card')
    expect(card).toHaveStyle({ 'border-radius': '9999px' })
  })

  it('handles text updates via context menu', () => {
    render(() => <SingleNoteCard {...defaultProps} />)
    
    const btn = screen.getByText('Update Text')
    fireEvent.click(btn)
    
    expect(defaultProps.onUpdateText).toHaveBeenCalledWith('note-1', 'Updated Text')
  })

  it('handles color updates via context menu', () => {
    render(() => <SingleNoteCard {...defaultProps} />)
    
    const btn = screen.getByText('Update Color')
    fireEvent.click(btn)
    
    expect(defaultProps.onUpdateColor).toHaveBeenCalledWith('note-1', '#00ff00')
  })
})
