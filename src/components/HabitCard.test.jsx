import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { HabitIcon, HabitCard } from './HabitCard'
import { HABIT_ICON_OPTIONS } from '../utils/constants'

describe('HabitIcon', () => {
  it('renders a distinct icon for every selectable habit icon id', () => {
    const markupFor = (iconId) => render(() => <HabitIcon iconId={iconId} />).container.innerHTML
    const markups = HABIT_ICON_OPTIONS.map((option) => markupFor(option.id))

    expect(markups.length).toBe(HABIT_ICON_OPTIONS.length)
    expect(new Set(markups).size).toBe(HABIT_ICON_OPTIONS.length)
  })

  it('falls back to the first option icon for unknown ids', () => {
    const fallback = render(() => <HabitIcon iconId="running" />).container.innerHTML
    const unknown = render(() => <HabitIcon iconId="does-not-exist" />).container.innerHTML

    expect(unknown).toBe(fallback)
  })
})

describe('HabitCard', () => {
  it('cycles through habit icons', () => {
    const mockOnUpdateIcon = vi.fn()
    const habit = {
      id: 'habit-1',
      title: 'Workout',
      icon: HABIT_ICON_OPTIONS[0].id,
      year: 2026,
      month: 7,
      completions: {}
    }

    render(() => (
      <HabitCard
        habit={habit}
        cardId="habit-1"
        onUpdateIcon={mockOnUpdateIcon}
      />
    ))

    const nextBtn = screen.getByRole('button', { name: 'next habit icon' })
    fireEvent.click(nextBtn)
    expect(mockOnUpdateIcon).toHaveBeenCalledWith('habit-1', HABIT_ICON_OPTIONS[1].id)

    const prevBtn = screen.getByRole('button', { name: 'previous habit icon' })
    fireEvent.click(prevBtn)
    expect(mockOnUpdateIcon).toHaveBeenCalledWith('habit-1', HABIT_ICON_OPTIONS[HABIT_ICON_OPTIONS.length - 1].id)
  })
})
