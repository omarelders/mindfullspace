import { describe, it, expect } from 'vitest'
import { parseTimerValue } from './dateUtils'

describe('parseTimerValue', () => {
  it('should return null for empty or whitespace-only strings', () => {
    expect(parseTimerValue('')).toBeNull()
    expect(parseTimerValue('   ')).toBeNull()
  })

  it('should parse single values as seconds', () => {
    expect(parseTimerValue('45')).toBe(45)
    expect(parseTimerValue('0')).toBe(0)
    expect(parseTimerValue('120')).toBe(120) // over 59 is valid for single value
  })

  it('should parse mm:ss format correctly', () => {
    expect(parseTimerValue('1:30')).toBe(90)
    expect(parseTimerValue('0:45')).toBe(45)
    expect(parseTimerValue('59:59')).toBe(3599)
  })

  it('should return null for mm:ss format if seconds > 59', () => {
    expect(parseTimerValue('1:60')).toBeNull()
    expect(parseTimerValue('1:99')).toBeNull()
  })

  it('should parse hh:mm:ss format correctly', () => {
    expect(parseTimerValue('1:00:00')).toBe(3600)
    expect(parseTimerValue('1:15:30')).toBe(4530)
    expect(parseTimerValue('2:59:59')).toBe(10799)
  })

  it('should return null for hh:mm:ss format if minutes or seconds > 59', () => {
    expect(parseTimerValue('1:60:00')).toBeNull()
    expect(parseTimerValue('1:00:60')).toBeNull()
    expect(parseTimerValue('1:60:60')).toBeNull()
  })

  it('should handle whitespace around parts', () => {
    expect(parseTimerValue(' 1 : 15 : 30 ')).toBe(4530)
    expect(parseTimerValue('  45  ')).toBe(45)
    expect(parseTimerValue(' 1 : 30 ')).toBe(90)
  })

  it('should return null if any part is non-numeric', () => {
    expect(parseTimerValue('abc')).toBeNull()
    expect(parseTimerValue('1:abc')).toBeNull()
    expect(parseTimerValue('1:2:abc')).toBeNull()
    expect(parseTimerValue('1:2a:30')).toBeNull()
  })

  it('should return null for negative values', () => {
    expect(parseTimerValue('-1')).toBeNull()
    expect(parseTimerValue('-1:30')).toBeNull()
    expect(parseTimerValue('1:-30')).toBeNull()
    expect(parseTimerValue('1:30:-10')).toBeNull()
  })

  it('should truncate decimal values (Math.floor applied)', () => {
    expect(parseTimerValue('1.5')).toBe(1)
    expect(parseTimerValue('1:30.9')).toBe(90)
    expect(parseTimerValue('1.5:30.9')).toBe(120) // 1.5 * 60 + 30.9 = 90 + 30.9 = 120.9 -> 120
  })

  it('should return null for formats with more than 3 parts', () => {
    expect(parseTimerValue('1:1:1:1')).toBeNull()
  })
})
