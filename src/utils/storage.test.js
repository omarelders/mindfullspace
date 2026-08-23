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
})
