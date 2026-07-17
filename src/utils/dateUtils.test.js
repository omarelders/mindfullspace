import { describe, it, expect } from 'vitest'
import { parseDateKey } from './dateUtils'

describe('parseDateKey', () => {
  it('should parse a valid date key correctly', () => {
    expect(parseDateKey('2023-10-15')).toEqual({ year: 2023, month: 9, day: 15 })
  })

  it('should handle single digit month and day', () => {
    expect(parseDateKey('2023-1-5')).toEqual({ year: 2023, month: 0, day: 5 })
    expect(parseDateKey('2023-01-05')).toEqual({ year: 2023, month: 0, day: 5 })
  })

  it('should return null for invalid date strings (non-numeric parts)', () => {
    expect(parseDateKey('2023-abc-15')).toBeNull()
    expect(parseDateKey('abc-def-ghi')).toBeNull()
  })

  it('should return null if there are missing parts', () => {
    expect(parseDateKey('2023-10')).toBeNull()
    expect(parseDateKey('2023')).toBeNull()
    expect(parseDateKey('')).toBeNull()
  })

  it('should ignore extra parts in the date string', () => {
    expect(parseDateKey('2023-10-15-extra')).toEqual({ year: 2023, month: 9, day: 15 })
  })
})
