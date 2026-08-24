// Shared touch-gesture tuning constants.
//
// Fingers drift 10–20px while pressing, so a mouse-sized slop radius cancels
// holds constantly. Touch also gets a longer hold duration and a short intent
// delay before any hold visual appears — a gesture that turns into a scroll
// within that window never shows the ring.

export const LONGPRESS_SLOP_MOUSE = 5
export const LONGPRESS_SLOP_TOUCH = 15

export const LONGPRESS_HOLD_MS_MOUSE = 650
export const LONGPRESS_HOLD_MS_TOUCH = 750

// How long a touch must stay still before the hold-ring visual is allowed.
export const LONGPRESS_INTENT_DELAY_MS = 100

/** Movement slop for a pointer type ('touch' | 'pen' | 'mouse'). */
export function longPressSlopFor(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen'
    ? LONGPRESS_SLOP_TOUCH
    : LONGPRESS_SLOP_MOUSE
}

/** Hold duration for a pointer type. */
export function longPressHoldMsFor(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen'
    ? LONGPRESS_HOLD_MS_TOUCH
    : LONGPRESS_HOLD_MS_MOUSE
}

/**
 * Whether a movement of `distance` px should cancel an in-flight long press.
 * Pure so the threshold behavior can be unit-tested without a DOM.
 */
export function shouldCancelLongPress(distance, pointerType) {
  return distance > longPressSlopFor(pointerType)
}

/**
 * Pull-to-sync activation: the pull distance (px) that must be exceeded to
 * arm the refresh. Generous enough that ordinary scrolling never triggers it.
 */
export const PULL_TO_SYNC_THRESHOLD = 80
