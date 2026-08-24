import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SwipeableCard } from './SwipeableCard'

function Child() {
  return <div className="card-probe">card content</div>
}

function drag(el, dx) {
  fireEvent.pointerDown(el, { pointerType: 'touch', pointerId: 7, clientX: 200, clientY: 200 })
  fireEvent.pointerMove(document.body, { pointerType: 'touch', pointerId: 7, clientX: 200 + dx, clientY: 200 })
  // PointerEvent init defaults unset clientX to 0 — always send the position.
  fireEvent.pointerUp(document.body, { pointerType: 'touch', pointerId: 7, clientX: 200 + dx, clientY: 200 })
}

describe('SwipeableCard', () => {
  it('renders children bare when no actions are provided', () => {
    const { container } = render(<SwipeableCard><Child /></SwipeableCard>)
    expect(container.querySelector('.card-probe')).not.toBeNull()
    expect(container.querySelector('.swipe-wrap')).toBeNull()
  })

  it('reveals actions after a leftward touch drag past the threshold', () => {
    const onArchive = vi.fn()
    const { container } = render(
      <SwipeableCard onArchive={onArchive}><Child /></SwipeableCard>,
    )
    const wrap = container.querySelector('.swipe-wrap')

    drag(wrap, -70)
    expect(wrap.className).toContain('is-open')
    expect(container.querySelector('.swipe-archive')).not.toBeNull()
  })

  it('snaps closed after a short drag', () => {
    const { container } = render(
      <SwipeableCard onArchive={vi.fn()}><Child /></SwipeableCard>,
    )
    const wrap = container.querySelector('.swipe-wrap')

    drag(wrap, -20)
    expect(wrap.className).not.toContain('is-open')
    expect(wrap.className).not.toContain('is-swiping')
  })

  it('runs archive from the revealed button and resets', () => {
    const onArchive = vi.fn()
    const { container } = render(
      <SwipeableCard onArchive={onArchive}><Child /></SwipeableCard>,
    )
    const wrap = container.querySelector('.swipe-wrap')
    drag(wrap, -70)
    fireEvent.click(container.querySelector('.swipe-archive'))

    expect(onArchive).toHaveBeenCalledTimes(1)
    expect(wrap.className).not.toContain('is-open')
  })

  it('does not hijack vertical drags', () => {
    const { container } = render(
      <SwipeableCard onArchive={vi.fn()}><Child /></SwipeableCard>,
    )
    const wrap = container.querySelector('.swipe-wrap')

    fireEvent.pointerDown(wrap, { pointerType: 'touch', pointerId: 7, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(document.body, { pointerType: 'touch', pointerId: 7, clientX: 205, clientY: 260 })
    fireEvent.pointerUp(document.body, { pointerType: 'touch', pointerId: 7 })

    expect(wrap.className).not.toContain('is-swiping')
    expect(wrap.className).not.toContain('is-open')
  })
})
