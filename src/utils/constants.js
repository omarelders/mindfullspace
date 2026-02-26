export const INITIAL_COLUMNS = [
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

export const DETACHED_LABELS = [
  { id: 'a', text: 'ROUTINE', role: 'routine' },
  { id: 'b', text: 'Programming', role: 'programming' },
  { id: 'c', text: 'ENGLISH', role: 'english' },
]

export const THEME_COLORS = {
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
    railButton: '#3F3F46',
    railIcon: '#FFFFFF',
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
    railButton: '#525A67',
    railIcon: '#FFFFFF',
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

export const NOTE_TEXT =
  'ahh fuck how long I have been\nstruggling in this shit ???! the answer\nis years !!\n\n-----------\n\nmy money tell now wiht al-amry is\n350 le + 300 le + 190 le + 600 le'

export const QUICK_CREATE_ACTIONS = [
  { id: 'label', title: 'Label', icon: 'label' },
  { id: 'note', title: 'Note', icon: 'note' },
  { id: 'todo-list', title: 'Todo List', icon: 'todo-list' },
  { id: 'counter', title: 'Counter', icon: 'counter' },
  { id: 'timer', title: 'Timer', icon: 'timer' },
  { id: 'stopwatch', title: 'Stopwatch', icon: 'stopwatch' },
  { id: 'picture', title: 'Picture', icon: 'picture' },
  { id: 'quick-links', title: 'Quick Links', icon: 'quick-links' },
  { id: 'calendar', title: 'Calendar', icon: 'calendar' },
  { id: 'habit', title: 'Habit', icon: 'habit' },
]

export const MIN_SCALE = 0.2
export const MAX_SCALE = 2.6
export const ZOOM_SENSITIVITY = 0.0016
export const CARD_POP_DURATION_MS = 260

export const CARD_MENU_COLORS = [
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

export const CARD_MOVE_TARGETS = [
  { id: 'top-left', label: 'Top Left', x: 90, y: 50 },
  { id: 'top-center', label: 'Top Center', x: 530, y: 50 },
  { id: 'top-right', label: 'Top Right', x: 1050, y: 50 },
  { id: 'bottom-left', label: 'Bottom Left', x: 90, y: 520 },
  { id: 'bottom-center', label: 'Bottom Center', x: 530, y: 520 },
  { id: 'bottom-right', label: 'Bottom Right', x: 1050, y: 520 },
]

export const HABIT_ICON_OPTIONS = [
  { id: 'running', label: 'Running' },
  { id: 'studying', label: 'Studying' },
  { id: 'coding', label: 'Coding' },
  { id: 'reading', label: 'Reading' },
  { id: 'hydration', label: 'Hydration' },
  { id: 'workout', label: 'Workout' },
  { id: 'meditation', label: 'Meditation' },
]

export const HABIT_ICON_EMOJI_FALLBACKS = {
  '🏃': 'running',
  '🏋️': 'workout',
  '📚': 'studying',
  '🧘': 'meditation',
  '💧': 'hydration',
}

export const APP_STORAGE_KEY = 'mindful-space.app.v1'
export const WORKSPACE_STORAGE_KEY_PREFIX = 'mindful-space.workspace.v1:'
export const DEFAULT_WORKSPACES = [{ id: 'ws-default', name: 'Welcome 👋' }]
