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

// Refined, muted palette. Both modes share the same hue families at mirrored
// lightness so cards, labels and accents feel like one cohesive system across
// dark and light modes rather than two unrelated color sets.
export const THEME_COLORS = {
  night: {
    workspaceBg: '#1A1A1D',
    workspaceBgAlt: '#202023',
    navbarBgStart: '#1E1E22',
    navbarBgMid: '#1A1A1D',
    navbarBgEnd: '#1E1E22',
    panel: '#1E1E22',
    panelMuted: '#2C2C31',
    panelBorder: '#34343A',
    inputText: '#F5F4F2',
    inputPlaceholder: '#8C8A85',
    text: '#F5F4F2',
    textStrong: '#FFFFFF',
    icon: '#F5F4F2',
    cardText: '#FAFAF8',
    cardUiSoft: 'rgba(255, 255, 255, 0.20)',
    cardUiMid: 'rgba(255, 255, 255, 0.34)',
    cardUiStrong: '#FFFFFF',
    toneCharcoal: '#2A2A30',
    toneGold: '#94743E',
    toneViolet: '#6C578C',
    toneRed: '#9E5B50',
    toneBlue: '#4C778F',
    labelRoutine: '#4C778F',
    labelProgramming: '#A66A40',
    labelEnglish: '#6E8A52',
    labelText: '#FAFAF8',
    railButton: '#2C2C31',
    railIcon: '#F5F4F2',
    switchTrack: '#34343A',
    switchKnob: '#EAD7A4',
    palette: {
      color1: '#A6564B',
      color2: '#A55C73',
      color3: '#7E5F96',
      color4: '#5E63A0',
      color5: '#4C778F',
      color6: '#3F8087',
      color7: '#5E8A5E',
      color8: '#7C8A4A',
      color9: '#94743E',
      color10: '#A66A40',
      neutral: '#34343A',
    },
  },
  day: {
    workspaceBg: '#F6F5F3',
    workspaceBgAlt: '#E9E7E3',
    navbarBgStart: '#EDEBE7',
    navbarBgMid: '#E9E7E3',
    navbarBgEnd: '#EDEBE7',
    panel: '#EDEBE7',
    panelMuted: '#E1DED9',
    panelBorder: '#D2CEC7',
    inputText: '#26251F',
    inputPlaceholder: '#86827A',
    text: '#26251F',
    textStrong: '#1A1A16',
    icon: '#26251F',
    cardText: '#26251F',
    cardUiSoft: 'rgba(38, 37, 31, 0.20)',
    cardUiMid: 'rgba(38, 37, 31, 0.34)',
    cardUiStrong: '#1A1A16',
    toneCharcoal: '#E7E4DF',
    toneGold: '#EAD7A4',
    toneViolet: '#D9CFE8',
    toneRed: '#EFC9BE',
    toneBlue: '#C4D8E2',
    labelRoutine: '#C4D8E2',
    labelProgramming: '#EED0B8',
    labelEnglish: '#D6E0BC',
    labelText: '#26251F',
    railButton: '#6B675F',
    railIcon: '#F5F4F2',
    switchTrack: '#CFCBC3',
    switchKnob: '#E8B06B',
    palette: {
      color1: '#E7B7AE',
      color2: '#E7BCC8',
      color3: '#D9CFE8',
      color4: '#C7CAEA',
      color5: '#C4D8E2',
      color6: '#BCDBDF',
      color7: '#C6DEC0',
      color8: '#D6E0BC',
      color9: '#EAD7A4',
      color10: '#EED0B8',
      neutral: '#E7E4DF',
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
  { id: 'quote', title: 'Quote', icon: 'quote' },
]

export const MIN_SCALE = 0.2
export const MAX_SCALE = 2.6
export const ZOOM_SENSITIVITY = 0.0016
export const CARD_POP_DURATION_MS = 260

export const CARD_MENU_COLORS = [
  { id: 'red', value: '#e0a89f' },
  { id: 'pink', value: '#e2aeba' },
  { id: 'purple', value: '#cdbfe0' },
  { id: 'indigo', value: '#b6bce0' },
  { id: 'blue', value: '#a9c4d8' },
  { id: 'cyan', value: '#a6d0d4' },
  { id: 'green', value: '#a6c9a6' },
  { id: 'lime', value: '#cdd6a0' },
  { id: 'yellow', value: '#ecd9a0' },
  { id: 'orange', value: '#edc9a0' },
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
