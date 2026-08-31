import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { CalendarCard } from './CalendarCard'

describe('CalendarCard', () => {
  it('renders calendar month view and handles day click', () => {
    const mockOnOpenDay = vi.fn()
    const calendar = {
      id: 'cal-1',
      title: 'My Calendar',
      year: 2026,
      month: 7, // August
      entries: {}
    }

    render(() => (
      <CalendarCard
        calendar={calendar}
        cardId="cal-1"
        onOpenDay={mockOnOpenDay}
      />
    ))

    // Check title
    expect(screen.getByText('My Calendar')).toBeInTheDocument()

    // Check month label
    expect(screen.getByText('August 2026')).toBeInTheDocument()

    // Find a day button and click it
    const dayBtn = screen.getByRole('button', { name: 'open day 15' })
    fireEvent.click(dayBtn)

    // Month 7 is 0-indexed, so it corresponds to August (08)
    expect(mockOnOpenDay).toHaveBeenCalledWith('cal-1', '2026-08-15')
  })

  it('renders safely without crashing when calendar entries contain non-string values', () => {
    const calendar = {
      id: 'cal-2',
      title: 'Malformed Entries Calendar',
      year: 2026,
      month: 7,
      entries: {
        '2026-08-10': 123,
        '2026-08-11': true,
        '2026-08-12': 'Valid note text',
      }
    }

    render(() => (
      <CalendarCard
        calendar={calendar}
        cardId="cal-2"
      />
    ))

    const day10 = screen.getByRole('button', { name: 'open day 10' })
    const day11 = screen.getByRole('button', { name: 'open day 11' })
    const day12 = screen.getByRole('button', { name: 'open day 12' })

    expect(day10).toHaveClass('has-entry')
    expect(day11).toHaveClass('has-entry')
    expect(day12).toHaveClass('has-entry')
  })
})
