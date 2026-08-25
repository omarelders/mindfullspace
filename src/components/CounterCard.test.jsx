import { render, fireEvent, screen } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CounterCard } from './CounterCard'
import '@testing-library/jest-dom'

vi.mock('../utils/audio', () => ({
  playAchievementSound: vi.fn()
}))

vi.mock('./CardContextMenu', () => ({
  CardContextMenu: () => <div data-testid="mock-context-menu" />
}))

describe('CounterCard', () => {
  const defaultProps = {
    cardId: 'card-1',
    counter: {
      id: 'c-1',
      title: 'Test Counter',
      initialValue: 10,
      minimized: false
    },
    onUpdateValue: vi.fn(),
    onUpdateTitle: vi.fn(),
    onUpdateColor: vi.fn(),
    onMoveCard: vi.fn(),
    onToggleMinimize: vi.fn(),
    onDuplicateCard: vi.fn(),
    onArchiveCard: vi.fn(),
    onDeleteCard: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders initial value', () => {
    render(() => <CounterCard {...defaultProps} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('calls onUpdateValue with incremented value when increment button is clicked', () => {
    render(() => <CounterCard {...defaultProps} />)
    const incBtn = screen.getByLabelText('increase counter')
    fireEvent.click(incBtn)
    expect(defaultProps.onUpdateValue).toHaveBeenCalledWith('c-1', 11)
  })

  it('calls onUpdateValue with decremented value when decrement button is clicked', () => {
    render(() => <CounterCard {...defaultProps} />)
    const decBtn = screen.getByLabelText('decrease counter')
    fireEvent.click(decBtn)
    expect(defaultProps.onUpdateValue).toHaveBeenCalledWith('c-1', 9)
  })

  it('resets the counter on double click', () => {
    render(() => <CounterCard {...defaultProps} />)
    const valueEl = screen.getByText('10')
    fireEvent.dblClick(valueEl)
    expect(defaultProps.onUpdateValue).toHaveBeenCalledWith('c-1', 0)
  })
})
