import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock3,
  Code2,
  Copy,
  Crosshair,
  Dumbbell,
  Droplets,
  Expand,
  FilePlus2,
  FileText,
  GraduationCap,
  GripVertical,
  Hash,
  Link2,
  ListTodo,
  LogOut,
  Mail,
  Maximize2,
  Menu,
  Minimize2,
  MoveRight,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Tag,
  Timer,
  TimerReset,
  Trash2,
  User,
  UserRound,
  Zap,
} from 'lucide-react'

const INITIAL_COLUMNS = [
  {
    id: 'left',
    tone: 'charcoal',
    positionClass: 'card-left',
    items: [
      { id: 'l1', text: 'reach page 100 in atomic habits', completed: false },
      { id: 'l2', text: 'reach page 150 in atomic habits', completed: false },
      { id: 'l3', text: 'reach page 200 in atomic habits', completed: false },
      { id: 'l4', text: 'reach page 250 in atomic habits', completed: false },
      { id: 'l5', text: 'reach page 300 in atomic habits', completed: false },
    ],
  },
  {
    id: 'middle',
    tone: 'gold',
    positionClass: 'card-middle',
    items: [
      { id: 'm1', text: 'finish the second course on datacamp', completed: false },
      { id: 'm2', text: 'finish the tiktok ads setup', completed: false },
    ],
  },
  {
    id: 'right',
    tone: 'violet',
    positionClass: 'card-right',
    items: [
      { id: 'r1', text: 'solve 3 problems in codeforces', completed: true },
      { id: 'r2', text: 'reach 30 minute in pronounce.com', completed: false },
      { id: 'r3', text: 'finish oop till inheritance', completed: false },
      { id: 'r4', text: 'start flutter course', completed: true },
    ],
  },
]

const DETACHED_LABELS = [
  { id: 'a', text: 'ROUTINE', role: 'routine' },
  { id: 'b', text: 'Programming', role: 'programming' },
  { id: 'c', text: 'ENGLISH', role: 'english' },
]

const THEME_COLORS = {
  night: {
    workspaceBg: '#18181B',
    workspaceBgAlt: '#17171A',
    navbarBgStart: '#18181B',
    navbarBgMid: '#17171A',
    navbarBgEnd: '#18181B',
    panel: '#18181B',
    panelMuted: '#3F3F46',
    panelBorder: '#3F3F46',
    inputText: '#FFFFFF',
    inputPlaceholder: '#EAD09B',
    text: '#FFFFFF',
    textStrong: '#FFFFFF',
    icon: '#FFFFFF',
    cardText: '#FFFFFF',
    cardUiSoft: 'rgba(255, 255, 255, 0.24)',
    cardUiMid: 'rgba(255, 255, 255, 0.38)',
    cardUiStrong: '#FFFFFF',
    toneCharcoal: '#27272A',
    toneGold: '#CA8A04',
    toneViolet: '#9333EA',
    toneRed: '#DC2626',
    toneBlue: '#0284C7',
    labelRoutine: '#2563EB',
    labelProgramming: '#EA580C',
    labelEnglish: '#65A30D',
    labelText: '#FFFFFF',
    railButton: '#F4F4F5',
    railIcon: '#18181B',
    switchTrack: '#9333EA',
    switchKnob: '#FDE047',
    palette: {
      color1: '#DC2626',
      color2: '#DB2777',
      color3: '#9333EA',
      color4: '#4F46E5',
      color5: '#2563EB',
      color6: '#0284C7',
      color7: '#16A34A',
      color8: '#65A30D',
      color9: '#CA8A04',
      color10: '#EA580C',
      neutral: '#3F3F46',
    },
  },
  day: {
    workspaceBg: '#F4F4F5',
    workspaceBgAlt: '#D4D4D8',
    navbarBgStart: '#E4E4E7',
    navbarBgMid: '#D4D4D8',
    navbarBgEnd: '#E4E4E7',
    panel: '#E4E4E7',
    panelMuted: '#D4D4D8',
    panelBorder: '#D4D4D8',
    inputText: '#000000',
    inputPlaceholder: '#655A1C',
    text: '#000000',
    textStrong: '#000000',
    icon: '#000000',
    cardText: '#000000',
    cardUiSoft: 'rgba(0, 0, 0, 0.22)',
    cardUiMid: 'rgba(0, 0, 0, 0.35)',
    cardUiStrong: '#000000',
    toneCharcoal: '#E4E4E7',
    toneGold: '#FDE047',
    toneViolet: '#D8B4FE',
    toneRed: '#FCA5A5',
    toneBlue: '#7DD3FC',
    labelRoutine: '#93C5FD',
    labelProgramming: '#FDBA74',
    labelEnglish: '#BEF264',
    labelText: '#000000',
    railButton: '#F4F4F5',
    railIcon: '#000000',
    switchTrack: '#D4D4D8',
    switchKnob: '#FDBA74',
    palette: {
      color1: '#FCA5A5',
      color2: '#F9A8D4',
      color3: '#D8B4FE',
      color4: '#A5B4FC',
      color5: '#93C5FD',
      color6: '#7DD3FC',
      color7: '#86EFAC',
      color8: '#BEF264',
      color9: '#FDE047',
      color10: '#FDBA74',
      neutral: '#E4E4E7',
    },
  },
}

const NOTE_TEXT =
  'ahh fuck how long I have been\nstruggling in this shit ???! the answer\nis years !!\n\n-----------\n\nmy money tell now wiht al-amry is\n350 le + 300 le + 190 le + 600 le'

const QUICK_CREATE_ACTIONS = [
  { id: 'label', title: 'Label', icon: 'label' },
  { id: 'note', title: 'Note', icon: 'note' },
  { id: 'todo-list', title: 'Todo List', icon: 'todo-list' },
  { id: 'counter', title: 'Counter', icon: 'counter' },
  { id: 'timer', title: 'Timer', icon: 'timer' },
  { id: 'stopwatch', title: 'Stopwatch', icon: 'stopwatch' },
  { id: 'quick-links', title: 'Quick Links', icon: 'quick-links' },
  { id: 'calendar', title: 'Calendar', icon: 'calendar' },
  { id: 'habit', title: 'Habit', icon: 'habit' },
]

const MIN_SCALE = 0.2
const MAX_SCALE = 2.6
const ZOOM_SENSITIVITY = 0.0016
const CARD_POP_DURATION_MS = 260

const CARD_MENU_COLORS = [
  { id: 'red', value: '#ef9a9a' },
  { id: 'pink', value: '#f48fb1' },
  { id: 'purple', value: '#ce93d8' },
  { id: 'indigo', value: '#9fa8da' },
  { id: 'blue', value: '#90caf9' },
  { id: 'cyan', value: '#80deea' },
  { id: 'green', value: '#81c784' },
  { id: 'lime', value: '#dce775' },
  { id: 'yellow', value: '#fff176' },
  { id: 'orange', value: '#ffb74d' },
]

const CARD_MOVE_TARGETS = [
  { id: 'top-left', label: 'Top Left', x: 90, y: 50 },
  { id: 'top-center', label: 'Top Center', x: 530, y: 50 },
  { id: 'top-right', label: 'Top Right', x: 1050, y: 50 },
  { id: 'bottom-left', label: 'Bottom Left', x: 90, y: 520 },
  { id: 'bottom-center', label: 'Bottom Center', x: 530, y: 520 },
  { id: 'bottom-right', label: 'Bottom Right', x: 1050, y: 520 },
]

const HABIT_ICON_OPTIONS = [
  { id: 'running', label: 'Running' },
  { id: 'studying', label: 'Studying' },
  { id: 'coding', label: 'Coding' },
  { id: 'reading', label: 'Reading' },
  { id: 'hydration', label: 'Hydration' },
  { id: 'workout', label: 'Workout' },
  { id: 'meditation', label: 'Meditation' },
]

const HABIT_ICON_EMOJI_FALLBACKS = {
  '🏃': 'running',
  '🏋️': 'workout',
  '📚': 'studying',
  '🧘': 'meditation',
  '💧': 'hydration',
}

const APP_STORAGE_KEY = 'mindful-space.app.v1'
const WORKSPACE_STORAGE_KEY_PREFIX = 'mindful-space.workspace.v1:'
const DEFAULT_WORKSPACES = [{ id: 'ws-default', name: 'Welcome 👋' }]

const createDefaultColumns = () =>
  INITIAL_COLUMNS.map((column) => ({
    ...column,
    title: '',
    color: null,
    minimized: false,
  }))

const createDefaultDrafts = () =>
  INITIAL_COLUMNS.reduce((accumulator, column) => {
    accumulator[column.id] = ''
    return accumulator
  }, {})

const createDefaultNotes = () => [{ id: 'note', text: NOTE_TEXT, title: '', color: null, minimized: false }]

const createDefaultTimers = () => [
  { id: 'timer', initialSeconds: 2700, remainingSeconds: 2700, title: '', color: null, minimized: false },
]

const createDefaultCardPositions = () => ({
  left: { x: 90, y: 50 },
  middle: { x: 530, y: 50 },
  right: { x: 1050, y: 50 },
  a: { x: 890, y: 282 },
  b: { x: 1000, y: 282 },
  c: { x: 890, y: 340 },
  note: { x: 370, y: 490 },
  timer: { x: 810, y: 450 },
})

function readJsonStorage(key) {
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

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage write errors.
  }
}

function removeStorageKey(key) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage delete errors.
  }
}

