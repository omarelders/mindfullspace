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
  const [pictures, setPictures] = useState(() => initialWorkspaceState.pictures || [])
  const [quickLinks, setQuickLinks] = useState(() => initialWorkspaceState.quickLinks || [])
  const [archivedCards, setArchivedCards] = useState(() => initialWorkspaceState.archivedCards)
  const [customLabels, setCustomLabels] = useState(() => initialWorkspaceState.customLabels)
  const [cardPositions, setCardPositions] = useState(() => initialWorkspaceState.cardPositions)
  const [draggingCard, setDraggingCard] = useState(null)
  const [poppingCardIds, setPoppingCardIds] = useState(() => new Set())
  const [toastMessage, setToastMessage] = useState(null)
  const hasInitializedCardTrackingRef = useRef(false)
  const previousCardIdsRef = useRef(new Set())
  const popCleanupTimeoutsRef = useRef(new Map())
  const panRef = useRef({ active: false, lastX: 0, lastY: 0 })
  const toastTimerRef = useRef(null)

  const { pushSnapshot, undo, redo } = useUndoRedo()

  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMessage(msg)
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000)
  }, [])

  // Refs that always hold current state for snapshot capture
  const stateRefsForSnapshot = useRef({})
  stateRefsForSnapshot.current = {
    columns, drafts, viewport, themeMode, notes, timers, counters,
    stopwatches, calendars, habits, pictures, quickLinks, archivedCards, customLabels, cardPositions
  }

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
    setArchivedCards(snapshot.archivedCards)
    setCustomLabels(snapshot.customLabels)
    setCardPositions(snapshot.cardPositions)
  }, [])

  const saveSnapshot = useCallback(() => {
    pushSnapshot(captureSnapshot())
  }, [pushSnapshot, captureSnapshot])

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
    ],
    [columns, detachedLabels, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks],
  )

  const workspaceStorageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`
  const workspaceStorageSnapshot = useMemo(
    () => ({
      columns, drafts, viewport, themeMode, notes, timers, counters,
      stopwatches, calendars, habits, pictures, quickLinks, archivedCards, customLabels, cardPositions,
    }),
    [columns, drafts, viewport, themeMode, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks, archivedCards, customLabels, cardPositions]
  )

  useEffect(() => {
    if (isPanning || draggingCard) return undefined
    const persistTimeoutId = window.setTimeout(() => writeJsonStorage(workspaceStorageKey, workspaceStorageSnapshot), 500)
    return () => window.clearTimeout(persistTimeoutId)
  }, [workspaceStorageKey, workspaceStorageSnapshot, isPanning, draggingCard])

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
        [draggingCard.id]: { x: draggingCard.initialX + dx, y: draggingCard.initialY + dy }
      }))
    }
    const handleMouseUp = () => setDraggingCard(null)
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
    setDraggingCard({ id: cardId, startX: e.clientX, startY: e.clientY, initialX: cardPosition.x, initialY: cardPosition.y })
  }

  useEffect(() => {
    const stopPanning = () => {
      if (!panRef.current.active) return
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
  }, [viewport, showToast])

  // Ctrl+V clipboard paste → Picture Card
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

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (blob) handlePasteImage(blob)
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePasteImage])

  const setDraft = useCallback((columnId, value) => setDrafts(prev => ({ ...prev, [columnId]: value })), [])

  const addItem = useCallback((columnId) => {
    setDrafts((currentDrafts) => {
      const text = currentDrafts[columnId]?.trim()
      if (!text) return currentDrafts
      setColumns((currentColumns) => currentColumns.map((column) => {
        if (column.id !== columnId) return column
        return {
          ...column,
          items: [...column.items, { id: `${columnId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`, text, completed: false }],
        }
      }))
      return { ...currentDrafts, [columnId]: '' }
    })
  }, [])

  const deleteItem = useCallback((columnId, itemId) => {
    setColumns(current => current.map(col => col.id === columnId ? { ...col, items: col.items.filter(i => i.id !== itemId) } : col))
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

  const archiveCardSnapshot = (cardType, cardData) => {
    const archivedPosition = cardData?.id && cardPositions[cardData.id] ? { ...cardPositions[cardData.id] } : null
    setArchivedCards(current => [...current, { id: `${cardType}-${Date.now()}`, type: cardType, archivedAt: Date.now(), data: cardData, position: archivedPosition }])
  }

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

  const generatorForToggleMinimize = (setter) => (id) => {
    setter(prev => prev.map(item => item.id === id ? { ...item, minimized: !item.minimized } : item))
  }

  // Cards generic CRUD methods
  // Labels
  const updateLabelText = useCallback((id, text) => setCustomLabels(p => p.map(l => l.id === id ? { ...l, text: text.toUpperCase() } : l)), [])
  const updateLabelColor = useCallback((id, color) => setCustomLabels(p => p.map(l => l.id === id ? { ...l, customColor: color } : l)), [])
  const toggleLabelMinimize = useCallback(generatorForToggleMinimize(setCustomLabels), [])
  const duplicateLabelCard = useCallback((id) => {
    setCustomLabels(prev => {
      const source = prev.find(l => l.id === id); if (!source) return prev
      const dupId = `label-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId }]
    })
  }, [])
  const archiveLabelCard = useCallback((id) => {
    saveSnapshot()
    setCustomLabels(prev => {
      const source = prev.find(l => l.id === id); if (source) archiveCardSnapshot('label', source); return prev.filter(l => l.id !== id)
    })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deleteLabelCard = useCallback((id) => {
    saveSnapshot()
    setCustomLabels(prev => prev.filter(l => l.id !== id)); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

  // Todos
  const updateTodoCardTitle = useCallback((id, title) => setColumns(prev => prev.map(c => c.id === id ? { ...c, title } : c)), [])
  const updateTodoCardColor = useCallback((id, color) => setColumns(prev => prev.map(c => c.id === id ? { ...c, color } : c)), [])
  const toggleTodoCardMinimize = useCallback(generatorForToggleMinimize(setColumns), [])
  const updateItemDetails = useCallback((colId, itemId, details) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...details } : i) } : c))
  }, [])
  const updateItemText = useCallback((colId, itemId, text) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, text } : i) } : c))
  }, [])
  const duplicateTodoCard = useCallback((id) => {
    setColumns(prev => {
      const source = prev.find(c => c.id === id); if (!source) return prev
      const dupId = `col-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      setDrafts(d => ({ ...d, [dupId]: d[id] || '' }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false, items: source.items.map((i, idx) => ({ ...i, id: `${dupId}-item-${idx}-${Date.now()}` })) }]
    })
  }, [])
  const archiveTodoCard = useCallback((id) => {
    saveSnapshot()
    setColumns(prev => { const src = prev.find(c => c.id === id); if (src) archiveCardSnapshot('todo', src); return prev.filter(c => c.id !== id) });
    clearCardDraft(id); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c); setDragState(d => d.columnId === id ? { columnId: null, itemId: null } : d)
  }, [clearCardDraft, removeCardPosition, saveSnapshot])
  const deleteTodoCard = useCallback((id) => {
    saveSnapshot()
    setColumns(prev => prev.filter(c => c.id !== id)); clearCardDraft(id); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c); setDragState(d => d.columnId === id ? { columnId: null, itemId: null } : d)
  }, [clearCardDraft, removeCardPosition, saveSnapshot])

  // Notes
  const updateNoteTitle = useCallback((id, title) => setNotes(prev => prev.map(n => n.id === id ? { ...n, title } : n)), [])
  const updateNoteText = useCallback((id, text) => setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n)), [])
  const updateNoteColor = useCallback((id, color) => setNotes(prev => prev.map(n => n.id === id ? { ...n, color } : n)), [])
  const toggleNoteMinimize = useCallback(generatorForToggleMinimize(setNotes), [])
  const duplicateNoteCard = useCallback((id) => {
    setNotes(prev => {
      const source = prev.find(n => n.id === id); if (!source) return prev
      const dupId = `note-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }]
    })
  }, [])
  const archiveNoteCard = useCallback((id) => {
    saveSnapshot()
    setNotes(prev => { const src = prev.find(n => n.id === id); if (src) archiveCardSnapshot('note', src); return prev.filter(n => n.id !== id) })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deleteNoteCard = useCallback((id) => {
    saveSnapshot()
    setNotes(prev => prev.filter(n => n.id !== id)); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

  // Timers
  const updateTimerTitle = useCallback((id, v) => setTimers(p => p.map(t => t.id === id ? { ...t, title: v } : t)), [])
  const updateTimerColor = useCallback((id, v) => setTimers(p => p.map(t => t.id === id ? { ...t, color: v } : t)), [])
  const toggleTimerMinimize = useCallback(generatorForToggleMinimize(setTimers), [])
  const updateTimerRemainingSeconds = useCallback((id, sec) => setTimers(p => p.map(t => t.id === id ? { ...t, remainingSeconds: Math.max(0, Math.floor(sec || 0)) } : t)), [])
  const updateTimerInitialSeconds = useCallback((id, sec) => {
    const s = Math.max(0, Math.floor(sec || 0))
    setTimers(p => p.map(t => t.id === id ? { ...t, initialSeconds: s, remainingSeconds: s } : t))
  }, [])
  const updatePomodoroConfig = useCallback((id, fields) => setTimers(p => p.map(t => t.id === id ? { ...t, ...fields } : t)), [])
  const duplicateTimerCard = useCallback((id) => {
    setTimers(prev => {
      const source = prev.find(t => t.id === id); if (!source) return prev
      const dupId = `timer-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }]
    })
  }, [])
  const archiveTimerCard = useCallback((id) => {
    saveSnapshot()
    setTimers(prev => { const src = prev.find(t => t.id === id); if (src) archiveCardSnapshot('timer', src); return prev.filter(t => t.id !== id) })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deleteTimerCard = useCallback((id) => {
    saveSnapshot()
    setTimers(prev => prev.filter(t => t.id !== id)); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

  // Counters
  const updateCounterTitle = useCallback((id, v) => setCounters(p => p.map(t => t.id === id ? { ...t, title: v } : t)), [])
  const updateCounterValue = useCallback((id, v) => setCounters(p => p.map(t => t.id === id ? { ...t, initialValue: v } : t)), [])
  const updateCounterColor = useCallback((id, v) => setCounters(p => p.map(t => t.id === id ? { ...t, color: v } : t)), [])
  const toggleCounterMinimize = useCallback(generatorForToggleMinimize(setCounters), [])
  const duplicateCounterCard = useCallback((id) => {
    setCounters(prev => {
      const source = prev.find(t => t.id === id); if (!source) return prev
      const dupId = `counter-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }]
    })
  }, [])
  const archiveCounterCard = useCallback((id) => {
    saveSnapshot()
    setCounters(prev => { const src = prev.find(t => t.id === id); if (src) archiveCardSnapshot('counter', src); return prev.filter(t => t.id !== id) })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deleteCounterCard = useCallback((id) => {
    saveSnapshot()
    setCounters(prev => prev.filter(t => t.id !== id)); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

  // Stopwatches
  const updateStopwatchTitle = useCallback((id, v) => setStopwatches(p => p.map(t => t.id === id ? { ...t, title: v } : t)), [])
  const updateStopwatchColor = useCallback((id, v) => setStopwatches(p => p.map(t => t.id === id ? { ...t, color: v } : t)), [])
  const toggleStopwatchMinimize = useCallback(generatorForToggleMinimize(setStopwatches), [])
  const updateStopwatchElapsedSeconds = useCallback((id, sec) => setStopwatches(p => p.map(t => t.id === id ? { ...t, elapsedSeconds: Math.max(0, Math.floor(sec || 0)) } : t)), [])
  const duplicateStopwatchCard = useCallback((id) => {
    setStopwatches(prev => {
      const source = prev.find(t => t.id === id); if (!source) return prev
      const dupId = `stopwatch-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }]
    })
  }, [])
  const archiveStopwatchCard = useCallback((id) => {
    saveSnapshot()
    setStopwatches(prev => { const src = prev.find(t => t.id === id); if (src) archiveCardSnapshot('stopwatch', src); return prev.filter(t => t.id !== id) })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deleteStopwatchCard = useCallback((id) => {
    saveSnapshot()
    setStopwatches(prev => prev.filter(t => t.id !== id)); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

  // Calendars
  const updateCalendarTitle = useCallback((id, v) => setCalendars(p => p.map(t => t.id === id ? { ...t, title: v } : t)), [])
  const updateCalendarColor = useCallback((id, v) => setCalendars(p => p.map(t => t.id === id ? { ...t, color: v } : t)), [])
  const toggleCalendarMinimize = useCallback(generatorForToggleMinimize(setCalendars), [])
  const changeCalendarMonth = useCallback((id, delta) => setCalendars(p => p.map(c => {
    if (c.id !== id) return c
    const shiftedDate = new Date(c.year, c.month + delta, 1)
    return { ...c, year: shiftedDate.getFullYear(), month: shiftedDate.getMonth() }
  })), [])
  const openCalendarDay = useCallback((id, dateKey) => setCalendars(p => p.map(c => c.id === id ? { ...c, selectedDate: dateKey } : c)), [])
  const closeCalendarDay = useCallback((id) => setCalendars(p => p.map(c => c.id === id ? { ...c, selectedDate: null } : c)), [])
  const updateCalendarEntry = useCallback((id, dateKey, value) => {
    setCalendars(prev => prev.map(c => {
      if (c.id !== id) return c
      const nextEnt = { ...c.entries }
      if (!value.trim()) delete nextEnt[dateKey]
      else nextEnt[dateKey] = value
      return { ...c, entries: nextEnt }
    }))
  }, [])
  const duplicateCalendarCard = useCallback((id) => {
    setCalendars(prev => {
      const source = prev.find(t => t.id === id); if (!source) return prev
      const dupId = `calendar-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }]
    })
  }, [])
  const archiveCalendarCard = useCallback((id) => {
    saveSnapshot()
    setCalendars(prev => { const src = prev.find(t => t.id === id); if (src) archiveCardSnapshot('calendar', src); return prev.filter(t => t.id !== id) })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deleteCalendarCard = useCallback((id) => {
    saveSnapshot()
    setCalendars(prev => prev.filter(t => t.id !== id)); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

  // Habits
  const updateHabitTitle = useCallback((id, v) => setHabits(p => p.map(t => t.id === id ? { ...t, title: v } : t)), [])
  const updateHabitIcon = useCallback((id, v) => setHabits(p => p.map(t => t.id === id ? { ...t, icon: normalizeHabitIconId(v) } : t)), [])
  const updateHabitColor = useCallback((id, v) => setHabits(p => p.map(t => t.id === id ? { ...t, color: v } : t)), [])
  const toggleHabitMinimize = useCallback(generatorForToggleMinimize(setHabits), [])
  const setHabitView = useCallback((id, v) => setHabits(p => p.map(t => t.id === id ? { ...t, view: v } : t)), [])
  const changeHabitMonth = useCallback((id, delta) => setHabits(p => p.map(c => {
    if (c.id !== id) return c
    const shiftedDate = new Date(c.year, c.month + delta, 1)
    return { ...c, year: shiftedDate.getFullYear(), month: shiftedDate.getMonth() }
  })), [])
  const toggleHabitDate = useCallback((id, dateKey) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h
      const parsedDate = parseDateKey(dateKey)
      if (!parsedDate) return h
      const targetDayStart = new Date(parsedDate.year, parsedDate.month, parsedDate.day)
      const t = new Date(); const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate())
      if (targetDayStart > todayStart) return h
      const nextComp = { ...(h.completions || {}) }
      if (nextComp[dateKey]) delete nextComp[dateKey]
      else nextComp[dateKey] = true
      return { ...h, completions: nextComp }
    }))
  }, [])
  const duplicateHabitCard = useCallback((id) => {
    setHabits(prev => {
      const source = prev.find(t => t.id === id); if (!source) return prev
      const dupId = `habit-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }]
    })
  }, [])
  const archiveHabitCard = useCallback((id) => {
    saveSnapshot()
    setHabits(prev => { const src = prev.find(t => t.id === id); if (src) archiveCardSnapshot('habit', src); return prev.filter(t => t.id !== id) })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deleteHabitCard = useCallback((id) => {
    saveSnapshot()
    setHabits(prev => prev.filter(t => t.id !== id)); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

  // Pictures
  const updatePictureTitle = useCallback((id, v) => setPictures(p => p.map(t => t.id === id ? { ...t, title: v } : t)), [])
  const updatePictureColor = useCallback((id, v) => setPictures(p => p.map(t => t.id === id ? { ...t, color: v } : t)), [])
  const togglePictureMinimize = useCallback(generatorForToggleMinimize(setPictures), [])
  const updatePictureImageId = useCallback((id, imageId) => setPictures(p => p.map(t => t.id === id ? { ...t, imageId } : t)), [])
  const duplicatePictureCard = useCallback((id) => {
    setPictures(prev => {
      const source = prev.find(t => t.id === id); if (!source) return prev
      const dupId = `picture-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }]
    })
  }, [])
  const archivePictureCard = useCallback((id) => {
    saveSnapshot()
    setPictures(prev => { const src = prev.find(t => t.id === id); if (src) archiveCardSnapshot('picture', src); return prev.filter(t => t.id !== id) })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deletePictureCard = useCallback((id) => {
    saveSnapshot()
    setPictures(prev => {
      const card = prev.find(t => t.id === id)
      if (card?.imageId) deleteImageBlob(card.imageId).catch(() => {})
      return prev.filter(t => t.id !== id)
    })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

  // Quick Links
  //new stuff
  const updateQuickLinksTitle = useCallback((id, v) => setQuickLinks(p => p.map(t => t.id === id ? { ...t, title: v } : t)), [])
  const updateQuickLinksColor = useCallback((id, v) => setQuickLinks(p => p.map(t => t.id === id ? { ...t, color: v } : t)), [])
  const toggleQuickLinksMinimize = useCallback(generatorForToggleMinimize(setQuickLinks), [])
  const addQuickLinkItem = useCallback((id, url, label) => setQuickLinks(p => p.map(t => t.id === id ? { ...t, links: [...(t.links || []), { id: `ql-item-${Date.now()}-${Math.floor(Math.random()*1000)}`, url, label }] } : t)), [])
  const updateQuickLinkItem = useCallback((id, itemId, url, label) => setQuickLinks(p => p.map(t => t.id === id ? { ...t, links: (t.links || []).map(l => l.id === itemId ? { ...l, url, label } : l) } : t)), [])
  const removeQuickLinkItem = useCallback((id, itemId) => setQuickLinks(p => p.map(t => t.id === id ? { ...t, links: (t.links || []).filter(l => l.id !== itemId) } : t)), [])
  const reorderQuickLinkItems = useCallback((id, sourceIndex, destIndex) => setQuickLinks(p => p.map(t => {
    if (t.id !== id) return t
    const links = [...(t.links || [])]
    const [removed] = links.splice(sourceIndex, 1)
    links.splice(destIndex, 0, removed)
    return { ...t, links }
  })), [])
  const duplicateQuickLinksCard = useCallback((id) => {
    setQuickLinks(prev => {
      const source = prev.find(t => t.id === id); if (!source) return prev
      const dupId = `quick-links-${Date.now()}`
      setCardPositions(pos => ({ ...pos, [dupId]: { x: (pos[id]?.x || 0) + 36, y: (pos[id]?.y || 0) + 36 } }))
      return [...prev, { ...source, id: dupId, title: source.title ? `${source.title} Copy` : '', minimized: false }]
    })
  }, [])
  const archiveQuickLinksCard = useCallback((id) => {
    saveSnapshot()
    setQuickLinks(prev => { const src = prev.find(t => t.id === id); if (src) archiveCardSnapshot('quick-links', src); return prev.filter(t => t.id !== id) })
    removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])
  const deleteQuickLinksCard = useCallback((id) => {
    saveSnapshot()
    setQuickLinks(prev => prev.filter(t => t.id !== id)); removeCardPosition(id); setDraggingCard(c => c?.id === id ? null : c)
  }, [removeCardPosition, saveSnapshot])

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
  }, [])

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
  }, [])

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
    if (event.button !== 2 && (event.type === 'mousedown' && event.button !== 1)) return
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

  const handleAddLabel = useCallback(() => {
    const id = `label-${Date.now()}`; const roles = ['routine', 'programming', 'english']
    setCustomLabels(p => [...p, { id, text: '', role: roles[Math.floor(Math.random() * roles.length)] }])
    setCardPositions(p => ({ ...p, [id]: { x: 400 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport])
  const handleAddNote = useCallback(() => {
    const id = `note-${Date.now()}`
    setNotes(p => [...p, { id, text: '', title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: { x: 350 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport])
  const handleAddTodoList = useCallback(() => {
    const id = `col-${Date.now()}`; const tones = ['charcoal', 'gold', 'violet', 'red', 'blue']
    setColumns(p => [...p, { id, tone: tones[Math.floor(Math.random() * tones.length)], positionClass: '', items: [], title: '', color: null, minimized: false }])
    setDrafts(p => ({ ...p, [id]: '' }))
    setCardPositions(p => ({ ...p, [id]: { x: 400 - (viewport.x / viewport.scale), y: 200 - (viewport.y / viewport.scale) } }))
  }, [viewport])
  const handleAddTimer = useCallback(() => {
    const id = `timer-${Date.now()}`; setTimers(p => [...p, { id, initialSeconds: 2700, remainingSeconds: 2700, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: { x: 600 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport])
  const handleAddCounter = useCallback(() => {
    const id = `counter-${Date.now()}`; setCounters(p => [...p, { id, initialValue: 0, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: { x: 960 - (viewport.x / viewport.scale), y: 260 - (viewport.y / viewport.scale) } }))
  }, [viewport])
  const handleAddStopwatch = useCallback(() => {
    const id = `stopwatch-${Date.now()}`; setStopwatches(p => [...p, { id, initialSeconds: 0, elapsedSeconds: 0, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: { x: 1240 - (viewport.x / viewport.scale), y: 260 - (viewport.y / viewport.scale) } }))
  }, [viewport])
  const handleAddCalendar = useCallback(() => {
    const id = `calendar-${Date.now()}`; const now = new Date()
    setCalendars(p => [...p, { id, year: now.getFullYear(), month: now.getMonth(), selectedDate: null, entries: {}, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: { x: 1500 - (viewport.x / viewport.scale), y: 120 - (viewport.y / viewport.scale) } }))
  }, [viewport])
  const handleAddHabit = useCallback(() => {
    const id = `habit-${Date.now()}`; const now = new Date()
    setHabits(p => [...p, { id, icon: HABIT_ICON_OPTIONS[0].id, year: now.getFullYear(), month: now.getMonth(), view: 'summary', completions: {}, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: { x: 1700 - (viewport.x / viewport.scale), y: 120 - (viewport.y / viewport.scale) } }))
  }, [viewport])
  const handleAddPicture = useCallback(() => {
    const id = `picture-${Date.now()}`
    setPictures(p => [...p, { id, imageId: null, title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: { x: 500 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport])

  const handleAddQuickLinks = useCallback(() => {
    const id = `quick-links-${Date.now()}`
    setQuickLinks(p => [...p, { id, links: [], title: '', color: null, minimized: false }])
    setCardPositions(p => ({ ...p, [id]: { x: 1000 - (viewport.x / viewport.scale), y: 300 - (viewport.y / viewport.scale) } }))
  }, [viewport])

  const handleQuickAction = useCallback((actionId) => {
    if (actionId === 'label') handleAddLabel()
    else if (actionId === 'note') handleAddNote()
    else if (actionId === 'todo-list') handleAddTodoList()
    else if (actionId === 'counter') handleAddCounter()
    else if (actionId === 'timer') handleAddTimer()
    else if (actionId === 'stopwatch') handleAddStopwatch()
    else if (actionId === 'calendar') handleAddCalendar()
    else if (actionId === 'habit') handleAddHabit()
    else if (actionId === 'picture') handleAddPicture()
    else if (actionId === 'quick-links') handleAddQuickLinks()
    setIsRailOpen(false)
  }, [handleAddLabel, handleAddNote, handleAddTodoList, handleAddCounter, handleAddTimer, handleAddStopwatch, handleAddCalendar, handleAddHabit, handleAddPicture, handleAddQuickLinks])


  return {
    state: {
      columns, drafts, viewport, isPanning, isRailOpen, isFocusMode, themeMode, theme,
      dragState, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks,
      archivedCards, detachedLabels, cardPositions, draggingCard, poppingCardIds, toastMessage
    },
    setters: {
      setThemeMode, setIsFocusMode, setIsRailOpen
    },
    actions: {
      setDraft, addItem, updateItemText, updateItemDetails, deleteItem,
      handleDragStartItem, handleDragEndItem, handleDragOverItem, handleDropOnItem, handleDropOnList,
      handleCardMouseDown, handleWheel, startPanning, movePanning, endPanning,
      handleQuickAction, focusLabelCard, restoreArchivedCard, moveCardToTarget,
      handleUndo, handleRedo,
      updateTodoCardTitle, updateTodoCardColor, toggleTodoCardMinimize, duplicateTodoCard, archiveTodoCard, deleteTodoCard,
      updateLabelText, updateLabelColor, toggleLabelMinimize, duplicateLabelCard, archiveLabelCard, deleteLabelCard,
      updateNoteTitle, updateNoteText, updateNoteColor, toggleNoteMinimize, duplicateNoteCard, archiveNoteCard, deleteNoteCard,
      updateTimerTitle, updateTimerColor, toggleTimerMinimize, updateTimerRemainingSeconds, updateTimerInitialSeconds, updatePomodoroConfig, duplicateTimerCard, archiveTimerCard, deleteTimerCard,
      updateCounterTitle, updateCounterValue, updateCounterColor, toggleCounterMinimize, duplicateCounterCard, archiveCounterCard, deleteCounterCard,
      updateStopwatchTitle, updateStopwatchColor, updateStopwatchElapsedSeconds, toggleStopwatchMinimize, duplicateStopwatchCard, archiveStopwatchCard, deleteStopwatchCard,
      updateCalendarTitle, updateCalendarColor, toggleCalendarMinimize, changeCalendarMonth, openCalendarDay, closeCalendarDay, updateCalendarEntry, duplicateCalendarCard, archiveCalendarCard, deleteCalendarCard,
      updateHabitTitle, updateHabitIcon, updateHabitColor, toggleHabitMinimize, setHabitView, changeHabitMonth, toggleHabitDate, duplicateHabitCard, archiveHabitCard, deleteHabitCard,
      updatePictureTitle, updatePictureColor, togglePictureMinimize, updatePictureImageId, duplicatePictureCard, archivePictureCard, deletePictureCard,
      updateQuickLinksTitle, updateQuickLinksColor, toggleQuickLinksMinimize, addQuickLinkItem, updateQuickLinkItem, removeQuickLinkItem, reorderQuickLinkItems, duplicateQuickLinksCard, archiveQuickLinksCard, deleteQuickLinksCard
    }
  }
}
