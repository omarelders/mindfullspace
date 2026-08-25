import { createSignal, createEffect, createMemo, onMount, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import {
  writeJsonStorage,
  getInitialWorkspaceState,
  validateWorkspaceState,
  removeStorageKey
} from '../utils/storage'
import {
  THEME_COLORS,
  THEME_PALETTES,
  CARD_POP_DURATION_MS,
  ZOOM_SENSITIVITY,
  MAX_SCALE,
  MIN_SCALE,
  CARD_MOVE_TARGETS,
  HABIT_ICON_OPTIONS,
  WORKSPACE_STORAGE_KEY_PREFIX,
} from '../utils/constants'
import { parseDateKey, buildDateKey } from '../utils/dateUtils'
import { saveImage, deleteImage as deleteImageBlob, MAX_IMAGE_SIZE } from '../utils/imageStore'
import { parseImportedCards } from '../utils/backup'
import { sanitizeUrl } from '../utils/urlSafety'
import { createId } from '../utils/id'
import { supportsNativeZoom } from '../utils/browserSupport'
import { createUndoRedo } from './useUndoRedo'
import { createCardCollection } from './useCardCollection'
import { useAuth } from './useAuth'
import { uploadImageToCloud, deleteImageFromCloud } from '../lib/imageSync'

function reorderListItems(list, itemId, targetItemId) {
  const currentIndex = list.findIndex((item) => item.id === itemId)
  const targetIndex = list.findIndex((item) => item.id === targetItemId)
  if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) {
    return list
  }
  const nextList = [...list]
  const [removedItem] = nextList.splice(currentIndex, 1)
  nextList.splice(targetIndex, 0, removedItem)
  return nextList
}

function normalizeHabitIconId(iconId) {
  if (HABIT_ICON_OPTIONS.some((option) => option.id === iconId)) {
    return iconId
  }
  return HABIT_ICON_OPTIONS[0].id
}

// Pure duplicate strategy shared by every collection whose cards copy as-is.
function duplicateWithSameData(source, dupData) {
  return { ...source, id: dupData.id }
}

