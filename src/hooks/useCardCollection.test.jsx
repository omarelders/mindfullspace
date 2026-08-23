import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCardCollection } from './useCardCollection'

describe('useCardCollection hook', () => {
  const setupCollection = (initial = [{ id: 'card-1', title: 'Card 1', color: null, minimized: false }]) => {
    const saveSnapshot = vi.fn()
    const archiveCardSnapshot = vi.fn()
    const removeCardPosition = vi.fn()
    const setCardPositions = vi.fn()
    const setDraggingCard = vi.fn()
    const onDelete = vi.fn()
    const onDuplicate = vi.fn((src, dup) => dup)

    const hook = renderHook(() =>
      useCardCollection({
        initialItems: initial,
        idPrefix: 'card',
        saveSnapshot,
        archiveCardSnapshot,
        removeCardPosition,
        setCardPositions,
        setDraggingCard,
        onDelete,
        onDuplicate,
      })
    )

    return { hook, spies: { saveSnapshot, archiveCardSnapshot, removeCardPosition, setCardPositions, setDraggingCard, onDelete, onDuplicate } }
  }

  it('updates title, color, and minimized state', () => {
    const { hook } = setupCollection()

    act(() => {
      hook.result.current.updateTitle('card-1', 'Updated Title')
    })
    expect(hook.result.current.items[0].title).toBe('Updated Title')

    act(() => {
      hook.result.current.updateColor('card-1', '#ff0000')
    })
    expect(hook.result.current.items[0].color).toBe('#ff0000')

    act(() => {
      hook.result.current.toggleMinimize('card-1')
    })
    expect(hook.result.current.items[0].minimized).toBe(true)
  })

  it('removes a card and triggers callbacks', () => {
    const { hook, spies } = setupCollection()

    act(() => {
      hook.result.current.remove('card-1')
    })

    expect(hook.result.current.items).toHaveLength(0)
    expect(spies.saveSnapshot).toHaveBeenCalled()
    expect(spies.removeCardPosition).toHaveBeenCalledWith('card-1')
    expect(spies.onDelete).toHaveBeenCalledWith('card-1')
  })

  it('archives a card and creates snapshot', () => {
    const { hook, spies } = setupCollection()

    act(() => {
      hook.result.current.archive('card-1')
    })

    expect(hook.result.current.items).toHaveLength(0)
    expect(spies.saveSnapshot).toHaveBeenCalled()
    expect(spies.archiveCardSnapshot).toHaveBeenCalledWith('card', expect.objectContaining({ id: 'card-1' }))
    expect(spies.removeCardPosition).toHaveBeenCalledWith('card-1')
  })

  it('duplicates a card with a new id and offset position', () => {
    const { hook, spies } = setupCollection()

    act(() => {
      hook.result.current.duplicate('card-1')
    })

    expect(hook.result.current.items).toHaveLength(2)
    expect(hook.result.current.items[1].title).toBe('Card 1 Copy')
    expect(spies.setCardPositions).toHaveBeenCalled()
  })
})
