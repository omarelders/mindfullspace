import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { usePullToSync } from './usePullToSync'
import { PULL_TO_SYNC_THRESHOLD } from '../utils/gestures'

function Host({ onRefresh }) {
  const { isPulling } = usePullToSync({ enabled: true, onRefresh })
  return (
    <div className="workspace" data-pulling={isPulling ? 'yes' : 'no'}>
      <div>content</div>
    </div>
  )
}

function pointerDown(target, opts = {}) {
  fireEvent.pointerDown(target, {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    button: 0,
    ...opts,
  })
}

describe('usePullToSync', () => {
  let scrollTop = 0

  beforeEach(() => {
    vi.useFakeTimers()
    scrollTop = 0
    // jsdom has no layout; define a controllable scrollTop.
    Object.defineProperty(window.Element.prototype, 'scrollTop', {
      configurable: true,
      get() { return this === document.querySelector('.workspace') ? scrollTop : 0 },
      set(v) { if (this === document.querySelector('.workspace')) scrollTop = v },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const drag = (target, fromY, toY) => {
    pointerDown(target)
    fireEvent.pointerMove(document, {
      pointerType: 'touch',
      pointerId: 1,
      clientX: 100,
      clientY: toY,
    })
    fireEvent.pointerUp(document, { pointerType: 'touch', pointerId: 1 })
  }

  it('fires onRefresh when pulled down past the threshold at top', () => {
    const onRefresh = vi.fn()
    render(<Host onRefresh={onRefresh} />)
    const el = document.querySelector('.workspace')

    drag(el, 100, 100 + PULL_TO_SYNC_THRESHOLD + 10)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not fire when the workspace is scrolled away from the top', () => {
    const onRefresh = vi.fn()
    render(<Host onRefresh={onRefresh} />)
    const el = document.querySelector('.workspace')
    scrollTop = 40 // mid-scroll: ordinary touch scrolling

    drag(el, 100, 100 + PULL_TO_SYNC_THRESHOLD + 10)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('ignores mouse drags', () => {
    const onRefresh = vi.fn()
    render(<Host onRefresh={onRefresh} />)
    const el = document.querySelector('.workspace')

    fireEvent.pointerDown(el, { pointerType: 'mouse', clientX: 100, clientY: 100 })
    fireEvent.pointerMove(document, { pointerType: 'mouse', clientX: 100, clientY: 300 })
    fireEvent.pointerUp(document, { pointerType: 'mouse' })

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('does not double-fire within the cooldown window', () => {
    const onRefresh = vi.fn()
    render(<Host onRefresh={onRefresh} />)
    const el = document.querySelector('.workspace')

    drag(el, 100, 100 + PULL_TO_SYNC_THRESHOLD + 5)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    drag(el, 100, 100 + PULL_TO_SYNC_THRESHOLD + 5)
    expect(onRefresh).toHaveBeenCalledTimes(1) // still cooling down

    vi.advanceTimersByTime(1300) // past cooldown
    drag(el, 100, 100 + PULL_TO_SYNC_THRESHOLD + 5)
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })
})