function getInitialAppState() {
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

function getInitialWorkspaceState(workspaceId) {
  const stored = readJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`)

  return {
    columns: Array.isArray(stored?.columns) ? stored.columns : createDefaultColumns(),
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
    notes: Array.isArray(stored?.notes) ? stored.notes : createDefaultNotes(),
    timers: Array.isArray(stored?.timers) ? stored.timers : createDefaultTimers(),
    counters: Array.isArray(stored?.counters) ? stored.counters : [],
    stopwatches: Array.isArray(stored?.stopwatches) ? stored.stopwatches : [],
    calendars: Array.isArray(stored?.calendars) ? stored.calendars : [],
    habits: Array.isArray(stored?.habits) ? stored.habits : [],
    archivedCards: Array.isArray(stored?.archivedCards) ? stored.archivedCards : [],
    customLabels: Array.isArray(stored?.customLabels) ? stored.customLabels : DETACHED_LABELS,
    cardPositions:
      stored?.cardPositions && typeof stored.cardPositions === 'object'
        ? { ...createDefaultCardPositions(), ...stored.cardPositions }
        : createDefaultCardPositions(),
  }
}

function normalizeHabitIconId(iconId) {
  if (HABIT_ICON_OPTIONS.some((option) => option.id === iconId)) {
    return iconId
  }

  if (iconId && HABIT_ICON_EMOJI_FALLBACKS[iconId]) {
    return HABIT_ICON_EMOJI_FALLBACKS[iconId]
  }

  return HABIT_ICON_OPTIONS[0].id
}

function HabitIcon({ iconId }) {
  const normalizedIconId = normalizeHabitIconId(iconId)

  switch (normalizedIconId) {
    case 'running':
      return <Zap className="habit-icon-svg" aria-hidden="true" />
    case 'studying':
      return <GraduationCap className="habit-icon-svg" aria-hidden="true" />
    case 'coding':
      return <Code2 className="habit-icon-svg" aria-hidden="true" />
    case 'reading':
      return <BookOpen className="habit-icon-svg" aria-hidden="true" />
    case 'workout':
      return <Dumbbell className="habit-icon-svg" aria-hidden="true" />
    case 'hydration':
      return <Droplets className="habit-icon-svg" aria-hidden="true" />
    case 'meditation':
      return <Sparkles className="habit-icon-svg" aria-hidden="true" />
    default:
      return null
  }
}

function reorderListItems(items, fromItemId, toItemId) {
  const fromIndex = items.findIndex((item) => item.id === fromItemId)
  const toIndex = items.findIndex((item) => item.id === toItemId)

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items
  }

  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

function formatSecondsToTimer(totalSeconds) {
  const safeTotal = Math.max(0, totalSeconds)
  const hours = Math.floor(safeTotal / 3600)
  const minutes = Math.floor((safeTotal % 3600) / 60)
  const seconds = safeTotal % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function parseTimerValue(value) {
  const raw = value.trim()
  if (!raw) {
    return null
  }

  const parts = raw.split(':').map((part) => Number(part.trim()))
  if (parts.some((part) => Number.isNaN(part) || part < 0)) {
    return null
  }

  if (parts.length === 1) {
    return Math.floor(parts[0])
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts
    if (seconds > 59) {
      return null
    }

    return Math.floor(minutes * 60 + seconds)
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    if (minutes > 59 || seconds > 59) {
      return null
    }

    return Math.floor(hours * 3600 + minutes * 60 + seconds)
  }

  return null
}

function buildDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return { year, month: month - 1, day }
}

function formatCalendarMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatCalendarEntryLabel(dateKey) {
  const parsedDate = parseDateKey(dateKey)
  if (!parsedDate) {
    return ''
  }

  return new Date(parsedDate.year, parsedDate.month, parsedDate.day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function TopBar({
  mode,
  onToggleMode,
  isFocusMode,
  onToggleFocusMode,
  workspace,
  allWorkspaces,
  onSwitchWorkspace,
  onUpdateName,
  onDuplicateWorkspace,
  onDeleteWorkspace,
  onCreateWorkspace,
  isWorkspaceMenuOpen,
  setIsWorkspaceMenuOpen,
  quickActions,
  onQuickAction,
  labels,
  onSelectLabel,
  archivedCards,
  habits,
  onRestoreArchivedCard,
}) {
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [activeAccountTab, setActiveAccountTab] = useState('profile')
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const accountRef = useRef(null)
  const labelOptions = Array.isArray(labels) ? labels : []
  const archiveOptions = Array.isArray(archivedCards) ? archivedCards : []
  const habitOptions = Array.isArray(habits) ? habits : []
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredLabels = labelOptions.filter((label) =>
    !normalizedQuery || label.text.toLowerCase().includes(normalizedQuery),
  )

  const { streakDays, streakTimeline } = useMemo(() => {
    const doneDateKeys = new Set()
    habitOptions.forEach((habit) => {
      Object.entries(habit.completions || {}).forEach(([dateKey, isDone]) => {
        if (isDone) {
          doneDateKeys.add(dateKey)
        }
      })
    })

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const cursor = new Date(todayStart)
    let nextStreakDays = 0

    while (doneDateKeys.has(buildDateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()))) {
      nextStreakDays += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    const timelineOffsets = [-3, -2, -1, 0, 1, 2]
    const nextTimeline = timelineOffsets.map((offset) => {
      const date = new Date(todayStart)
      date.setDate(todayStart.getDate() + offset)
      const dateKey = buildDateKey(date.getFullYear(), date.getMonth(), date.getDate())

      let status = 'missed'
      if (offset > 0) {
        status = 'future'
      } else if (doneDateKeys.has(dateKey)) {
        status = offset === 0 ? 'today-done' : 'done'
      } else if (offset === 0) {
        status = 'today'
      }

      return {
        key: `${dateKey}-${offset}`,
        status,
      }
    })

    return {
      streakDays: nextStreakDays,
      streakTimeline: nextTimeline,
    }
  }, [habitOptions])

  const archivedItems = useMemo(
    () => [...archiveOptions].sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0)),
    [archiveOptions],
  )

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsQuickMenuOpen(false)
      }

      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false)
      }

      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setIsAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectLabel = (label) => {
    if (onSelectLabel) {
      onSelectLabel(label.id)
    }
    setSearchQuery('')
    setIsSearchOpen(false)
  }

  const formatArchiveTypeLabel = (type) => {
    if (type === 'todo') return 'Todo'
    if (type === 'label') return 'Label'
    if (type === 'note') return 'Note'
    if (type === 'timer') return 'Timer'
    if (type === 'counter') return 'Counter'
    if (type === 'stopwatch') return 'Stopwatch'
    if (type === 'calendar') return 'Calendar'
    if (type === 'habit') return 'Habit'
    return 'Card'
  }

  const formatArchiveTitle = (entry) => {
    const data = entry?.data || {}
    if (entry?.type === 'label') return data.text || 'Label'
    if (entry?.type === 'todo') return data.title || 'Todo List'
    if (entry?.type === 'note') return data.title || (data.text ? data.text.slice(0, 28) : 'Note')
    if (entry?.type === 'timer') return data.title || 'Timer'
    if (entry?.type === 'counter') return data.title || 'Counter'
    if (entry?.type === 'stopwatch') return data.title || 'Stopwatch'
    if (entry?.type === 'calendar') return data.title || 'Calendar'
    if (entry?.type === 'habit') return data.title || 'Habit'
    return 'Archived Card'
  }

  const profileName = 'Omar Elders'
  const profileEmail = 'omarelders1968@gmail.com'
  const profileLevel = 1

  return (
    <header className="top-bar">
      <div className="top-left">
        <div className="account-menu-wrap" ref={accountRef}>
          <button
            className={`nav-box ${isAccountMenuOpen ? 'is-open' : ''}`}
            aria-label="menu"
            aria-expanded={isAccountMenuOpen}
            onClick={() => {
              setIsAccountMenuOpen((open) => !open)
              setIsQuickMenuOpen(false)
              setIsSearchOpen(false)
            }}
          >
            <Menu aria-hidden="true" />
          </button>

          {isAccountMenuOpen && (
            <section className="account-panel" aria-label="account menu">
              <div className="account-tabs">
                <button
                  type="button"
                  className={`account-tab ${activeAccountTab === 'profile' ? 'is-active' : ''}`}
                  onClick={() => setActiveAccountTab('profile')}
                >
                  <User aria-hidden="true" />
                  Profile
                </button>
                <button
                  type="button"
                  className={`account-tab ${activeAccountTab === 'archive' ? 'is-active' : ''}`}
                  onClick={() => setActiveAccountTab('archive')}
                >
                  <Archive aria-hidden="true" />
                  Archive
                </button>
                <button
                  type="button"
                  className={`account-tab ${activeAccountTab === 'settings' ? 'is-active' : ''}`}
                  onClick={() => setActiveAccountTab('settings')}
                >
                  <Settings aria-hidden="true" />
                  Settings
                </button>
              </div>

              {activeAccountTab === 'profile' && (
                <div className="account-content">
                  <div className="account-profile-grid">
                    <div className="account-avatar-wrap">
                      <div className="account-avatar">
                        <UserRound aria-hidden="true" />
                      </div>
                    </div>

                    <div className="account-meta-stack">
                      <div className="account-meta-card account-meta-strong">{profileName}</div>
                      <div className="account-meta-card">
                        <User aria-hidden="true" />
                        Level {profileLevel}
                      </div>
                      <button
                        type="button"
                        className="account-meta-card account-signout-btn"
                        onClick={() => setIsAccountMenuOpen(false)}
                      >
                        <LogOut aria-hidden="true" />
                        Sign Out
                      </button>
                    </div>
                  </div>

                  <div className="account-email-row">
                    <span className="account-email-dot" aria-hidden="true" />
                    <span>{profileEmail}</span>
                  </div>

                  <div className="account-streak-card">
                    <div className="account-streak-header">
                      <span>You're on a</span>
                      <span>{streakDays} day streak in total 🔥</span>
                    </div>
                    <div className="account-streak-main">{streakDays} day streak</div>

                    <div className="account-streak-track" aria-hidden="true">
                      {streakTimeline.map((node) => (
                        <span key={node.key} className={`streak-node ${node.status}`} />
                      ))}
                    </div>
                  </div>

                  <button type="button" className="account-subscribe-btn">
                    Subscribe to mindfulspace+
                  </button>
                </div>
              )}

              {activeAccountTab === 'archive' && (
                <div className="account-content">
                  {archivedItems.length > 0 ? (
                    <div className="account-archive-list">
                      {archivedItems.slice(0, 12).map((entry) => (
                        <article key={entry.id} className="account-archive-item">
                          <div className="account-archive-main">
                            <div className="account-archive-title">{formatArchiveTitle(entry)}</div>
                            <div className="account-archive-meta">
                              {formatArchiveTypeLabel(entry.type)} •{' '}
                              {new Date(entry.archivedAt || Date.now()).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </div>
                          <div className="account-archive-actions">
                            <button
                              type="button"
                              className="account-archive-restore"
                              onClick={() => onRestoreArchivedCard?.(entry.id)}
                            >
                              Restore
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="account-empty-state">No archived cards yet.</div>
                  )}
                </div>
              )}

              {activeAccountTab === 'settings' && (
                <div className="account-content">
                  <div className="account-settings-list">
                    <div className="account-setting-row">
                      <span>Theme</span>
                      <button type="button" className="account-setting-btn" onClick={onToggleMode}>
                        {mode === 'night' ? 'Switch to day' : 'Switch to night'}
                      </button>
                    </div>
                    <div className="account-setting-row">
                      <span>Archived cards</span>
                      <strong>{archivedItems.length}</strong>
                    </div>
                    <div className="account-setting-row">
                      <span>Active habits</span>
                      <strong>{habitOptions.length}</strong>
                    </div>
                    <div className="account-setting-row">
                      <span>Labels</span>
                      <strong>{labelOptions.length}</strong>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="workspace-selector-wrap" ref={menuRef}>
          <button
            className={`welcome-box ${isWorkspaceMenuOpen ? 'is-open' : ''}`}
            aria-label="workspace selector"
            onClick={() => {
              setIsWorkspaceMenuOpen(open => !open)
              setIsAccountMenuOpen(false)
              setIsQuickMenuOpen(false)
              setIsSearchOpen(false)
            }}
          >
            <span className="welcome-text">{workspace.name}</span>
            <ChevronDown className="caret-icon" aria-hidden="true" />
          </button>

          {isWorkspaceMenuOpen && (
            <section className="workspace-menu-panel" role="menu">
              <div className="workspace-list">
                {allWorkspaces.map(ws => (
                  <div key={ws.id} className={`workspace-item ${ws.id === workspace.id ? 'is-active' : ''}`}>
                    {ws.id === workspace.id ? (
                      <div className="workspace-drag-handle">
                        <GripVertical aria-hidden="true" />
                      </div>
                    ) : (
                      <div className="workspace-drag-handle-placeholder" />
                    )}
                    
                    <input
                      className="workspace-name-input"
                      value={ws.name}
                      onChange={(e) => onUpdateName(ws.id, e.target.value)}
                      onClick={() => {
                        if (ws.id !== workspace.id) {
                          onSwitchWorkspace(ws.id)
                          setIsWorkspaceMenuOpen(false)
                        }
                      }}
                    />

                    <div className="workspace-actions">
                      <button
                        className="workspace-action-btn"
                        onClick={() => {
                          onSwitchWorkspace(ws.id)
                          setIsWorkspaceMenuOpen(false)
                        }}
                        aria-label="select workspace"
                      >
                        <Check aria-hidden="true" />
                      </button>
                      
                      <button
                        className="workspace-action-btn"
                        onClick={() => {
                          onDuplicateWorkspace(ws.id)
                          setIsWorkspaceMenuOpen(false)
                        }}
                        aria-label="duplicate workspace"
                      >
                        <Copy aria-hidden="true" />
                      </button>

                      <button
                        className="workspace-action-btn workspace-delete-btn"
                        onClick={() => {
                          if (allWorkspaces.length <= 1) {
                            alert("You must have at least one workspace.")
                            return
                          }
                          if (window.confirm(`Delete workspace "${ws.name}"?`)) {
                            onDeleteWorkspace(ws.id)
                            setIsWorkspaceMenuOpen(false)
                          }
                        }}
                        aria-label="delete workspace"
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="workspace-menu-footer">
                <button
                  className="workspace-add-btn"
                  onClick={() => {
                    onCreateWorkspace()
                    setIsWorkspaceMenuOpen(false)
                  }}
                >
                  <Plus aria-hidden="true" />
                </button>
              </div>
            </section>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            className="quick-box"
            aria-label="quick create"
            onClick={() => {
              setIsQuickMenuOpen((open) => !open)
              setIsAccountMenuOpen(false)
              setIsSearchOpen(false)
            }}
          >
            <FilePlus2 aria-hidden="true" />
            <ChevronDown className="caret-icon" aria-hidden="true" />
          </button>

          {isQuickMenuOpen && (
            <div className="quick-menu">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className="quick-menu-item"
                  onClick={() => {
                    onQuickAction(action.id)
                    setIsQuickMenuOpen(false)
                  }}
                >
                  <ActionRailIcon kind={action.icon} />
                  {action.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="top-right">
        <div className="label-search-wrap" ref={searchRef}>
          <label className="search-shell">
            <input
              type="text"
              value={searchQuery}
              placeholder="Search for a label..."
              onFocus={() => {
                setIsSearchOpen(true)
                setIsAccountMenuOpen(false)
              }}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setIsSearchOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && filteredLabels.length > 0) {
                  handleSelectLabel(filteredLabels[0])
                }

                if (event.key === 'Escape') {
                  setIsSearchOpen(false)
                }
              }}
            />
            <Search aria-hidden="true" />
          </label>

          {isSearchOpen && (
            <div className="label-search-results" role="listbox" aria-label="label search results">
              {filteredLabels.length > 0 ? (
                filteredLabels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className="label-search-item"
                    style={{ backgroundColor: label.color || undefined, color: 'var(--label-text)' }}
                    onClick={() => handleSelectLabel(label)}
                  >
                    {label.text}
                  </button>
                ))
              ) : (
                <div className="label-search-empty">No labels found</div>
              )}
            </div>
          )}
        </div>

        <button className="icon-box" aria-label="messages">
          <Mail aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`icon-box focus-toggle ${isFocusMode ? 'is-active' : ''}`}
          aria-label={isFocusMode ? 'Exit Focus Mode' : 'Focus Mode'}
          aria-pressed={isFocusMode}
          onClick={onToggleFocusMode}
        >
          <Crosshair aria-hidden="true" />
        </button>

        <button className="icon-box" aria-label="fullscreen">
          <Expand aria-hidden="true" />
        </button>

        <button
          className={`theme-switch ${mode === 'day' ? 'is-day' : 'is-night'}`}
          aria-label="theme switch"
          onClick={onToggleMode}
        >
          <span className="theme-moon" />
        </button>
      </div>
    </header>
  )
}

function CardContextMenu({
  title,
  minimized,
  onTitleChange,
  onColorChange,
  onMove,
  onToggleMinimize,
  onDuplicate,
  onArchive,
  onDelete,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [openSubmenu, setOpenSubmenu] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
        setOpenSubmenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const closeMenu = () => {
    setIsOpen(false)
    setOpenSubmenu(null)
  }

  const handleAction = (action) => {
    action()
    closeMenu()
  }

  const stopMenuDrag = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div className="card-menu-wrap" ref={menuRef} onMouseDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="card-menu card-menu-trigger"
        aria-label="card menu"
        onMouseDown={stopMenuDrag}
        onClick={() => {
          setIsOpen((open) => !open)
          setOpenSubmenu(null)
        }}
      >
        ...
      </button>

      {isOpen && (
        <div className="card-menu-panel" role="menu" onMouseDown={(event) => event.stopPropagation()}>
          <div className="card-menu-title-row">
            <Pencil aria-hidden="true" />
            <input
              type="text"
              value={title}
              placeholder="Write your title..."
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </div>

          <button
            type="button"
            className={`card-menu-item ${openSubmenu === 'color' ? 'is-active' : ''}`}
            onClick={() => setOpenSubmenu((submenu) => (submenu === 'color' ? null : 'color'))}
          >
            <span className="card-menu-item-label">
              <Palette aria-hidden="true" />
              Color
            </span>
            <span className="card-menu-arrow" aria-hidden="true">›</span>
          </button>

          <button
            type="button"
            className={`card-menu-item ${openSubmenu === 'move' ? 'is-active' : ''}`}
            onClick={() => setOpenSubmenu((submenu) => (submenu === 'move' ? null : 'move'))}
          >
            <span className="card-menu-item-label">
              <MoveRight aria-hidden="true" />
              Move To
            </span>
            <span className="card-menu-arrow" aria-hidden="true">›</span>
          </button>

          <button type="button" className="card-menu-item" onClick={() => handleAction(onToggleMinimize)}>
            <span className="card-menu-item-label">
              {minimized ? <Maximize2 aria-hidden="true" /> : <Minimize2 aria-hidden="true" />}
              {minimized ? 'Restore' : 'Minimize'}
            </span>
          </button>

          <button type="button" className="card-menu-item" onClick={() => handleAction(onDuplicate)}>
            <span className="card-menu-item-label">
              <Copy aria-hidden="true" />
              Duplicate
            </span>
          </button>

          <button type="button" className="card-menu-item" onClick={() => handleAction(onArchive)}>
            <span className="card-menu-item-label">
              <Archive aria-hidden="true" />
              Archive
            </span>
          </button>

          <button type="button" className="card-menu-item card-menu-item-danger" onClick={() => handleAction(onDelete)}>
            <span className="card-menu-item-label">
              <Trash2 aria-hidden="true" />
              Delete
            </span>
          </button>

          {openSubmenu === 'color' && (
            <div className="card-submenu card-color-submenu">
              {CARD_MENU_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className="card-color-option"
                  style={{ backgroundColor: color.value }}
                  onClick={() => handleAction(() => onColorChange(color.value))}
                  aria-label={`set color ${color.id}`}
                />
              ))}
            </div>
          )}

          {openSubmenu === 'move' && (
            <div className="card-submenu card-move-submenu">
              {CARD_MOVE_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className="card-move-option"
                  onClick={() => handleAction(() => onMove(target.id))}
                >
                  {target.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function hasSamePosition(currentPosition, nextPosition) {
  if (currentPosition === nextPosition) {
    return true
  }

  if (!currentPosition || !nextPosition) {
    return currentPosition === nextPosition
  }

  return currentPosition.x === nextPosition.x && currentPosition.y === nextPosition.y
}

function areTodoCardPropsEqual(currentProps, nextProps) {
  return (
    currentProps.column === nextProps.column &&
    currentProps.draft === nextProps.draft &&
    currentProps.draggingItemId === nextProps.draggingItemId &&
    currentProps.isPopping === nextProps.isPopping &&
    hasSamePosition(currentProps.position, nextProps.position)
  )
}

function areNoteCardPropsEqual(currentProps, nextProps) {
  return (
    currentProps.note === nextProps.note &&
    currentProps.isPopping === nextProps.isPopping &&
    hasSamePosition(currentProps.position, nextProps.position)
  )
}

function areTimerCardPropsEqual(currentProps, nextProps) {
  return (
    currentProps.timer === nextProps.timer &&
    currentProps.isPopping === nextProps.isPopping &&
    hasSamePosition(currentProps.position, nextProps.position)
  )
}

function areLabelCardPropsEqual(currentProps, nextProps) {
  return (
    currentProps.label === nextProps.label &&
    currentProps.labelTextColor === nextProps.labelTextColor &&
    currentProps.isPopping === nextProps.isPopping &&
    hasSamePosition(currentProps.position, nextProps.position)
  )
}

function areCounterCardPropsEqual(currentProps, nextProps) {
  return (
    currentProps.counter === nextProps.counter &&
    currentProps.isPopping === nextProps.isPopping &&
    hasSamePosition(currentProps.position, nextProps.position)
  )
}

function areStopwatchCardPropsEqual(currentProps, nextProps) {
  return (
    currentProps.stopwatch === nextProps.stopwatch &&
    currentProps.isPopping === nextProps.isPopping &&
    hasSamePosition(currentProps.position, nextProps.position)
  )
}

function areCalendarCardPropsEqual(currentProps, nextProps) {
  return (
    currentProps.calendar === nextProps.calendar &&
    currentProps.isPopping === nextProps.isPopping &&
    hasSamePosition(currentProps.position, nextProps.position)
  )
}

function areHabitCardPropsEqual(currentProps, nextProps) {
  return (
    currentProps.habit === nextProps.habit &&
    currentProps.isPopping === nextProps.isPopping &&
    hasSamePosition(currentProps.position, nextProps.position)
  )
}

const TodoCard = memo(function TodoCard({
  column,
  draft,
  onDraftChange,
  onAdd,
  onToggle,
  onUpdateItemText,
  onDeleteItem,
  onDragStartItem,
  onDragOverItem,
  onDropOnItem,
  onDropOnList,
  onDragEndItem,
  draggingItemId,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onUpdateItemDetails,
  isPopping,
}) {
  const [editingItemId, setEditingItemId] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [activeDragHandleId, setActiveDragHandleId] = useState(null)

  const toggleItemExpanded = (itemId, e) => {
    e.stopPropagation()
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const updateItemDescription = (itemId, description) => {
    if (onUpdateItemDetails) onUpdateItemDetails(column.id, itemId, { description })
  }

  const updateItemStatus = (itemId, status) => {
    if (onUpdateItemDetails) {
      onUpdateItemDetails(column.id, itemId, { status, completed: status === 'Done' })
    }
  }

  const startEditingItem = (item) => {
    setEditingItemId(item.id)
    setEditingValue(item.text)
  }

  const cancelEditingItem = () => {
    setEditingItemId(null)
    setEditingValue('')
  }

  const commitEditingItem = (itemId) => {
    const nextText = editingValue.trim()
    if (!nextText) {
      cancelEditingItem()
      return
    }

    onUpdateItemText(column.id, itemId, nextText)
    cancelEditingItem()
  }

  return (
    <section
      className={`floating-card todo-card tone-${column.tone} ${column.positionClass} ${column.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: column.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{column.title}</span>
        <CardContextMenu
          title={column.title}
          minimized={Boolean(column.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(column.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(column.id, color)}
          onMove={(targetId) => onMoveCard(column.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(column.id)}
          onDuplicate={() => onDuplicateCard(column.id)}
          onArchive={() => onArchiveCard(column.id)}
          onDelete={() => onDeleteCard(column.id)}
        />
      </header>

      {!column.minimized && (
        <>
          <ul className="todo-list" onDragOver={onDragOverItem} onDrop={(event) => onDropOnList(column.id, event)}>
            {column.items.map((item) => {
              const isExpanded = expandedItems.has(item.id)
              const status = item.status || (item.completed ? 'Done' : 'Todo')
              return (
              <li
                className={`todo-row ${item.completed ? 'is-done' : ''} ${draggingItemId === item.id ? 'dragging' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                key={item.id}
                draggable={activeDragHandleId === item.id}
                onDragOver={onDragOverItem}
                onDrop={(event) => onDropOnItem(column.id, item.id, event)}
                onDragStart={(event) => onDragStartItem(column.id, item.id, event)}
                onDragEnd={onDragEndItem}
              >
                <div className="todo-row-main">
                  <button
                    type="button"
                    className="drag-grid"
                    aria-label={`drag ${item.text}`}
                    onMouseEnter={() => setActiveDragHandleId(item.id)}
                    onMouseLeave={() => setActiveDragHandleId(null)}
                  >
                    <GripVertical aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className={`todo-check ${status === 'Done' ? 'checked' : ''} ${status === 'In Progress' ? 'in-progress' : ''}`}
                    onClick={() => {
                      const nextStatus = status === 'Todo' ? 'In Progress' : status === 'In Progress' ? 'Done' : 'Todo'
                      updateItemStatus(item.id, nextStatus)
                    }}
                    aria-label={`toggle ${item.text}`}
                  >
                    {status === 'Done' && (
                      <Check aria-hidden="true" />
                    )}
                    {status === 'In Progress' && (
                      <Clock3 aria-hidden="true" />
                    )}
                  </button>

                  {editingItemId === item.id ? (
                    <input
                      type="text"
                      className="todo-text-edit"
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onBlur={() => commitEditingItem(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitEditingItem(item.id)
                        }

                        if (event.key === 'Escape') {
                          cancelEditingItem()
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className={`todo-text ${item.completed ? 'completed' : ''}`}
                      onClick={() => startEditingItem(item)}
                      aria-label={`edit ${item.text}`}
                    >
                      {item.text}
                    </button>
                  )}

                  <div className="todo-actions">
                    <button 
                      type="button" 
                      className="todo-arrow-btn" 
                      onClick={(e) => toggleItemExpanded(item.id, e)} 
                      aria-label={`more actions for ${item.text}`}
                    >
                      <ChevronDown
                        aria-hidden="true"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      />
                    </button>
                    <button
                      type="button"
                      className="todo-delete-btn"
                      onClick={() => onDeleteItem(column.id, item.id)}
                      aria-label={`delete ${item.text}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="todo-row-expanded">
                    <textarea
                      className="todo-description-input"
                      placeholder="Description..."
                      value={item.description || ''}
                      onChange={(e) => updateItemDescription(item.id, e.target.value)}
                    />
                    <div className="todo-status-group">
                      {['Todo', 'In Progress', 'Done'].map(s => (
                        <button
                          key={s}
                          type="button"
                          className={`todo-status-btn ${status === s ? 'active' : ''}`}
                          onClick={() => updateItemStatus(item.id, s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
              )
            })}
          </ul>

          <div className="todo-input-row">
            <input
              type="text"
              placeholder="Type your todo..."
              value={draft}
              onChange={(event) => onDraftChange(column.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onAdd(column.id)
                }
              }}
            />
            <button type="button" onClick={() => onAdd(column.id)} aria-label="add todo">
              +
            </button>
          </div>
        </>
      )}
    </section>
  )
}, areTodoCardPropsEqual)

function LabelStack({ labels, labelTextColor, position, onMouseDown }) {
  return (
    <div className="label-stack" aria-label="labels" style={{ left: position?.x, top: position?.y, margin: position ? 0 : undefined }}>
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default', height: '20px', minHeight: '20px', width: '100%', padding: 0 }} />
      {labels.map((label) => (
        <span key={label.id} style={{ background: label.color, color: labelTextColor }}>
          {label.text}
        </span>
      ))}
    </div>
  )
}

const NoteCard = memo(function NoteCard({
  note,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onUpdateText,
  isPopping,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(note.text)

  const handleStartEdit = (e) => {
    e.stopPropagation()
    setEditValue(note.text)
    setIsEditing(true)
  }

  const handleCommitEdit = () => {
    setIsEditing(false)
    if (onUpdateText && editValue !== note.text) {
      onUpdateText(note.id, editValue)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(note.text)
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCommitEdit()
    }
  }

  return (
    <section
      className={`floating-card note-card card-note ${note.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: note.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{note.title}</span>
        <CardContextMenu
          title={note.title}
          minimized={Boolean(note.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(note.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(note.id, color)}
          onMove={(targetId) => onMoveCard(note.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(note.id)}
          onDuplicate={() => onDuplicateCard(note.id)}
          onArchive={() => onArchiveCard(note.id)}
          onDelete={() => onDeleteCard(note.id)}
        />
      </header>
      {!note.minimized && (
        isEditing ? (
          <textarea
            className="note-text-edit"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommitEdit}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <p className="note-content" onClick={handleStartEdit} style={{ height: 'calc(100% - 36px)' }}>
            {note.text || 'Click to edit note...'}
          </p>
        )
      )}
    </section>
  )
}, areNoteCardPropsEqual)

const TimerCard = memo(function TimerCard({
  timer,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onUpdateRemainingSeconds,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  const initialSeconds = Number.isFinite(timer.initialSeconds) ? timer.initialSeconds : 2700
  const persistedSeconds = Number.isFinite(timer.remainingSeconds) ? timer.remainingSeconds : initialSeconds
  const [secondsLeft, setSecondsLeft] = useState(persistedSeconds)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    setSecondsLeft(persistedSeconds)
  }, [timer.id, persistedSeconds])

  useEffect(() => {
    onUpdateRemainingSeconds(timer.id, secondsLeft)
  }, [onUpdateRemainingSeconds, timer.id, secondsLeft])

  useEffect(() => {
    if (!isRunning) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setSecondsLeft((previousSeconds) => {
        if (previousSeconds <= 1) {
          window.clearInterval(intervalId)
          setIsRunning(false)
          return 0
        }

        return previousSeconds - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isRunning])

  const toggleRunning = () => {
    if (!isRunning && secondsLeft <= 0) {
      return
    }

    setIsRunning((running) => !running)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setSecondsLeft(initialSeconds)
  }

  const editTimer = () => {
    const rawValue = window.prompt('Set timer as HH:MM:SS', formatSecondsToTimer(secondsLeft))
    if (rawValue === null) {
      return
    }

    const parsedSeconds = parseTimerValue(rawValue)
    if (parsedSeconds === null) {
      window.alert('Use HH:MM:SS, MM:SS, or seconds.')
      return
    }

    setIsRunning(false)
    setSecondsLeft(parsedSeconds)
  }

  return (
    <section
      className={`floating-card timer-card card-timer ${timer.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: timer.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{timer.title}</span>
        <CardContextMenu
          title={timer.title}
          minimized={Boolean(timer.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(timer.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(timer.id, color)}
          onMove={(targetId) => onMoveCard(timer.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(timer.id)}
          onDuplicate={() => onDuplicateCard(timer.id)}
          onArchive={() => onArchiveCard(timer.id)}
          onDelete={() => onDeleteCard(timer.id)}
        />
      </header>
      {!timer.minimized && (
        <div className="timer-panel">
          <div className="timer-value">{formatSecondsToTimer(secondsLeft)}</div>
          <div className="timer-controls">
            <button
              type="button"
              className={`timer-control play ${isRunning ? 'is-running' : ''}`}
            onClick={toggleRunning}
            aria-label={isRunning ? 'pause timer' : 'start timer'}
            disabled={!isRunning && secondsLeft <= 0}
            >
              {isRunning ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </button>

            <button type="button" className="timer-control" onClick={editTimer} aria-label="edit timer value">
              <Pencil aria-hidden="true" />
            </button>

            <button type="button" className="timer-control" onClick={resetTimer} aria-label="reset timer">
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}, areTimerCardPropsEqual)

const LabelCard = memo(function LabelCard({
  label,
  position,
  labelTextColor,
  onMouseDown,
  onUpdateText,
  onUpdateColor,
  onMoveCard,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  return (
    <div
      className={`floating-card label-card card-label ${isPopping ? 'is-popping' : ''}`}
      data-card-id={label.id}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: label.color || undefined,
        color: labelTextColor,
      }}
    >
      <div className="label-drag-handle" onMouseDown={onMouseDown} style={{ flex: 1, cursor: onMouseDown ? 'grab' : 'default', paddingRight: '4px' }}>
        {label.text}
      </div>
      <CardContextMenu
        title={label.text}
        minimized={false}
        onTitleChange={(nextText) => onUpdateText(label.id, nextText)}
        onColorChange={(color) => onUpdateColor(label.id, color)}
        onMove={(targetId) => onMoveCard(label.id, targetId)}
        onToggleMinimize={() => {}}
        onDuplicate={() => onDuplicateCard(label.id)}
        onArchive={() => onArchiveCard(label.id)}
        onDelete={() => onDeleteCard(label.id)}
      />
    </div>
  )
}, areLabelCardPropsEqual)

const CounterCard = memo(function CounterCard({
  counter,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  const initialValue = counter.initialValue ?? 0
  const [value, setValue] = useState(initialValue)

  const resetCounter = () => {
    setValue(initialValue)
  }

  return (
    <section
      className={`floating-card counter-card card-counter ${counter.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: counter.color || undefined,
      }}
    >
      <header className="card-header counter-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        {counter.title ? <span className="card-title">{counter.title}</span> : null}
        <CardContextMenu
          title={counter.title}
          minimized={Boolean(counter.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(counter.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(counter.id, color)}
          onMove={(targetId) => onMoveCard(counter.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(counter.id)}
          onDuplicate={() => onDuplicateCard(counter.id)}
          onArchive={() => onArchiveCard(counter.id)}
          onDelete={() => onDeleteCard(counter.id)}
        />
      </header>
      {!counter.minimized && (
        <div className="counter-panel">
          <button
            type="button"
            className="counter-chevron-btn"
            onClick={() => setValue((current) => current + 1)}
            aria-label="increase counter"
          >
            <ChevronUp aria-hidden="true" />
          </button>

          <div className="counter-large-value" onDoubleClick={resetCounter} title="Double-click to reset">
            {value}
          </div>

          <button
            type="button"
            className="counter-chevron-btn"
            onClick={() => setValue((current) => current - 1)}
            aria-label="decrease counter"
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
}, areCounterCardPropsEqual)

const StopwatchCard = memo(function StopwatchCard({
  stopwatch,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onUpdateElapsedSeconds,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  const initialSeconds = Number.isFinite(stopwatch.initialSeconds) ? stopwatch.initialSeconds : 0
  const persistedSeconds = Number.isFinite(stopwatch.elapsedSeconds)
    ? stopwatch.elapsedSeconds
    : initialSeconds
  const [elapsedSeconds, setElapsedSeconds] = useState(persistedSeconds)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    setElapsedSeconds(persistedSeconds)
  }, [stopwatch.id, persistedSeconds])

  useEffect(() => {
    onUpdateElapsedSeconds(stopwatch.id, elapsedSeconds)
  }, [onUpdateElapsedSeconds, stopwatch.id, elapsedSeconds])

  useEffect(() => {
    if (!isRunning) return undefined

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isRunning])

  const resetStopwatch = () => {
    setIsRunning(false)
    setElapsedSeconds(0)
  }

  const [h, m, s] = formatSecondsToTimer(elapsedSeconds).split(':')

  return (
    <section
      className={`floating-card stopwatch-card card-stopwatch ${stopwatch.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: '#86ECA0',
      }}
    >
      <div className="stopwatch-drag-handle" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <CardContextMenu
          title={stopwatch.title || 'Stopwatch'}
          minimized={Boolean(stopwatch.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(stopwatch.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(stopwatch.id, color)}
          onMove={(targetId) => onMoveCard(stopwatch.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(stopwatch.id)}
          onDuplicate={() => onDuplicateCard(stopwatch.id)}
          onArchive={() => onArchiveCard(stopwatch.id)}
          onDelete={() => onDeleteCard(stopwatch.id)}
        />
      </div>

      {!stopwatch.minimized && (
        <div className="stopwatch-panel">
          <div className="stopwatch-value">
            {h} <span className="stopwatch-colon">:</span> {m} <span className="stopwatch-colon">:</span> {s}
          </div>
          <div className="stopwatch-controls">
            <button
              type="button"
              className={`stopwatch-control play ${isRunning ? 'is-running' : ''}`}
              onClick={() => setIsRunning((running) => !running)}
              aria-label={isRunning ? 'pause stopwatch' : 'start stopwatch'}
            >
              {isRunning ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" style={{ paddingLeft: '2px' }} />
              )}
            </button>

            <button type="button" className="stopwatch-control" onClick={resetStopwatch} aria-label="reset stopwatch">
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}, areStopwatchCardPropsEqual)

const CalendarCard = memo(function CalendarCard({
  calendar,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onChangeMonth,
  onOpenDay,
  onCloseDay,
  onUpdateEntry,
  isPopping,
}) {
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const firstDayOfMonth = new Date(calendar.year, calendar.month, 1)
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(calendar.year, calendar.month + 1, 0).getDate()
  const today = new Date()
  const todayKey = buildDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const currentEntry = calendar.selectedDate ? calendar.entries?.[calendar.selectedDate] || '' : ''

  return (
    <section
      className={`floating-card calendar-card card-calendar ${calendar.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: calendar.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{calendar.title || 'Calendar'}</span>
        <CardContextMenu
          title={calendar.title || 'Calendar'}
          minimized={Boolean(calendar.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(calendar.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(calendar.id, color)}
          onMove={(targetId) => onMoveCard(calendar.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(calendar.id)}
          onDuplicate={() => onDuplicateCard(calendar.id)}
          onArchive={() => onArchiveCard(calendar.id)}
          onDelete={() => onDeleteCard(calendar.id)}
        />
      </header>

      {!calendar.minimized && (
        <div className="calendar-panel-shell">
          {calendar.selectedDate ? (
            <div className="calendar-entry-view">
              <div className="calendar-entry-top">
                <button
                  type="button"
                  className="calendar-back-btn"
                  aria-label="back to calendar month"
                  onClick={() => onCloseDay(calendar.id)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <div className="calendar-entry-date">{formatCalendarEntryLabel(calendar.selectedDate)}</div>
              </div>
              <textarea
                className="calendar-entry-input"
                value={currentEntry}
                onChange={(event) => onUpdateEntry(calendar.id, calendar.selectedDate, event.target.value)}
                placeholder="Write your journal entry..."
              />
            </div>
          ) : (
            <div className="calendar-month-view">
              <div className="calendar-toolbar">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  aria-label="previous month"
                  onClick={() => onChangeMonth(calendar.id, -1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <h4 className="calendar-month-label">{formatCalendarMonthLabel(calendar.year, calendar.month)}</h4>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  aria-label="next month"
                  onClick={() => onChangeMonth(calendar.id, 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <div className="calendar-weekdays">
                {weekdayLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="calendar-days-grid">
                {Array.from({ length: firstWeekday }).map((_, index) => (
                  <span key={`blank-${index}`} className="calendar-day calendar-day-empty" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const dayNumber = index + 1
                  const dateKey = buildDateKey(calendar.year, calendar.month, dayNumber)
                  const hasEntry = Boolean(calendar.entries?.[dateKey]?.trim())
                  const isToday = dateKey === todayKey

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={`calendar-day ${isToday ? 'is-today' : ''} ${hasEntry ? 'has-entry' : ''}`}
                      onClick={() => onOpenDay(calendar.id, dateKey)}
                      aria-label={`open day ${dayNumber}`}
                    >
                      {dayNumber}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}, areCalendarCardPropsEqual)

const HabitCard = memo(function HabitCard({
  habit,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateIcon,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onSetView,
  onChangeMonth,
  onToggleDate,
  isPopping,
}) {
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const firstDayOfMonth = new Date(habit.year, habit.month, 1)
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(habit.year, habit.month + 1, 0).getDate()
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const currentYear = todayStart.getFullYear()
  const currentMonth = todayStart.getMonth()
  const currentDayOfMonth = todayStart.getDate()
  const todayKey = buildDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const todayIsDone = Boolean(habit.completions?.[todayKey])
  const hasHabitTitle = Boolean((habit.title || '').trim())
  const selectedIconId = normalizeHabitIconId(habit.icon)
  const selectedIconIndex = HABIT_ICON_OPTIONS.findIndex((option) => option.id === selectedIconId)
  const isViewingCurrentMonth = habit.year === currentYear && habit.month === currentMonth
  const [editingName, setEditingName] = useState(false)
  const [editingNameValue, setEditingNameValue] = useState('')

  const startEditingName = () => {
    setEditingName(true)
    setEditingNameValue(habit.title || '')
  }

  const cancelEditingName = () => {
    setEditingName(false)
    setEditingNameValue('')
  }

  const commitEditingName = () => {
    const nextTitle = editingNameValue.trim()
    if (!nextTitle) {
      cancelEditingName()
      return
    }

    if (nextTitle !== (habit.title || '')) {
      onUpdateTitle(habit.id, nextTitle)
    }

    cancelEditingName()
  }

  const cycleHabitIcon = (direction) => {
    const totalOptions = HABIT_ICON_OPTIONS.length
    if (!totalOptions) {
      return
    }

    const startIndex = selectedIconIndex >= 0 ? selectedIconIndex : 0
    const nextIndex = (startIndex + direction + totalOptions) % totalOptions
    onUpdateIcon(habit.id, HABIT_ICON_OPTIONS[nextIndex].id)
  }

  let doneInViewedMonth = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = buildDateKey(habit.year, habit.month, day)
    if (habit.completions?.[dateKey]) {
      doneInViewedMonth += 1
    }
  }

  let missingInViewedMonth = 0
  if (isViewingCurrentMonth) {
    for (let day = 1; day < currentDayOfMonth; day += 1) {
      const dateKey = buildDateKey(habit.year, habit.month, day)
      if (!habit.completions?.[dateKey]) {
        missingInViewedMonth += 1
      }
    }
  }

  let doneInCurrentMonth = 0
  for (let day = 1; day <= currentDayOfMonth; day += 1) {
    const dateKey = buildDateKey(currentYear, currentMonth, day)
    const isDone = Boolean(habit.completions?.[dateKey])
    if (isDone) {
      doneInCurrentMonth += 1
    }
  }

  return (
    <section
      className={`floating-card habit-card card-habit ${habit.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: habit.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{habit.title || 'Habit'}</span>
        <CardContextMenu
          title={habit.title || 'Habit'}
          minimized={Boolean(habit.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(habit.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(habit.id, color)}
          onMove={(targetId) => onMoveCard(habit.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(habit.id)}
          onDuplicate={() => onDuplicateCard(habit.id)}
          onArchive={() => onArchiveCard(habit.id)}
          onDelete={() => onDeleteCard(habit.id)}
        />
      </header>

      {!habit.minimized && (
        <div className="habit-body">
          {habit.view === 'calendar' ? (
            <div className="habit-calendar-view">
              <div className="habit-calendar-toolbar">
                <button
                  type="button"
                  className="habit-back-btn"
                  aria-label="back to habit"
                  onClick={() => onSetView(habit.id, 'summary')}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>

                <div className="habit-month-nav">
                  <button
                    type="button"
                    className="habit-nav-btn"
                    aria-label="previous month"
                    onClick={() => onChangeMonth(habit.id, -1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <h4 className="habit-month-label">{formatCalendarMonthLabel(habit.year, habit.month)}</h4>
                  <button
                    type="button"
                    className="habit-nav-btn"
                    aria-label="next month"
                    onClick={() => onChangeMonth(habit.id, 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="habit-weekdays">
                {weekdayLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="habit-days-grid">
                {Array.from({ length: firstWeekday }).map((_, index) => (
                  <span key={`habit-blank-${index}`} className="habit-day habit-day-empty" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const dayNumber = index + 1
                  const dateKey = buildDateKey(habit.year, habit.month, dayNumber)
                  const isDone = Boolean(habit.completions?.[dateKey])
                  const dayStart = new Date(habit.year, habit.month, dayNumber)
                  const isToday = dayStart.getTime() === todayStart.getTime()
                  const isMissed = isViewingCurrentMonth && dayStart < todayStart && !isDone
                  const isFuture = dayStart > todayStart
                  const canToggle = dayStart <= todayStart

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={`habit-day ${isDone ? 'is-done' : ''} ${isMissed ? 'is-missed' : ''} ${isFuture ? 'is-future' : ''} ${isToday ? 'is-today' : ''}`}
                      onClick={() => onToggleDate(habit.id, dateKey)}
                      disabled={!canToggle}
                      aria-label={`toggle habit for day ${dayNumber}`}
                    >
                      {dayNumber}
                    </button>
                  )
                })}
              </div>

              <div className="habit-calendar-stats">
                <span>{doneInViewedMonth} done</span>
                <span>{missingInViewedMonth} missing</span>
              </div>
            </div>
          ) : (
            <div className="habit-summary-view">
              <div className="habit-icon-switcher">
                <button
                  type="button"
                  className="habit-icon-nav"
                  onClick={() => cycleHabitIcon(-1)}
                  aria-label="previous habit icon"
                >
                  <ChevronLeft aria-hidden="true" />
                </button>

                <div className="habit-icon-circle" aria-hidden="true">
                  <HabitIcon iconId={selectedIconId} />
                </div>

                <button
                  type="button"
                  className="habit-icon-nav"
                  onClick={() => cycleHabitIcon(1)}
                  aria-label="next habit icon"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <div className="habit-title-row">
                {editingName ? (
                  <input
                    type="text"
                    className="habit-name-edit"
                    value={editingNameValue}
                    onChange={(event) => setEditingNameValue(event.target.value)}
                    onBlur={commitEditingName}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitEditingName()
                      }

                      if (event.key === 'Escape') {
                        cancelEditingName()
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className={`habit-name habit-name-btn ${hasHabitTitle ? 'is-custom' : ''}`}
                    onClick={startEditingName}
                    aria-label="edit habit name"
                  >
                    {habit.title || 'Habit...'}
                  </button>
                )}

                <button
                  type="button"
                  className="habit-open-calendar"
                  aria-label="open habit calendar"
                  onClick={() => onSetView(habit.id, 'calendar')}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                className={`habit-check-btn ${todayIsDone ? 'is-done' : ''}`}
                onClick={() => onToggleDate(habit.id, todayKey)}
                aria-label="toggle today habit done"
              >
                <Check aria-hidden="true" />
              </button>

              <div className="habit-done-text">{doneInCurrentMonth} x done</div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}, areHabitCardPropsEqual)

function ActionRailIcon({ kind }) {
  switch (kind) {
    case 'label':
      return <Tag aria-hidden="true" />
    case 'note':
      return <FileText aria-hidden="true" />
    case 'todo-list':
      return <ListTodo aria-hidden="true" />
    case 'counter':
      return <Hash aria-hidden="true" />
    case 'stopwatch':
      return <TimerReset aria-hidden="true" />
    case 'timer':
      return <Timer aria-hidden="true" />
    case 'quick-links':
      return <Link2 aria-hidden="true" />
    case 'calendar':
      return <CalendarDays aria-hidden="true" />
    case 'habit':
      return <CircleCheck aria-hidden="true" />
    default:
      return null
  }
}

function ActionRail({ open, onToggle, quickActions, onQuickAction }) {
  return (
    <aside className="action-rail" aria-label="action rail">
      <div className={`rail-items ${open ? 'open' : ''}`}>
        {quickActions.map((action) => (
          <button
            key={action.id}
            className="rail-button"
            aria-label={action.title}
            onClick={() => onQuickAction(action.id)}
          >
            <ActionRailIcon kind={action.icon} />
          </button>
        ))}
      </div>
      <button
        className="rail-button rail-add"
        aria-label="toggle action menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Plus aria-hidden="true" />
      </button>
    </aside>
  )
}

export default function App() {
  const initialAppState = useMemo(() => getInitialAppState(), [])
  const [workspaces, setWorkspaces] = useState(() => initialAppState.workspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => initialAppState.activeWorkspaceId)

  useEffect(() => {
    if (workspaces.length === 0) {
      return
    }

    const hasActiveWorkspace = workspaces.some((workspace) => workspace.id === activeWorkspaceId)
    const nextActiveWorkspaceId = hasActiveWorkspace ? activeWorkspaceId : workspaces[0].id

    if (nextActiveWorkspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(nextActiveWorkspaceId)
      return
    }

    writeJsonStorage(APP_STORAGE_KEY, {
      workspaces,
      activeWorkspaceId: nextActiveWorkspaceId,
    })
  }, [workspaces, activeWorkspaceId])

  const handleUpdateWorkspaceName = (id, newName) => {
    setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, name: newName } : ws))
  }

  const handleDeleteWorkspace = (id) => {
    setWorkspaces(prev => {
      removeStorageKey(`${WORKSPACE_STORAGE_KEY_PREFIX}${id}`)
      const remaining = prev.filter(ws => ws.id !== id)
      if (remaining.length === 0) {
        const fallbackWorkspace = { id: 'ws-default', name: 'Welcome 👋' }
        setActiveWorkspaceId(fallbackWorkspace.id)
        return [fallbackWorkspace]
      }

      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(remaining[0].id)
      }

      return remaining
    })
  }

  const handleCreateWorkspace = () => {
    const newId = `ws-${Date.now()}`
    setWorkspaces(prev => [...prev, { id: newId, name: 'New Workspace' }])
    setActiveWorkspaceId(newId)
  }

  const handleDuplicateWorkspace = (sourceWorkspaceId) => {
    const sourceWorkspace = workspaces.find((ws) => ws.id === sourceWorkspaceId)
    if (!sourceWorkspace) {
      return
    }

    const newId = `ws-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const sourceStorageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${sourceWorkspaceId}`
    const nextStorageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${newId}`
    const sourceSnapshot = readJsonStorage(sourceStorageKey)

    if (sourceSnapshot) {
      writeJsonStorage(nextStorageKey, sourceSnapshot)
    }

    setWorkspaces((prev) => [
      ...prev,
      {
        id: newId,
        name: sourceWorkspace.name ? `${sourceWorkspace.name} Copy` : 'Workspace Copy',
      },
    ])
    setActiveWorkspaceId(newId)
  }

  return (
    <>
      {workspaces.map(ws => (
        <WorkspaceBoard
          key={ws.id}
          workspace={ws}
          isVisible={activeWorkspaceId === ws.id}
          allWorkspaces={workspaces}
          onSwitchWorkspace={setActiveWorkspaceId}
          onUpdateName={handleUpdateWorkspaceName}
          onDuplicateWorkspace={handleDuplicateWorkspace}
          onDeleteWorkspace={handleDeleteWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
        />
      ))}
    </>
  )
}

function WorkspaceBoard({
  workspace,
  isVisible,
  allWorkspaces,
  onSwitchWorkspace,
  onUpdateName,
  onDuplicateWorkspace,
  onDeleteWorkspace,
  onCreateWorkspace,
}) {
  const workspaceRef = useRef(null)
  const menuRef = useRef(null)
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false)
  const panRef = useRef({ active: false, lastX: 0, lastY: 0 })
  const initialWorkspaceState = useMemo(() => getInitialWorkspaceState(workspace.id), [workspace.id])
  const [columns, setColumns] = useState(() => initialWorkspaceState.columns)
  const [drafts, setDrafts] = useState(() => initialWorkspaceState.drafts)
  const [viewport, setViewport] = useState(() => initialWorkspaceState.viewport)
  const [isPanning, setIsPanning] = useState(false)
  const [isRailOpen, setIsRailOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [themeMode, setThemeMode] = useState(() => initialWorkspaceState.themeMode)
  const [dragState, setDragState] = useState({ columnId: null, itemId: null })
  const [notes, setNotes] = useState(() => initialWorkspaceState.notes)
  const [timers, setTimers] = useState(() => initialWorkspaceState.timers)
  const [counters, setCounters] = useState(() => initialWorkspaceState.counters)
  const [stopwatches, setStopwatches] = useState(() => initialWorkspaceState.stopwatches)
  const [calendars, setCalendars] = useState(() => initialWorkspaceState.calendars)
  const [habits, setHabits] = useState(() => initialWorkspaceState.habits)
  const [archivedCards, setArchivedCards] = useState(() => initialWorkspaceState.archivedCards)
  const [customLabels, setCustomLabels] = useState(() => initialWorkspaceState.customLabels)
  const [cardPositions, setCardPositions] = useState(() => initialWorkspaceState.cardPositions)
  const [draggingCard, setDraggingCard] = useState(null)
  const [activeDragHandleId, setActiveDragHandleId] = useState(null)
  const [poppingCardIds, setPoppingCardIds] = useState(() => new Set())
  const hasInitializedCardTrackingRef = useRef(false)
  const previousCardIdsRef = useRef(new Set())
  const popCleanupTimeoutsRef = useRef(new Map())
  const supportsNativeZoom =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('zoom', '1')
  const theme = THEME_COLORS[themeMode]
  const detachedLabels = customLabels.map((label) => {
    let color = ''
    if (label.customColor) {
      color = label.customColor
    } else if (label.role === 'routine') {
      color = theme.labelRoutine
    } else if (label.role === 'programming') {
      color = theme.labelProgramming
    } else {
      color = theme.labelEnglish
    }
    return { ...label, color }
  })
  const renderedCardIds = useMemo(
    () => [
      ...columns.map((column) => column.id),
      ...detachedLabels.map((label) => label.id),
      ...notes.map((note) => note.id),
      ...timers.map((timer) => timer.id),
      ...counters.map((counter) => counter.id),
      ...stopwatches.map((stopwatch) => stopwatch.id),
      ...calendars.map((calendar) => calendar.id),
      ...habits.map((habit) => habit.id),
    ],
    [columns, detachedLabels, notes, timers, counters, stopwatches, calendars, habits],
  )

  const workspaceStorageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${workspace.id}`
  const workspaceStorageSnapshot = useMemo(
    () => ({
      columns,
      drafts,
      viewport,
      themeMode,
      notes,
      timers,
      counters,
      stopwatches,
      calendars,
      habits,
      archivedCards,
      customLabels,
      cardPositions,
    }),
    [
      columns,
      drafts,
      viewport,
      themeMode,
      notes,
      timers,
      counters,
      stopwatches,
      calendars,
      habits,
      archivedCards,
      customLabels,
      cardPositions,
    ],
  )

  useEffect(() => {
    const persistTimeoutId = window.setTimeout(() => {
      writeJsonStorage(workspaceStorageKey, workspaceStorageSnapshot)
    }, 500)

    return () => window.clearTimeout(persistTimeoutId)
  }, [workspaceStorageKey, workspaceStorageSnapshot])

  useEffect(() => {
    const currentCardIds = new Set(renderedCardIds)

    if (!hasInitializedCardTrackingRef.current) {
      hasInitializedCardTrackingRef.current = true
      previousCardIdsRef.current = currentCardIds
      return
    }

    const previousCardIds = previousCardIdsRef.current
    previousCardIdsRef.current = currentCardIds

    const addedCardIds = renderedCardIds.filter((cardId) => !previousCardIds.has(cardId))
    const removedCardIds = [...previousCardIds].filter((cardId) => !currentCardIds.has(cardId))

    if (removedCardIds.length > 0) {
      setPoppingCardIds((currentPoppingIds) => {
        const nextPoppingIds = new Set(currentPoppingIds)
        removedCardIds.forEach((cardId) => nextPoppingIds.delete(cardId))
        return nextPoppingIds
      })

      removedCardIds.forEach((cardId) => {
        const timeoutId = popCleanupTimeoutsRef.current.get(cardId)
        if (timeoutId) {
          window.clearTimeout(timeoutId)
          popCleanupTimeoutsRef.current.delete(cardId)
        }
      })
    }

    if (addedCardIds.length === 0) {
      return
    }

    setPoppingCardIds((currentPoppingIds) => {
      const nextPoppingIds = new Set(currentPoppingIds)
      addedCardIds.forEach((cardId) => nextPoppingIds.add(cardId))
      return nextPoppingIds
    })

    addedCardIds.forEach((cardId) => {
      const existingTimeoutId = popCleanupTimeoutsRef.current.get(cardId)
      if (existingTimeoutId) {
        window.clearTimeout(existingTimeoutId)
      }

      const timeoutId = window.setTimeout(() => {
        setPoppingCardIds((currentPoppingIds) => {
          if (!currentPoppingIds.has(cardId)) {
            return currentPoppingIds
          }

          const nextPoppingIds = new Set(currentPoppingIds)
          nextPoppingIds.delete(cardId)
          return nextPoppingIds
        })
        popCleanupTimeoutsRef.current.delete(cardId)
      }, CARD_POP_DURATION_MS)

      popCleanupTimeoutsRef.current.set(cardId, timeoutId)
    })
  }, [renderedCardIds])

  useEffect(() => {
    return () => {
      popCleanupTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      popCleanupTimeoutsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!draggingCard) return

    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    window.getSelection()?.removeAllRanges()

    const handleMouseMove = (e) => {
      const scale = viewport.scale || 1
      const dx = (e.clientX - draggingCard.startX) / scale
      const dy = (e.clientY - draggingCard.startY) / scale
      
      setCardPositions(prev => ({
        ...prev,
        [draggingCard.id]: {
          x: draggingCard.initialX + dx,
          y: draggingCard.initialY + dy
        }
      }))
    }

    const handleMouseUp = () => {
      setDraggingCard(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingCard, viewport.scale])

  const handleCardMouseDown = (cardId, e) => {
    if (e.button !== 0) return
    if (!e.target.closest('.card-header') && !e.target.closest('.label-drag-handle') && !e.target.closest('.stopwatch-drag-handle')) return
    if (e.target.closest('.card-menu-wrap')) return
    const cardPosition = cardPositions[cardId]
    if (!cardPosition) return
    e.preventDefault()
    e.stopPropagation()
    window.getSelection()?.removeAllRanges()
    setDraggingCard({
      id: cardId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: cardPosition.x,
      initialY: cardPosition.y
    })
  }

  useEffect(() => {
    const stopPanning = () => {
      if (!panRef.current.active) {
        return
      }

      panRef.current.active = false
      setIsPanning(false)
    }

    window.addEventListener('mouseup', stopPanning)
    window.addEventListener('blur', stopPanning)

    return () => {
      window.removeEventListener('mouseup', stopPanning)
      window.removeEventListener('blur', stopPanning)
    }
  }, [])

  useEffect(() => {
    if (!isFocusMode) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsFocusMode(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isFocusMode])

  const toggleItem = (columnId, itemId) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => {
        if (column.id !== columnId) {
          return column
        }

        return {
          ...column,
          items: column.items.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item,
          ),
        }
      }),
    )
  }

  const setDraft = (columnId, value) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [columnId]: value,
    }))
  }

  const addItem = (columnId) => {
    const rawValue = drafts[columnId]
    const text = rawValue.trim()

    if (!text) {
      return
    }

    setColumns((currentColumns) =>
      currentColumns.map((column) => {
        if (column.id !== columnId) {
          return column
        }

        return {
          ...column,
          items: [
            ...column.items,
            {
              id: `${columnId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              text,
              completed: false,
            },
          ],
        }
      }),
    )

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [columnId]: '',
    }))
  }

  const deleteItem = (columnId, itemId) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => {
        if (column.id !== columnId) {
          return column
        }

        return {
          ...column,
          items: column.items.filter((item) => item.id !== itemId),
        }
      }),
    )
  }

  const removeCardPosition = (cardId) => {
    setCardPositions((currentPositions) => {
      if (!(cardId in currentPositions)) {
        return currentPositions
      }

      const nextPositions = { ...currentPositions }
      delete nextPositions[cardId]
      return nextPositions
    })
  }

  const clearCardDraft = (cardId) => {
    setDrafts((currentDrafts) => {
      if (!(cardId in currentDrafts)) {
        return currentDrafts
      }

      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[cardId]
      return nextDrafts
    })
  }

  const updateLabelText = (labelId, nextText) => {
    setCustomLabels((prev) => prev.map(l => l.id === labelId ? { ...l, text: nextText.toUpperCase() } : l))
  }
  
  const updateLabelColor = (labelId, color) => {
    setCustomLabels((prev) => prev.map(l => l.id === labelId ? { ...l, customColor: color } : l))
  }
  
  const duplicateLabelCard = (labelId) => {
    const source = detachedLabels.find(l => l.id === labelId)
    if (!source) return
    const dupId = `label-${Date.now()}`
    const sourcePos = cardPositions[labelId] || {x: 890, y: 282}
    setCustomLabels(prev => [...prev, { ...source, id: dupId, text: source.text }])
    setCardPositions(prev => ({ ...prev, [dupId]: { x: sourcePos.x + 36, y: sourcePos.y + 36 } }))
  }

  const archiveLabelCard = (labelId) => {
    const source = detachedLabels.find(l => l.id === labelId)
    if (source) archiveCardSnapshot('label', source)
    setCustomLabels(prev => prev.filter(l => l.id !== labelId))
    removeCardPosition(labelId)
    setDraggingCard(current => current?.id === labelId ? null : current)
  }

  const deleteLabelCard = (labelId) => {
    setCustomLabels(prev => prev.filter(l => l.id !== labelId))
    removeCardPosition(labelId)
    setDraggingCard(current => current?.id === labelId ? null : current)
  }

  const archiveCardSnapshot = (cardType, cardData) => {
    const archivedPosition =
      cardData?.id && cardPositions[cardData.id]
        ? { ...cardPositions[cardData.id] }
        : null

    setArchivedCards((currentArchive) => [
      ...currentArchive,
      {
        id: `${cardType}-${Date.now()}`,
        type: cardType,
        archivedAt: Date.now(),
        data: cardData,
        position: archivedPosition,
      },
    ])
  }

  const getRestorePosition = (cardType, archivedPosition) => {
    if (
      archivedPosition &&
      Number.isFinite(archivedPosition.x) &&
      Number.isFinite(archivedPosition.y)
    ) {
      return {
        x: archivedPosition.x + 24,
        y: archivedPosition.y + 24,
      }
    }

    const viewportOffsetX = viewport.x / viewport.scale
    const viewportOffsetY = viewport.y / viewport.scale

    if (cardType === 'label') {
      return { x: 400 - viewportOffsetX, y: 300 - viewportOffsetY }
    }

    if (cardType === 'todo') {
      return { x: 400 - viewportOffsetX, y: 200 - viewportOffsetY }
    }

    if (cardType === 'note') {
      return { x: 350 - viewportOffsetX, y: 300 - viewportOffsetY }
    }

    if (cardType === 'timer') {
      return { x: 600 - viewportOffsetX, y: 300 - viewportOffsetY }
    }

    if (cardType === 'counter') {
      return { x: 960 - viewportOffsetX, y: 260 - viewportOffsetY }
    }

    if (cardType === 'stopwatch') {
      return { x: 1240 - viewportOffsetX, y: 260 - viewportOffsetY }
    }

    if (cardType === 'calendar') {
      return { x: 1500 - viewportOffsetX, y: 120 - viewportOffsetY }
    }

    if (cardType === 'habit') {
      return { x: 1700 - viewportOffsetX, y: 120 - viewportOffsetY }
    }

    return { x: 400 - viewportOffsetX, y: 260 - viewportOffsetY }
  }

  const restoreArchivedCard = (archiveId) => {
    const archivedEntry = archivedCards.find((entry) => entry.id === archiveId)
    if (!archivedEntry) {
      return
    }

    const archivedData = archivedEntry.data || {}
    const restoredPosition = getRestorePosition(archivedEntry.type, archivedEntry.position)
    const uniqueSeed = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    let restoredCardId = null

    if (archivedEntry.type === 'label') {
      restoredCardId = `label-${uniqueSeed}`
      setCustomLabels((currentLabels) => [
        ...currentLabels,
        {
          ...archivedData,
          id: restoredCardId,
          text: archivedData.text || 'LABEL',
          role: archivedData.role || 'routine',
        },
      ])
    } else if (archivedEntry.type === 'todo') {
      restoredCardId = `col-${uniqueSeed}`
      const restoredItems = (archivedData.items || []).map((item, index) => ({
        ...item,
        id: `${restoredCardId}-item-${index}-${Date.now()}`,
      }))

      setColumns((currentColumns) => [
        ...currentColumns,
        {
          ...archivedData,
          id: restoredCardId,
          tone: archivedData.tone || 'charcoal',
          positionClass: '',
          title: archivedData.title || '',
          color: archivedData.color || null,
          minimized: false,
          items: restoredItems,
        },
      ])

      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [restoredCardId]: '',
      }))
    } else if (archivedEntry.type === 'note') {
      restoredCardId = `note-${uniqueSeed}`
      setNotes((currentNotes) => [
        ...currentNotes,
        {
          ...archivedData,
          id: restoredCardId,
          text: archivedData.text || '',
          title: archivedData.title || '',
          color: archivedData.color || null,
          minimized: false,
        },
      ])
    } else if (archivedEntry.type === 'timer') {
      restoredCardId = `timer-${uniqueSeed}`
      const initialSeconds = Number.isFinite(archivedData.initialSeconds) ? archivedData.initialSeconds : 2700
      const remainingSeconds = Number.isFinite(archivedData.remainingSeconds)
        ? archivedData.remainingSeconds
        : initialSeconds
      setTimers((currentTimers) => [
        ...currentTimers,
        {
          ...archivedData,
          id: restoredCardId,
          initialSeconds,
          remainingSeconds,
          title: archivedData.title || '',
          color: archivedData.color || null,
          minimized: false,
        },
      ])
    } else if (archivedEntry.type === 'counter') {
      restoredCardId = `counter-${uniqueSeed}`
      setCounters((currentCounters) => [
        ...currentCounters,
        {
          ...archivedData,
          id: restoredCardId,
          initialValue: Number.isFinite(archivedData.initialValue) ? archivedData.initialValue : 0,
          title: archivedData.title || '',
          color: archivedData.color || null,
          minimized: false,
        },
      ])
    } else if (archivedEntry.type === 'stopwatch') {
      restoredCardId = `stopwatch-${uniqueSeed}`
      const initialSeconds = Number.isFinite(archivedData.initialSeconds) ? archivedData.initialSeconds : 0
      const elapsedSeconds = Number.isFinite(archivedData.elapsedSeconds)
        ? archivedData.elapsedSeconds
        : initialSeconds
      setStopwatches((currentStopwatches) => [
        ...currentStopwatches,
        {
          ...archivedData,
          id: restoredCardId,
          initialSeconds,
          elapsedSeconds,
          title: archivedData.title || '',
          color: archivedData.color || null,
          minimized: false,
        },
      ])
    } else if (archivedEntry.type === 'calendar') {
      const now = new Date()
      restoredCardId = `calendar-${uniqueSeed}`
      setCalendars((currentCalendars) => [
        ...currentCalendars,
        {
          ...archivedData,
          id: restoredCardId,
          year: Number.isFinite(archivedData.year) ? archivedData.year : now.getFullYear(),
          month: Number.isFinite(archivedData.month) ? archivedData.month : now.getMonth(),
          selectedDate: null,
          entries: { ...(archivedData.entries || {}) },
          title: archivedData.title || '',
          color: archivedData.color || null,
          minimized: false,
        },
      ])
    } else if (archivedEntry.type === 'habit') {
      const now = new Date()
      restoredCardId = `habit-${uniqueSeed}`
      setHabits((currentHabits) => [
        ...currentHabits,
        {
          ...archivedData,
          id: restoredCardId,
          icon: normalizeHabitIconId(archivedData.icon),
          year: Number.isFinite(archivedData.year) ? archivedData.year : now.getFullYear(),
          month: Number.isFinite(archivedData.month) ? archivedData.month : now.getMonth(),
          view: 'summary',
          completions: { ...(archivedData.completions || {}) },
          title: archivedData.title || '',
          color: archivedData.color || null,
          minimized: false,
        },
      ])
    }

    if (!restoredCardId) {
      return
    }

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [restoredCardId]: restoredPosition,
    }))

    setArchivedCards((currentArchive) =>
      currentArchive.filter((entry) => entry.id !== archiveId),
    )
  }

  const moveCardToTarget = (cardId, targetId) => {
    const target = CARD_MOVE_TARGETS.find((candidate) => candidate.id === targetId)
    if (!target) {
      return
    }

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [cardId]: { x: target.x, y: target.y },
    }))
  }

  const updateTodoCardTitle = (columnId, nextTitle) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) =>
        column.id === columnId ? { ...column, title: nextTitle } : column,
      ),
    )
  }

  const updateTodoCardColor = (columnId, color) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) =>
        column.id === columnId ? { ...column, color } : column,
      ),
    )
  }

  const toggleTodoCardMinimize = (columnId) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) =>
        column.id === columnId ? { ...column, minimized: !column.minimized } : column,
      ),
    )
  }

  const duplicateTodoCard = (columnId) => {
    const sourceColumn = columns.find((column) => column.id === columnId)
    if (!sourceColumn) {
      return
    }

    const duplicateId = `col-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const now = Date.now()
    const sourcePosition = cardPositions[columnId] || { x: 200, y: 120 }
    const duplicateItems = sourceColumn.items.map((item, index) => ({
      ...item,
      id: `${duplicateId}-item-${index}-${now}`,
    }))

    setColumns((currentColumns) => [
      ...currentColumns,
      {
        ...sourceColumn,
        id: duplicateId,
        positionClass: '',
        title: sourceColumn.title ? `${sourceColumn.title} Copy` : '',
        minimized: false,
        items: duplicateItems,
      },
    ])

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [duplicateId]: currentDrafts[columnId] || '',
    }))

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [duplicateId]: {
        x: sourcePosition.x + 36,
        y: sourcePosition.y + 36,
      },
    }))
  }

  const archiveTodoCard = (columnId) => {
    const sourceColumn = columns.find((column) => column.id === columnId)
    if (!sourceColumn) {
      return
    }

    archiveCardSnapshot('todo', sourceColumn)
    setColumns((currentColumns) => currentColumns.filter((column) => column.id !== columnId))
    clearCardDraft(columnId)
    removeCardPosition(columnId)
    setDraggingCard((currentDrag) => (currentDrag?.id === columnId ? null : currentDrag))
    setDragState((currentDragState) =>
      currentDragState.columnId === columnId ? { columnId: null, itemId: null } : currentDragState,
    )
  }

  const deleteTodoCard = (columnId) => {
    setColumns((currentColumns) => currentColumns.filter((column) => column.id !== columnId))
    clearCardDraft(columnId)
    removeCardPosition(columnId)
    setDraggingCard((currentDrag) => (currentDrag?.id === columnId ? null : currentDrag))
    setDragState((currentDragState) =>
      currentDragState.columnId === columnId ? { columnId: null, itemId: null } : currentDragState,
    )
  }

  const updateNoteTitle = (noteId, nextTitle) => {
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === noteId ? { ...note, title: nextTitle } : note)),
    )
  }

  const updateNoteText = (noteId, nextText) => {
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === noteId ? { ...note, text: nextText } : note)),
    )
  }

  const updateNoteColor = (noteId, color) => {
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === noteId ? { ...note, color } : note)),
    )
  }

  const toggleNoteMinimize = (noteId) => {
    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === noteId ? { ...note, minimized: !note.minimized } : note,
      ),
    )
  }

  const duplicateNoteCard = (noteId) => {
    const sourceNote = notes.find((note) => note.id === noteId)
    if (!sourceNote) {
      return
    }

    const duplicateId = `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const sourcePosition = cardPositions[noteId] || { x: 360, y: 450 }

    setNotes((currentNotes) => [
      ...currentNotes,
      {
        ...sourceNote,
        id: duplicateId,
        title: sourceNote.title ? `${sourceNote.title} Copy` : '',
        minimized: false,
      },
    ])

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [duplicateId]: {
        x: sourcePosition.x + 36,
        y: sourcePosition.y + 36,
      },
    }))
  }

  const archiveNoteCard = (noteId) => {
    const sourceNote = notes.find((note) => note.id === noteId)
    if (!sourceNote) {
      return
    }

    archiveCardSnapshot('note', sourceNote)
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId))
    removeCardPosition(noteId)
    setDraggingCard((currentDrag) => (currentDrag?.id === noteId ? null : currentDrag))
  }

  const deleteNoteCard = (noteId) => {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId))
    removeCardPosition(noteId)
    setDraggingCard((currentDrag) => (currentDrag?.id === noteId ? null : currentDrag))
  }

  const updateTimerTitle = (timerId, nextTitle) => {
    setTimers((currentTimers) =>
      currentTimers.map((timer) =>
        timer.id === timerId ? { ...timer, title: nextTitle } : timer,
      ),
    )
  }

  const updateTimerColor = (timerId, color) => {
    setTimers((currentTimers) =>
      currentTimers.map((timer) =>
        timer.id === timerId ? { ...timer, color } : timer,
      ),
    )
  }

  const updateTimerRemainingSeconds = (timerId, nextSeconds) => {
    const safeSeconds = Number.isFinite(nextSeconds) ? Math.max(0, Math.floor(nextSeconds)) : 0
    setTimers((currentTimers) => {
      const timerIndex = currentTimers.findIndex((timer) => timer.id === timerId)
      if (timerIndex < 0) {
        return currentTimers
      }

      const currentTimer = currentTimers[timerIndex]
      if (currentTimer.remainingSeconds === safeSeconds) {
        return currentTimers
      }

      const nextTimers = [...currentTimers]
      nextTimers[timerIndex] = { ...currentTimer, remainingSeconds: safeSeconds }
      return nextTimers
    })
  }

  const toggleTimerMinimize = (timerId) => {
    setTimers((currentTimers) =>
      currentTimers.map((timer) =>
        timer.id === timerId ? { ...timer, minimized: !timer.minimized } : timer,
      ),
    )
  }

  const duplicateTimerCard = (timerId) => {
    const sourceTimer = timers.find((timer) => timer.id === timerId)
    if (!sourceTimer) {
      return
    }

    const duplicateId = `timer-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const sourcePosition = cardPositions[timerId] || { x: 800, y: 420 }

    setTimers((currentTimers) => [
      ...currentTimers,
      {
        ...sourceTimer,
        id: duplicateId,
        remainingSeconds: Number.isFinite(sourceTimer.remainingSeconds)
          ? sourceTimer.remainingSeconds
          : Number.isFinite(sourceTimer.initialSeconds)
            ? sourceTimer.initialSeconds
            : 2700,
        title: sourceTimer.title ? `${sourceTimer.title} Copy` : '',
        minimized: false,
      },
    ])

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [duplicateId]: {
        x: sourcePosition.x + 36,
        y: sourcePosition.y + 36,
      },
    }))
  }

  const archiveTimerCard = (timerId) => {
    const sourceTimer = timers.find((timer) => timer.id === timerId)
    if (!sourceTimer) {
      return
    }

    archiveCardSnapshot('timer', sourceTimer)
    setTimers((currentTimers) => currentTimers.filter((timer) => timer.id !== timerId))
    removeCardPosition(timerId)
    setDraggingCard((currentDrag) => (currentDrag?.id === timerId ? null : currentDrag))
  }

  const deleteTimerCard = (timerId) => {
    setTimers((currentTimers) => currentTimers.filter((timer) => timer.id !== timerId))
    removeCardPosition(timerId)
    setDraggingCard((currentDrag) => (currentDrag?.id === timerId ? null : currentDrag))
  }

  const updateCounterTitle = (counterId, nextTitle) => {
    setCounters((currentCounters) =>
      currentCounters.map((counter) =>
        counter.id === counterId ? { ...counter, title: nextTitle } : counter,
      ),
    )
  }

  const updateCounterColor = (counterId, color) => {
    setCounters((currentCounters) =>
      currentCounters.map((counter) =>
        counter.id === counterId ? { ...counter, color } : counter,
      ),
    )
  }

  const toggleCounterMinimize = (counterId) => {
    setCounters((currentCounters) =>
      currentCounters.map((counter) =>
        counter.id === counterId ? { ...counter, minimized: !counter.minimized } : counter,
      ),
    )
  }

  const duplicateCounterCard = (counterId) => {
    const sourceCounter = counters.find((counter) => counter.id === counterId)
    if (!sourceCounter) {
      return
    }

    const duplicateId = `counter-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const sourcePosition = cardPositions[counterId] || { x: 1090, y: 260 }

    setCounters((currentCounters) => [
      ...currentCounters,
      {
        ...sourceCounter,
        id: duplicateId,
        title: sourceCounter.title ? `${sourceCounter.title} Copy` : '',
        minimized: false,
      },
    ])

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [duplicateId]: {
        x: sourcePosition.x + 36,
        y: sourcePosition.y + 36,
      },
    }))
  }

  const archiveCounterCard = (counterId) => {
    const sourceCounter = counters.find((counter) => counter.id === counterId)
    if (!sourceCounter) {
      return
    }

    archiveCardSnapshot('counter', sourceCounter)
    setCounters((currentCounters) => currentCounters.filter((counter) => counter.id !== counterId))
    removeCardPosition(counterId)
    setDraggingCard((currentDrag) => (currentDrag?.id === counterId ? null : currentDrag))
  }

  const deleteCounterCard = (counterId) => {
    setCounters((currentCounters) => currentCounters.filter((counter) => counter.id !== counterId))
    removeCardPosition(counterId)
    setDraggingCard((currentDrag) => (currentDrag?.id === counterId ? null : currentDrag))
  }

  const updateStopwatchTitle = (stopwatchId, nextTitle) => {
    setStopwatches((currentStopwatches) =>
      currentStopwatches.map((stopwatch) =>
        stopwatch.id === stopwatchId ? { ...stopwatch, title: nextTitle } : stopwatch,
      ),
    )
  }

  const updateStopwatchColor = (stopwatchId, color) => {
    setStopwatches((currentStopwatches) =>
      currentStopwatches.map((stopwatch) =>
        stopwatch.id === stopwatchId ? { ...stopwatch, color } : stopwatch,
      ),
    )
  }

  const updateStopwatchElapsedSeconds = (stopwatchId, nextSeconds) => {
    const safeSeconds = Number.isFinite(nextSeconds) ? Math.max(0, Math.floor(nextSeconds)) : 0
    setStopwatches((currentStopwatches) => {
      const stopwatchIndex = currentStopwatches.findIndex((stopwatch) => stopwatch.id === stopwatchId)
      if (stopwatchIndex < 0) {
        return currentStopwatches
      }

      const currentStopwatch = currentStopwatches[stopwatchIndex]
      if (currentStopwatch.elapsedSeconds === safeSeconds) {
        return currentStopwatches
      }

      const nextStopwatches = [...currentStopwatches]
      nextStopwatches[stopwatchIndex] = { ...currentStopwatch, elapsedSeconds: safeSeconds }
      return nextStopwatches
    })
  }

  const toggleStopwatchMinimize = (stopwatchId) => {
    setStopwatches((currentStopwatches) =>
      currentStopwatches.map((stopwatch) =>
        stopwatch.id === stopwatchId ? { ...stopwatch, minimized: !stopwatch.minimized } : stopwatch,
      ),
    )
  }

  const duplicateStopwatchCard = (stopwatchId) => {
    const sourceStopwatch = stopwatches.find((stopwatch) => stopwatch.id === stopwatchId)
    if (!sourceStopwatch) {
      return
    }

    const duplicateId = `stopwatch-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const sourcePosition = cardPositions[stopwatchId] || { x: 1350, y: 250 }

    setStopwatches((currentStopwatches) => [
      ...currentStopwatches,
      {
        ...sourceStopwatch,
        id: duplicateId,
        elapsedSeconds: Number.isFinite(sourceStopwatch.elapsedSeconds)
          ? sourceStopwatch.elapsedSeconds
          : Number.isFinite(sourceStopwatch.initialSeconds)
            ? sourceStopwatch.initialSeconds
            : 0,
        title: sourceStopwatch.title ? `${sourceStopwatch.title} Copy` : '',
        minimized: false,
      },
    ])

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [duplicateId]: {
        x: sourcePosition.x + 36,
        y: sourcePosition.y + 36,
      },
    }))
  }

  const archiveStopwatchCard = (stopwatchId) => {
    const sourceStopwatch = stopwatches.find((stopwatch) => stopwatch.id === stopwatchId)
    if (!sourceStopwatch) {
      return
    }

    archiveCardSnapshot('stopwatch', sourceStopwatch)
    setStopwatches((currentStopwatches) => currentStopwatches.filter((stopwatch) => stopwatch.id !== stopwatchId))
    removeCardPosition(stopwatchId)
    setDraggingCard((currentDrag) => (currentDrag?.id === stopwatchId ? null : currentDrag))
  }

  const deleteStopwatchCard = (stopwatchId) => {
    setStopwatches((currentStopwatches) => currentStopwatches.filter((stopwatch) => stopwatch.id !== stopwatchId))
    removeCardPosition(stopwatchId)
    setDraggingCard((currentDrag) => (currentDrag?.id === stopwatchId ? null : currentDrag))
  }

  const updateCalendarTitle = (calendarId, nextTitle) => {
    setCalendars((currentCalendars) =>
      currentCalendars.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, title: nextTitle } : calendar,
      ),
    )
  }

  const updateCalendarColor = (calendarId, color) => {
    setCalendars((currentCalendars) =>
      currentCalendars.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, color } : calendar,
      ),
    )
  }

  const toggleCalendarMinimize = (calendarId) => {
    setCalendars((currentCalendars) =>
      currentCalendars.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, minimized: !calendar.minimized } : calendar,
      ),
    )
  }

  const changeCalendarMonth = (calendarId, delta) => {
    setCalendars((currentCalendars) =>
      currentCalendars.map((calendar) => {
        if (calendar.id !== calendarId) {
          return calendar
        }

        const shiftedDate = new Date(calendar.year, calendar.month + delta, 1)
        return {
          ...calendar,
          year: shiftedDate.getFullYear(),
          month: shiftedDate.getMonth(),
        }
      }),
    )
  }

  const openCalendarDay = (calendarId, dateKey) => {
    setCalendars((currentCalendars) =>
      currentCalendars.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, selectedDate: dateKey } : calendar,
      ),
    )
  }

  const closeCalendarDay = (calendarId) => {
    setCalendars((currentCalendars) =>
      currentCalendars.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, selectedDate: null } : calendar,
      ),
    )
  }

  const updateCalendarEntry = (calendarId, dateKey, value) => {
    setCalendars((currentCalendars) =>
      currentCalendars.map((calendar) => {
        if (calendar.id !== calendarId) {
          return calendar
        }

        return {
          ...calendar,
          entries: {
            ...calendar.entries,
            [dateKey]: value,
          },
        }
      }),
    )
  }

  const duplicateCalendarCard = (calendarId) => {
    const sourceCalendar = calendars.find((calendar) => calendar.id === calendarId)
    if (!sourceCalendar) {
      return
    }

    const duplicateId = `calendar-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const sourcePosition = cardPositions[calendarId] || { x: 1480, y: 120 }

    setCalendars((currentCalendars) => [
      ...currentCalendars,
      {
        ...sourceCalendar,
        id: duplicateId,
        title: sourceCalendar.title ? `${sourceCalendar.title} Copy` : '',
        selectedDate: null,
        minimized: false,
        entries: { ...sourceCalendar.entries },
      },
    ])

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [duplicateId]: {
        x: sourcePosition.x + 36,
        y: sourcePosition.y + 36,
      },
    }))
  }

  const archiveCalendarCard = (calendarId) => {
    const sourceCalendar = calendars.find((calendar) => calendar.id === calendarId)
    if (!sourceCalendar) {
      return
    }

    archiveCardSnapshot('calendar', sourceCalendar)
    setCalendars((currentCalendars) => currentCalendars.filter((calendar) => calendar.id !== calendarId))
    removeCardPosition(calendarId)
    setDraggingCard((currentDrag) => (currentDrag?.id === calendarId ? null : currentDrag))
  }

  const deleteCalendarCard = (calendarId) => {
    setCalendars((currentCalendars) => currentCalendars.filter((calendar) => calendar.id !== calendarId))
    removeCardPosition(calendarId)
    setDraggingCard((currentDrag) => (currentDrag?.id === calendarId ? null : currentDrag))
  }

  const updateHabitTitle = (habitId, nextTitle) => {
    setHabits((currentHabits) =>
      currentHabits.map((habit) =>
        habit.id === habitId ? { ...habit, title: nextTitle } : habit,
      ),
    )
  }

  const updateHabitIcon = (habitId, icon) => {
    setHabits((currentHabits) =>
      currentHabits.map((habit) =>
        habit.id === habitId ? { ...habit, icon: normalizeHabitIconId(icon) } : habit,
      ),
    )
  }

  const updateHabitColor = (habitId, color) => {
    setHabits((currentHabits) =>
      currentHabits.map((habit) =>
        habit.id === habitId ? { ...habit, color } : habit,
      ),
    )
  }

  const toggleHabitMinimize = (habitId) => {
    setHabits((currentHabits) =>
      currentHabits.map((habit) =>
        habit.id === habitId ? { ...habit, minimized: !habit.minimized } : habit,
      ),
    )
  }

  const setHabitView = (habitId, view) => {
    setHabits((currentHabits) =>
      currentHabits.map((habit) =>
        habit.id === habitId ? { ...habit, view } : habit,
      ),
    )
  }

  const changeHabitMonth = (habitId, delta) => {
    setHabits((currentHabits) =>
      currentHabits.map((habit) => {
        if (habit.id !== habitId) {
          return habit
        }

        const shiftedDate = new Date(habit.year, habit.month + delta, 1)
        return {
          ...habit,
          year: shiftedDate.getFullYear(),
          month: shiftedDate.getMonth(),
        }
      }),
    )
  }

  const toggleHabitDate = (habitId, dateKey) => {
    setHabits((currentHabits) =>
      currentHabits.map((habit) => {
        if (habit.id !== habitId) {
          return habit
        }

        const parsedDate = parseDateKey(dateKey)
        if (!parsedDate) {
          return habit
        }

        const targetDayStart = new Date(parsedDate.year, parsedDate.month, parsedDate.day)
        const today = new Date()
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        if (targetDayStart > todayStart) {
          return habit
        }

        const nextCompletions = { ...(habit.completions || {}) }
        if (nextCompletions[dateKey]) {
          delete nextCompletions[dateKey]
        } else {
          nextCompletions[dateKey] = true
        }

        return {
          ...habit,
          completions: nextCompletions,
        }
      }),
    )
  }

  const duplicateHabitCard = (habitId) => {
    const sourceHabit = habits.find((habit) => habit.id === habitId)
    if (!sourceHabit) {
      return
    }

    const duplicateId = `habit-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const sourcePosition = cardPositions[habitId] || { x: 1700, y: 120 }

    setHabits((currentHabits) => [
      ...currentHabits,
      {
        ...sourceHabit,
        id: duplicateId,
        title: sourceHabit.title ? `${sourceHabit.title} Copy` : '',
        view: 'summary',
        minimized: false,
        completions: { ...(sourceHabit.completions || {}) },
      },
    ])

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [duplicateId]: {
        x: sourcePosition.x + 36,
        y: sourcePosition.y + 36,
      },
    }))
  }

  const archiveHabitCard = (habitId) => {
    const sourceHabit = habits.find((habit) => habit.id === habitId)
    if (!sourceHabit) {
      return
    }

    archiveCardSnapshot('habit', sourceHabit)
    setHabits((currentHabits) => currentHabits.filter((habit) => habit.id !== habitId))
    removeCardPosition(habitId)
    setDraggingCard((currentDrag) => (currentDrag?.id === habitId ? null : currentDrag))
  }

  const deleteHabitCard = (habitId) => {
    setHabits((currentHabits) => currentHabits.filter((habit) => habit.id !== habitId))
    removeCardPosition(habitId)
    setDraggingCard((currentDrag) => (currentDrag?.id === habitId ? null : currentDrag))
  }

  const handleAddLabel = () => {
    const id = `label-${Date.now()}`
    const roles = ['routine', 'programming', 'english']
    const role = roles[Math.floor(Math.random() * roles.length)]
    setCustomLabels(prev => [...prev, { id, text: '', role }])

    setCardPositions(prev => ({
      ...prev,
      [id]: { x: 400 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) }
    }))
  }

  const handleAddNote = () => {
    const id = `note-${Date.now()}`
    setNotes((currentNotes) => [
      ...currentNotes,
      { id, text: '', title: '', color: null, minimized: false },
    ])

    setCardPositions((currentPositions) => ({
      ...currentPositions,
      [id]: {
        x: 350 - viewport.x / viewport.scale,
        y: 300 - viewport.y / viewport.scale,
      },
    }))
  }

  const handleAddTodoList = () => {
    const id = `col-${Date.now()}`
    const tones = ['charcoal', 'gold', 'violet', 'red', 'blue']
    const tone = tones[Math.floor(Math.random() * tones.length)]
    
    setColumns(prev => [...prev, {
      id,
      tone,
      positionClass: '',
      items: [],
      title: '',
      color: null,
      minimized: false,
    }])
    setDrafts(prev => ({ ...prev, [id]: '' }))
    
    // Position it somewhat centrally based on viewport
    setCardPositions(prev => ({ 
      ...prev, 
      [id]: { x: 400 - (viewport.x / viewport.scale), y: 200 - (viewport.y / viewport.scale) } 
    }))
  }

  const handleAddTimer = () => {
    const id = `timer-${Date.now()}`
    setTimers((prev) => [
      ...prev,
      { id, initialSeconds: 2700, remainingSeconds: 2700, title: '', color: null, minimized: false },
    ])
    
    setCardPositions(prev => ({ 
      ...prev, 
      [id]: { x: 600 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } 
    }))
  }

  const handleAddCounter = () => {
    const id = `counter-${Date.now()}`
    setCounters((prev) => [
      ...prev,
      { id, initialValue: 0, title: '', color: null, minimized: false },
    ])

    setCardPositions((prev) => ({
      ...prev,
      [id]: { x: 960 - (viewport.x / viewport.scale), y: 260 - (viewport.y / viewport.scale) },
    }))
  }

  const handleAddStopwatch = () => {
    const id = `stopwatch-${Date.now()}`
    setStopwatches((prev) => [
      ...prev,
      { id, initialSeconds: 0, elapsedSeconds: 0, title: '', color: null, minimized: false },
    ])

    setCardPositions((prev) => ({
      ...prev,
      [id]: { x: 1240 - (viewport.x / viewport.scale), y: 260 - (viewport.y / viewport.scale) },
    }))
  }

  const handleAddCalendar = () => {
    const id = `calendar-${Date.now()}`
    const now = new Date()
    setCalendars((prev) => [
      ...prev,
      {
        id,
        year: now.getFullYear(),
        month: now.getMonth(),
        selectedDate: null,
        entries: {},
        title: '',
        color: null,
        minimized: false,
      },
    ])

    setCardPositions((prev) => ({
      ...prev,
      [id]: { x: 1500 - (viewport.x / viewport.scale), y: 120 - (viewport.y / viewport.scale) },
    }))
  }

  const handleAddHabit = () => {
    const id = `habit-${Date.now()}`
    const now = new Date()

    setHabits((prev) => [
      ...prev,
      {
        id,
        icon: HABIT_ICON_OPTIONS[0].id,
        year: now.getFullYear(),
        month: now.getMonth(),
        view: 'summary',
        completions: {},
        title: '',
        color: null,
        minimized: false,
      },
    ])

    setCardPositions((prev) => ({
      ...prev,
      [id]: { x: 1700 - (viewport.x / viewport.scale), y: 120 - (viewport.y / viewport.scale) },
    }))
  }

  const handleQuickAction = (actionId) => {
    if (actionId === 'label') {
      handleAddLabel()
    } else if (actionId === 'note') {
      handleAddNote()
    } else if (actionId === 'todo-list') {
      handleAddTodoList()
    } else if (actionId === 'counter') {
      handleAddCounter()
    } else if (actionId === 'timer') {
      handleAddTimer()
    } else if (actionId === 'stopwatch') {
      handleAddStopwatch()
    } else if (actionId === 'calendar') {
      handleAddCalendar()
    } else if (actionId === 'habit') {
      handleAddHabit()
    } else if (actionId === 'quick-links') {
      window.alert(`${QUICK_CREATE_ACTIONS.find((action) => action.id === actionId)?.title || 'This feature'} is coming soon.`)
    }
    setIsRailOpen(false)
  }

  const updateItemDetails = (columnId, itemId, details) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => {
        if (column.id !== columnId) {
          return column
        }

        return {
          ...column,
          items: column.items.map((item) =>
            item.id === itemId ? { ...item, ...details } : item,
          ),
        }
      }),
    )
  }

  const updateItemText = (columnId, itemId, nextText) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => {
        if (column.id !== columnId) {
          return column
        }

        return {
          ...column,
          items: column.items.map((item) =>
            item.id === itemId ? { ...item, text: nextText } : item,
          ),
        }
      }),
    )
  }

  const readDragPayload = (event) => {
    const rawPayload = event.dataTransfer?.getData('text/plain')
    if (rawPayload) {
      try {
        const parsedPayload = JSON.parse(rawPayload)
        if (parsedPayload?.columnId && parsedPayload?.itemId) {
          return parsedPayload
        }
      } catch {
        // Ignore invalid drag payload and fallback to component state.
      }
    }

    if (dragState.columnId && dragState.itemId) {
      return dragState
    }

    return null
  }

  const handleDragStartItem = (columnId, itemId, event) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify({ columnId, itemId }))
    setDragState({ columnId, itemId })
  }

  const handleDragEndItem = () => {
    setDragState({ columnId: null, itemId: null })
  }

  const handleDragOverItem = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnItem = (columnId, targetItemId, event) => {
    event.preventDefault()
    event.stopPropagation()

    const payload = readDragPayload(event)
    if (!payload || payload.columnId !== columnId || payload.itemId === targetItemId) {
      return
    }

    setColumns((currentColumns) =>
      currentColumns.map((column) => {
        if (column.id !== columnId) {
          return column
        }

        return {
          ...column,
          items: reorderListItems(column.items, payload.itemId, targetItemId),
        }
      }),
    )

    setDragState({ columnId: null, itemId: null })
  }

  const handleDropOnList = (columnId, event) => {
    event.preventDefault()

    const payload = readDragPayload(event)
    if (!payload || payload.columnId !== columnId) {
      return
    }

    setColumns((currentColumns) =>
      currentColumns.map((column) => {
        if (column.id !== columnId) {
          return column
        }

        const currentIndex = column.items.findIndex((item) => item.id === payload.itemId)
        if (currentIndex < 0 || currentIndex === column.items.length - 1) {
          return column
        }

        const nextItems = [...column.items]
        const [movedItem] = nextItems.splice(currentIndex, 1)
        nextItems.push(movedItem)

        return {
          ...column,
          items: nextItems,
        }
      }),
    )

    setDragState({ columnId: null, itemId: null })
  }

  const handleWheel = (event) => {
    event.preventDefault()

    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }

    const pointerX = event.clientX - bounds.left
    const pointerY = event.clientY - bounds.top
    const zoomFactor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY)

    setViewport((currentViewport) => {
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, currentViewport.scale * zoomFactor),
      )

      if (nextScale === currentViewport.scale) {
        return currentViewport
      }

      const contentX = (pointerX - currentViewport.x) / currentViewport.scale
      const contentY = (pointerY - currentViewport.y) / currentViewport.scale

      return {
        scale: nextScale,
        x: pointerX - contentX * nextScale,
        y: pointerY - contentY * nextScale,
      }
    })
  }

  const startPanning = (event) => {
    if (event.button !== 2) {
      return
    }

    event.preventDefault()
    panRef.current = { active: true, lastX: event.clientX, lastY: event.clientY }
    setIsPanning(true)
  }

  const movePanning = (event) => {
    if (!panRef.current.active) {
      return
    }

    event.preventDefault()
    const deltaX = event.clientX - panRef.current.lastX
    const deltaY = event.clientY - panRef.current.lastY

    panRef.current.lastX = event.clientX
    panRef.current.lastY = event.clientY

    setViewport((currentViewport) => ({
      ...currentViewport,
      x: currentViewport.x + deltaX,
      y: currentViewport.y + deltaY,
    }))
  }

  const endPanning = () => {
    if (!panRef.current.active) {
      return
    }

    panRef.current.active = false
    setIsPanning(false)
  }

  const focusLabelCard = (labelId) => {
    const workspace = workspaceRef.current
    if (!workspace) {
      return
    }

    const workspaceBounds = workspace.getBoundingClientRect()
    const cardElement = workspace.querySelector(`[data-card-id="${labelId}"]`)

    if (cardElement) {
      const cardBounds = cardElement.getBoundingClientRect()
      const centerX = workspaceBounds.left + workspaceBounds.width / 2
      const centerY = workspaceBounds.top + workspaceBounds.height / 2
      const cardCenterX = cardBounds.left + cardBounds.width / 2
      const cardCenterY = cardBounds.top + cardBounds.height / 2

      setViewport((currentViewport) => ({
        ...currentViewport,
        x: currentViewport.x + (centerX - cardCenterX),
        y: currentViewport.y + (centerY - cardCenterY),
      }))
      return
    }

    const fallbackPosition = cardPositions[labelId]
    if (!fallbackPosition) {
      return
    }

    setViewport((currentViewport) => ({
      ...currentViewport,
      x: workspaceBounds.width / 2 - fallbackPosition.x * currentViewport.scale,
      y: workspaceBounds.height / 2 - fallbackPosition.y * currentViewport.scale,
    }))
  }

  const boardStageStyle = supportsNativeZoom
    ? {
        left: viewport.x / viewport.scale,
        top: viewport.y / viewport.scale,
        zoom: viewport.scale,
      }
    : {
        left: 0,
        top: 0,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
      }

  if (!isVisible) {
    return (
      <div className={`app-shell theme-${themeMode} ${isFocusMode ? 'is-focus-mode' : ''}`} style={{ display: 'none' }}>
        <div ref={workspaceRef} />
      </div>
    )
  }

  return (
    <div
      className={`app-shell theme-${themeMode} ${isFocusMode ? 'is-focus-mode' : ''}`}
      style={{
        '--workspace-bg': theme.workspaceBg,
        '--workspace-bg-alt': theme.workspaceBgAlt,
        '--navbar-bg-start': theme.navbarBgStart,
        '--navbar-bg-mid': theme.navbarBgMid,
        '--navbar-bg-end': theme.navbarBgEnd,
        '--surface-panel': theme.panel,
        '--surface-panel-muted': theme.panelMuted,
        '--surface-border': theme.panelBorder,
        '--ui-text': theme.text,
        '--ui-text-strong': theme.textStrong,
        '--ui-icon': theme.icon,
        '--input-text': theme.inputText,
        '--input-placeholder': theme.inputPlaceholder,
        '--card-text': theme.cardText,
        '--card-ui-soft': theme.cardUiSoft,
        '--card-ui-mid': theme.cardUiMid,
        '--card-ui-strong': theme.cardUiStrong,
        '--tone-charcoal': theme.toneCharcoal,
        '--tone-gold': theme.toneGold,
        '--tone-violet': theme.toneViolet,
        '--tone-red': theme.toneRed,
        '--tone-blue': theme.toneBlue,
        '--label-routine': theme.labelRoutine,
        '--label-programming': theme.labelProgramming,
        '--label-english': theme.labelEnglish,
        '--label-text': theme.labelText,
        '--rail-button-bg': theme.railButton,
        '--rail-button-icon': theme.railIcon,
        '--switch-track': theme.switchTrack,
        '--switch-knob': theme.switchKnob,
        '--palette-color-1': theme.palette.color1,
        '--palette-color-2': theme.palette.color2,
        '--palette-color-3': theme.palette.color3,
        '--palette-color-4': theme.palette.color4,
        '--palette-color-5': theme.palette.color5,
        '--palette-color-6': theme.palette.color6,
        '--palette-color-7': theme.palette.color7,
        '--palette-color-8': theme.palette.color8,
        '--palette-color-9': theme.palette.color9,
        '--palette-color-10': theme.palette.color10,
        '--palette-neutral': theme.palette.neutral,
      }}
    >
      <TopBar 
        mode={themeMode} 
        onToggleMode={() => setThemeMode((mode) => (mode === 'night' ? 'day' : 'night'))} 
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode((active) => !active)}
        workspace={workspace}
        allWorkspaces={allWorkspaces}
        onSwitchWorkspace={onSwitchWorkspace}
        onUpdateName={onUpdateName}
        onDuplicateWorkspace={onDuplicateWorkspace}
        onDeleteWorkspace={onDeleteWorkspace}
        onCreateWorkspace={onCreateWorkspace}
        isWorkspaceMenuOpen={isWorkspaceMenuOpen}
        setIsWorkspaceMenuOpen={setIsWorkspaceMenuOpen}
        quickActions={QUICK_CREATE_ACTIONS}
        onQuickAction={handleQuickAction}
        labels={detachedLabels}
        onSelectLabel={focusLabelCard}
        archivedCards={archivedCards}
        habits={habits}
        onRestoreArchivedCard={restoreArchivedCard}
      />

      <div className={`focus-overlay ${isFocusMode ? 'is-active' : ''}`} aria-hidden="true" />

      <div
        className={`workspace ${isPanning ? 'is-panning' : ''} ${draggingCard ? 'is-card-dragging' : ''}`}
        ref={workspaceRef}
        onContextMenu={(event) => event.preventDefault()}
        onWheel={handleWheel}
        onMouseDown={startPanning}
        onMouseMove={movePanning}
        onMouseUp={endPanning}
        onMouseLeave={endPanning}
      >
        <div className="board-stage" style={boardStageStyle}>
          <main className="board">
            {columns.map((column) => (
              <TodoCard
                key={column.id}
                column={column}
                draft={drafts[column.id]}
                onDraftChange={setDraft}
                onAdd={addItem}
                onToggle={toggleItem}
                onUpdateItemText={updateItemText}
                onUpdateItemDetails={updateItemDetails}
                onDeleteItem={deleteItem}
                onDragStartItem={handleDragStartItem}
                onDragOverItem={handleDragOverItem}
                onDropOnItem={handleDropOnItem}
                onDropOnList={handleDropOnList}
                onDragEndItem={handleDragEndItem}
                draggingItemId={dragState.columnId === column.id ? dragState.itemId : null}
                position={cardPositions[column.id]}
                onMouseDown={(e) => handleCardMouseDown(column.id, e)}
                onUpdateTitle={updateTodoCardTitle}
                onUpdateColor={updateTodoCardColor}
                onMoveCard={moveCardToTarget}
                onToggleMinimize={toggleTodoCardMinimize}
                onDuplicateCard={duplicateTodoCard}
                onArchiveCard={archiveTodoCard}
                onDeleteCard={deleteTodoCard}
                isPopping={poppingCardIds.has(column.id)}
              />
            ))}

            {detachedLabels.map((label) => (
              <LabelCard
                key={label.id}
                label={label}
                labelTextColor={theme.labelText}
                position={cardPositions[label.id]}
                onMouseDown={(e) => handleCardMouseDown(label.id, e)}
                onUpdateText={updateLabelText}
                onUpdateColor={updateLabelColor}
                onMoveCard={moveCardToTarget}
                onDuplicateCard={duplicateLabelCard}
                onArchiveCard={archiveLabelCard}
                onDeleteCard={deleteLabelCard}
                isPopping={poppingCardIds.has(label.id)}
              />
            ))}

            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                position={cardPositions[note.id]}
                onMouseDown={(e) => handleCardMouseDown(note.id, e)}
                onUpdateTitle={updateNoteTitle}
                onUpdateText={updateNoteText}
                onUpdateColor={updateNoteColor}
                onMoveCard={moveCardToTarget}
                onToggleMinimize={toggleNoteMinimize}
                onDuplicateCard={duplicateNoteCard}
                onArchiveCard={archiveNoteCard}
                onDeleteCard={deleteNoteCard}
                isPopping={poppingCardIds.has(note.id)}
              />
            ))}
            {timers.map((timer) => (
              <TimerCard
                key={timer.id}
                timer={timer}
                position={cardPositions[timer.id]}
                onMouseDown={(e) => handleCardMouseDown(timer.id, e)}
                onUpdateTitle={updateTimerTitle}
                onUpdateColor={updateTimerColor}
                onUpdateRemainingSeconds={updateTimerRemainingSeconds}
                onMoveCard={moveCardToTarget}
                onToggleMinimize={toggleTimerMinimize}
                onDuplicateCard={duplicateTimerCard}
                onArchiveCard={archiveTimerCard}
                onDeleteCard={deleteTimerCard}
                isPopping={poppingCardIds.has(timer.id)}
              />
            ))}
            {counters.map((counter) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                position={cardPositions[counter.id]}
                onMouseDown={(e) => handleCardMouseDown(counter.id, e)}
                onUpdateTitle={updateCounterTitle}
                onUpdateColor={updateCounterColor}
                onMoveCard={moveCardToTarget}
                onToggleMinimize={toggleCounterMinimize}
                onDuplicateCard={duplicateCounterCard}
                onArchiveCard={archiveCounterCard}
                onDeleteCard={deleteCounterCard}
                isPopping={poppingCardIds.has(counter.id)}
              />
            ))}
            {stopwatches.map((stopwatch) => (
              <StopwatchCard
                key={stopwatch.id}
                stopwatch={stopwatch}
                position={cardPositions[stopwatch.id]}
                onMouseDown={(e) => handleCardMouseDown(stopwatch.id, e)}
                onUpdateTitle={updateStopwatchTitle}
                onUpdateColor={updateStopwatchColor}
                onUpdateElapsedSeconds={updateStopwatchElapsedSeconds}
                onMoveCard={moveCardToTarget}
                onToggleMinimize={toggleStopwatchMinimize}
                onDuplicateCard={duplicateStopwatchCard}
                onArchiveCard={archiveStopwatchCard}
                onDeleteCard={deleteStopwatchCard}
                isPopping={poppingCardIds.has(stopwatch.id)}
              />
            ))}
            {calendars.map((calendar) => (
              <CalendarCard
                key={calendar.id}
                calendar={calendar}
                position={cardPositions[calendar.id]}
                onMouseDown={(e) => handleCardMouseDown(calendar.id, e)}
                onUpdateTitle={updateCalendarTitle}
                onUpdateColor={updateCalendarColor}
                onMoveCard={moveCardToTarget}
                onToggleMinimize={toggleCalendarMinimize}
                onDuplicateCard={duplicateCalendarCard}
                onArchiveCard={archiveCalendarCard}
                onDeleteCard={deleteCalendarCard}
                onChangeMonth={changeCalendarMonth}
                onOpenDay={openCalendarDay}
                onCloseDay={closeCalendarDay}
                onUpdateEntry={updateCalendarEntry}
                isPopping={poppingCardIds.has(calendar.id)}
              />
            ))}
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                position={cardPositions[habit.id]}
                onMouseDown={(e) => handleCardMouseDown(habit.id, e)}
                onUpdateTitle={updateHabitTitle}
                onUpdateIcon={updateHabitIcon}
                onUpdateColor={updateHabitColor}
                onMoveCard={moveCardToTarget}
                onToggleMinimize={toggleHabitMinimize}
                onDuplicateCard={duplicateHabitCard}
                onArchiveCard={archiveHabitCard}
                onDeleteCard={deleteHabitCard}
                onSetView={setHabitView}
                onChangeMonth={changeHabitMonth}
                onToggleDate={toggleHabitDate}
                isPopping={poppingCardIds.has(habit.id)}
              />
            ))}
          </main>
        </div>

        <ActionRail
          open={isRailOpen}
          onToggle={() => setIsRailOpen((isOpen) => !isOpen)}
          quickActions={QUICK_CREATE_ACTIONS}
          onQuickAction={handleQuickAction}
        />
      </div>
    </div>
  )
}
