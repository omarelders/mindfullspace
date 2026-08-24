import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionRail, ActionRailIcon } from './ActionRail'
import { QUICK_CREATE_ACTIONS } from '../utils/constants'

describe('ActionRail', () => {
  it('renders the toggle button with accessible label', () => {
    const onToggle = vi.fn()
    const onQuickAction = vi.fn()
    const { rerender } = render(
      <ActionRail
        open={false}
        onToggle={onToggle}
        quickActions={QUICK_CREATE_ACTIONS}
        onQuickAction={onQuickAction}
      />
    )

    const toggleButton = screen.getByRole('button', { name: /add card/i })
    expect(toggleButton).toBeInTheDocument()
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleButton)
    expect(onToggle).toHaveBeenCalledTimes(1)

    rerender(
      <ActionRail
        open={true}
        onToggle={onToggle}
        quickActions={QUICK_CREATE_ACTIONS}
        onQuickAction={onQuickAction}
      />
    )
    expect(screen.getByRole('button', { name: /close action menu/i })).toBeInTheDocument()
  })

  it('renders all 12 card types in the rail and allows clicking each', () => {
    const onToggle = vi.fn()
    const onQuickAction = vi.fn()

    render(
      <ActionRail
        open={true}
        onToggle={onToggle}
        quickActions={QUICK_CREATE_ACTIONS}
        onQuickAction={onQuickAction}
      />
    )

    expect(QUICK_CREATE_ACTIONS).toHaveLength(12)

    QUICK_CREATE_ACTIONS.forEach((action) => {
      const button = screen.getByRole('button', { name: action.title })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('data-card-type', action.id)
    })

    // Test clicking a card type
    const singleNoteBtn = screen.getByRole('button', { name: 'Single Note' })
    fireEvent.click(singleNoteBtn)
    expect(onQuickAction).toHaveBeenCalledWith('singlenote')

    const habitBtn = screen.getByRole('button', { name: 'Habit' })
    fireEvent.click(habitBtn)
    expect(onQuickAction).toHaveBeenCalledWith('habit')
  })

  it('renders icons for all kinds without returning null', () => {
    const kinds = [
      'label',
      'singlenote',
      'note',
      'todo-list',
      'counter',
      'stopwatch',
      'timer',
      'quick-links',
      'calendar',
      'habit',
      'picture',
      'quote',
    ]

    kinds.forEach((kind) => {
      const { container } = render(<ActionRailIcon kind={kind} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })
})
