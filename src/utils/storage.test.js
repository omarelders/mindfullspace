import { describe, it, expect, beforeEach } from 'vitest'
import {
  readJsonStorage,
  writeJsonStorage,
  removeStorageKey,
  getInitialAppState,
  validateWorkspaceState,
  createDefaultColumns,
  createDefaultNotes,
  createDefaultTimers,
  createDefaultCardPositions,
} from './storage'
import { APP_STORAGE_KEY, DEFAULT_WORKSPACES } from './constants'

describe('storage utils', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reads and writes JSON storage safely', () => {
    expect(readJsonStorage('test-key')).toBeNull()

    writeJsonStorage('test-key', { foo: 'bar', num: 42 })
    expect(readJsonStorage('test-key')).toEqual({ foo: 'bar', num: 42 })

    removeStorageKey('test-key')
    expect(readJsonStorage('test-key')).toBeNull()
  })

  it('handles corrupted localStorage JSON gracefully', () => {
    localStorage.setItem('corrupt-key', '{ invalid: json ]')
    expect(readJsonStorage('corrupt-key')).toBeNull()
  })

  it('retrieves default app state when storage is empty', () => {
    const appState = getInitialAppState()
    expect(appState.workspaces).toEqual(DEFAULT_WORKSPACES)
    expect(appState.activeWorkspaceId).toBe(DEFAULT_WORKSPACES[0].id)
  })

  it('validates workspace state and fills missing fields with safe defaults', () => {
    const emptyState = validateWorkspaceState(null)

    expect(emptyState.columns.length).toBeGreaterThan(0)
    expect(emptyState.notes.length).toBeGreaterThan(0)
    expect(emptyState.timers.length).toBeGreaterThan(0)
    expect(emptyState.viewport).toEqual({ x: 0, y: 0, scale: 1 })
    expect(emptyState.themeMode).toBe('night')
    expect(emptyState.themePalette).toBe('sage')
    expect(emptyState.cardPositions).toBeDefined()
  })

  it('sanitizes dangerous URLs in quickLinks on load', () => {
    const rawStoredState = {
      quickLinks: [
        {
          id: 'ql-1',
          links: [
            { id: 'l-1', url: 'javascript:alert(1)', label: 'XSS' },
            { id: 'l-2', url: 'https://example.com', label: 'Safe' },
            { id: 'l-3', url: 'github.com', label: 'Bare Domain' },
          ],
        },
      ],
    }

    const validated = validateWorkspaceState(rawStoredState)
    const links = validated.quickLinks[0].links

    expect(links[0].url).toBe('') // stripped
    expect(links[1].url).toBe('https://example.com/')
    expect(links[2].url).toBe('https://github.com/')
  })

  it('deeply validates and normalizes nested structures across all card types', () => {
    const malformedState = {
      columns: [{ id: 'col-1', items: [{ id: 123, text: null, completed: 1 }, null, 'invalid'] }],
      calendars: [{ id: 'cal-1', entries: { '2026-08-31': 12345, '2026-09-01': null } }],
      habits: [{ id: 'hab-1', completions: { '2026-08-31': 1, '2026-09-01': 0 } }],
      counters: [{ id: 'cnt-1', initialValue: 'invalid' }],
      timers: [{ id: 'tmr-1', initialSeconds: 'NaN', remainingSeconds: null }],
    }

    const validated = validateWorkspaceState(malformedState)

    // Columns: filtered invalid items, normalized text and boolean completed
    expect(validated.columns[0].items).toHaveLength(1)
    expect(validated.columns[0].items[0]).toEqual({ id: '123', text: '', completed: true })

    // Calendars: non-string entry values coerced to string
    expect(validated.calendars[0].entries['2026-08-31']).toBe('12345')
    expect(validated.calendars[0].entries['2026-09-01']).toBeUndefined()

    // Habits: boolean completions
    expect(validated.habits[0].completions['2026-08-31']).toBe(true)
    expect(validated.habits[0].completions['2026-09-01']).toBe(false)

    // Counters and timers: numeric defaults
    expect(validated.counters[0].initialValue).toBe(0)
    expect(validated.timers[0].initialSeconds).toBe(2700)
    expect(validated.timers[0].remainingSeconds).toBe(2700)
  })

  it('filters malformed labels and archived records before rendering', () => {
    const validated = validateWorkspaceState({
      customLabels: [null, { id: 'label-1', text: 'Safe', role: 'routine', customColor: 42 }],
      archivedCards: [null, { id: 'archive-1', type: 'picture', data: null }],
    })

    expect(validated.customLabels).toEqual([
      expect.objectContaining({ id: 'label-1', text: 'Safe', customColor: null }),
    ])
    expect(validated.archivedCards).toEqual([
      expect.objectContaining({ id: 'archive-1', type: 'picture', data: {} }),
    ])
  })
})
