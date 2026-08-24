import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { LazyMount } from './LazyMount'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LazyMount', () => {
  it('renders children immediately when deferment is off', () => {
    const { container } = render(
      <LazyMount isDeferred={false}>
        <div className="lazy-probe">card</div>
      </LazyMount>,
    )
    expect(container.querySelector('.lazy-probe')).not.toBeNull()
    expect(container.querySelector('[data-lazy-slot]')).toBeNull()
  })

  it('mounts even without IntersectionObserver support (never hides content forever)', () => {
    // jsdom ships without IntersectionObserver — the graceful fallback must
    // mount children rather than leave them permanently deferred.
    const { container } = render(
      <LazyMount isDeferred={true}>
        <div className="lazy-probe">card</div>
      </LazyMount>,
    )
    expect(container.querySelector('.lazy-probe')).not.toBeNull()
  })

  it('keeps a placeholder until the observer reports intersection, then mounts once', async () => {
    const instances = []
    class MockIntersectionObserver {
      constructor(callback) {
        this.callback = callback
        instances.push(this)
      }
      observe() {
        // Start offscreen: nothing intersecting yet.
        this.callback([{ isIntersecting: false }])
      }
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    const { container } = render(
      <LazyMount isDeferred={true}>
        <div className="lazy-probe">card</div>
      </LazyMount>,
    )

    expect(container.querySelector('.lazy-probe')).toBeNull()
    expect(container.querySelector('[data-lazy-slot="pending"]')).not.toBeNull()

    // Card scrolls near the viewport.
    instances[0].callback([{ isIntersecting: true }])
    await waitFor(() => expect(container.querySelector('.lazy-probe')).not.toBeNull())
    expect(container.querySelector('[data-lazy-slot]')).toBeNull()

    // Mounting is monotonic: further offscreen reports do not unmount.
    instances[0].callback([{ isIntersecting: false }])
    expect(container.querySelector('.lazy-probe')).not.toBeNull()
  })
})
