import { describe, it, expect } from 'vitest'
import {
  LONGPRESS_SLOP_MOUSE,
  LONGPRESS_SLOP_TOUCH,
  LONGPRESS_INTENT_DELAY_MS,
  PULL_TO_SYNC_THRESHOLD,
  longPressSlopFor,
  longPressHoldMsFor,
  shouldCancelLongPress,
} from './gestures'

describe('gesture thresholds', () => {
  it('gives touch/pen a wider slop than mouse (fingers drift while pressing)', () => {
    expect(LONGPRESS_SLOP_TOUCH).toBeGreaterThanOrEqual(15)
    expect(LONGPRESS_SLOP_MOUSE).toBeLessThan(LONGPRESS_SLOP_TOUCH)
    expect(longPressSlopFor('touch')).toBe(LONGPRESS_SLOP_TOUCH)
    expect(longPressSlopFor('pen')).toBe(LONGPRESS_SLOP_TOUCH)
    expect(longPressSlopFor('mouse')).toBe(LONGPRESS_SLOP_MOUSE)
  })

  it('cancels a 10px drift for mouse but not for touch', () => {
    expect(shouldCancelLongPress(10, 'mouse')).toBe(true)
    expect(shouldCancelLongPress(10, 'touch')).toBe(false)
    // Boundary: exactly at slop is not yet a cancel; past it is.
    expect(shouldCancelLongPress(LONGPRESS_SLOP_TOUCH, 'touch')).toBe(false)
    expect(shouldCancelLongPress(LONGPRESS_SLOP_TOUCH + 0.5, 'touch')).toBe(true)
  })

  it('uses a longer hold on touch plus a nonzero intent delay', () => {
    expect(longPressHoldMsFor('touch')).toBeGreaterThan(longPressHoldMsFor('mouse'))
    expect(LONGPRESS_INTENT_DELAY_MS).toBeGreaterThanOrEqual(100)
  })

  it('pull-to-sync threshold is far above scroll jitter but reachable by a deliberate pull', () => {
    expect(PULL_TO_SYNC_THRESHOLD).toBeGreaterThan(40)
    expect(PULL_TO_SYNC_THRESHOLD).toBeLessThan(150)
  })
})
