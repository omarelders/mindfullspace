import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HabitIcon } from './HabitCard'
import { HABIT_ICON_OPTIONS } from '../utils/constants'

describe('HabitIcon', () => {
  it('renders a distinct icon for every selectable habit icon id', () => {
    const markupFor = (iconId) => render(<HabitIcon iconId={iconId} />).container.innerHTML
    const markups = HABIT_ICON_OPTIONS.map((option) => markupFor(option.id))

    expect(markups.length).toBe(HABIT_ICON_OPTIONS.length)
    expect(new Set(markups).size).toBe(HABIT_ICON_OPTIONS.length)
  })

  it('falls back to the first option icon for unknown ids', () => {
    const fallback = render(<HabitIcon iconId="running" />).container.innerHTML
    const unknown = render(<HabitIcon iconId="does-not-exist" />).container.innerHTML

    expect(unknown).toBe(fallback)
  })
})
