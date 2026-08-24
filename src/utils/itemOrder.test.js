import { describe, it, expect } from 'vitest'
import { reorderItems, moveListItem, insertItemInto, removeItem } from './itemOrder'

const list = [
  { id: 'a', text: 'first' },
  { id: 'b', text: 'second' },
  { id: 'c', text: 'third' },
]

describe('reorderItems', () => {
  it('moves an item above the hovered item', () => {
    const next = reorderItems(list, 'c', 'a')
    expect(next.map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('moves downward as well as upward', () => {
    expect(reorderItems(list, 'a', 'b').map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('returns the original reference for unknown ids or no-op moves', () => {
    expect(reorderItems(list, 'x', 'a')).toBe(list)
    expect(reorderItems(list, 'a', 'x')).toBe(list)
    expect(reorderItems(list, 'a', 'a')).toBe(list)
  })

  it('does not mutate the input array', () => {
    reorderItems(list, 'a', 'c')
    expect(list.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('moveListItem', () => {
  it('moves by relative offset with clamping', () => {
    expect(moveListItem(list, 'a', 1).map((i) => i.id)).toEqual(['b', 'a', 'c'])
    expect(moveListItem(list, 'a', -5).map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(moveListItem(list, 'c', 5).map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(moveListItem(list, 'c', -1).map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op returning the same reference for zero offset or missing ids', () => {
    expect(moveListItem(list, 'a', 0)).toBe(list)
    expect(moveListItem(list, 'zz', 1)).toBe(list)
  })
})

describe('insertItemInto / removeItem', () => {
  it('inserts before the target item, or appends when target is null', () => {
    expect(insertItemInto(list, { id: 'z' }, 'b').map((i) => i.id)).toEqual(['a', 'z', 'b', 'c'])
    expect(insertItemInto(list, { id: 'z' }, null).map((i) => i.id)).toEqual(['a', 'b', 'c', 'z'])
    expect(insertItemInto(list, { id: 'z' }, 'nope').map((i) => i.id)).toEqual(['a', 'b', 'c', 'z'])
  })

  it('removes by id and is a no-op reference-wise when absent', () => {
    expect(removeItem(list, 'b').map((i) => i.id)).toEqual(['a', 'c'])
    expect(removeItem(list, 'nope')).toBe(list)
  })
})
