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

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const safeColor = (color) => typeof color === 'string' ? normalizeCardColor(color) : null

const normalizeItems = (items) =>
  Array.isArray(items)
    ? items
        .filter(isRecord)
        .map((item) =>
          item.color ? { ...item, color: safeColor(item.color) } : item,
        )
    : []

const normalizeColumns = (columns) =>
  Array.isArray(columns)
    ? columns
        .filter(isRecord)
        .map((col) => ({
          ...col,
          color: safeColor(col.color),
          title: typeof col.title === 'string' ? col.title : '',
          items: Array.isArray(col.items)
            ? col.items
                .filter(isRecord)
                .map((it) => ({
                  ...it,
                  id: typeof it.id === 'string' ? it.id : String(it.id || 'item'),
                  text: typeof it.text === 'string' ? it.text : String(it.text ?? ''),
                  completed: Boolean(it.completed),
                }))
            : [],
        }))
    : createDefaultColumns()

const normalizeCalendars = (calendars) =>
  Array.isArray(calendars)
    ? calendars
        .filter(isRecord)
        .map((cal) => {
          const rawEntries = isRecord(cal.entries) ? cal.entries : {}
          const cleanEntries = {}
          for (const [key, val] of Object.entries(rawEntries)) {
            if (val !== undefined && val !== null) {
              cleanEntries[key] = typeof val === 'string' ? val : String(val)
            }
          }
          return {
            ...cal,
            color: safeColor(cal.color),
            title: typeof cal.title === 'string' ? cal.title : '',
            entries: cleanEntries,
          }
        })
    : []

const normalizeHabits = (habits) =>
  Array.isArray(habits)
    ? habits
        .filter(isRecord)
        .map((h) => {
          const rawCompletions = isRecord(h.completions) ? h.completions : {}
          const cleanCompletions = {}
          for (const [k, v] of Object.entries(rawCompletions)) {
            if (v !== undefined && v !== null) {
              cleanCompletions[k] = Boolean(v)
            }
          }
          return {
            ...h,
            color: safeColor(h.color),
            title: typeof h.title === 'string' ? h.title : '',
            completions: cleanCompletions,
          }
        })
    : []

const normalizeCounters = (counters) =>
  Array.isArray(counters)
    ? counters
        .filter(isRecord)
        .map((c) => ({
          ...c,
          color: safeColor(c.color),
          title: typeof c.title === 'string' ? c.title : '',
          initialValue: Number.isFinite(c.initialValue) ? c.initialValue : 0,
        }))
    : []

const normalizeTimers = (timers) =>
  Array.isArray(timers)
    ? timers
        .filter(isRecord)
        .map((t) => ({
          ...t,
          color: safeColor(t.color),
          title: typeof t.title === 'string' ? t.title : '',
          initialSeconds: Number.isFinite(t.initialSeconds) ? t.initialSeconds : 2700,
          remainingSeconds: Number.isFinite(t.remainingSeconds) ? t.remainingSeconds : 2700,
        }))
    : createDefaultTimers()

const normalizeStopwatches = (stopwatches) =>
  Array.isArray(stopwatches)
    ? stopwatches
        .filter(isRecord)
        .map((s) => ({
          ...s,
          color: safeColor(s.color),
          title: typeof s.title === 'string' ? s.title : '',
          initialSeconds: Number.isFinite(s.initialSeconds) ? s.initialSeconds : 0,
          elapsedSeconds: Number.isFinite(s.elapsedSeconds) ? s.elapsedSeconds : 0,
        }))
    : []

// Link URLs are rendered as <a href>, so anything that isn't a safe http(s)
// URL (e.g. javascript: injected via a tampered localStorage or a shared
// backup file) is neutralized at the load boundary.
const sanitizeQuickLinks = (cards) =>
  cards.map((card) =>
    isRecord(card) && Array.isArray(card.links)
      ? {
          ...card,
          links: card.links
            .filter(isRecord)
            .map((link) => ({
              ...link,
              url: sanitizeUrl(link.url) || '',
              label: typeof link.label === 'string' ? link.label : '',
            })),
        }
      : card,
  )

const ARCHIVED_CARD_TYPES = new Set([
  'todo', 'col', 'note', 'timer', 'counter', 'stopwatch', 'calendar', 'habit',
  'picture', 'quick-links', 'quote', 'label', 'singlenote',
])

const normalizeArchivedCards = (cards) =>
  Array.isArray(cards)
    ? cards
        .filter((entry) => isRecord(entry) && ARCHIVED_CARD_TYPES.has(entry.type === 'col' ? 'todo' : entry.type))
        .map((entry) => ({
          ...entry,
          type: entry.type === 'col' ? 'todo' : entry.type,
          data: isRecord(entry.data) ? entry.data : {},
          position: isRecord(entry.position) ? entry.position : null,
        }))
    : []

const normalizeCustomLabels = (labels) =>
  Array.isArray(labels)
    ? labels
        .filter(isRecord)
        .map((label) => ({
          ...label,
          text: typeof label.text === 'string' ? label.text : '',
          role: typeof label.role === 'string' ? label.role : 'english',
          customColor: safeColor(label.customColor),
        }))
    : DETACHED_LABELS

export function validateWorkspaceState(stored) {
  return {
    columns: normalizeColumns(stored?.columns),
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
    timers: normalizeTimers(stored?.timers),
    counters: normalizeCounters(stored?.counters),
    stopwatches: normalizeStopwatches(stored?.stopwatches),
    calendars: normalizeCalendars(stored?.calendars),
    habits: normalizeHabits(stored?.habits),
    pictures: normalizeItems(stored?.pictures),
    quickLinks: sanitizeQuickLinks(normalizeItems(stored?.quickLinks)),
    archivedCards: normalizeArchivedCards(stored?.archivedCards),
    customLabels: normalizeCustomLabels(stored?.customLabels),
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
