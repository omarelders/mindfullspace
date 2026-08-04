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
import { parseImportedCards, isImportReload, clearImportReloadFlag } from '../utils/backup'
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

const supportsNativeZoom = 'zoom' in document.createElement('div').style

export function useWorkspace(workspaceId, workspaceRef) {
  const initialWorkspaceState = useMemo(() => getInitialWorkspaceState(workspaceId), [workspaceId])
  const [drafts, setDrafts] = useState(() => initialWorkspaceState.drafts)
  const [viewport, setViewport] = useState(() => initialWorkspaceState.viewport)
  const [wheelMode, setWheelMode] = useState('zoom')
  const lastMiddleClickRef = useRef(0)
  const lastShiftPressRef = useRef(0)
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
  // Ref-based drag state for zero-React-overhead pointer moves
  const draggingCardRef = useRef(null)
  // Ref-based viewport for zero-React-overhead panning
  const viewportRef = useRef(initialWorkspaceState.viewport)
  // rAF handle for drag
  const dragRafRef = useRef(null)
  // rAF handle for pan
  const panRafRef = useRef(null)

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

  const singleNoteCol = useCardCollection({
    initialItems: initialWorkspaceState.singleNotes,
    idPrefix: 'singlenote',
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

  // Refs that always hold current state for snapshot capture
  const stateRefsForSnapshot = useRef({})

  useEffect(() => {
    stateRefsForSnapshot.current = {
      columns, drafts, viewport, themeMode, notes, timers, counters,
      stopwatches, calendars, habits, pictures, quickLinks, quotes, archivedCards, customLabels, singleNotes, cardPositions
    }
  }, [columns, drafts, viewport, themeMode, notes, timers, counters,
      stopwatches, calendars, habits, pictures, quickLinks, quotes, archivedCards, customLabels, singleNotes, cardPositions])

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
      singleNotes: s.singleNotes,
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
    if (snapshot.singleNotes) setSingleNotes(snapshot.singleNotes)
    setCardPositions(snapshot.cardPositions)
  }, [setColumns, setDrafts, setViewport, setThemeMode, setNotes, setTimers, setCounters, setStopwatches, setCalendars, setHabits, setPictures, setQuickLinks, setQuotes, setArchivedCards, setCustomLabels, setSingleNotes, setCardPositions])

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
    [columns, detachedLabels, singleNotes, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks, quotes],
  )

  const workspaceStorageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`

  useEffect(() => {
    if (isPanning || draggingCard) return undefined
    let idleId = null
    const timerId = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => {
          writeJsonStorage(workspaceStorageKey, captureSnapshot())
        }, { timeout: 2000 })
      } else {
        writeJsonStorage(workspaceStorageKey, captureSnapshot())
      }
    }, 1000)

    return () => {
      window.clearTimeout(timerId)
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [workspaceStorageKey, isPanning, draggingCard, columns, drafts, viewport, themeMode, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks, quotes, archivedCards, customLabels, singleNotes, cardPositions, captureSnapshot])

  // Ensure state is saved immediately on beforeunload or visibilitychange.
  // IMPORTANT: if an import just wrote data to localStorage and is about to
  // trigger a page reload, we must NOT overwrite that data with stale React
  // state. The importWorkspace helper sets a sessionStorage sentinel for this.
  useEffect(() => {
    // Clear the import flag on mount so future saves are allowed
    clearImportReloadFlag()
  }, [])

  useEffect(() => {
    const handleSave = () => {
      if (isImportReload()) {
        // An import wrote fresh data and is reloading — skip the autosave so
        // we don't clobber the import.
        return
      }
      writeJsonStorage(workspaceStorageKey, captureSnapshot())
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
  }, [workspaceStorageKey, captureSnapshot])

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

  // Keep viewportRef in sync with viewport React state
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    if (!draggingCard) return
    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    window.getSelection()?.removeAllRanges()

    // Store drag start info in ref so the pointermove handler is stable
    draggingCardRef.current = draggingCard

    // Find the dragging card's DOM element
    const cardEl = workspaceRef.current?.querySelector(`[data-card-id="${draggingCard.id}"]`)

    const handlePointerMove = (e) => {
      const dc = draggingCardRef.current
      if (!dc) return
      if (dc.pointerId !== undefined && e.pointerId !== dc.pointerId) return
      const scale = viewportRef.current.scale || 1
      const dx = (e.clientX - dc.startX) / scale
      const dy = (e.clientY - dc.startY) / scale
      const nextX = dc.initialX + dx
      const nextY = dc.initialY + dy
      // Apply directly to DOM via rAF — no React state update during motion
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = requestAnimationFrame(() => {
        if (cardEl) {
          cardEl.style.left = nextX + 'px'
          cardEl.style.top = nextY + 'px'
        }
        // Keep a lightweight pending position so we can commit on pointerup
        draggingCardRef.current._pendingX = nextX
        draggingCardRef.current._pendingY = nextY
      })
    }
    const handlePointerUp = (e) => {
      if (draggingCardRef.current?.pointerId !== undefined && e.pointerId !== draggingCardRef.current?.pointerId) return
      const dc = draggingCardRef.current
      if (dc && dc._pendingX !== undefined) {
        // Commit final position to React state only once, on release
        setCardPositions(prev => ({
          ...prev,
          [dc.id]: { x: dc._pendingX, y: dc._pendingY }
        }))
      }
      draggingCardRef.current = null
      setDraggingCard(null)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      document.body.style.userSelect = previousUserSelect
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [draggingCard, workspaceRef])

  // Stable handleCardPointerDown via ref — never creates new function reference,
  // so it won't defeat React.memo on card components
  const cardPositionsRef = useRef(cardPositions)
  useEffect(() => { cardPositionsRef.current = cardPositions }, [cardPositions])

  const handleCardPointerDown = useCallback((cardId, e) => {
    if (window.innerWidth <= 1200) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (!e.target.closest('.card-header') && !e.target.closest('.label-drag-handle') && !e.target.closest('.stopwatch-drag-handle')) return
    if (e.target.closest('.card-menu-wrap')) return
    const cardPosition = cardPositionsRef.current[cardId]
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
  }, [])

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

  // Double-Shift toggle wheel mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      const tag = document.activeElement?.tagName?.toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable
      if (isEditable) return

      if (e.key === 'Shift') {
        const now = Date.now()
        if (now - lastShiftPressRef.current < 400) {
          setWheelMode(mode => {
            const nextMode = mode === 'zoom' ? 'pan' : 'zoom'
            showToast(`Scroll mode switched to ${nextMode === 'zoom' ? 'Zoom' : 'Pan'}`)
            return nextMode
          })
          lastShiftPressRef.current = 0
        } else {
          lastShiftPressRef.current = now
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showToast])

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
    } else if (archivedEntry.type === 'singlenote') {
      restoredCardId = `singlenote-${uniqueSeed}`
      setSingleNotes(current => [...current, { ...archivedData, id: restoredCardId, text: archivedData.text || 'Single Note' }])
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
  const updateLabelFontSize = useCallback((id, fontSize) => labelCol.update(id, { fontSize }), [labelCol])
  const toggleLabelMinimize = labelCol.toggleMinimize
  const duplicateLabelCard = labelCol.duplicate
  const archiveLabelCard = labelCol.archive
  const deleteLabelCard = labelCol.remove

  // Single Notes
  const updateSingleNoteText = useCallback((id, text) => singleNoteCol.update(id, { text }), [singleNoteCol])
  const updateSingleNoteColor = useCallback((id, color) => singleNoteCol.update(id, { color }), [singleNoteCol])
  const updateSingleNoteFontSize = useCallback((id, fontSize) => singleNoteCol.update(id, { fontSize }), [singleNoteCol])
  const updateSingleNoteShape = useCallback((id, shape) => singleNoteCol.update(id, { shape }), [singleNoteCol])
  const toggleSingleNoteMinimize = singleNoteCol.toggleMinimize
  const duplicateSingleNoteCard = singleNoteCol.duplicate
  const archiveSingleNoteCard = singleNoteCol.archive
  const deleteSingleNoteCard = singleNoteCol.remove

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
  const updateTodoCardFontSize = useCallback((id, fontSize) => colCol.update(id, { fontSize }), [colCol])
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
  const updateNoteFontSize = useCallback((id, fontSize) => noteCol.update(id, { fontSize }), [noteCol])

  // Timers
  const updateTimerTitle = timerCol.updateTitle
  const updateTimerColor = timerCol.updateColor
  const toggleTimerMinimize = timerCol.toggleMinimize
  const duplicateTimerCard = timerCol.duplicate
  const archiveTimerCard = timerCol.archive
  const deleteTimerCard = timerCol.remove
  const updateTimerState = useCallback((id, patch) => timerCol.update(id, patch), [timerCol])
  const updateTimerFontSize = useCallback((id, fontSize) => timerCol.update(id, { fontSize }), [timerCol])

  // Counters
  const updateCounterTitle = counterCol.updateTitle
  const updateCounterColor = counterCol.updateColor
  const toggleCounterMinimize = counterCol.toggleMinimize
  const duplicateCounterCard = counterCol.duplicate
  const archiveCounterCard = counterCol.archive
  const deleteCounterCard = counterCol.remove
  const updateCounterValue = useCallback((id, v) => counterCol.update(id, { initialValue: v }), [counterCol])
  const updateCounterFontSize = useCallback((id, fontSize) => counterCol.update(id, { fontSize }), [counterCol])

  // Stopwatches
  const updateStopwatchTitle = stopwatchCol.updateTitle
  const updateStopwatchColor = stopwatchCol.updateColor
  const toggleStopwatchMinimize = stopwatchCol.toggleMinimize
  const duplicateStopwatchCard = stopwatchCol.duplicate
  const archiveStopwatchCard = stopwatchCol.archive
  const deleteStopwatchCard = stopwatchCol.remove
  const updateStopwatchState = useCallback((id, patch) => stopwatchCol.update(id, patch), [stopwatchCol])
  const updateStopwatchFontSize = useCallback((id, fontSize) => stopwatchCol.update(id, { fontSize }), [stopwatchCol])

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
  const updateCalendarFontSize = useCallback((id, fontSize) => calendarCol.update(id, { fontSize }), [calendarCol])

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
  const updateHabitFontSize = useCallback((id, fontSize) => habitCol.update(id, { fontSize }), [habitCol])

  // Pictures
  const updatePictureTitle = picCol.updateTitle
  const updatePictureColor = picCol.updateColor
  const togglePictureMinimize = picCol.toggleMinimize
  const duplicatePictureCard = picCol.duplicate
  const archivePictureCard = picCol.archive
  const updatePictureImageId = useCallback((id, imageId) => picCol.update(id, { imageId }), [picCol])
  const updatePictureDimensions = useCallback((id, width, height) => picCol.update(id, { width, height }), [picCol])
  const updatePictureFitMode = useCallback((id, fitMode) => picCol.update(id, { fitMode }), [picCol])
  const updatePictureFontSize = useCallback((id, fontSize) => picCol.update(id, { fontSize }), [picCol])
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
  const updateQuickLinksFontSize = useCallback((id, fontSize) => qlCol.update(id, { fontSize }), [qlCol])

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
  const updateQuoteFontSize = useCallback((id, fontSize) => quoteCol.update(id, { fontSize }), [quoteCol])

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

    const isMouseWheel = event.deltaMode !== 0
    const isPinch = event.ctrlKey || event.metaKey

    if (isPinch || wheelMode === 'zoom') {
      const pointerX = event.clientX - bounds.left; const pointerY = event.clientY - bounds.top
      
      // Use original sensitivity for mouse wheel, use 3x for trackpad pinch
      const sensitivity = isPinch && !isMouseWheel ? (ZOOM_SENSITIVITY * 3.0) : ZOOM_SENSITIVITY
      const zoomFactor = Math.exp(-event.deltaY * sensitivity)
  
      setViewport((v) => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * zoomFactor))
        if (nextScale === v.scale) return v
        const contentX = (pointerX - v.x) / v.scale; const contentY = (pointerY - v.y) / v.scale
        return { scale: nextScale, x: pointerX - contentX * nextScale, y: pointerY - contentY * nextScale }
      })
    } else {
      // Pan mode
      const panSpeed = isMouseWheel ? 40 : 1; // Adjust speed for mouse wheel panning
      setViewport((v) => ({
        ...v,
        x: v.x - (event.deltaX * panSpeed),
        y: v.y - (event.deltaY * panSpeed)
      }))
    }
  }, [workspaceRef, wheelMode])

  const startPanning = useCallback((event) => {
    if (window.innerWidth <= 1200) return
    if (event.button !== 2) return
    if (event.target.closest('.action-rail') || event.target.closest('.top-bar') || event.target.closest('.card-menu-wrap')) return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {}
    panRef.current = { active: true, lastX: event.clientX, lastY: event.clientY }
    setIsPanning(true)
  }, [])

  const handleMiddleClick = useCallback((event) => {
    if (event.button !== 1) return // Middle button
    event.preventDefault()
    const now = Date.now()
    if (now - lastMiddleClickRef.current < 400) {
      setWheelMode(mode => {
        const nextMode = mode === 'zoom' ? 'pan' : 'zoom'
        showToast(`Scroll mode switched to ${nextMode === 'zoom' ? 'Zoom' : 'Pan'}`)
        return nextMode
      })
      lastMiddleClickRef.current = 0
    } else {
      lastMiddleClickRef.current = now
    }
  }, [showToast])

  const movePanning = useCallback((event) => {
    if (!panRef.current.active) return
    event.preventDefault()
    const deltaX = event.clientX - panRef.current.lastX
    const deltaY = event.clientY - panRef.current.lastY
    panRef.current.lastX = event.clientX
    panRef.current.lastY = event.clientY
    // Update ref immediately for downstream calculations
    const v = viewportRef.current
    const nextViewport = { ...v, x: v.x + deltaX, y: v.y + deltaY }
    viewportRef.current = nextViewport
    // Apply to DOM via rAF — no React state update during motion
    if (panRafRef.current) cancelAnimationFrame(panRafRef.current)
    panRafRef.current = requestAnimationFrame(() => {
      const boardStage = workspaceRef.current?.querySelector('.board-stage')
      if (boardStage) {
        const vr = viewportRef.current
        if (supportsNativeZoom) {
          boardStage.style.left = (vr.x / vr.scale) + 'px'
          boardStage.style.top = (vr.y / vr.scale) + 'px'
        } else {
          boardStage.style.transform = `translate(${vr.x}px, ${vr.y}px) scale(${vr.scale})`
        }
      }
    })
  }, [workspaceRef])

  const endPanning = useCallback((event) => {
    if (!panRef.current.active) return
    panRef.current.active = false
    setIsPanning(false)
    if (panRafRef.current) cancelAnimationFrame(panRafRef.current)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {}
    // Commit final viewport to React state once on release
    setViewport(viewportRef.current)
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

  const handleAddSingleNote = useCallback((pos) => {
    const id = `singlenote-${Date.now()}`
    const vx = viewport.x / viewport.scale; const vy = viewport.y / viewport.scale
    setCardPositions((prev) => ({ ...prev, [id]: pos || { x: 450 - vx, y: 350 - vy } }))
    setSingleNotes(prev => [...prev, { id, text: 'Single Note', shape: 'rectangle' }])
    saveSnapshot()
  }, [setSingleNotes, saveSnapshot, setCardPositions, viewport])
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
  }, [viewport, workspaceRef, handleAddLabel, handleAddSingleNote, handleAddNote, handleAddTodoList, handleAddCounter, handleAddTimer, handleAddStopwatch, handleAddCalendar, handleAddHabit, handleAddPicture, handleAddQuickLinks, handleAddQuote, handleAddSingleNote])

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

  const importCardsFromJson = useCallback(async (file) => {
    try {
      const rawWorkspace = await parseImportedCards(file)
      
      const batchSeed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
      const newPositions = {}
      const newDrafts = {}
      let totalImported = 0

      const vx = viewport.x / (viewport.scale || 1)
      const vy = viewport.y / (viewport.scale || 1)

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
          importedQuickLinks.push({ ...card, links: card.links || [], title: card.title || '', minimized: false })
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

      if (importedColumns.length > 0) setColumns(c => [...c, ...importedColumns])
      if (importedLabels.length > 0) setCustomLabels(c => [...c, ...importedLabels])
      if (importedNotes.length > 0) setNotes(c => [...c, ...importedNotes])
      if (importedSingleNotes.length > 0) setSingleNotes(c => [...c, ...importedSingleNotes])
      if (importedTimers.length > 0) setTimers(c => [...c, ...importedTimers])
      if (importedCounters.length > 0) setCounters(c => [...c, ...importedCounters])
      if (importedStopwatches.length > 0) setStopwatches(c => [...c, ...importedStopwatches])
      if (importedCalendars.length > 0) setCalendars(c => [...c, ...importedCalendars])
      if (importedHabits.length > 0) setHabits(c => [...c, ...importedHabits])
      if (importedPictures.length > 0) setPictures(c => [...c, ...importedPictures])
      if (importedQuickLinks.length > 0) setQuickLinks(c => [...c, ...importedQuickLinks])
      if (importedQuotes.length > 0) setQuotes(c => [...c, ...importedQuotes])

      setCardPositions(prev => ({ ...prev, ...newPositions }))
      setDrafts(prev => ({ ...prev, ...newDrafts }))

      showToast(`Successfully imported ${totalImported} card${totalImported === 1 ? '' : 's'}!`)
    } catch (err) {
      showToast(err.message || 'Failed to import cards.')
    }
  }, [viewport, showToast, saveSnapshot, setColumns, setCustomLabels, setNotes, setSingleNotes, setTimers, setCounters, setStopwatches, setCalendars, setHabits, setPictures, setQuickLinks, setQuotes, setCardPositions, setDrafts])


  return {
    state: {
      columns, drafts, viewport, isPanning, isRailOpen, isFocusMode, themeMode, theme,
      dragState, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks, quotes,
      archivedCards, detachedLabels, singleNotes, cardPositions, draggingCard, poppingCardIds, toastMessage,
      longPressMenu, isLongPressHolding, longPressPos
    },
    setters: {
      setThemeMode, setIsFocusMode, setIsRailOpen
    },
    actions: {
      setDraft, addItem, updateItemText, updateItemDetails, deleteItem,
      handleDragStartItem, handleDragEndItem, handleDragOverItem, handleDropOnItem, handleDropOnList,
      handleCardPointerDown, handleWheel, startPanning, movePanning, endPanning, handleMiddleClick,
      handleQuickAction, focusLabelCard, restoreArchivedCard, moveCardToTarget,
      handleUndo, handleRedo, startLongPress, moveLongPress, cancelLongPress, closeLongPressMenu,
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
      captureSnapshot
    }
  }
}