export function createWorkspace(workspaceId, workspaceRef) {
  // Context accessor — keep the object so its getters stay live (never
  // destructure: that would freeze the value at setup time).
  const auth = useAuth()

  const initialWorkspaceState = getInitialWorkspaceState(workspaceId)

  // ── B) Ephemeral UI state ── createSignals
  const [wheelMode, setWheelMode] = createSignal('zoom')
  const [isPanning, setIsPanning] = createSignal(false)
  const [isRailOpen, setIsRailOpen] = createSignal(false)
  const [isFocusMode, setIsFocusMode] = createSignal(false)
  const [dragState, setDragState] = createSignal({ columnId: null, itemId: null })
  const [draggingCard, setDraggingCard] = createSignal(null)
  const [poppingCardIds, setPoppingCardIds] = createSignal(new Set())
  const [toastMessage, setToastMessage] = createSignal(null)

  // Long-press context menu state
  const [longPressMenu, setLongPressMenu] = createSignal({ visible: false, x: 0, y: 0, canvasX: 0, canvasY: 0 })
  const [isLongPressHolding, setIsLongPressHolding] = createSignal(false)
  const [longPressPos, setLongPressPos] = createSignal({ x: 0, y: 0 })

  // ── C) Mutable closure variables (replace useRef — factory runs once) ──
  let lastMiddleClick = 0
  let lastShiftPress = 0
  let hasInitializedCardTracking = false
  let previousCardIds = new Set()
  const popCleanupTimeouts = new Map()
  const pan = { active: false, lastX: 0, lastY: 0 }
  let toastTimer = null
  // Live drag state for zero-overhead pointer moves
  let draggingCardLive = null
  // Live viewport for zero-overhead panning (kept synced from the store)
  let viewportLive = initialWorkspaceState.viewport
    ? { ...initialWorkspaceState.viewport }
    : { x: 0, y: 0, scale: 1 }
  // rAF handles
  let dragRaf = null
  let panRaf = null
  let longPressTimer = null
  let longPressStart = { x: 0, y: 0 }
  // Cross-tab coordination bookkeeping
  let lastWrittenValue = null
  let lastRemoteValue = null

  const { pushSnapshot, undo, redo } = createUndoRedo()

  // ── A) Persistent cross-cutting store ──
  // Card arrays live inside the per-type collections created below; this
  // store holds the remaining persisted slices with deep reactivity.
  const [ui, setUi] = createStore({
    drafts: initialWorkspaceState.drafts,
    viewport: initialWorkspaceState.viewport,
    themeMode: initialWorkspaceState.themeMode,
    themePalette: initialWorkspaceState.themePalette || 'sage',
    archivedCards: initialWorkspaceState.archivedCards,
    cardPositions: initialWorkspaceState.cardPositions,
  })

  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer)
    setToastMessage(msg)
    toastTimer = setTimeout(() => setToastMessage(null), 2000)
  }

  // Snapshot capture reads live state directly — no ref mirrors needed.
  // Function declarations hoist, so the collections below can receive
  // saveSnapshot before captureSnapshot's body ever runs.
  function captureSnapshot() {
    return JSON.parse(JSON.stringify({
      columns: colCol.items,
      drafts: ui.drafts,
      viewport: ui.viewport,
      themeMode: ui.themeMode,
      themePalette: ui.themePalette,
      notes: noteCol.items,
      timers: timerCol.items,
      counters: counterCol.items,
      stopwatches: stopwatchCol.items,
      calendars: calendarCol.items,
      habits: habitCol.items,
      pictures: picCol.items,
      quickLinks: qlCol.items,
      quotes: quoteCol.items,
      archivedCards: ui.archivedCards,
      customLabels: labelCol.items,
      singleNotes: singleNoteCol.items,
      cardPositions: ui.cardPositions,
    }))
  }

  // Tag lets consecutive edit pushes coalesce into one undo entry (see createUndoRedo)
  function saveSnapshot(tag = null) {
    pushSnapshot(captureSnapshot(), tag)
  }

  function removeCardPosition(cardId) {
    setUi('cardPositions', (current) => {
      if (!(cardId in current)) return current
      const nextPositions = { ...current }
      delete nextPositions[cardId]
      return nextPositions
    })
  }

  function clearCardDraft(cardId) {
    setUi('drafts', (current) => {
      if (!(cardId in current)) return current
      const nextDrafts = { ...current }
      delete nextDrafts[cardId]
      return nextDrafts
    })
  }

  function setCardPositions(update) {
    if (typeof update === 'function') setUi('cardPositions', update)
    else setUi('cardPositions', reconcile(update))
  }

  function archiveCardSnapshot(cardType, cardData) {
    const pos = cardData?.id ? ui.cardPositions[cardData.id] : null
    const archivedPosition = pos ? { x: pos.x, y: pos.y } : null
    setUi('archivedCards', (current) => [
      ...current,
      { id: createId(cardType), type: cardType, archivedAt: Date.now(), data: cardData, position: archivedPosition },
    ])
  }

  // ── Card Collections (each owns its slice via createCardCollection) ──
  const labelCol = createCardCollection({
    initialItems: initialWorkspaceState.customLabels,
    idPrefix: 'label',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
    onDuplicate: duplicateWithSameData
  })

  const singleNoteCol = createCardCollection({
    initialItems: initialWorkspaceState.singleNotes,
    idPrefix: 'singlenote',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
    onDuplicate: duplicateWithSameData
  })

  const colCol = createCardCollection({
    initialItems: initialWorkspaceState.columns,
    idPrefix: 'col',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
    onDuplicate: (source, dupData, dupId) => {
      setUi('drafts', (d) => ({ ...d, [dupId]: d[source.id] || '' }))
      return {
        ...dupData,
        items: source.items.map((i, idx) => ({ ...i, id: `${dupId}-item-${idx}-${Date.now()}` }))
      }
    },
    onDelete: (id) => {
      clearCardDraft(id)
      setDragState((d) => d.columnId === id ? { columnId: null, itemId: null } : d)
    },
  })

  const noteCol = createCardCollection({
    initialItems: initialWorkspaceState.notes,
    idPrefix: 'note',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const quoteCol = createCardCollection({
    initialItems: initialWorkspaceState.quotes || [],
    idPrefix: 'quote',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const timerCol = createCardCollection({
    initialItems: initialWorkspaceState.timers,
    idPrefix: 'timer',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const counterCol = createCardCollection({
    initialItems: initialWorkspaceState.counters,
    idPrefix: 'counter',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const stopwatchCol = createCardCollection({
    initialItems: initialWorkspaceState.stopwatches,
    idPrefix: 'stopwatch',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const calendarCol = createCardCollection({
    initialItems: initialWorkspaceState.calendars,
    idPrefix: 'calendar',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const habitCol = createCardCollection({
    initialItems: initialWorkspaceState.habits,
    idPrefix: 'habit',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const picCol = createCardCollection({
    initialItems: initialWorkspaceState.pictures || [],
    idPrefix: 'picture',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const qlCol = createCardCollection({
    initialItems: initialWorkspaceState.quickLinks || [],
    idPrefix: 'quick-links',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  // Aliases so the rest of the factory reads like the original codebase
  const customLabels = labelCol.items
  const setCustomLabels = labelCol.setItems
  const singleNotes = singleNoteCol.items
  const setSingleNotes = singleNoteCol.setItems

  const columns = colCol.items
  const setColumns = colCol.setItems

  const notes = noteCol.items
  const setNotes = noteCol.setItems

  const timers = timerCol.items
  const setTimers = timerCol.setItems

  const counters = counterCol.items
  const setCounters = counterCol.setItems

  const stopwatches = stopwatchCol.items
  const setStopwatches = stopwatchCol.setItems

  const calendars = calendarCol.items
  const setCalendars = calendarCol.setItems

  const habits = habitCol.items
  const setHabits = habitCol.setItems

  const pictures = picCol.items
  const setPictures = picCol.setItems

  const quickLinks = qlCol.items
  const setQuickLinks = qlCol.setItems

  const quotes = quoteCol.items
  const setQuotes = quoteCol.setItems

  // ── Derived values (createMemo replaces useMemo) ──
  const activePalette = createMemo(() => THEME_PALETTES[ui.themePalette] || THEME_PALETTES.sage || THEME_COLORS)
  const theme = createMemo(() => activePalette()[ui.themeMode] || activePalette().night || THEME_COLORS[ui.themeMode])
  const detachedLabels = createMemo(() => customLabels.map((label) => {
    let color = ''
    if (label.customColor) {
      color = label.customColor
    } else if (label.role === 'routine') {
      color = theme().labelRoutine
    } else if (label.role === 'programming') {
      color = theme().labelProgramming
    } else {
      color = theme().labelEnglish
    }
    return { ...label, color }
  }))

  const renderedCardIds = createMemo(
    () => [
      ...columns.map((column) => column.id),
      ...detachedLabels().map((label) => label.id),
      ...singleNotes.map((note) => note.id),
      ...notes.map((note) => note.id),
      ...timers.map((timer) => timer.id),
      ...counters.map((counter) => counter.id),
      ...stopwatches.map((stopwatch) => stopwatch.id),
      ...calendars.map((calendar) => calendar.id),
      ...habits.map((habit) => habit.id),
      ...pictures.map((pic) => pic.id),
      ...quickLinks.map((ql) => ql.id),
      ...quotes.map((q) => q.id),
    ],
  )

  const workspaceStorageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`

  function restoreSnapshot(snapshot) {
    setColumns(reconcile(snapshot.columns ?? []))
    setUi('drafts', reconcile(snapshot.drafts ?? {}))
    setUi('viewport', reconcile(snapshot.viewport ?? { x: 0, y: 0, scale: 1 }))
    setUi('themeMode', snapshot.themeMode)
    if (snapshot.themePalette) setUi('themePalette', snapshot.themePalette)
    setNotes(reconcile(snapshot.notes ?? []))
    setTimers(reconcile(snapshot.timers ?? []))
    setCounters(reconcile(snapshot.counters ?? []))
    setStopwatches(reconcile(snapshot.stopwatches ?? []))
    setCalendars(reconcile(snapshot.calendars ?? []))
    setHabits(reconcile(snapshot.habits ?? []))
    setPictures(reconcile(snapshot.pictures ?? []))
    setQuickLinks(reconcile(snapshot.quickLinks || []))
    setQuotes(reconcile(snapshot.quotes || []))
    setUi('archivedCards', reconcile(snapshot.archivedCards ?? []))
    setCustomLabels(reconcile(snapshot.customLabels ?? []))
    if (snapshot.singleNotes) setSingleNotes(reconcile(snapshot.singleNotes))
    setCardPositions(snapshot.cardPositions ?? {})
  }

  function handleUndo() {
    const snapshot = undo(captureSnapshot())
    if (snapshot) {
      restoreSnapshot(snapshot)
      showToast('Undone')
    } else {
      showToast('Nothing to undo')
    }
  }

  function handleRedo() {
    const snapshot = redo(captureSnapshot())
    if (snapshot) {
      restoreSnapshot(snapshot)
      showToast('Redone')
    } else {
      showToast('Nothing to redo')
    }
  }

  // Apply a parsed workspace backup (see parseWorkspaceBackup) directly to
  // reactive state. No page reload; the previous state is pushed onto the
  // undo stack so an import can be undone.
  function importWorkspaceState(sanitizedWorkspace) {
    saveSnapshot()
    restoreSnapshot(sanitizedWorkspace)
    showToast('Workspace imported')
  }

  // Cross-tab coordination. State is whole-workspace JSON in localStorage, so
  // without coordination the last tab to write would silently clobber
  // everything the other tab did.
  function saveWorkspaceState() {
    const snapshot = captureSnapshot()
    const serialized = JSON.stringify(snapshot)
    if (serialized === lastRemoteValue) {
      // Our state is identical to what another tab just sent us — writing it
      // back would only echo the same storage event between tabs forever.
      lastRemoteValue = null
      return
    }
    writeJsonStorage(workspaceStorageKey, snapshot)
    lastWrittenValue = serialized
  }

  onMount(() => {
    // Ensure state is saved immediately on beforeunload or visibilitychange.
    const handleSave = () => {
      saveWorkspaceState()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleSave()
    }
    window.addEventListener('beforeunload', handleSave)
    window.addEventListener('visibilitychange', handleVisibilityChange)

    // Multi-tab safety net: when another tab saves this same workspace, apply
    // its state here so both tabs stay current instead of overwriting each
    // other's work.
    const handleStorage = (e) => {
      if (e.key !== workspaceStorageKey || e.newValue === null) return
      if (e.newValue === lastWrittenValue) return // our own write reflected back
      try {
        const incoming = JSON.parse(e.newValue)
        restoreSnapshot(validateWorkspaceState(incoming))
        lastRemoteValue = e.newValue
        showToast('Synced changes from another tab')
      } catch {
        // Ignore malformed payloads from other tabs.
      }
    }
    window.addEventListener('storage', handleStorage)

    // Pan stop listeners
    const stopPanning = () => {
      if (!pan.active) return
      pan.active = false
      setIsPanning(false)
    }
    window.addEventListener('pointerup', stopPanning)
    window.addEventListener('pointercancel', stopPanning)
    window.addEventListener('blur', stopPanning)

    // Ctrl+Z / Ctrl+Shift+Z keyboard listener.
    // Never hijack undo while the user is typing — native text undo must keep
    // working inside inputs, textareas, and contenteditable elements.
    const handleUndoKeys = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl || e.key.toLowerCase() !== 'z') return
      const active = document.activeElement
      const tag = active?.tagName?.toLowerCase()
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        active?.isContentEditable
      if (isEditable) return
      e.preventDefault()
      if (e.shiftKey) {
        handleRedo()
      } else {
        handleUndo()
      }
    }
    window.addEventListener('keydown', handleUndoKeys)

    // Double-Shift toggle wheel mode
    const handleShiftToggle = (e) => {
      // Ignore if typing in an input
      const tag = document.activeElement?.tagName?.toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable
      if (isEditable) return

      if (e.key === 'Shift') {
        const now = Date.now()
        if (now - lastShiftPress < 400) {
          setWheelMode((mode) => {
            const nextMode = mode === 'zoom' ? 'pan' : 'zoom'
            showToast(`Scroll mode switched to ${nextMode === 'zoom' ? 'Zoom' : 'Pan'}`)
            return nextMode
          })
          lastShiftPress = 0
        } else {
          lastShiftPress = now
        }
      }
    }
    window.addEventListener('keydown', handleShiftToggle)

    onCleanup(() => {
      window.removeEventListener('beforeunload', handleSave)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('pointerup', stopPanning)
      window.removeEventListener('pointercancel', stopPanning)
      window.removeEventListener('blur', stopPanning)
      window.removeEventListener('keydown', handleUndoKeys)
      window.removeEventListener('keydown', handleShiftToggle)
    })
  })

  // Debounced auto-save whenever any persisted slice changes.
  // captureSnapshot deep-reads every store slice, which subscribes this
  // effect to all nested mutations (Solid store proxies track property
  // access during JSON serialization).
  createEffect(() => {
    const _snapshot = captureSnapshot()
    void _snapshot

    if (isPanning() || draggingCard()) return
    let idleId = null
    const timerId = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => {
          saveWorkspaceState()
        }, { timeout: 2000 })
      } else {
        saveWorkspaceState()
      }
    }, 1000)

    onCleanup(() => {
      window.clearTimeout(timerId)
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    })
  })

  // Pop animation card ID diffing
  createEffect(() => {
    const currentRenderedIds = renderedCardIds()
    const currentCardIds = new Set(currentRenderedIds)

    if (!hasInitializedCardTracking) {
      hasInitializedCardTracking = true
      previousCardIds = currentCardIds
      return
    }

    const previousIds = previousCardIds
    previousCardIds = currentCardIds

    const addedCardIds = currentRenderedIds.filter((cardId) => !previousIds.has(cardId))
    const removedCardIds = [...previousIds].filter((cardId) => !currentCardIds.has(cardId))

    if (removedCardIds.length > 0) {
      setPoppingCardIds((currentPoppingIds) => {
        const nextPoppingIds = new Set(currentPoppingIds)
        removedCardIds.forEach((cardId) => nextPoppingIds.delete(cardId))
        return nextPoppingIds
      })

      removedCardIds.forEach((cardId) => {
        const timeoutId = popCleanupTimeouts.get(cardId)
        if (timeoutId) {
          window.clearTimeout(timeoutId)
          popCleanupTimeouts.delete(cardId)
        }
      })
    }

    if (addedCardIds.length === 0) return

    setPoppingCardIds((currentPoppingIds) => {
      const nextPoppingIds = new Set(currentPoppingIds)
      addedCardIds.forEach((cardId) => nextPoppingIds.add(cardId))
      return nextPoppingIds
    })

    addedCardIds.forEach((cardId) => {
      const existingTimeoutId = popCleanupTimeouts.get(cardId)
      if (existingTimeoutId) window.clearTimeout(existingTimeoutId)

      const timeoutId = window.setTimeout(() => {
        setPoppingCardIds((currentPoppingIds) => {
          const nextPoppingIds = new Set(currentPoppingIds)
          nextPoppingIds.delete(cardId)
          return nextPoppingIds
        })
        popCleanupTimeouts.delete(cardId)
      }, CARD_POP_DURATION_MS)

      popCleanupTimeouts.set(cardId, timeoutId)
    })
  })

  onCleanup(() => {
    popCleanupTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    popCleanupTimeouts.clear()
  })

  // Keep viewportLive synced from the store for zero-overhead panning reads
  createEffect(() => {
    viewportLive = { x: ui.viewport.x, y: ui.viewport.y, scale: ui.viewport.scale }
  })

  // Direct-DOM card dragging driven by draggingCard() changes
  createEffect(() => {
    const dc = draggingCard()
    if (!dc) return
    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    window.getSelection()?.removeAllRanges()

    // Live closure copy so the pointermove handler reads latest info
    draggingCardLive = dc

    // Find the dragging card's DOM element
    const wsEl = typeof workspaceRef === 'function' ? workspaceRef() : workspaceRef?.current
    const cardEl = wsEl?.querySelector(`[data-card-id="${dc.id}"]`)

    const handlePointerMove = (e) => {
      const live = draggingCardLive
      if (!live) return
      if (live.pointerId !== undefined && e.pointerId !== live.pointerId) return
      const scale = viewportLive.scale || 1
      const dx = (e.clientX - live.startX) / scale
      const dy = (e.clientY - live.startY) / scale
      const nextX = live.initialX + dx
      const nextY = live.initialY + dy
      // Apply directly to DOM via rAF — no reactive updates during motion
      if (dragRaf) cancelAnimationFrame(dragRaf)
      dragRaf = requestAnimationFrame(() => {
        if (cardEl) {
          cardEl.style.left = nextX + 'px'
          cardEl.style.top = nextY + 'px'
        }
        // Keep a lightweight pending position so we can commit on pointerup
        draggingCardLive._pendingX = nextX
        draggingCardLive._pendingY = nextY
      })
    }
    const handlePointerUp = (e) => {
      const live = draggingCardLive
      if (live?.pointerId !== undefined && e.pointerId !== live?.pointerId) return
      if (live && live._pendingX !== undefined) {
        // Commit final position to the store only once, on release
        setCardPositions((prev) => ({
          ...prev,
          [live.id]: { x: live._pendingX, y: live._pendingY }
        }))
      }
      draggingCardLive = null
      setDraggingCard(null)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    onCleanup(() => {
      document.body.style.userSelect = previousUserSelect
      if (dragRaf) cancelAnimationFrame(dragRaf)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    })
  })

  function handleCardPointerDown(cardId, e) {
    if (window.innerWidth <= 1200) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (!e.target.closest('.card-header') && !e.target.closest('.label-drag-handle') && !e.target.closest('.stopwatch-drag-handle')) return
    if (e.target.closest('.card-menu-wrap')) return
    const cardPosition = ui.cardPositions[cardId]
    if (!cardPosition) return
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignore pointer capture errors if element not attached
    }
    window.getSelection()?.removeAllRanges()
    setDraggingCard({
      id: cardId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: cardPosition.x,
      initialY: cardPosition.y
    })
  }

  // Focus mode Escape listener
  createEffect(() => {
    if (!isFocusMode()) return
    const handleEscape = (event) => { if (event.key === 'Escape') setIsFocusMode(false) }
    window.addEventListener('keydown', handleEscape)
    onCleanup(() => window.removeEventListener('keydown', handleEscape))
  })

  async function handlePasteImage(blob) {
    if (blob.size > MAX_IMAGE_SIZE) {
      showToast(`Image too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`)
      return
    }
    const id = createId('picture')
    const imageId = createId('img-paste')
    try {
      await saveImage(imageId, blob)
      const user = auth.user
      if (user) {
        uploadImageToCloud(user.id, imageId, blob).catch(() => {})
      }
    } catch {
      showToast('Failed to paste image.')
      return
    }
    setPictures((p) => [...p, { id, imageId, title: '', color: null, minimized: false }])
    setCardPositions((p) => ({
      ...p,
      [id]: {
        x: 500 - (viewportLive.x / viewportLive.scale),
        y: 300 - (viewportLive.y / viewportLive.scale),
      },
    }))
    showToast('Image pasted!')
  }

  function handlePasteText(text) {
    if (!text || text.trim().length === 0) return
    const id = createId('quote')
    setQuotes((p) => [...p, { id, text, author: '', title: '', color: null, minimized: false }])
    setCardPositions((p) => ({
      ...p,
      [id]: {
        x: 400 - (viewportLive.x / viewportLive.scale),
        y: 300 - (viewportLive.y / viewportLive.scale),
      },
    }))
    showToast('Text pasted as Quote!')
  }

  // Ctrl+V clipboard paste → Picture Card or Quote Card
  onMount(() => {
    const handlePaste = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        document.activeElement?.isContentEditable
      if (isEditable) return

      const items = e.clipboardData?.items
      if (!items) return
      let hasImage = false
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (blob) handlePasteImage(blob)
          hasImage = true
          break
        }
      }

      if (!hasImage) {
        const text = e.clipboardData?.getData('text/plain')
        if (text) {
          e.preventDefault()
          handlePasteText(text)
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    onCleanup(() => window.removeEventListener('paste', handlePaste))
  })

  function setDraft(columnId, value) {
    setUi('drafts', columnId, value)
  }

  function addItem(columnId) {
    const text = ui.drafts[columnId]?.trim()
    if (!text) return
    saveSnapshot('todo-items')
    setColumns((currentColumns) => currentColumns.map((column) => {
      if (column.id !== columnId) return column
      return {
        ...column,
        items: [...column.items, { id: `${columnId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`, text, completed: false }],
      }
    }))
    setUi('drafts', columnId, '')
  }

  function deleteItem(columnId, itemId) {
    saveSnapshot('todo-items')
    setColumns((current) => current.map((col) => col.id === columnId ? { ...col, items: col.items.filter((i) => i.id !== itemId) } : col))
  }

  function getRestorePosition(cardType, archivedPosition) {
    if (archivedPosition && Number.isFinite(archivedPosition.x) && Number.isFinite(archivedPosition.y)) return { x: archivedPosition.x + 24, y: archivedPosition.y + 24 }
    const vx = viewportLive.x / viewportLive.scale; const vy = viewportLive.y / viewportLive.scale
    if (cardType === 'label') return { x: 400 - vx, y: 300 - vy }
    if (cardType === 'todo') return { x: 400 - vx, y: 200 - vy }
    if (cardType === 'note') return { x: 350 - vx, y: 300 - vy }
    if (cardType === 'timer') return { x: 600 - vx, y: 300 - vy }
    if (cardType === 'counter') return { x: 960 - vx, y: 260 - vy }
    if (cardType === 'stopwatch') return { x: 1240 - vx, y: 260 - vy }
    if (cardType === 'calendar') return { x: 1500 - vx, y: 120 - vy }
    if (cardType === 'habit') return { x: 1700 - vx, y: 120 - vy }
    if (cardType === 'picture') return { x: 500 - vx, y: 300 - vy }
    if (cardType === 'quick-links') return { x: 1000 - vx, y: 300 - vy }
    if (cardType === 'quote') return { x: 450 - vx, y: 300 - vy }
    return { x: 400 - vx, y: 260 - vy }
  }

  function restoreArchivedCard(archiveId) {
    const archivedEntry = ui.archivedCards.find((entry) => entry.id === archiveId)
    if (!archivedEntry) return

    const archivedData = archivedEntry.data || {}
    const restoredPosition = getRestorePosition(archivedEntry.type, archivedEntry.position)
    let restoredCardId = null

    if (archivedEntry.type === 'label') {
      restoredCardId = createId('label')
      setCustomLabels((current) => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || 'LABEL', role: archivedData.role || 'routine' }])
    } else if (archivedEntry.type === 'singlenote') {
      restoredCardId = createId('singlenote')
      setSingleNotes((current) => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || 'Single Note' }])
    } else if (archivedEntry.type === 'todo') {
      restoredCardId = createId('col')
      const restoredItems = (archivedData.items || []).map((item, index) => ({ ...item, id: `${restoredCardId}-item-${index}-${Date.now()}` }))
      setColumns((current) => [...current, { ...archivedData, id: restoredCardId, tone: archivedData.tone || 'charcoal', positionClass: '', title: archivedData.title || '', color: archivedData.color || null, minimized: false, items: restoredItems }])
      setUi('drafts', (current) => ({ ...current, [restoredCardId]: '' }))
    } else if (archivedEntry.type === 'note') {
      restoredCardId = createId('note')
      setNotes((current) => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || '', title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'timer') {
      restoredCardId = createId('timer')
      const initialSeconds = Number.isFinite(archivedData.initialSeconds) ? archivedData.initialSeconds : 2700
      const remainingSeconds = Number.isFinite(archivedData.remainingSeconds) ? archivedData.remainingSeconds : initialSeconds
      setTimers((current) => [...current, { ...archivedData, id: restoredCardId, initialSeconds, remainingSeconds, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'counter') {
      restoredCardId = createId('counter')
      setCounters((current) => [...current, { ...archivedData, id: restoredCardId, initialValue: Number.isFinite(archivedData.initialValue) ? archivedData.initialValue : 0, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'stopwatch') {
      restoredCardId = createId('stopwatch')
      const initialSeconds = Number.isFinite(archivedData.initialSeconds) ? archivedData.initialSeconds : 0
      const elapsedSeconds = Number.isFinite(archivedData.elapsedSeconds) ? archivedData.elapsedSeconds : initialSeconds
      setStopwatches((current) => [...current, { ...archivedData, id: restoredCardId, initialSeconds, elapsedSeconds, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'calendar') {
      restoredCardId = createId('calendar')
      const now = new Date()
      setCalendars((current) => [...current, { ...archivedData, id: restoredCardId, year: Number.isFinite(archivedData.year) ? archivedData.year : now.getFullYear(), month: Number.isFinite(archivedData.month) ? archivedData.month : now.getMonth(), selectedDate: null, entries: { ...(archivedData.entries || {}) }, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'habit') {
      restoredCardId = createId('habit')
      const now = new Date()
      setHabits((current) => [...current, { ...archivedData, id: restoredCardId, icon: normalizeHabitIconId(archivedData.icon), year: Number.isFinite(archivedData.year) ? archivedData.year : now.getFullYear(), month: Number.isFinite(archivedData.month) ? archivedData.month : now.getMonth(), view: 'summary', completions: { ...(archivedData.completions || {}) }, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'picture') {
      restoredCardId = createId('picture')
      setPictures((current) => [...current, { ...archivedData, id: restoredCardId, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'quick-links') {
      restoredCardId = createId('quick-links')
      const restoredLinks = (archivedData.links || []).map((link) => ({ ...link, url: sanitizeUrl(link?.url) || '' }))
      setQuickLinks((current) => [...current, { ...archivedData, id: restoredCardId, links: restoredLinks, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'quote') {
      restoredCardId = createId('quote')
      setQuotes((current) => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || '', author: archivedData.author || '', title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    }

    if (!restoredCardId) return
    setCardPositions((current) => ({ ...current, [restoredCardId]: restoredPosition }))
    setUi('archivedCards', (current) => current.filter((entry) => entry.id !== archiveId))
  }

  function moveCardToTarget(cardId, targetId) {
    const target = CARD_MOVE_TARGETS.find((candidate) => candidate.id === targetId)
    if (!target) return
    setCardPositions((current) => ({ ...current, [cardId]: { x: target.x, y: target.y } }))
  }

  // Labels
  function updateLabelText(id, text) {
    saveSnapshot('label-text')
    labelCol.update(id, { text: text.toUpperCase() })
  }
  function updateLabelColor(id, color) {
    saveSnapshot('label-color')
    labelCol.update(id, { customColor: color })
  }
  function updateLabelFontSize(id, fontSize) { labelCol.update(id, { fontSize }) }
  const toggleLabelMinimize = labelCol.toggleMinimize
  const duplicateLabelCard = labelCol.duplicate
  const archiveLabelCard = labelCol.archive
  const deleteLabelCard = labelCol.remove

  // Single Notes
  function updateSingleNoteText(id, text) {
    saveSnapshot('singlenote-text')
    singleNoteCol.update(id, { text })
  }
  function updateSingleNoteColor(id, color) { singleNoteCol.update(id, { color }) }
  function updateSingleNoteFontSize(id, fontSize) { singleNoteCol.update(id, { fontSize }) }
  function updateSingleNoteShape(id, shape) { singleNoteCol.update(id, { shape }) }
  const toggleSingleNoteMinimize = singleNoteCol.toggleMinimize
  const duplicateSingleNoteCard = singleNoteCol.duplicate
  const archiveSingleNoteCard = singleNoteCol.archive
  const deleteSingleNoteCard = singleNoteCol.remove

  // Todos (Columns)
  function updateTodoCardTitle(id, title) {
    saveSnapshot('todo-title')
    colCol.updateTitle(id, title)
  }
  const updateTodoCardColor = colCol.updateColor
  const toggleTodoCardMinimize = colCol.toggleMinimize
  function updateItemDetails(colId, itemId, details) {
    saveSnapshot('todo-items')
    colCol.update(colId, (c) => ({
      items: c.items.map((i) => i.id === itemId ? { ...i, ...details } : i)
    }))
  }
  function updateItemText(colId, itemId, text) {
    saveSnapshot('todo-items')
    colCol.update(colId, (c) => ({
      items: c.items.map((i) => i.id === itemId ? { ...i, text } : i)
    }))
  }
  function updateTodoCardFontSize(id, fontSize) { colCol.update(id, { fontSize }) }
  const duplicateTodoCard = colCol.duplicate
  const archiveTodoCard = colCol.archive
  const deleteTodoCard = colCol.remove

  // Notes
  function updateNoteTitle(id, title) {
    saveSnapshot('note-title')
    noteCol.updateTitle(id, title)
  }
  const updateNoteColor = noteCol.updateColor
  const toggleNoteMinimize = noteCol.toggleMinimize
  const duplicateNoteCard = noteCol.duplicate
  const archiveNoteCard = noteCol.archive
  const deleteNoteCard = noteCol.remove
  function updateNoteText(id, text) {
    saveSnapshot('note-text')
    noteCol.update(id, { text })
  }
  function updateNoteDimensions(id, width, height) { noteCol.update(id, { width, height }) }
  function updateNoteFontSize(id, fontSize) { noteCol.update(id, { fontSize }) }

  // Timers
  function updateTimerTitle(id, title) {
    saveSnapshot('timer-title')
    timerCol.updateTitle(id, title)
  }
  const updateTimerColor = timerCol.updateColor
  const toggleTimerMinimize = timerCol.toggleMinimize
  const duplicateTimerCard = timerCol.duplicate
  const archiveTimerCard = timerCol.archive
  const deleteTimerCard = timerCol.remove
  function updateTimerState(id, patch) {
    saveSnapshot('timer-state')
    timerCol.update(id, patch)
  }
  function updateTimerFontSize(id, fontSize) { timerCol.update(id, { fontSize }) }

  // Counters
  function updateCounterTitle(id, title) {
    saveSnapshot('counter-title')
    counterCol.updateTitle(id, title)
  }
  const updateCounterColor = counterCol.updateColor
  const toggleCounterMinimize = counterCol.toggleMinimize
  const duplicateCounterCard = counterCol.duplicate
  const archiveCounterCard = counterCol.archive
  const deleteCounterCard = counterCol.remove
  function updateCounterValue(id, v) {
    saveSnapshot('counter-value')
    counterCol.update(id, { initialValue: v })
  }
  function updateCounterFontSize(id, fontSize) { counterCol.update(id, { fontSize }) }

  // Stopwatches
  function updateStopwatchTitle(id, title) {
    saveSnapshot('stopwatch-title')
    stopwatchCol.updateTitle(id, title)
  }
  const updateStopwatchColor = stopwatchCol.updateColor
  const toggleStopwatchMinimize = stopwatchCol.toggleMinimize
  const duplicateStopwatchCard = stopwatchCol.duplicate
  const archiveStopwatchCard = stopwatchCol.archive
  const deleteStopwatchCard = stopwatchCol.remove
  function updateStopwatchState(id, patch) {
    saveSnapshot('stopwatch-state')
    stopwatchCol.update(id, patch)
  }
  function updateStopwatchFontSize(id, fontSize) { stopwatchCol.update(id, { fontSize }) }

  // Calendars
  function updateCalendarTitle(id, title) {
    saveSnapshot('calendar-title')
    calendarCol.updateTitle(id, title)
  }
  const updateCalendarColor = calendarCol.updateColor
  const toggleCalendarMinimize = calendarCol.toggleMinimize
  const duplicateCalendarCard = calendarCol.duplicate
  const archiveCalendarCard = calendarCol.archive
  const deleteCalendarCard = calendarCol.remove
  function changeCalendarMonth(id, delta) {
    calendarCol.update(id, (c) => {
      const shifted = new Date(c.year, c.month + delta, 1)
      return { year: shifted.getFullYear(), month: shifted.getMonth() }
    })
  }
  function openCalendarDay(id, dateKey) { calendarCol.update(id, { selectedDate: dateKey }) }
  function closeCalendarDay(id) { calendarCol.update(id, { selectedDate: null }) }
  function updateCalendarEntry(id, dateKey, value) {
    saveSnapshot('calendar-entry')
    calendarCol.update(id, (c) => {
      const nextEnt = { ...c.entries }
      if (!value.trim()) delete nextEnt[dateKey]
      else nextEnt[dateKey] = value
      return { entries: nextEnt }
    })
  }
  function updateCalendarFontSize(id, fontSize) { calendarCol.update(id, { fontSize }) }

  // Habits
  function updateHabitTitle(id, title) {
    saveSnapshot('habit-title')
    habitCol.updateTitle(id, title)
  }
  const updateHabitColor = habitCol.updateColor
  const toggleHabitMinimize = habitCol.toggleMinimize
  const duplicateHabitCard = habitCol.duplicate
  const archiveHabitCard = habitCol.archive
  const deleteHabitCard = habitCol.remove
  function updateHabitIcon(id, v) { habitCol.update(id, { icon: normalizeHabitIconId(v) }) }
  function setHabitView(id, v) { habitCol.update(id, { view: v }) }
  function changeHabitMonth(id, delta) {
    habitCol.update(id, (c) => {
      const shifted = new Date(c.year, c.month + delta, 1)
      return { year: shifted.getFullYear(), month: shifted.getMonth() }
    })
  }
  function toggleHabitDate(id, dateKey) {
    saveSnapshot('habit-date')
    habitCol.update(id, (h) => {
      const parsedDate = parseDateKey(dateKey)
      if (!parsedDate) return {}
      const targetDayStart = new Date(parsedDate.year, parsedDate.month, parsedDate.day)
      const t = new Date()
      const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate())
      if (targetDayStart > todayStart) return {}
      const nextComp = { ...(h.completions || {}) }
      if (nextComp[dateKey]) delete nextComp[dateKey]
      else nextComp[dateKey] = true
      return { completions: nextComp }
    })
  }
  function updateHabitFontSize(id, fontSize) { habitCol.update(id, { fontSize }) }

  // Pictures
  const updatePictureTitle = picCol.updateTitle
  const updatePictureColor = picCol.updateColor
  const togglePictureMinimize = picCol.toggleMinimize
  const duplicatePictureCard = picCol.duplicate
  const archivePictureCard = picCol.archive
  function updatePictureImageId(id, imageId) { picCol.update(id, { imageId }) }
  function updatePictureDimensions(id, width, height) { picCol.update(id, { width, height }) }
  function updatePictureFitMode(id, fitMode) { picCol.update(id, { fitMode }) }
  function updatePictureFontSize(id, fontSize) { picCol.update(id, { fontSize }) }
  function deletePictureCard(id) {
    // Compute from current state directly — never run side effects inside a
    // setItems updater.
    const card = picCol.items.find((t) => t.id === id)
    const isReferencedByActive = card?.imageId
      ? picCol.items.some((c) => c.id !== id && c.imageId === card.imageId)
      : false
    const isReferencedByArchived = card?.imageId
      ? ui.archivedCards.some((a) => a.type === 'picture' && a.data?.imageId === card.imageId)
      : false

    picCol.remove(id)

    if (card?.imageId && !isReferencedByActive && !isReferencedByArchived) {
      deleteImageBlob(card.imageId).catch(() => {})
      // Remove the cloud copy too so deleted images don't accumulate as
      // orphaned Storage objects.
      const user = auth.user
      if (user) {
        deleteImageFromCloud(user.id, card.imageId).catch(() => {})
      }
    }
  }

  // Quick Links
  function updateQuickLinksTitle(id, title) {
    saveSnapshot('quicklinks-title')
    qlCol.updateTitle(id, title)
  }
  const updateQuickLinksColor = qlCol.updateColor
  const toggleQuickLinksMinimize = qlCol.toggleMinimize
  const duplicateQuickLinksCard = qlCol.duplicate
  const archiveQuickLinksCard = qlCol.archive
  const deleteQuickLinksCard = qlCol.remove
  // Store-boundary URL validation: the form validates too, but data can also
  // arrive from imports/undo/restore — never trust it blindly (XSS via
  // javascript: hrefs).
  function addQuickLinkItem(id, url, label) {
    const safeUrl = sanitizeUrl(url)
    if (!safeUrl) return
    saveSnapshot('quick-links')
    qlCol.update(id, (t) => ({
      links: [...(t.links || []), { id: createId('ql-item'), url: safeUrl, label }]
    }))
  }
  function updateQuickLinkItem(id, itemId, url, label) {
    const safeUrl = sanitizeUrl(url)
    if (!safeUrl) return
    saveSnapshot('quick-links')
    qlCol.update(id, (t) => ({
      links: (t.links || []).map((l) => l.id === itemId ? { ...l, url: safeUrl, label } : l)
    }))
  }
  function removeQuickLinkItem(id, itemId) {
    saveSnapshot('quick-links')
    qlCol.update(id, (t) => ({
      links: (t.links || []).filter((l) => l.id !== itemId)
    }))
  }
  function reorderQuickLinkItems(id, sourceIndex, destIndex) {
    saveSnapshot('quick-links')
    qlCol.update(id, (t) => {
      const links = [...(t.links || [])]
      const [removed] = links.splice(sourceIndex, 1)
      links.splice(destIndex, 0, removed)
      return { links }
    })
  }
  function updateQuickLinksFontSize(id, fontSize) { qlCol.update(id, { fontSize }) }

  // Quotes
  function updateQuoteTitle(id, title) {
    saveSnapshot('quote-title')
    quoteCol.updateTitle(id, title)
  }
  const updateQuoteColor = quoteCol.updateColor
  const toggleQuoteMinimize = quoteCol.toggleMinimize
  const duplicateQuoteCard = quoteCol.duplicate
  const archiveQuoteCard = quoteCol.archive
  const deleteQuoteCard = quoteCol.remove
  function updateQuoteText(id, text) {
    saveSnapshot('quote-text')
    quoteCol.update(id, { text })
  }
  function updateQuoteAuthor(id, author) {
    saveSnapshot('quote-author')
    quoteCol.update(id, { author })
  }
  function updateQuoteDimensions(id, width, height) { quoteCol.update(id, { width, height }) }
  function updateQuoteFontSize(id, fontSize) { quoteCol.update(id, { fontSize }) }

  function readDragPayload(event) {
    const rawPayload = event.dataTransfer?.getData('text/plain')
    if (rawPayload) {
      try { const cur = JSON.parse(rawPayload); if (cur?.columnId && cur?.itemId) return cur } catch { /* ignore */ }
    }
    return null
  }

  function handleDragStartItem(columnId, itemId, event) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify({ columnId, itemId }))
    setDragState({ columnId, itemId })
  }
  function handleDragEndItem() { setDragState({ columnId: null, itemId: null }) }
  function handleDragOverItem(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }

  function handleDropOnItem(columnId, targetItemId, event) {
    event.preventDefault(); event.stopPropagation()
    const payload = readDragPayload(event)
    if (!payload || (payload.columnId === columnId && payload.itemId === targetItemId)) return
    saveSnapshot('todo-items')

    setColumns((currentColumns) => {
      if (payload.columnId === columnId) {
        return currentColumns.map((col) => col.id === columnId ? { ...col, items: reorderListItems(col.items, payload.itemId, targetItemId) } : col)
      }
      const sourceCol = currentColumns.find((c) => c.id === payload.columnId)
      if (!sourceCol) return currentColumns
      const movedItem = sourceCol.items.find((item) => item.id === payload.itemId)
      if (!movedItem) return currentColumns

      return currentColumns.map((col) => {
        if (col.id === payload.columnId) return { ...col, items: col.items.filter((i) => i.id !== payload.itemId) }
        if (col.id === columnId) {
          const targetIndex = col.items.findIndex((item) => item.id === targetItemId)
          const newItems = [...col.items]; newItems.splice(targetIndex < 0 ? newItems.length : targetIndex, 0, movedItem)
          return { ...col, items: newItems }
        }
        return col
      })
    })
    setDragState({ columnId: null, itemId: null })
  }

  function handleDropOnList(columnId, event) {
    event.preventDefault()
    const payload = readDragPayload(event)
    if (!payload) return
    saveSnapshot('todo-items')

    setColumns((currentColumns) => {
      if (payload.columnId !== columnId) {
        const sourceCol = currentColumns.find((c) => c.id === payload.columnId)
        if (!sourceCol) return currentColumns
        const movedItem = sourceCol.items.find((item) => item.id === payload.itemId)
        if (!movedItem) return currentColumns
        return currentColumns.map((col) => {
          if (col.id === payload.columnId) return { ...col, items: col.items.filter((i) => i.id !== payload.itemId) }
          if (col.id === columnId) return { ...col, items: [...col.items, movedItem] }
          return col
        })
      }
      return currentColumns.map((col) => {
        if (col.id !== columnId) return col
        const currentIndex = col.items.findIndex((i) => i.id === payload.itemId)
        if (currentIndex < 0 || currentIndex === col.items.length - 1) return col
        const nextItems = [...col.items]; const [moved] = nextItems.splice(currentIndex, 1); nextItems.push(moved)
        return { ...col, items: nextItems }
      })
    })
    setDragState({ columnId: null, itemId: null })
  }

  function handleWheel(event) {
    event.preventDefault()
    const wsEl = typeof workspaceRef === 'function' ? workspaceRef() : workspaceRef?.current
    const bounds = wsEl?.getBoundingClientRect()
    if (!bounds) return

    const isMouseWheel = event.deltaMode !== 0
    const isPinch = event.ctrlKey || event.metaKey

    if (isPinch || wheelMode() === 'zoom') {
      const pointerX = event.clientX - bounds.left; const pointerY = event.clientY - bounds.top

      // Use original sensitivity for mouse wheel, use 3x for trackpad pinch
      const sensitivity = isPinch && !isMouseWheel ? (ZOOM_SENSITIVITY * 3.0) : ZOOM_SENSITIVITY
      const zoomFactor = Math.exp(-event.deltaY * sensitivity)

      setUi('viewport', (v) => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * zoomFactor))
        if (nextScale === v.scale) return v
        const contentX = (pointerX - v.x) / v.scale; const contentY = (pointerY - v.y) / v.scale
        return { scale: nextScale, x: pointerX - contentX * nextScale, y: pointerY - contentY * nextScale }
      })
    } else {
      // Pan mode
      const panSpeed = isMouseWheel ? 40 : 1; // Adjust speed for mouse wheel panning
      setUi('viewport', (v) => ({
        ...v,
        x: v.x - (event.deltaX * panSpeed),
        y: v.y - (event.deltaY * panSpeed)
      }))
    }
  }

  function startPanning(event) {
    if (window.innerWidth <= 1200) return
    if (event.button !== 2) return
    if (event.target.closest('.action-rail') || event.target.closest('.top-bar') || event.target.closest('.card-menu-wrap')) return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {}
    pan.active = true
    pan.lastX = event.clientX
    pan.lastY = event.clientY
    setIsPanning(true)
  }

  function handleMiddleClick(event) {
    if (event.button !== 1) return // Middle button
    event.preventDefault()
    const now = Date.now()
    if (now - lastMiddleClick < 400) {
      setWheelMode((mode) => {
        const nextMode = mode === 'zoom' ? 'pan' : 'zoom'
        showToast(`Scroll mode switched to ${nextMode === 'zoom' ? 'Zoom' : 'Pan'}`)
        return nextMode
      })
      lastMiddleClick = 0
    } else {
      lastMiddleClick = now
    }
  }

  function movePanning(event) {
    if (!pan.active) return
    event.preventDefault()
    const deltaX = event.clientX - pan.lastX
    const deltaY = event.clientY - pan.lastY
    pan.lastX = event.clientX
    pan.lastY = event.clientY
    // Update live copy immediately for downstream calculations
    const v = viewportLive
    viewportLive = { ...v, x: v.x + deltaX, y: v.y + deltaY }
    // Apply to DOM via rAF — no reactive updates during motion
    if (panRaf) cancelAnimationFrame(panRaf)
    panRaf = requestAnimationFrame(() => {
      const wsEl = typeof workspaceRef === 'function' ? workspaceRef() : workspaceRef?.current
      const boardStage = wsEl?.querySelector('.board-stage')
      if (boardStage) {
        const vr = viewportLive
        if (supportsNativeZoom) {
          boardStage.style.left = (vr.x / vr.scale) + 'px'
          boardStage.style.top = (vr.y / vr.scale) + 'px'
        } else {
          boardStage.style.transform = `translate(${vr.x}px, ${vr.y}px) scale(${vr.scale})`
        }
      }
    })
  }

  function endPanning(event) {
    if (!pan.active) return
    pan.active = false
    setIsPanning(false)
    if (panRaf) cancelAnimationFrame(panRaf)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {}
    // Commit final viewport to the store once on release
    setUi('viewport', reconcile({ ...viewportLive }))
  }

  function focusLabelCard(labelId) {
    const wsEl = typeof workspaceRef === 'function' ? workspaceRef() : workspaceRef?.current
    if (!wsEl) return
    const workspaceBounds = wsEl.getBoundingClientRect()
    const cardElement = wsEl.querySelector(`[data-card-id="${labelId}"]`)
    if (cardElement) {
      const cardBounds = cardElement.getBoundingClientRect()
      const centerX = workspaceBounds.left + workspaceBounds.width / 2; const centerY = workspaceBounds.top + workspaceBounds.height / 2
      const cardCenterX = cardBounds.left + cardBounds.width / 2; const cardCenterY = cardBounds.top + cardBounds.height / 2
      setUi('viewport', (v) => ({ ...v, x: v.x + (centerX - cardCenterX), y: v.y + (centerY - cardCenterY) }))
      return
    }
    const fallbackPosition = ui.cardPositions[labelId]
    if (!fallbackPosition) return
    setUi('viewport', (v) => ({
      ...v,
      x: workspaceBounds.width / 2 - fallbackPosition.x * v.scale,
      y: workspaceBounds.height / 2 - fallbackPosition.y * v.scale
    }))
  }

  function handleAddLabel(pos) {
    const id = createId('label'); const roles = ['routine', 'programming', 'english']
    setCustomLabels((p) => [...p, { id, text: '', role: roles[Math.floor(Math.random() * roles.length)] }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 400 - (viewportLive.x / viewportLive.scale), y: 300 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddSingleNote(pos) {
    const id = createId('singlenote')
    const vx = viewportLive.x / viewportLive.scale; const vy = viewportLive.y / viewportLive.scale
    setCardPositions((prev) => ({ ...prev, [id]: pos || { x: 450 - vx, y: 350 - vy } }))
    setSingleNotes((prev) => [...prev, { id, text: 'Single Note', shape: 'rectangle' }])
    saveSnapshot()
  }

  function handleAddNote(pos) {
    const id = createId('note')
    setNotes((p) => [...p, { id, text: '', title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 350 - (viewportLive.x / viewportLive.scale), y: 300 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddTodoList(pos) {
    const id = createId('col'); const tones = ['charcoal', 'gold', 'violet', 'red', 'blue']
    setColumns((p) => [...p, { id, tone: tones[Math.floor(Math.random() * tones.length)], positionClass: '', items: [], title: '', color: null, minimized: false }])
    setUi('drafts', (p) => ({ ...p, [id]: '' }))
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 400 - (viewportLive.x / viewportLive.scale), y: 200 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddTimer(pos) {
    const id = createId('timer'); setTimers((p) => [...p, { id, initialSeconds: 2700, remainingSeconds: 2700, title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 600 - (viewportLive.x / viewportLive.scale), y: 300 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddCounter(pos) {
    const id = createId('counter'); setCounters((p) => [...p, { id, initialValue: 0, title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 960 - (viewportLive.x / viewportLive.scale), y: 260 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddStopwatch(pos) {
    const id = createId('stopwatch'); setStopwatches((p) => [...p, { id, initialSeconds: 0, elapsedSeconds: 0, title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 1240 - (viewportLive.x / viewportLive.scale), y: 260 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddCalendar(pos) {
    const id = createId('calendar'); const now = new Date()
    setCalendars((p) => [...p, { id, year: now.getFullYear(), month: now.getMonth(), selectedDate: null, entries: {}, title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 1500 - (viewportLive.x / viewportLive.scale), y: 120 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddHabit(pos) {
    const id = createId('habit'); const now = new Date()
    setHabits((p) => [...p, { id, icon: HABIT_ICON_OPTIONS[0].id, year: now.getFullYear(), month: now.getMonth(), view: 'summary', completions: {}, title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 1700 - (viewportLive.x / viewportLive.scale), y: 120 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddPicture(pos) {
    const id = createId('picture')
    setPictures((p) => [...p, { id, imageId: null, title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 500 - (viewportLive.x / viewportLive.scale), y: 300 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddQuickLinks(pos) {
    const id = createId('quick-links')
    setQuickLinks((p) => [...p, { id, links: [], title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 1000 - (viewportLive.x / viewportLive.scale), y: 300 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleAddQuote(pos) {
    const id = createId('quote')
    setQuotes((p) => [...p, { id, text: '', author: '', title: '', color: null, minimized: false }])
    setCardPositions((p) => ({ ...p, [id]: pos || { x: 450 - (viewportLive.x / viewportLive.scale), y: 300 - (viewportLive.y / viewportLive.scale) } }))
    saveSnapshot()
  }

  function handleQuickAction(actionId, event, canvasPos) {
    let pos = canvasPos || null
    if (!pos && event && event.clientX !== undefined) {
      const wsEl = typeof workspaceRef === 'function' ? workspaceRef() : workspaceRef?.current
      const bounds = wsEl?.getBoundingClientRect()
      if (bounds) {
        pos = {
          x: (event.clientX - bounds.left - viewportLive.x) / viewportLive.scale,
          y: (event.clientY - bounds.top - viewportLive.y) / viewportLive.scale
        }
      }
    }
    if (actionId === 'label') handleAddLabel(pos)
    else if (actionId === 'singlenote') handleAddSingleNote(pos)
    else if (actionId === 'note') handleAddNote(pos)
    else if (actionId === 'todo-list') handleAddTodoList(pos)
    else if (actionId === 'counter') handleAddCounter(pos)
    else if (actionId === 'timer') handleAddTimer(pos)
    else if (actionId === 'stopwatch') handleAddStopwatch(pos)
    else if (actionId === 'calendar') handleAddCalendar(pos)
    else if (actionId === 'habit') handleAddHabit(pos)
    else if (actionId === 'picture') handleAddPicture(pos)
    else if (actionId === 'quick-links') handleAddQuickLinks(pos)
    else if (actionId === 'quote') handleAddQuote(pos)
    setIsRailOpen(false)
  }

  // Long-press callbacks
  function startLongPress(event) {
    if (event.button !== 1 && event.pointerType !== 'touch') return
    // Only trigger on empty canvas (not on cards)
    if (event.target !== event.currentTarget && !event.target.classList.contains('board-stage') && !event.target.classList.contains('board')) return
    const x = event.clientX
    const y = event.clientY
    longPressStart = { x, y }
    setLongPressPos({ x, y })
    setIsLongPressHolding(true)
    clearTimeout(longPressTimer)
    longPressTimer = setTimeout(() => {
      const wsEl = typeof workspaceRef === 'function' ? workspaceRef() : workspaceRef?.current
      const bounds = wsEl?.getBoundingClientRect()
      if (bounds) {
        const canvasX = (x - bounds.left - viewportLive.x) / viewportLive.scale
        const canvasY = (y - bounds.top - viewportLive.y) / viewportLive.scale
        setLongPressMenu({ visible: true, x, y, canvasX, canvasY })
      }
      setIsLongPressHolding(false)
    }, 650)
  }

  function moveLongPress(event) {
    if (!isLongPressHolding()) return
    const dx = event.clientX - longPressStart.x
    const dy = event.clientY - longPressStart.y
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      clearTimeout(longPressTimer)
      setIsLongPressHolding(false)
    }
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer)
    setIsLongPressHolding(false)
  }

  function closeLongPressMenu() {
    setLongPressMenu((prev) => ({ ...prev, visible: false }))
  }

  onCleanup(() => {
    clearTimeout(longPressTimer)
    clearTimeout(toastTimer)
  })

  async function importCardsFromJson(file) {
    try {
      const rawWorkspace = await parseImportedCards(file)

      const batchSeed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
      const newPositions = {}
      const newDrafts = {}
      let totalImported = 0

      const vx = viewportLive.x / (viewportLive.scale || 1)
      const vy = viewportLive.y / (viewportLive.scale || 1)

      const processCard = (card, idx, defaultX, defaultY) => {
        totalImported++
        const oldId = card.id || `card-${idx}`
        const newId = `${oldId}-imp-${batchSeed}-${idx}`
        const oldPos = rawWorkspace.cardPositions?.[oldId]
        if (oldPos && Number.isFinite(oldPos.x) && Number.isFinite(oldPos.y)) {
          newPositions[newId] = { x: oldPos.x + 40, y: oldPos.y + 40 }
        } else {
          newPositions[newId] = { x: defaultX - vx + (idx * 24), y: defaultY - vy + (idx * 24) }
        }
        return { card: { ...card, id: newId }, newId, oldId }
      }

      const importedColumns = []
      if (Array.isArray(rawWorkspace.columns)) {
        rawWorkspace.columns.forEach((col, idx) => {
          const { card, newId, oldId } = processCard(col, idx, 350, 200)
          const newItems = (col.items || []).map((item, itemIdx) => ({
            ...item,
            id: `${newId}-item-${itemIdx}-${Date.now()}`
          }))
          importedColumns.push({ ...card, items: newItems, minimized: false })
          if (rawWorkspace.drafts?.[oldId]) {
            newDrafts[newId] = rawWorkspace.drafts[oldId]
          } else {
            newDrafts[newId] = ''
          }
        })
      }

      const importedLabels = []
      if (Array.isArray(rawWorkspace.customLabels)) {
        rawWorkspace.customLabels.forEach((label, idx) => {
          const { card } = processCard(label, idx, 350, 300)
          importedLabels.push({ ...card, text: card.text || 'LABEL', role: card.role || 'routine', minimized: false })
        })
      }

      const importedNotes = []
      if (Array.isArray(rawWorkspace.notes)) {
        rawWorkspace.notes.forEach((note, idx) => {
          const { card } = processCard(note, idx, 400, 300)
          importedNotes.push({ ...card, text: card.text || '', title: card.title || '', minimized: false })
        })
      }

      const importedSingleNotes = []
      if (Array.isArray(rawWorkspace.singleNotes)) {
        rawWorkspace.singleNotes.forEach((sn, idx) => {
          const { card } = processCard(sn, idx, 450, 350)
          importedSingleNotes.push({ ...card, text: card.text || 'Single Note', shape: card.shape || 'rectangle' })
        })
      }

      const importedTimers = []
      if (Array.isArray(rawWorkspace.timers)) {
        rawWorkspace.timers.forEach((timer, idx) => {
          const { card } = processCard(timer, idx, 600, 300)
          const initialSeconds = Number.isFinite(card.initialSeconds) ? card.initialSeconds : 2700
          const remainingSeconds = Number.isFinite(card.remainingSeconds) ? card.remainingSeconds : initialSeconds
          importedTimers.push({ ...card, initialSeconds, remainingSeconds, title: card.title || '', minimized: false })
        })
      }

      const importedCounters = []
      if (Array.isArray(rawWorkspace.counters)) {
        rawWorkspace.counters.forEach((counter, idx) => {
          const { card } = processCard(counter, idx, 800, 260)
          importedCounters.push({ ...card, initialValue: Number.isFinite(card.initialValue) ? card.initialValue : 0, title: card.title || '', minimized: false })
        })
      }

      const importedStopwatches = []
      if (Array.isArray(rawWorkspace.stopwatches)) {
        rawWorkspace.stopwatches.forEach((stopwatch, idx) => {
          const { card } = processCard(stopwatch, idx, 1000, 260)
          const initialSeconds = Number.isFinite(card.initialSeconds) ? card.initialSeconds : 0
          const elapsedSeconds = Number.isFinite(card.elapsedSeconds) ? card.elapsedSeconds : initialSeconds
          importedStopwatches.push({ ...card, initialSeconds, elapsedSeconds, title: card.title || '', minimized: false })
        })
      }

      const importedCalendars = []
      if (Array.isArray(rawWorkspace.calendars)) {
        const now = new Date()
        rawWorkspace.calendars.forEach((calendar, idx) => {
          const { card } = processCard(calendar, idx, 1200, 120)
          importedCalendars.push({
            ...card,
            year: Number.isFinite(card.year) ? card.year : now.getFullYear(),
            month: Number.isFinite(card.month) ? card.month : now.getMonth(),
            selectedDate: null,
            entries: { ...(card.entries || {}) },
            title: card.title || '',
            minimized: false
          })
        })
      }

      const importedHabits = []
      if (Array.isArray(rawWorkspace.habits)) {
        const now = new Date()
        rawWorkspace.habits.forEach((habit, idx) => {
          const { card } = processCard(habit, idx, 1400, 120)
          importedHabits.push({
            ...card,
            icon: normalizeHabitIconId(card.icon),
            year: Number.isFinite(card.year) ? card.year : now.getFullYear(),
            month: Number.isFinite(card.month) ? card.month : now.getMonth(),
            view: 'summary',
            completions: { ...(card.completions || {}) },
            title: card.title || '',
            minimized: false
          })
        })
      }

      const importedPictures = []
      if (Array.isArray(rawWorkspace.pictures)) {
        rawWorkspace.pictures.forEach((pic, idx) => {
          const { card } = processCard(pic, idx, 500, 300)
          importedPictures.push({ ...card, title: card.title || '', minimized: false })
        })
      }

      const importedQuickLinks = []
      if (Array.isArray(rawWorkspace.quickLinks)) {
        rawWorkspace.quickLinks.forEach((ql, idx) => {
          const { card } = processCard(ql, idx, 900, 300)
          // Imported files are untrusted — strip dangerous URL schemes here so
          // a shared backup can't inject javascript: links.
          const safeLinks = (Array.isArray(card.links) ? card.links : []).map((link) => ({
            ...link,
            url: sanitizeUrl(link?.url) || '',
          }))
          importedQuickLinks.push({ ...card, links: safeLinks, title: card.title || '', minimized: false })
        })
      }

      const importedQuotes = []
      if (Array.isArray(rawWorkspace.quotes)) {
        rawWorkspace.quotes.forEach((quote, idx) => {
          const { card } = processCard(quote, idx, 450, 300)
          importedQuotes.push({ ...card, text: card.text || '', author: card.author || '', title: card.title || '', minimized: false })
        })
      }

      if (totalImported === 0) {
        showToast('No cards found in JSON file.')
        return
      }

      saveSnapshot()

      if (importedColumns.length > 0) setColumns((c) => [...c, ...importedColumns])
      if (importedLabels.length > 0) setCustomLabels((c) => [...c, ...importedLabels])
      if (importedNotes.length > 0) setNotes((c) => [...c, ...importedNotes])
      if (importedSingleNotes.length > 0) setSingleNotes((c) => [...c, ...importedSingleNotes])
      if (importedTimers.length > 0) setTimers((c) => [...c, ...importedTimers])
      if (importedCounters.length > 0) setCounters((c) => [...c, ...importedCounters])
      if (importedStopwatches.length > 0) setStopwatches((c) => [...c, ...importedStopwatches])
      if (importedCalendars.length > 0) setCalendars((c) => [...c, ...importedCalendars])
      if (importedHabits.length > 0) setHabits((c) => [...c, ...importedHabits])
      if (importedPictures.length > 0) setPictures((c) => [...c, ...importedPictures])
      if (importedQuickLinks.length > 0) setQuickLinks((c) => [...c, ...importedQuickLinks])
      if (importedQuotes.length > 0) setQuotes((c) => [...c, ...importedQuotes])

      setCardPositions((prev) => ({ ...prev, ...newPositions }))
      setUi('drafts', (prev) => ({ ...prev, ...newDrafts }))

      showToast(`Successfully imported ${totalImported} card${totalImported === 1 ? '' : 's'}!`)
    } catch (err) {
      showToast(err.message || 'Failed to import cards.')
    }
  }

  return {
    state: {
      get columns() { return columns },
      get drafts() { return ui.drafts },
      get viewport() { return ui.viewport },
      get isPanning() { return isPanning() },
      get isRailOpen() { return isRailOpen() },
      get isFocusMode() { return isFocusMode() },
      get themeMode() { return ui.themeMode },
      get themePalette() { return ui.themePalette },
      get theme() { return theme() },
      get dragState() { return dragState() },
      get notes() { return notes },
      get timers() { return timers },
      get counters() { return counters },
      get stopwatches() { return stopwatches },
      get calendars() { return calendars },
      get habits() { return habits },
      get pictures() { return pictures },
      get quickLinks() { return quickLinks },
      get quotes() { return quotes },
      get archivedCards() { return ui.archivedCards },
      get detachedLabels() { return detachedLabels() },
      get singleNotes() { return singleNotes },
      get cardPositions() { return ui.cardPositions },
      get draggingCard() { return draggingCard() },
      get poppingCardIds() { return poppingCardIds() },
      get toastMessage() { return toastMessage() },
      get longPressMenu() { return longPressMenu() },
      get isLongPressHolding() { return isLongPressHolding() },
      get longPressPos() { return longPressPos() },
    },
    setters: {
      setThemeMode: (mode) => setUi('themeMode', typeof mode === 'function' ? mode(ui.themeMode) : mode),
      setThemePalette: (palette) => setUi('themePalette', typeof palette === 'function' ? palette(ui.themePalette) : palette),
      setIsFocusMode,
      setIsRailOpen,
    },
    actions: {
      setDraft, addItem, updateItemText, updateItemDetails, deleteItem,
      handleDragStartItem, handleDragEndItem, handleDragOverItem, handleDropOnItem, handleDropOnList,
      handleCardPointerDown, handleWheel, startPanning, movePanning, endPanning, handleMiddleClick,
      handleQuickAction, focusLabelCard, restoreArchivedCard, moveCardToTarget,
      handleUndo, handleRedo, startLongPress, moveLongPress, cancelLongPress, closeLongPressMenu,
      importWorkspaceState,
      updateTodoCardTitle, updateTodoCardColor, toggleTodoCardMinimize, updateTodoCardFontSize, duplicateTodoCard, archiveTodoCard, deleteTodoCard,
      updateLabelText, updateLabelColor, toggleLabelMinimize, updateLabelFontSize, duplicateLabelCard, archiveLabelCard, deleteLabelCard,
      updateSingleNoteText, updateSingleNoteColor, updateSingleNoteFontSize, updateSingleNoteShape, toggleSingleNoteMinimize, duplicateSingleNoteCard, archiveSingleNoteCard, deleteSingleNoteCard,
      updateNoteTitle, updateNoteText, updateNoteColor, toggleNoteMinimize, updateNoteDimensions, updateNoteFontSize, duplicateNoteCard, archiveNoteCard, deleteNoteCard,
      updateTimerTitle, updateTimerColor, toggleTimerMinimize, updateTimerState, updateTimerFontSize, duplicateTimerCard, archiveTimerCard, deleteTimerCard,
      updateCounterTitle, updateCounterValue, updateCounterColor, toggleCounterMinimize, updateCounterFontSize, duplicateCounterCard, archiveCounterCard, deleteCounterCard,
      updateStopwatchTitle, updateStopwatchColor, updateStopwatchState, toggleStopwatchMinimize, updateStopwatchFontSize, duplicateStopwatchCard, archiveStopwatchCard, deleteStopwatchCard,
      updateCalendarTitle, updateCalendarColor, toggleCalendarMinimize, changeCalendarMonth, openCalendarDay, closeCalendarDay, updateCalendarEntry, updateCalendarFontSize, duplicateCalendarCard, archiveCalendarCard, deleteCalendarCard,
      updateHabitTitle, updateHabitIcon, updateHabitColor, toggleHabitMinimize, setHabitView, changeHabitMonth, toggleHabitDate, updateHabitFontSize, duplicateHabitCard, archiveHabitCard, deleteHabitCard,
      updatePictureTitle, updatePictureColor, togglePictureMinimize, updatePictureImageId, updatePictureDimensions, updatePictureFitMode, updatePictureFontSize, duplicatePictureCard, archivePictureCard, deletePictureCard,
      updateQuickLinksTitle, updateQuickLinksColor, toggleQuickLinksMinimize, addQuickLinkItem, updateQuickLinkItem, removeQuickLinkItem, reorderQuickLinkItems, updateQuickLinksFontSize, duplicateQuickLinksCard, archiveQuickLinksCard, deleteQuickLinksCard,
      updateQuoteTitle, updateQuoteText, updateQuoteAuthor, updateQuoteColor, toggleQuoteMinimize, updateQuoteDimensions, updateQuoteFontSize, duplicateQuoteCard, archiveQuoteCard, deleteQuoteCard, importCardsFromJson,
      captureSnapshot, setThemePalette: (palette) => setUi('themePalette', typeof palette === 'function' ? palette(ui.themePalette) : palette),
    }
  }
}
