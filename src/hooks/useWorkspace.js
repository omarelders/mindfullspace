import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  writeJsonStorage,
  getInitialWorkspaceState,
  removeStorageKey
} from '../utils/storage'
import {
  THEME_COLORS,
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
import { useUndoRedo } from './useUndoRedo'
import { useCardCollection } from './useCardCollection'

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


export function useWorkspace(workspaceId, workspaceRef) {
  const initialWorkspaceState = useMemo(() => getInitialWorkspaceState(workspaceId), [workspaceId])
  const [drafts, setDrafts] = useState(() => initialWorkspaceState.drafts)
  const [viewport, setViewport] = useState(() => initialWorkspaceState.viewport)
  const [isPanning, setIsPanning] = useState(false)
  const [isRailOpen, setIsRailOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [themeMode, setThemeMode] = useState(() => initialWorkspaceState.themeMode)
  const [dragState, setDragState] = useState({ columnId: null, itemId: null })
  const [archivedCards, setArchivedCards] = useState(() => initialWorkspaceState.archivedCards)
  const [cardPositions, setCardPositions] = useState(() => initialWorkspaceState.cardPositions)
  const [draggingCard, setDraggingCard] = useState(null)
  const [poppingCardIds, setPoppingCardIds] = useState(() => new Set())
  const [toastMessage, setToastMessage] = useState(null)
  const hasInitializedCardTrackingRef = useRef(false)
  const previousCardIdsRef = useRef(new Set())
  const popCleanupTimeoutsRef = useRef(new Map())
  const panRef = useRef({ active: false, lastX: 0, lastY: 0 })
  const toastTimerRef = useRef(null)

  // Long-press context menu state
  const [longPressMenu, setLongPressMenu] = useState({ visible: false, x: 0, y: 0, canvasX: 0, canvasY: 0 })
  const [isLongPressHolding, setIsLongPressHolding] = useState(false)
  const [longPressPos, setLongPressPos] = useState({ x: 0, y: 0 })
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef({ x: 0, y: 0 })

  const { pushSnapshot, undo, redo } = useUndoRedo()

  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMessage(msg)
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000)
  }, [])

  const removeCardPosition = useCallback((cardId) => {
    setCardPositions((currentPositions) => {
      if (!(cardId in currentPositions)) return currentPositions
      const nextPositions = { ...currentPositions }
      delete nextPositions[cardId]
      return nextPositions
    })
  }, [])

  const clearCardDraft = useCallback((cardId) => {
    setDrafts((currentDrafts) => {
      if (!(cardId in currentDrafts)) return currentDrafts
      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[cardId]
      return nextDrafts
    })
  }, [])

  const archiveCardSnapshot = useCallback((cardType, cardData) => {
    const archivedPosition = cardData?.id && cardPositions[cardData.id] ? { ...cardPositions[cardData.id] } : null
    setArchivedCards(current => [...current, { id: `${cardType}-${Date.now()}`, type: cardType, archivedAt: Date.now(), data: cardData, position: archivedPosition }])
  }, [cardPositions])

  // Card Collections
  const labelCol = useCardCollection({
    initialItems: initialWorkspaceState.customLabels,
    idPrefix: 'label',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
    onDuplicate: (source, dupData) => ({ ...source, id: dupData.id })
  })

  const colCol = useCardCollection({
    initialItems: initialWorkspaceState.columns,
    idPrefix: 'col',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
    onDuplicate: (source, dupData, dupId) => {
      setDrafts(d => ({ ...d, [dupId]: d[source.id] || '' }))
      return {
        ...dupData,
        items: source.items.map((i, idx) => ({ ...i, id: `${dupId}-item-${idx}-${Date.now()}` }))
      }
    },
    onDelete: (id) => {
      clearCardDraft(id)
      setDragState(d => d.columnId === id ? { columnId: null, itemId: null } : d)
    }
  })

  const noteCol = useCardCollection({
    initialItems: initialWorkspaceState.notes,
    idPrefix: 'note',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const quoteCol = useCardCollection({
    initialItems: initialWorkspaceState.quotes || [],
    idPrefix: 'quote',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const timerCol = useCardCollection({
    initialItems: initialWorkspaceState.timers,
    idPrefix: 'timer',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const counterCol = useCardCollection({
    initialItems: initialWorkspaceState.counters,
    idPrefix: 'counter',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const stopwatchCol = useCardCollection({
    initialItems: initialWorkspaceState.stopwatches,
    idPrefix: 'stopwatch',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const calendarCol = useCardCollection({
    initialItems: initialWorkspaceState.calendars,
    idPrefix: 'calendar',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const habitCol = useCardCollection({
    initialItems: initialWorkspaceState.habits,
    idPrefix: 'habit',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const picCol = useCardCollection({
    initialItems: initialWorkspaceState.pictures || [],
    idPrefix: 'picture',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  const qlCol = useCardCollection({
    initialItems: initialWorkspaceState.quickLinks || [],
    idPrefix: 'quick-links',
    saveSnapshot,
    archiveCardSnapshot,
    removeCardPosition,
    setCardPositions,
    setDraggingCard,
  })

  // Aliases for state variables so existing codebase works without modification
  const customLabels = labelCol.items
  const setCustomLabels = labelCol.setItems

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

  // Refs that always hold current state for snapshot capture
  const stateRefsForSnapshot = useRef({})

  useEffect(() => {
    stateRefsForSnapshot.current = {
      columns, drafts, viewport, themeMode, notes, timers, counters,
      stopwatches, calendars, habits, pictures, quickLinks, quotes, archivedCards, customLabels, cardPositions
    }
  }, [columns, drafts, viewport, themeMode, notes, timers, counters,
      stopwatches, calendars, habits, pictures, quickLinks, quotes, archivedCards, customLabels, cardPositions])

  const captureSnapshot = useCallback(() => {
    const s = stateRefsForSnapshot.current
    return {
      columns: s.columns,
      drafts: s.drafts,
      viewport: s.viewport,
      themeMode: s.themeMode,
      notes: s.notes,
      timers: s.timers,
      counters: s.counters,
      stopwatches: s.stopwatches,
      calendars: s.calendars,
      habits: s.habits,
      pictures: s.pictures,
      quickLinks: s.quickLinks,
      quotes: s.quotes,
      archivedCards: s.archivedCards,
      customLabels: s.customLabels,
      cardPositions: s.cardPositions,
    }
  }, [])

  const restoreSnapshot = useCallback((snapshot) => {
    setColumns(snapshot.columns)
    setDrafts(snapshot.drafts)
    setViewport(snapshot.viewport)
    setThemeMode(snapshot.themeMode)
    setNotes(snapshot.notes)
    setTimers(snapshot.timers)
    setCounters(snapshot.counters)
    setStopwatches(snapshot.stopwatches)
    setCalendars(snapshot.calendars)
    setHabits(snapshot.habits)
    setPictures(snapshot.pictures)
    setQuickLinks(snapshot.quickLinks || [])
    setQuotes(snapshot.quotes || [])
    setArchivedCards(snapshot.archivedCards)
    setCustomLabels(snapshot.customLabels)
    setCardPositions(snapshot.cardPositions)
  }, [setColumns, setDrafts, setViewport, setThemeMode, setNotes, setTimers, setCounters, setStopwatches, setCalendars, setHabits, setPictures, setQuickLinks, setQuotes, setArchivedCards, setCustomLabels, setCardPositions])

  function saveSnapshot() {
    pushSnapshot(captureSnapshot())
  }

  const handleUndo = useCallback(() => {
    const snapshot = undo(captureSnapshot())
    if (snapshot) {
      restoreSnapshot(snapshot)
      showToast('Undone')
    } else {
      showToast('Nothing to undo')
    }
  }, [undo, captureSnapshot, restoreSnapshot, showToast])

  const handleRedo = useCallback(() => {
    const snapshot = redo(captureSnapshot())
    if (snapshot) {
      restoreSnapshot(snapshot)
      showToast('Redone')
    } else {
      showToast('Nothing to redo')
    }
  }, [redo, captureSnapshot, restoreSnapshot, showToast])

  const theme = THEME_COLORS[themeMode]
  const detachedLabels = useMemo(() => customLabels.map((label) => {
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
  }), [customLabels, theme])

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
      ...pictures.map((pic) => pic.id),
      ...quickLinks.map((ql) => ql.id),
      ...quotes.map((q) => q.id),
    ],
    [columns, detachedLabels, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks, quotes],
  )

  const workspaceStorageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`
  const workspaceStorageSnapshot = useMemo(
    () => ({
      columns, drafts, viewport, themeMode, notes, timers, counters,
      stopwatches, calendars, habits, pictures, quickLinks, quotes, archivedCards, customLabels, cardPositions,
    }),
    [columns, drafts, viewport, themeMode, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks, quotes, archivedCards, customLabels, cardPositions]
  )

  useEffect(() => {
    if (isPanning || draggingCard) return undefined
    const persistTimeoutId = window.setTimeout(() => writeJsonStorage(workspaceStorageKey, workspaceStorageSnapshot), 500)
    return () => window.clearTimeout(persistTimeoutId)
  }, [workspaceStorageKey, workspaceStorageSnapshot, isPanning, draggingCard])

  // Ensure state is saved immediately on beforeunload or visibilitychange
  useEffect(() => {
    const handleSave = () => {
      writeJsonStorage(workspaceStorageKey, workspaceStorageSnapshot)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleSave()
    }
    window.addEventListener('beforeunload', handleSave)
    window.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', handleSave)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
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

    if (addedCardIds.length === 0) return

    setPoppingCardIds((currentPoppingIds) => {
      const nextPoppingIds = new Set(currentPoppingIds)
      addedCardIds.forEach((cardId) => nextPoppingIds.add(cardId))
      return nextPoppingIds
    })

    addedCardIds.forEach((cardId) => {
      const existingTimeoutId = popCleanupTimeoutsRef.current.get(cardId)
      if (existingTimeoutId) window.clearTimeout(existingTimeoutId)

      const timeoutId = window.setTimeout(() => {
        setPoppingCardIds((currentPoppingIds) => {
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
    const popCleanup = popCleanupTimeoutsRef.current
    return () => {
      popCleanup.forEach((timeoutId) => window.clearTimeout(timeoutId))
      popCleanup.clear()
    }
  }, [])

  useEffect(() => {
    if (!draggingCard) return
    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    window.getSelection()?.removeAllRanges()

    const handlePointerMove = (e) => {
      if (draggingCard.pointerId !== undefined && e.pointerId !== draggingCard.pointerId) return
      const scale = viewport.scale || 1
      const dx = (e.clientX - draggingCard.startX) / scale
      const dy = (e.clientY - draggingCard.startY) / scale
      setCardPositions(prev => ({
        ...prev,
        [draggingCard.id]: { x: draggingCard.initialX + dx, y: draggingCard.initialY + dy }
      }))
    }
    const handlePointerUp = (e) => {
      if (draggingCard.pointerId !== undefined && e.pointerId !== draggingCard.pointerId) return
      setDraggingCard(null)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [draggingCard, viewport.scale])

  const handleCardPointerDown = (cardId, e) => {
    if (window.innerWidth <= 1200) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (!e.target.closest('.card-header') && !e.target.closest('.label-drag-handle') && !e.target.closest('.stopwatch-drag-handle')) return
    if (e.target.closest('.card-menu-wrap')) return
    const cardPosition = cardPositions[cardId]
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

  useEffect(() => {
    const stopPanning = () => {
      if (!panRef.current.active) return
      panRef.current.active = false
      setIsPanning(false)
    }
    window.addEventListener('pointerup', stopPanning)
    window.addEventListener('pointercancel', stopPanning)
    window.addEventListener('blur', stopPanning)
    return () => {
      window.removeEventListener('pointerup', stopPanning)
      window.removeEventListener('pointercancel', stopPanning)
      window.removeEventListener('blur', stopPanning)
    }
  }, [])

  useEffect(() => {
    if (!isFocusMode) return undefined
    const handleEscape = (event) => { if (event.key === 'Escape') setIsFocusMode(false) }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isFocusMode])

  // Ctrl+Z / Ctrl+Shift+Z keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) {
        handleRedo()
      } else {
        handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  const handlePasteImage = useCallback(async (blob) => {
    if (blob.size > MAX_IMAGE_SIZE) {
      showToast(`Image too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`)
      return
    }
    const id = `picture-${Date.now()}`
    const imageId = `img-paste-${Date.now()}`
    try {
      await saveImage(imageId, blob)
    } catch {
      showToast('Failed to paste image.')
      return
    }
    setPictures(p => [...p, { id, imageId, title: '', color: null, minimized: false }])
    setCardPositions(p => ({
      ...p,
      [id]: {
        x: 500 - (viewport.x / viewport.scale),
        y: 300 - (viewport.y / viewport.scale),
      },
    }))
    showToast('Image pasted!')
  }, [viewport, showToast, setPictures])

  const handlePasteText = useCallback((text) => {
    if (!text || text.trim().length === 0) return
    const id = `quote-${Date.now()}`
    setQuotes(p => [...p, { id, text, author: '', title: '', color: null, minimized: false }])
    setCardPositions(p => ({
      ...p,
      [id]: {
        x: 400 - (viewport.x / viewport.scale),
        y: 300 - (viewport.y / viewport.scale),
      },
    }))
    showToast('Text pasted as Quote!')
  }, [viewport, showToast, setQuotes])

  // Ctrl+V clipboard paste → Picture Card or Quote Card
  useEffect(() => {
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
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePasteImage, handlePasteText])

  const setDraft = useCallback((columnId, value) => setDrafts(prev => ({ ...prev, [columnId]: value })), [])

  const addItem = useCallback((columnId) => {
    const text = stateRefsForSnapshot.current.drafts[columnId]?.trim()
    if (!text) return
    setColumns((currentColumns) => currentColumns.map((column) => {
      if (column.id !== columnId) return column
      return {
        ...column,
        items: [...column.items, { id: `${columnId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`, text, completed: false }],
      }
    }))
    setDrafts((currentDrafts) => ({ ...currentDrafts, [columnId]: '' }))
  }, [setColumns])

  const deleteItem = useCallback((columnId, itemId) => {
    setColumns(current => current.map(col => col.id === columnId ? { ...col, items: col.items.filter(i => i.id !== itemId) } : col))
  }, [setColumns])

  const getRestorePosition = (cardType, archivedPosition) => {
    if (archivedPosition && Number.isFinite(archivedPosition.x) && Number.isFinite(archivedPosition.y)) return { x: archivedPosition.x + 24, y: archivedPosition.y + 24 }
    const vx = viewport.x / viewport.scale; const vy = viewport.y / viewport.scale
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

  const restoreArchivedCard = (archiveId) => {
    const archivedEntry = archivedCards.find((entry) => entry.id === archiveId)
    if (!archivedEntry) return

    const archivedData = archivedEntry.data || {}
    const restoredPosition = getRestorePosition(archivedEntry.type, archivedEntry.position)
    const uniqueSeed = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    let restoredCardId = null

    if (archivedEntry.type === 'label') {
      restoredCardId = `label-${uniqueSeed}`
      setCustomLabels(current => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || 'LABEL', role: archivedData.role || 'routine' }])
    } else if (archivedEntry.type === 'todo') {
      restoredCardId = `col-${uniqueSeed}`
      const restoredItems = (archivedData.items || []).map((item, index) => ({ ...item, id: `${restoredCardId}-item-${index}-${Date.now()}` }))
      setColumns(current => [...current, { ...archivedData, id: restoredCardId, tone: archivedData.tone || 'charcoal', positionClass: '', title: archivedData.title || '', color: archivedData.color || null, minimized: false, items: restoredItems }])
      setDrafts(current => ({ ...current, [restoredCardId]: '' }))
    } else if (archivedEntry.type === 'note') {
      restoredCardId = `note-${uniqueSeed}`
      setNotes(current => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || '', title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'timer') {
      restoredCardId = `timer-${uniqueSeed}`
      const initialSeconds = Number.isFinite(archivedData.initialSeconds) ? archivedData.initialSeconds : 2700
      const remainingSeconds = Number.isFinite(archivedData.remainingSeconds) ? archivedData.remainingSeconds : initialSeconds
      setTimers(current => [...current, { ...archivedData, id: restoredCardId, initialSeconds, remainingSeconds, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'counter') {
      restoredCardId = `counter-${uniqueSeed}`
      setCounters(current => [...current, { ...archivedData, id: restoredCardId, initialValue: Number.isFinite(archivedData.initialValue) ? archivedData.initialValue : 0, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'stopwatch') {
      restoredCardId = `stopwatch-${uniqueSeed}`
      const initialSeconds = Number.isFinite(archivedData.initialSeconds) ? archivedData.initialSeconds : 0
      const elapsedSeconds = Number.isFinite(archivedData.elapsedSeconds) ? archivedData.elapsedSeconds : initialSeconds
      setStopwatches(current => [...current, { ...archivedData, id: restoredCardId, initialSeconds, elapsedSeconds, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'calendar') {
      restoredCardId = `calendar-${uniqueSeed}`
      const now = new Date()
      setCalendars(current => [...current, { ...archivedData, id: restoredCardId, year: Number.isFinite(archivedData.year) ? archivedData.year : now.getFullYear(), month: Number.isFinite(archivedData.month) ? archivedData.month : now.getMonth(), selectedDate: null, entries: { ...(archivedData.entries || {}) }, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'habit') {
      restoredCardId = `habit-${uniqueSeed}`
      const now = new Date()
      setHabits(current => [...current, { ...archivedData, id: restoredCardId, icon: normalizeHabitIconId(archivedData.icon), year: Number.isFinite(archivedData.year) ? archivedData.year : now.getFullYear(), month: Number.isFinite(archivedData.month) ? archivedData.month : now.getMonth(), view: 'summary', completions: { ...(archivedData.completions || {}) }, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'picture') {
      restoredCardId = `picture-${uniqueSeed}`
      setPictures(current => [...current, { ...archivedData, id: restoredCardId, title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'quick-links') {
      restoredCardId = `quick-links-${uniqueSeed}`
      setQuickLinks(current => [...current, { ...archivedData, id: restoredCardId, links: archivedData.links || [], title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    } else if (archivedEntry.type === 'quote') {
      restoredCardId = `quote-${uniqueSeed}`
      setQuotes(current => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || '', author: archivedData.author || '', title: archivedData.title || '', color: archivedData.color || null, minimized: false }])
    }

    if (!restoredCardId) return
    setCardPositions(current => ({ ...current, [restoredCardId]: restoredPosition }))
    setArchivedCards(current => current.filter(entry => entry.id !== archiveId))
  }

  const moveCardToTarget = useCallback((cardId, targetId) => {
    const target = CARD_MOVE_TARGETS.find((candidate) => candidate.id === targetId)
    if (!target) return
    setCardPositions(current => ({ ...current, [cardId]: { x: target.x, y: target.y } }))
  }, [])

  // Labels
  const updateLabelText = useCallback((id, text) => labelCol.update(id, { text: text.toUpperCase() }), [labelCol])
  const updateLabelColor = useCallback((id, color) => labelCol.update(id, { customColor: color }), [labelCol])
  const toggleLabelMinimize = labelCol.toggleMinimize
  const duplicateLabelCard = labelCol.duplicate
  const archiveLabelCard = labelCol.archive
  const deleteLabelCard = labelCol.remove

  // Todos (Columns)
  const updateTodoCardTitle = colCol.updateTitle
  const updateTodoCardColor = colCol.updateColor
  const toggleTodoCardMinimize = colCol.toggleMinimize
  const updateItemDetails = useCallback((colId, itemId, details) => {
    colCol.update(colId, (c) => ({
      items: c.items.map(i => i.id === itemId ? { ...i, ...details } : i)
    }))
  }, [colCol])
  const updateItemText = useCallback((colId, itemId, text) => {
    colCol.update(colId, (c) => ({
      items: c.items.map(i => i.id === itemId ? { ...i, text } : i)
    }))
  }, [colCol])
  const duplicateTodoCard = colCol.duplicate
  const archiveTodoCard = colCol.archive
  const deleteTodoCard = colCol.remove

  // Notes
  const updateNoteTitle = noteCol.updateTitle
  const updateNoteColor = noteCol.updateColor
  const toggleNoteMinimize = noteCol.toggleMinimize
  const duplicateNoteCard = noteCol.duplicate
  const archiveNoteCard = noteCol.archive
  const deleteNoteCard = noteCol.remove
  const updateNoteText = useCallback((id, text) => noteCol.update(id, { text }), [noteCol])
  const updateNoteDimensions = useCallback((id, width, height) => noteCol.update(id, { width, height }), [noteCol])

  // Timers
  const updateTimerTitle = timerCol.updateTitle
  const updateTimerColor = timerCol.updateColor
  const toggleTimerMinimize = timerCol.toggleMinimize
  const duplicateTimerCard = timerCol.duplicate
  const archiveTimerCard = timerCol.archive
  const deleteTimerCard = timerCol.remove
  const updateTimerState = useCallback((id, patch) => timerCol.update(id, patch), [timerCol])

  // Counters
  const updateCounterTitle = counterCol.updateTitle
  const updateCounterColor = counterCol.updateColor
  const toggleCounterMinimize = counterCol.toggleMinimize
  const duplicateCounterCard = counterCol.duplicate
  const archiveCounterCard = counterCol.archive
  const deleteCounterCard = counterCol.remove
  const updateCounterValue = useCallback((id, v) => counterCol.update(id, { initialValue: v }), [counterCol])

  // Stopwatches
  const updateStopwatchTitle = stopwatchCol.updateTitle
  const updateStopwatchColor = stopwatchCol.updateColor
  const toggleStopwatchMinimize = stopwatchCol.toggleMinimize
  const duplicateStopwatchCard = stopwatchCol.duplicate
  const archiveStopwatchCard = stopwatchCol.archive
  const deleteStopwatchCard = stopwatchCol.remove
  const updateStopwatchState = useCallback((id, patch) => stopwatchCol.update(id, patch), [stopwatchCol])

  // Calendars
  const updateCalendarTitle = calendarCol.updateTitle
  const updateCalendarColor = calendarCol.updateColor
  const toggleCalendarMinimize = calendarCol.toggleMinimize
  const duplicateCalendarCard = calendarCol.duplicate
  const archiveCalendarCard = calendarCol.archive
  const deleteCalendarCard = calendarCol.remove
  const changeCalendarMonth = useCallback((id, delta) => calendarCol.update(id, (c) => {
    const shifted = new Date(c.year, c.month + delta, 1)
    return { year: shifted.getFullYear(), month: shifted.getMonth() }
  }), [calendarCol])
  const openCalendarDay = useCallback((id, dateKey) => calendarCol.update(id, { selectedDate: dateKey }), [calendarCol])
  const closeCalendarDay = useCallback((id) => calendarCol.update(id, { selectedDate: null }), [calendarCol])
  const updateCalendarEntry = useCallback((id, dateKey, value) => {
    calendarCol.update(id, (c) => {
      const nextEnt = { ...c.entries }
      if (!value.trim()) delete nextEnt[dateKey]
      else nextEnt[dateKey] = value
      return { entries: nextEnt }
    })
  }, [calendarCol])

  // Habits
  const updateHabitTitle = habitCol.updateTitle
  const updateHabitColor = habitCol.updateColor
  const toggleHabitMinimize = habitCol.toggleMinimize
  const duplicateHabitCard = habitCol.duplicate
  const archiveHabitCard = habitCol.archive
  const deleteHabitCard = habitCol.remove
  const updateHabitIcon = useCallback((id, v) => habitCol.update(id, { icon: normalizeHabitIconId(v) }), [habitCol])
  const setHabitView = useCallback((id, v) => habitCol.update(id, { view: v }), [habitCol])
  const changeHabitMonth = useCallback((id, delta) => habitCol.update(id, (c) => {
    const shifted = new Date(c.year, c.month + delta, 1)
    return { year: shifted.getFullYear(), month: shifted.getMonth() }
  }), [habitCol])
  const toggleHabitDate = useCallback((id, dateKey) => {
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
  }, [habitCol])

  // Pictures
  const updatePictureTitle = picCol.updateTitle
  const updatePictureColor = picCol.updateColor
  const togglePictureMinimize = picCol.toggleMinimize
  const duplicatePictureCard = picCol.duplicate
  const archivePictureCard = picCol.archive
  const updatePictureImageId = useCallback((id, imageId) => picCol.update(id, { imageId }), [picCol])
  const updatePictureDimensions = useCallback((id, width, height) => picCol.update(id, { width, height }), [picCol])
  const updatePictureFitMode = useCallback((id, fitMode) => picCol.update(id, { fitMode }), [picCol])
  const deletePictureCard = useCallback((id) => {
    let imageIdToDelete = null;
    picCol.setItems(prev => {
      const card = prev.find(t => t.id === id);
      if (card?.imageId) {
        // Check if other active picture cards share this imageId
        const isReferencedByActive = prev.some(c => c.id !== id && c.imageId === card.imageId);

        // Check if other archived cards share this imageId
        const isReferencedByArchived = archivedCards.some(a => a.type === 'picture' && a.data?.imageId === card.imageId);

        if (!isReferencedByActive && !isReferencedByArchived) {
          imageIdToDelete = card.imageId;
        }
      }
      return prev;
    });
    picCol.remove(id);
    if (imageIdToDelete) {
      deleteImageBlob(imageIdToDelete).catch(() => {});
    }
  }, [picCol, archivedCards])

  // Quick Links
  const updateQuickLinksTitle = qlCol.updateTitle
  const updateQuickLinksColor = qlCol.updateColor
  const toggleQuickLinksMinimize = qlCol.toggleMinimize
  const duplicateQuickLinksCard = qlCol.duplicate
  const archiveQuickLinksCard = qlCol.archive
  const deleteQuickLinksCard = qlCol.remove
  const addQuickLinkItem = useCallback((id, url, label) => {
    qlCol.update(id, (t) => ({
      links: [...(t.links || []), { id: `ql-item-${Date.now()}-${Math.floor(Math.random()*1000)}`, url, label }]
    }))
  }, [qlCol])
  const updateQuickLinkItem = useCallback((id, itemId, url, label) => {
    qlCol.update(id, (t) => ({
      links: (t.links || []).map(l => l.id === itemId ? { ...l, url, label } : l)
    }))
  }, [qlCol])
  const removeQuickLinkItem = useCallback((id, itemId) => {
    qlCol.update(id, (t) => ({
      links: (t.links || []).filter(l => l.id !== itemId)
    }))
  }, [qlCol])
  const reorderQuickLinkItems = useCallback((id, sourceIndex, destIndex) => {
    qlCol.update(id, (t) => {
      const links = [...(t.links || [])]
      const [removed] = links.splice(sourceIndex, 1)
      links.splice(destIndex, 0, removed)
      return { links }
    })
  }, [qlCol])

  // Quotes
  const updateQuoteTitle = quoteCol.updateTitle
  const updateQuoteColor = quoteCol.updateColor
  const toggleQuoteMinimize = quoteCol.toggleMinimize
  const duplicateQuoteCard = quoteCol.duplicate
  const archiveQuoteCard = quoteCol.archive
  const deleteQuoteCard = quoteCol.remove
  const updateQuoteText = useCallback((id, text) => quoteCol.update(id, { text }), [quoteCol])
  const updateQuoteAuthor = useCallback((id, author) => quoteCol.update(id, { author }), [quoteCol])
  const updateQuoteDimensions = useCallback((id, width, height) => quoteCol.update(id, { width, height }), [quoteCol])

  const readDragPayload = (event) => {
    const rawPayload = event.dataTransfer?.getData('text/plain')
    if (rawPayload) {
      try { const cur = JSON.parse(rawPayload); if (cur?.columnId && cur?.itemId) return cur } catch { /* ignore */ }
    }
    return null
  }

  const handleDragStartItem = useCallback((columnId, itemId, event) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify({ columnId, itemId }))
    setDragState({ columnId, itemId })
  }, [])
  const handleDragEndItem = useCallback(() => setDragState({ columnId: null, itemId: null }), [])
  const handleDragOverItem = useCallback((event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }, [])

  const handleDropOnItem = useCallback((columnId, targetItemId, event) => {
    event.preventDefault(); event.stopPropagation()
    const payload = readDragPayload(event)
    if (!payload || (payload.columnId === columnId && payload.itemId === targetItemId)) return

    setColumns((currentColumns) => {
      if (payload.columnId === columnId) {
        return currentColumns.map((col) => col.id === columnId ? { ...col, items: reorderListItems(col.items, payload.itemId, targetItemId) } : col)
      }
      const sourceCol = currentColumns.find((c) => c.id === payload.columnId)
      if (!sourceCol) return currentColumns
      const movedItem = sourceCol.items.find((item) => item.id === payload.itemId)
      if (!movedItem) return currentColumns

      return currentColumns.map((col) => {
        if (col.id === payload.columnId) return { ...col, items: col.items.filter(i => i.id !== payload.itemId) }
        if (col.id === columnId) {
          const targetIndex = col.items.findIndex((item) => item.id === targetItemId)
          const newItems = [...col.items]; newItems.splice(targetIndex < 0 ? newItems.length : targetIndex, 0, movedItem)
          return { ...col, items: newItems }
        }
        return col
      })
    })
    setDragState({ columnId: null, itemId: null })
  }, [setColumns])

  const handleDropOnList = useCallback((columnId, event) => {
    event.preventDefault()
    const payload = readDragPayload(event)
    if (!payload) return

    setColumns((currentColumns) => {
      if (payload.columnId !== columnId) {
        const sourceCol = currentColumns.find((c) => c.id === payload.columnId)
        if (!sourceCol) return currentColumns
        const movedItem = sourceCol.items.find((item) => item.id === payload.itemId)
        if (!movedItem) return currentColumns
        return currentColumns.map((col) => {
          if (col.id === payload.columnId) return { ...col, items: col.items.filter(i => i.id !== payload.itemId) }
          if (col.id === columnId) return { ...col, items: [...col.items, movedItem] }
          return col
        })
      }
      return currentColumns.map((col) => {
        if (col.id !== columnId) return col
        const currentIndex = col.items.findIndex(i => i.id === payload.itemId)
        if (currentIndex < 0 || currentIndex === col.items.length - 1) return col
        const nextItems = [...col.items]; const [moved] = nextItems.splice(currentIndex, 1); nextItems.push(moved)
        return { ...col, items: nextItems }
      })
    })
    setDragState({ columnId: null, itemId: null })
  }, [setColumns])

  const handleWheel = useCallback((event) => {
    event.preventDefault()
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!bounds) return
    const pointerX = event.clientX - bounds.left; const pointerY = event.clientY - bounds.top
    const zoomFactor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY)

    setViewport((v) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * zoomFactor))
      if (nextScale === v.scale) return v
      const contentX = (pointerX - v.x) / v.scale; const contentY = (pointerY - v.y) / v.scale
      return { scale: nextScale, x: pointerX - contentX * nextScale, y: pointerY - contentY * nextScale }
    })
  }, [workspaceRef])

  const startPanning = useCallback((event) => {
    if (window.innerWidth <= 1200) return
    if (event.button !== 2) return
    if (event.target.closest('.floating-card') || event.target.closest('.action-rail') || event.target.closest('.top-bar') || event.target.closest('.card-menu-wrap')) return
    event.preventDefault()
    panRef.current = { active: true, lastX: event.clientX, lastY: event.clientY }
    setIsPanning(true)
  }, [])

  const movePanning = useCallback((event) => {
    if (!panRef.current.active) return
    event.preventDefault()
    const deltaX = event.clientX - panRef.current.lastX; const deltaY = event.clientY - panRef.current.lastY
    panRef.current.lastX = event.clientX; panRef.current.lastY = event.clientY
    setViewport((v) => ({ ...v, x: v.x + deltaX, y: v.y + deltaY }))
  }, [])

  const endPanning = useCallback(() => {
    if (!panRef.current.active) return
    panRef.current.active = false
    setIsPanning(false)
  }, [])

  const focusLabelCard = useCallback((labelId) => {
    const workspace = workspaceRef.current; if (!workspace) return
    const workspaceBounds = workspace.getBoundingClientRect()
    const cardElement = workspace.querySelector(`[data-card-id="${labelId}"]`)
    if (cardElement) {
      const cardBounds = cardElement.getBoundingClientRect()
      const centerX = workspaceBounds.left + workspaceBounds.width / 2; const centerY = workspaceBounds.top + workspaceBounds.height / 2
      const cardCenterX = cardBounds.left + cardBounds.width / 2; const cardCenterY = cardBounds.top + cardBounds.height / 2
      setViewport(v => ({ ...v, x: v.x + (centerX - cardCenterX), y: v.y + (centerY - cardCenterY) }))
      return
    }
    const fallbackPosition = cardPositions[labelId]
    if (!fallbackPosition) return
    setViewport(v => ({
      ...v,
      x: workspaceBounds.width / 2 - fallbackPosition.x * v.scale,
      y: workspaceBounds.height / 2 - fallbackPosition.y * v.scale
    }))
  }, [workspaceRef, cardPositions])

  const handleAddLabel = useCallback((pos) => {
    const id = `label-${Date.now()}`; const roles = ['routine', 'programming', 'english']
    setCustomLabels(p => [...p, { id, text: '', role: roles[Math.floor(Math.random() * roles.length)] }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 400 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport, setCustomLabels])
  const handleAddNote = useCallback((pos) => {
    const id = `note-${Date.now()}`
    setNotes(p => [...p, { id, text: '', title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 350 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport, setNotes])
  const handleAddTodoList = useCallback((pos) => {
    const id = `col-${Date.now()}`; const tones = ['charcoal', 'gold', 'violet', 'red', 'blue']
    setColumns(p => [...p, { id, tone: tones[Math.floor(Math.random() * tones.length)], positionClass: '', items: [], title: '', color: null, minimized: false }])
    setDrafts(p => ({ ...p, [id]: '' }))
    setCardPositions(p => ({ ...p, [id]: pos || { x: 400 - (viewport.x / viewport.scale), y: 200 - (viewport.y / viewport.scale) } }))
  }, [viewport, setColumns])
  const handleAddTimer = useCallback((pos) => {
    const id = `timer-${Date.now()}`; setTimers(p => [...p, { id, initialSeconds: 2700, remainingSeconds: 2700, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 600 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport, setTimers])
  const handleAddCounter = useCallback((pos) => {
    const id = `counter-${Date.now()}`; setCounters(p => [...p, { id, initialValue: 0, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 960 - (viewport.x / viewport.scale), y: 260 - (viewport.y / viewport.scale) } }))
  }, [viewport, setCounters])
  const handleAddStopwatch = useCallback((pos) => {
    const id = `stopwatch-${Date.now()}`; setStopwatches(p => [...p, { id, initialSeconds: 0, elapsedSeconds: 0, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 1240 - (viewport.x / viewport.scale), y: 260 - (viewport.y / viewport.scale) } }))
  }, [viewport, setStopwatches])
  const handleAddCalendar = useCallback((pos) => {
    const id = `calendar-${Date.now()}`; const now = new Date()
    setCalendars(p => [...p, { id, year: now.getFullYear(), month: now.getMonth(), selectedDate: null, entries: {}, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 1500 - (viewport.x / viewport.scale), y: 120 - (viewport.y / viewport.scale) } }))
  }, [viewport, setCalendars])
  const handleAddHabit = useCallback((pos) => {
    const id = `habit-${Date.now()}`; const now = new Date()
    setHabits(p => [...p, { id, icon: HABIT_ICON_OPTIONS[0].id, year: now.getFullYear(), month: now.getMonth(), view: 'summary', completions: {}, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 1700 - (viewport.x / viewport.scale), y: 120 - (viewport.y / viewport.scale) } }))
  }, [viewport, setHabits])
  const handleAddPicture = useCallback((pos) => {
    const id = `picture-${Date.now()}`
    setPictures(p => [...p, { id, imageId: null, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 500 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport, setPictures])
  const handleAddQuickLinks = useCallback((pos) => {
    const id = `quick-links-${Date.now()}`
    setQuickLinks(p => [...p, { id, links: [], title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 1000 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport, setQuickLinks])
  const handleAddQuote = useCallback((pos) => {
    const id = `quote-${Date.now()}`
    setQuotes(p => [...p, { id, text: '', author: '', title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: pos || { x: 450 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport, setQuotes])

  const handleQuickAction = useCallback((actionId, event, canvasPos) => {
    let pos = canvasPos || null
    if (!pos && event && event.clientX !== undefined) {
      const bounds = workspaceRef.current?.getBoundingClientRect()
      if (bounds) {
        pos = {
          x: (event.clientX - bounds.left - viewport.x) / viewport.scale,
          y: (event.clientY - bounds.top - viewport.y) / viewport.scale
        }
      }
    }
    if (actionId === 'label') handleAddLabel(pos)
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
  }, [viewport, workspaceRef, handleAddLabel, handleAddNote, handleAddTodoList, handleAddCounter, handleAddTimer, handleAddStopwatch, handleAddCalendar, handleAddHabit, handleAddPicture, handleAddQuickLinks, handleAddQuote])

  // Long-press callbacks
  const startLongPress = useCallback((event) => {
    if (event.button !== 1 && event.pointerType !== 'touch') return
    // Only trigger on empty canvas (not on cards)
    if (event.target !== event.currentTarget && !event.target.classList.contains('board-stage') && !event.target.classList.contains('board')) return
    const x = event.clientX
    const y = event.clientY
    longPressStartRef.current = { x, y }
    setLongPressPos({ x, y })
    setIsLongPressHolding(true)
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      const bounds = workspaceRef.current?.getBoundingClientRect()
      if (bounds) {
        const canvasX = (x - bounds.left - viewport.x) / viewport.scale
        const canvasY = (y - bounds.top - viewport.y) / viewport.scale
        setLongPressMenu({ visible: true, x, y, canvasX, canvasY })
      }
      setIsLongPressHolding(false)
    }, 650)
  }, [viewport, workspaceRef])

  const moveLongPress = useCallback((event) => {
    if (!isLongPressHolding) return
    const dx = event.clientX - longPressStartRef.current.x
    const dy = event.clientY - longPressStartRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      clearTimeout(longPressTimerRef.current)
      setIsLongPressHolding(false)
    }
  }, [isLongPressHolding])

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
    setIsLongPressHolding(false)
  }, [])

  const closeLongPressMenu = useCallback(() => {
    setLongPressMenu(prev => ({ ...prev, visible: false }))
  }, [])


  return {
    state: {
      columns, drafts, viewport, isPanning, isRailOpen, isFocusMode, themeMode, theme,
      dragState, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks, quotes,
      archivedCards, detachedLabels, cardPositions, draggingCard, poppingCardIds, toastMessage,
      longPressMenu, isLongPressHolding, longPressPos
    },
    setters: {
      setThemeMode, setIsFocusMode, setIsRailOpen
    },
    actions: {
      setDraft, addItem, updateItemText, updateItemDetails, deleteItem,
      handleDragStartItem, handleDragEndItem, handleDragOverItem, handleDropOnItem, handleDropOnList,
      handleCardPointerDown, handleWheel, startPanning, movePanning, endPanning,
      handleQuickAction, focusLabelCard, restoreArchivedCard, moveCardToTarget,
      handleUndo, handleRedo, startLongPress, moveLongPress, cancelLongPress, closeLongPressMenu,
      updateTodoCardTitle, updateTodoCardColor, toggleTodoCardMinimize, duplicateTodoCard, archiveTodoCard, deleteTodoCard,
      updateLabelText, updateLabelColor, toggleLabelMinimize, duplicateLabelCard, archiveLabelCard, deleteLabelCard,
      updateNoteTitle, updateNoteText, updateNoteColor, toggleNoteMinimize, updateNoteDimensions, duplicateNoteCard, archiveNoteCard, deleteNoteCard,
      updateTimerTitle, updateTimerColor, toggleTimerMinimize, updateTimerState, duplicateTimerCard, archiveTimerCard, deleteTimerCard,
      updateCounterTitle, updateCounterValue, updateCounterColor, toggleCounterMinimize, duplicateCounterCard, archiveCounterCard, deleteCounterCard,
      updateStopwatchTitle, updateStopwatchColor, updateStopwatchState, toggleStopwatchMinimize, duplicateStopwatchCard, archiveStopwatchCard, deleteStopwatchCard,
      updateCalendarTitle, updateCalendarColor, toggleCalendarMinimize, changeCalendarMonth, openCalendarDay, closeCalendarDay, updateCalendarEntry, duplicateCalendarCard, archiveCalendarCard, deleteCalendarCard,
      updateHabitTitle, updateHabitIcon, updateHabitColor, toggleHabitMinimize, setHabitView, changeHabitMonth, toggleHabitDate, duplicateHabitCard, archiveHabitCard, deleteHabitCard,
      updatePictureTitle, updatePictureColor, togglePictureMinimize, updatePictureImageId, updatePictureDimensions, updatePictureFitMode, duplicatePictureCard, archivePictureCard, deletePictureCard,
      updateQuickLinksTitle, updateQuickLinksColor, toggleQuickLinksMinimize, addQuickLinkItem, updateQuickLinkItem, removeQuickLinkItem, reorderQuickLinkItems, duplicateQuickLinksCard, archiveQuickLinksCard, deleteQuickLinksCard,
      updateQuoteTitle, updateQuoteText, updateQuoteAuthor, updateQuoteColor, toggleQuoteMinimize, updateQuoteDimensions, duplicateQuoteCard, archiveQuoteCard, deleteQuoteCard
    }
  }
}
