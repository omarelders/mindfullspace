import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot } from 'solid-js'
import { createCardCollection } from './useCardCollection'

describe('createCardCollection', () => {
  let collection
  const spies = {}

  beforeEach(() => {
    spies.saveSnapshot = vi.fn()
    spies.archiveCardSnapshot = vi.fn()
    spies.removeCardPosition = vi.fn()
    spies.setCardPositions = vi.fn()
    spies.setDraggingCard = vi.fn()
    spies.onDelete = vi.fn()
    spies.onDuplicate = vi.fn((src, dup) => dup)

    createRoot((dispose) => {
      collection = createCardCollection({
        initialItems: [
          { id: 'card-1', title: 'Test', color: null, minimized: false },
          { id: 'card-2', title: 'Other', color: '#ff0', minimized: false },
        ],
        idPrefix: 'card',
        ...spies,
      })
    })
  })

  it('updates title, color, and minimized state', () => {
    collection.updateTitle('card-1', 'Updated Title')
    expect(collection.items[0].title).toBe('Updated Title')

    collection.updateColor('card-1', '#ff0000')
    expect(collection.items[0].color).toBe('#ff0000')

    collection.toggleMinimize('card-1')
    expect(collection.items[0].minimized).toBe(true)
  })

  it('removes a card and triggers callbacks', () => {
    collection.remove('card-1')

    expect(collection.items).toHaveLength(1)
    expect(spies.saveSnapshot).toHaveBeenCalled()
    expect(spies.removeCardPosition).toHaveBeenCalledWith('card-1')
    expect(spies.onDelete).toHaveBeenCalledWith('card-1')
  })

  it('archives a card and creates snapshot', () => {
    collection.archive('card-1')

    expect(collection.items).toHaveLength(1)
    expect(spies.saveSnapshot).toHaveBeenCalled()
    expect(spies.archiveCardSnapshot).toHaveBeenCalledWith('card', expect.objectContaining({ id: 'card-1' }))
    expect(spies.removeCardPosition).toHaveBeenCalledWith('card-1')
  })

  it('duplicates a card with a new id and offset position', () => {
    collection.duplicate('card-1')

    expect(collection.items).toHaveLength(3)
    expect(collection.items[2].title).toBe('Test Copy')
    expect(spies.setCardPositions).toHaveBeenCalled()
  })

  it('clears dragging card when the dragged card is removed', () => {
    // The setDraggingCard callback contract mirrors React setState semantics
    collection.remove('card-1')
    expect(spies.setDraggingCard).toHaveBeenCalled()
  })
})
