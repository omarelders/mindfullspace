import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CardContextMenu } from './CardContextMenu'
import { MobileCardOrderProvider } from './MobileCardOrderContext'

const baseProps = {
  title: 'My Note',
  minimized: false,
  fontSize: 14,
}

function mountMenu(props, providerValue) {
  const content = (
    <div data-card-id="note-1">
      <CardContextMenu {...baseProps} {...props} />
    </div>
  )
  return providerValue
    ? render(<MobileCardOrderProvider value={providerValue}>{content}</MobileCardOrderProvider>)
    : render(content)
}

function open(props, providerValue) {
  const utils = mountMenu(props, providerValue)
  fireEvent.click(screen.getByLabelText('card menu'))
  return utils
}

describe('CardContextMenu', () => {
  it('opens on trigger click and closes on an outside pointerdown', () => {
    const { container } = open({})
    expect(screen.getByRole('menu')).not.toBeNull()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(container).toBeTruthy()
  })

  it('renders extra actions, runs them, and closes the menu', () => {
    const onRun = vi.fn()
    open({ extraActions: [{ id: 'pin', label: 'Pin card', icon: null, onRun }] })

    fireEvent.click(screen.getByText('Pin card'))
    expect(onRun).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers Move up / Move down through the mobile-order context', () => {
    const orderActions = {
      canMove: vi.fn((_id, direction) => direction === 'down'),
      move: vi.fn(),
    }
    open({}, orderActions)

    expect(orderActions.canMove).toHaveBeenCalledWith('note-1', 'up')
    expect(orderActions.canMove).toHaveBeenCalledWith('note-1', 'down')

    fireEvent.click(screen.getByText('Move down'))
    expect(orderActions.move).toHaveBeenCalledWith('note-1', 'down')
  })

  it('disables move entries whose direction is unavailable', () => {
    const orderActions = {
      canMove: vi.fn(() => false),
      move: vi.fn(),
    }
    open({}, orderActions)

    const moveUp = screen.getByText('Move up').closest('button')
    expect(moveUp.disabled).toBe(true)
    fireEvent.click(moveUp)
    expect(orderActions.move).not.toHaveBeenCalled()
  })

  it('omits move entries entirely outside the provider (desktop canvas)', () => {
    open({})
    expect(screen.queryByText('Move up')).toBeNull()
    expect(screen.queryByText('Move down')).toBeNull()
  })
})
