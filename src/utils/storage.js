import {
  APP_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY_PREFIX,
  DEFAULT_WORKSPACES,
  INITIAL_COLUMNS,
  NOTE_TEXT,
  DETACHED_LABELS,
  THEME_PALETTES,
  normalizeCardColor,
} from './constants'
import { sanitizeUrl } from './urlSafety'

export const createDefaultColumns = () =>
  INITIAL_COLUMNS.map((column) => ({
    ...column,
    title: '',
    color: null,
    minimized: false,
  }))

export const createDefaultDrafts = () =>
  INITIAL_COLUMNS.reduce((accumulator, column) => {
    accumulator[column.id] = ''
    return accumulator
  }, {})

export const createDefaultNotes = () => [{ id: 'note', text: NOTE_TEXT, title: '', color: null, minimized: false }]

export const createDefaultTimers = () => [
  { id: 'timer', initialSeconds: 2700, remainingSeconds: 2700, title: '', color: null, minimized: false },
]

export const createDefaultCardPositions = () => ({
  left: { x: 90, y: 50 },
  middle: { x: 530, y: 50 },
  right: { x: 1050, y: 50 },
  a: { x: 890, y: 282 },
  b: { x: 1000, y: 282 },
  c: { x: 890, y: 340 },
  note: { x: 370, y: 490 },
  timer: { x: 810, y: 450 },
})

export function readJsonStorage(key) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }

    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage write errors.
  }
}

export function removeStorageKey(key) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage delete errors.
  }
}

export function getInitialAppState() {
  const stored = readJsonStorage(APP_STORAGE_KEY)
  const storedWorkspaces = Array.isArray(stored?.workspaces)
    ? stored.workspaces.filter(
        (workspace) =>
          workspace &&
          typeof workspace.id === 'string' &&
          typeof workspace.name === 'string',
      )
    : []

  const workspaces = storedWorkspaces.length > 0 ? storedWorkspaces : DEFAULT_WORKSPACES
  const activeWorkspaceId =
    typeof stored?.activeWorkspaceId === 'string' &&
    workspaces.some((workspace) => workspace.id === stored.activeWorkspaceId)
      ? stored.activeWorkspaceId
      : workspaces[0].id

  return { workspaces, activeWorkspaceId }
}

const normalizeItems = (items) =>
  Array.isArray(items)
    ? items.map((item) =>
        item && typeof item === 'object' && item.color
          ? { ...item, color: normalizeCardColor(item.color) }
          : item,
      )
    : []

// Link URLs are rendered as <a href>, so anything that isn't a safe http(s)
// URL (e.g. javascript: injected via a tampered localStorage or a shared
// backup file) is neutralized at the load boundary.
const sanitizeQuickLinks = (cards) =>
  cards.map((card) =>
    card && typeof card === 'object' && Array.isArray(card.links)
      ? {
          ...card,
          links: card.links.map((link) =>
            link && typeof link === 'object'
              ? { ...link, url: sanitizeUrl(link.url) || '' }
              : link,
          ),
        }
      : card,
  )

export function validateWorkspaceState(stored) {
  return {
    columns: Array.isArray(stored?.columns)
      ? normalizeItems(stored.columns)
      : createDefaultColumns(),
    drafts:
      stored?.drafts && typeof stored.drafts === 'object'
        ? { ...createDefaultDrafts(), ...stored.drafts }
        : createDefaultDrafts(),
    viewport:
      stored?.viewport &&
      Number.isFinite(stored.viewport.x) &&
      Number.isFinite(stored.viewport.y) &&
      Number.isFinite(stored.viewport.scale)
        ? stored.viewport
        : { x: 0, y: 0, scale: 1 },
    themeMode: stored?.themeMode === 'day' ? 'day' : 'night',
    themePalette:
      stored?.themePalette && THEME_PALETTES[stored.themePalette] ? stored.themePalette : 'sage',
    notes: Array.isArray(stored?.notes) ? normalizeItems(stored.notes) : createDefaultNotes(),
    timers: Array.isArray(stored?.timers) ? normalizeItems(stored.timers) : createDefaultTimers(),
    counters: normalizeItems(stored?.counters),
    stopwatches: normalizeItems(stored?.stopwatches),
    calendars: normalizeItems(stored?.calendars),
    habits: normalizeItems(stored?.habits),
    pictures: normalizeItems(stored?.pictures),
    quickLinks: sanitizeQuickLinks(normalizeItems(stored?.quickLinks)),
    archivedCards: Array.isArray(stored?.archivedCards) ? stored.archivedCards : [],
    customLabels: Array.isArray(stored?.customLabels)
      ? stored.customLabels.map((lbl) =>
          lbl && lbl.customColor
            ? { ...lbl, customColor: normalizeCardColor(lbl.customColor) }
            : lbl,
        )
      : DETACHED_LABELS,
    singleNotes: normalizeItems(stored?.singleNotes),
    quotes: normalizeItems(stored?.quotes),
    cardPositions:
      stored?.cardPositions && typeof stored.cardPositions === 'object'
        ? { ...createDefaultCardPositions(), ...stored.cardPositions }
        : createDefaultCardPositions(),
  }
}

export function getInitialWorkspaceState(workspaceId) {
  const stored = readJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`)
  return validateWorkspaceState(stored)
}
