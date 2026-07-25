import { describe, it, expect } from 'vitest'
import { parseImportedCards } from './backup'

describe('parseImportedCards', () => {
  it('parses a full workspace export and returns extracted arrays', async () => {
    const mockExport = {
      version: 1,
      workspace: {
        notes: [{ id: 'note-1', title: 'Test Note', text: 'Hello world' }],
        timers: [{ id: 'timer-1', title: 'Focus Timer', initialSeconds: 1500 }]
      }
    }
    const file = new File([JSON.stringify(mockExport)], 'backup.json', { type: 'application/json' })
    const result = await parseImportedCards(file)

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].title).toBe('Test Note')
    expect(result.timers).toHaveLength(1)
    expect(result.timers[0].initialSeconds).toBe(1500)
    expect(result.columns).toBeNull()
  })

  it('parses an array of cards directly', async () => {
    const mockArray = [
      { type: 'note', title: 'Array Note', text: 'Some content' },
      { type: 'todo', title: 'Array Todo', items: [{ text: 'item 1' }] },
      { type: 'quote', author: 'Seneca', text: 'Luck is what happens when preparation meets opportunity.' }
    ]
    const file = new File([JSON.stringify(mockArray)], 'cards.json', { type: 'application/json' })
    const result = await parseImportedCards(file)

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].title).toBe('Array Note')
    expect(result.columns).toHaveLength(1)
    expect(result.columns[0].title).toBe('Array Todo')
    expect(result.quotes).toHaveLength(1)
    expect(result.quotes[0].author).toBe('Seneca')
  })

  it('throws an error on invalid json', async () => {
    const file = new File(['not valid json'], 'bad.json', { type: 'application/json' })
    await expect(parseImportedCards(file)).rejects.toThrow()
  })
})
