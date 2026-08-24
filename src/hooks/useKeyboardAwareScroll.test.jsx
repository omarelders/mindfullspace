import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useEffect } from 'react'
import { useKeyboardAwareScroll } from './useKeyboardAwareScroll'

function Host({ enabled }) {
  useKeyboardAwareScroll({ enabled })
  useEffect(() => {
    document.body.innerHTML = ''
    const workspace = document.createElement('div')
    workspace.className = 'workspace'
    const input = document.createElement('input')
    input.type = 'text'
    workspace.appendChild(input)
    document.body.appendChild(workspace)
  }, [])
  return null
}

describe('useKeyboardAwareScroll', () => {
  let scrollSpy

  beforeEach(() => {
    vi.useFakeTimers()
    scrollSpy = vi.fn()
    // jsdom has no layout engine; stub scrollIntoView on all elements.
    if (!window.Element.prototype.scrollIntoView) {
      window.Element.prototype.scrollIntoView = scrollSpy
    } else {
      scrollSpy = vi.spyOn(window.Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('scrolls a focused input into view shortly after focus', () => {
    render(<Host enabled={true} />)
    const input = document.querySelector('.workspace input')

    fireEvent.focusIn(input)
    vi.advanceTimersByTime(200)

    expect(scrollSpy).toHaveBeenCalled()
    const [arg] = scrollSpy.mock.calls[0]
    expect(arg).toMatchObject({ block: 'center' })
  })

  it('ignores focus on non-text elements', () => {
    render(<Host enabled={true} />)
    const button = document.createElement('button')
    document.body.appendChild(button)

    fireEvent.focusIn(button)
    vi.advanceTimersByTime(300)

    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('can be disabled', () => {
    render(<Host enabled={false} />)
    const input = document.querySelector('.workspace input')

    fireEvent.focusIn(input)
    vi.advanceTimersByTime(300)

    expect(scrollSpy).not.toHaveBeenCalled()
  })
})
