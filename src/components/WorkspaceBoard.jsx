import { useRef, useEffect, useCallback, useMemo } from 'react'
import { ActionRail, ActionRailIcon } from './ActionRail'
import { TodoCard } from './TodoCard'
import { LabelCard } from './LabelCard'
import { SingleNoteCard } from './SingleNoteCard'
import { NoteCard } from './NoteCard'
import { TimerCard } from './TimerCard'
import { CounterCard } from './CounterCard'
import { StopwatchCard } from './StopwatchCard'
import { CalendarCard } from './CalendarCard'
import { HabitCard } from './HabitCard'
import { PictureCard } from './PictureCard'
import { QuickLinksCard } from './QuickLinksCard'
import { QuoteCard } from './QuoteCard'
import { TopBar } from './TopBar'
import { LazyMount } from './LazyMount'
import { SwipeableCard } from './SwipeableCard'
import { MobileCardOrderProvider } from './MobileCardOrderContext'
import { useWorkspace } from '../hooks/useWorkspace'
import { usePointerListDrag } from '../hooks/usePointerListDrag'
import { useDocumentTitleTimer } from '../hooks/useDocumentTitleTimer'
import { useAuth } from '../hooks/useAuth'
import { useSyncEngine } from '../hooks/useSyncEngine'
import { useIsColumnLayout } from '../hooks/useIsColumnLayout'
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll'
import { usePullToSync } from '../hooks/usePullToSync'
import { QUICK_CREATE_ACTIONS } from '../utils/constants'
import { supportsNativeZoom } from '../utils/browserSupport'

export function WorkspaceBoard({
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
  
  const {
    state: {
      columns, drafts, viewport, isPanning, isRailOpen, isFocusMode, themeMode, themePalette, theme,
      notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks, quotes,
      archivedCards, detachedLabels, singleNotes, cardPositions, mobileCardOrder, draggingCard, poppingCardIds, toastMessage,
      longPressMenu, isLongPressHolding, longPressPos
    },
    setters: {
      setThemeMode, setThemePalette, setIsFocusMode, setIsRailOpen
    },
    actions,
  } = useWorkspace(workspace.id, workspaceRef)

  // Pointer-event drag for todo rows (works on touch; replaces HTML5 DnD).
  const todoDrag = usePointerListDrag({
    onReorder: actions.handlePointerReorderItem,
    onMoveBetween: actions.handlePointerMoveBetweenColumns,
  })

  const { user } = useAuth()
  const { syncStatus, lastSyncedAt, syncError, syncNow, notifyChange } = useSyncEngine({
    workspaceId: workspace.id,
    captureSnapshot: actions.captureSnapshot,
    user,
    workspaceName: workspace.name,
    onRemoteWorkspaceLoaded: actions.importWorkspaceState,
  })

  // Trigger debounced cloud sync whenever local state changes
  useEffect(() => {
    notifyChange()
  }, [
    columns, drafts, viewport, themeMode, themePalette, notes, timers, counters,
    stopwatches, calendars, habits, pictures, quickLinks, quotes, archivedCards,
    detachedLabels, singleNotes, cardPositions, notifyChange
  ])

  useDocumentTitleTimer(timers, workspace.name)

  const handleToggleThemeMode = useCallback(() => setThemeMode((mode) => (mode === 'night' ? 'day' : 'night')), [setThemeMode])
  const handleToggleFocusMode = useCallback(() => setIsFocusMode((active) => !active), [setIsFocusMode])
  const handleToggleRail = useCallback(() => setIsRailOpen((isOpen) => !isOpen), [setIsRailOpen])

  const noteDimensionsCallbacks = useRef({})
  const noteIdsKey = notes.map((n) => n.id).join('|')
  useEffect(() => {
    // Evict cached callbacks for deleted notes so the cache can't grow forever.
    const live = new Set(noteIdsKey ? noteIdsKey.split('|') : [])
    Object.keys(noteDimensionsCallbacks.current)
      .filter((id) => !live.has(id))
      .forEach((id) => delete noteDimensionsCallbacks.current[id])
  }, [noteIdsKey])
  const getUpdateNoteDimensions = useCallback((id) => {
    if (!noteDimensionsCallbacks.current[id]) {
      noteDimensionsCallbacks.current[id] = (w, h) => actions.updateNoteDimensions(id, w, h)
    }
    return noteDimensionsCallbacks.current[id]
  }, [actions.updateNoteDimensions])

  const pictureDimensionsCallbacks = useRef({})
  const pictureIdsKey = pictures.map((p) => p.id).join('|')
  useEffect(() => {
    const live = new Set(pictureIdsKey ? pictureIdsKey.split('|') : [])
    Object.keys(pictureDimensionsCallbacks.current)
      .filter((id) => !live.has(id))
      .forEach((id) => delete pictureDimensionsCallbacks.current[id])
  }, [pictureIdsKey])
  const getUpdatePictureDimensions = useCallback((id) => {
    if (!pictureDimensionsCallbacks.current[id]) {
      pictureDimensionsCallbacks.current[id] = (w, h) => actions.updatePictureDimensions(id, w, h)
    }
    return pictureDimensionsCallbacks.current[id]
  }, [actions.updatePictureDimensions])

  const quoteDimensionsCallbacks = useRef({})
  const quoteIdsKey = quotes.map((q) => q.id).join('|')
  useEffect(() => {
    const live = new Set(quoteIdsKey ? quoteIdsKey.split('|') : [])
    Object.keys(quoteDimensionsCallbacks.current)
      .filter((id) => !live.has(id))
      .forEach((id) => delete quoteDimensionsCallbacks.current[id])
  }, [quoteIdsKey])
  const getUpdateQuoteDimensions = useCallback((id) => {
    if (!quoteDimensionsCallbacks.current[id]) {
      quoteDimensionsCallbacks.current[id] = (w, h) => actions.updateQuoteDimensions(id, w, h)
    }
    return quoteDimensionsCallbacks.current[id]
  }, [actions.updateQuoteDimensions])

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

  // ---------------------------------------------------------------------
  // Mobile column layout: card ordering + lazy mounting.
  //
  // Every card type registers its element under its id, then cards are
  // emitted in the persisted mobile order (<=1200px) or natural creation
  // order (desktop canvas). Elements are rebuilt each render exactly like
  // the previous inline .map() calls; the memoized card components still
  // limit real DOM work to changed inputs.
  // ---------------------------------------------------------------------
  const isColumnLayout = useIsColumnLayout()
  useKeyboardAwareScroll({ enabled: isColumnLayout })

  // Pull-to-sync on mobile: dragging down at the top of the stack triggers a
  // manual cloud sync (Step 6.1 of the mobile plan).
  const pullToSync = usePullToSync({ enabled: isColumnLayout, onRefresh: syncNow })

  // Natural order mirrors useWorkspace's renderedCardIds.
  const naturalCardIds = [
    ...columns.map((column) => column.id),
    ...detachedLabels.map((label) => label.id),
    ...singleNotes.map((note) => note.id),
    ...notes.map((note) => note.id),
    ...timers.map((timer) => timer.id),
    ...counters.map((counter) => counter.id),
    ...stopwatches.map((stopwatch) => stopwatch.id),
    ...calendars.map((calendar) => calendar.id),
    ...habits.map((habit) => habit.id),
    ...pictures.map((picture) => picture.id),
    ...quickLinks.map((qlCard) => qlCard.id),
    ...quotes.map((quote) => quote.id),
  ]

  const savedOrderList = isColumnLayout && mobileCardOrder && Array.isArray(mobileCardOrder.list)
    ? mobileCardOrder.list
    : []
  const naturalIdSet = new Set(naturalCardIds)
  const orderedHead = savedOrderList.filter((id) => naturalIdSet.has(id))
  const orderedHeadSet = new Set(orderedHead)
  // Effective mobile stack order: the persisted arrangement first, then any
  // cards created or synced after it was saved, appended in natural order.
  const effectiveMobileIds = [...orderedHead, ...naturalCardIds.filter((id) => !orderedHeadSet.has(id))]

  const mobileOrderActions = {
    canMove: (cardId, direction) => {
      const index = effectiveMobileIds.indexOf(cardId)
      if (index < 0) return false
      return direction === 'up' ? index > 0 : index < effectiveMobileIds.length - 1
    },
    move: (cardId, direction) => actions.moveCardInMobileOrder(cardId, direction),
  }

  const cardRenderers = new Map()
  columns.forEach((column) => {
    cardRenderers.set(column.id, (
      <TodoCard
        cardId={column.id}
        column={column}
        draft={drafts[column.id]}
        onDraftChange={actions.setDraft}
        onAdd={actions.addItem}
        onUpdateItemText={actions.updateItemText}
        onUpdateItemDetails={actions.updateItemDetails}
        onDeleteItem={actions.deleteItem}
        onItemDragStart={todoDrag.beginItemDrag}
        draggingItemId={todoDrag.draggingItemId}
        overItemId={todoDrag.overItemId}
        position={cardPositions[column.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateTodoCardTitle}
        onUpdateColor={actions.updateTodoCardColor}
        onUpdateFontSize={actions.updateTodoCardFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleTodoCardMinimize}
        onDuplicateCard={actions.duplicateTodoCard}
        onArchiveCard={actions.archiveTodoCard}
        onDeleteCard={actions.deleteTodoCard}
        isPopping={poppingCardIds.has(column.id)}
      />
    ))
  })
  detachedLabels.forEach((label) => {
    cardRenderers.set(label.id, (
      <LabelCard
        cardId={label.id}
        label={label}
        labelTextColor={theme.labelText}
        position={cardPositions[label.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateText={actions.updateLabelText}
        onUpdateColor={actions.updateLabelColor}
        onUpdateFontSize={actions.updateLabelFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleLabelMinimize}
        onDuplicateCard={actions.duplicateLabelCard}
        onArchiveCard={actions.archiveLabelCard}
        onDeleteCard={actions.deleteLabelCard}
        isPopping={poppingCardIds.has(label.id)}
      />
    ))
  })
  singleNotes.forEach((note) => {
    cardRenderers.set(note.id, (
      <SingleNoteCard
        cardId={note.id}
        singleNote={note}
        position={cardPositions[note.id]}
        textColor="var(--label-text)"
        onPointerDown={actions.handleCardPointerDown}
        onUpdateText={actions.updateSingleNoteText}
        onUpdateColor={actions.updateSingleNoteColor}
        onUpdateFontSize={actions.updateSingleNoteFontSize}
        onUpdateShape={actions.updateSingleNoteShape}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleSingleNoteMinimize}
        onDuplicateCard={actions.duplicateSingleNoteCard}
        onArchiveCard={actions.archiveSingleNoteCard}
        onDeleteCard={actions.deleteSingleNoteCard}
        isPopping={poppingCardIds.has(note.id)}
      />
    ))
  })
  notes.forEach((note) => {
    cardRenderers.set(note.id, (
      <NoteCard
        cardId={note.id}
        note={note}
        position={cardPositions[note.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateNoteTitle}
        onUpdateText={actions.updateNoteText}
        onUpdateColor={actions.updateNoteColor}
        onUpdateFontSize={actions.updateNoteFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleNoteMinimize}
        onDuplicateCard={actions.duplicateNoteCard}
        onArchiveCard={actions.archiveNoteCard}
        onDeleteCard={actions.deleteNoteCard}
        onUpdateDimensions={getUpdateNoteDimensions(note.id)}
        scale={viewport.scale}
        isPopping={poppingCardIds.has(note.id)}
      />
    ))
  })
  timers.forEach((timer) => {
    cardRenderers.set(timer.id, (
      <TimerCard
        cardId={timer.id}
        timer={timer}
        position={cardPositions[timer.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateTimerTitle}
        onUpdateColor={actions.updateTimerColor}
        onUpdateFontSize={actions.updateTimerFontSize}
        onUpdateTimerState={actions.updateTimerState}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleTimerMinimize}
        onDuplicateCard={actions.duplicateTimerCard}
        onArchiveCard={actions.archiveTimerCard}
        onDeleteCard={actions.deleteTimerCard}
        isPopping={poppingCardIds.has(timer.id)}
      />
    ))
  })
  counters.forEach((counter) => {
    cardRenderers.set(counter.id, (
      <CounterCard
        cardId={counter.id}
        counter={counter}
        position={cardPositions[counter.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateCounterTitle}
        onUpdateValue={actions.updateCounterValue}
        onUpdateColor={actions.updateCounterColor}
        onUpdateFontSize={actions.updateCounterFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleCounterMinimize}
        onDuplicateCard={actions.duplicateCounterCard}
        onArchiveCard={actions.archiveCounterCard}
        onDeleteCard={actions.deleteCounterCard}
        isPopping={poppingCardIds.has(counter.id)}
      />
    ))
  })
  stopwatches.forEach((stopwatch) => {
    cardRenderers.set(stopwatch.id, (
      <StopwatchCard
        cardId={stopwatch.id}
        stopwatch={stopwatch}
        position={cardPositions[stopwatch.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateStopwatchTitle}
        onUpdateColor={actions.updateStopwatchColor}
        onUpdateFontSize={actions.updateStopwatchFontSize}
        onUpdateStopwatchState={actions.updateStopwatchState}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleStopwatchMinimize}
        onDuplicateCard={actions.duplicateStopwatchCard}
        onArchiveCard={actions.archiveStopwatchCard}
        onDeleteCard={actions.deleteStopwatchCard}
        isPopping={poppingCardIds.has(stopwatch.id)}
      />
    ))
  })
  calendars.forEach((calendar) => {
    cardRenderers.set(calendar.id, (
      <CalendarCard
        cardId={calendar.id}
        calendar={calendar}
        allHabits={habits}
        position={cardPositions[calendar.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateCalendarTitle}
        onUpdateColor={actions.updateCalendarColor}
        onUpdateFontSize={actions.updateCalendarFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleCalendarMinimize}
        onDuplicateCard={actions.duplicateCalendarCard}
        onArchiveCard={actions.archiveCalendarCard}
        onDeleteCard={actions.deleteCalendarCard}
        onChangeMonth={actions.changeCalendarMonth}
        onOpenDay={actions.openCalendarDay}
        onCloseDay={actions.closeCalendarDay}
        onUpdateEntry={actions.updateCalendarEntry}
        isPopping={poppingCardIds.has(calendar.id)}
      />
    ))
  })
  habits.forEach((habit) => {
    cardRenderers.set(habit.id, (
      <HabitCard
        cardId={habit.id}
        habit={habit}
        position={cardPositions[habit.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateHabitTitle}
        onUpdateIcon={actions.updateHabitIcon}
        onUpdateColor={actions.updateHabitColor}
        onUpdateFontSize={actions.updateHabitFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleHabitMinimize}
        onDuplicateCard={actions.duplicateHabitCard}
        onArchiveCard={actions.archiveHabitCard}
        onDeleteCard={actions.deleteHabitCard}
        onSetView={actions.setHabitView}
        onChangeMonth={actions.changeHabitMonth}
        onToggleDate={actions.toggleHabitDate}
        isPopping={poppingCardIds.has(habit.id)}
      />
    ))
  })
  pictures.forEach((picture) => {
    cardRenderers.set(picture.id, (
      <PictureCard
        cardId={picture.id}
        picture={picture}
        position={cardPositions[picture.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updatePictureTitle}
        onUpdateColor={actions.updatePictureColor}
        onUpdateFontSize={actions.updatePictureFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.togglePictureMinimize}
        onDuplicateCard={actions.duplicatePictureCard}
        onArchiveCard={actions.archivePictureCard}
        onDeleteCard={actions.deletePictureCard}
        onUpdateImageId={actions.updatePictureImageId}
        onUpdateDimensions={getUpdatePictureDimensions(picture.id)}
        onUpdateFitMode={actions.updatePictureFitMode}
        scale={viewport.scale}
        isPopping={poppingCardIds.has(picture.id)}
      />
    ))
  })
  quickLinks.forEach((qlCard) => {
    cardRenderers.set(qlCard.id, (
      <QuickLinksCard
        cardId={qlCard.id}
        quickLinkCard={qlCard}
        position={cardPositions[qlCard.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateQuickLinksTitle}
        onUpdateColor={actions.updateQuickLinksColor}
        onUpdateFontSize={actions.updateQuickLinksFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleQuickLinksMinimize}
        onDuplicateCard={actions.duplicateQuickLinksCard}
        onArchiveCard={actions.archiveQuickLinksCard}
        onDeleteCard={actions.deleteQuickLinksCard}
        onAddLink={actions.addQuickLinkItem}
        onUpdateLink={actions.updateQuickLinkItem}
        onRemoveLink={actions.removeQuickLinkItem}
        onReorderLinks={actions.reorderQuickLinkItems}
        isPopping={poppingCardIds.has(qlCard.id)}
      />
    ))
  })
  quotes.forEach((quote) => {
    cardRenderers.set(quote.id, (
      <QuoteCard
        cardId={quote.id}
        quote={quote}
        position={cardPositions[quote.id]}
        onPointerDown={actions.handleCardPointerDown}
        onUpdateTitle={actions.updateQuoteTitle}
        onUpdateText={actions.updateQuoteText}
        onUpdateAuthor={actions.updateQuoteAuthor}
        onUpdateColor={actions.updateQuoteColor}
        onUpdateFontSize={actions.updateQuoteFontSize}
        onMoveCard={actions.moveCardToTarget}
        onToggleMinimize={actions.toggleQuoteMinimize}
        onDuplicateCard={actions.duplicateQuoteCard}
        onArchiveCard={actions.archiveQuoteCard}
        onDeleteCard={actions.deleteQuoteCard}
        onUpdateDimensions={getUpdateQuoteDimensions(quote.id)}
        scale={viewport.scale}
        isPopping={poppingCardIds.has(quote.id)}
      />
    ))
  })

  // Emit cards in effective order, lazily mounting everything past the first
  // few on mobile so busy workspaces don't mount 30+ subtrees at once.
  const LAZY_MOUNT_FIRST_N = 4
  const seenCardIds = new Set()
  const orderedCards = []
  const emitCard = (id) => {
    if (seenCardIds.has(id)) return
    let card = cardRenderers.get(id)
    if (!card) return
    seenCardIds.add(id)
    if (isColumnLayout) {
      card = (
        <SwipeableCard
          onArchive={() => actions.swipeActionDispatch(id, 'archive')}
          onDelete={() => actions.swipeActionDispatch(id, 'delete')}
        >
          {card}
        </SwipeableCard>
      )
    }
    const isDeferred = isColumnLayout && orderedCards.length >= LAZY_MOUNT_FIRST_N
    orderedCards.push(<LazyMount key={id} isDeferred={isDeferred}>{card}</LazyMount>)
  }
  if (isColumnLayout) {
    effectiveMobileIds.forEach(emitCard)
  } else {
    naturalCardIds.forEach(emitCard)
  }

  return (
    <MobileCardOrderProvider value={mobileOrderActions}>
    <div
      className={`app-shell theme-${themeMode} palette-${themePalette} ${isFocusMode ? 'is-focus-mode' : ''}`}
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
        '--card-counter-bg': theme.cardCounter,
        '--card-stopwatch-bg': theme.cardStopwatch,
        '--card-calendar-bg': theme.cardCalendar,
        '--card-habit-bg': theme.cardHabit,
        '--ink-strong': theme.inkStrong,
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
        onToggleMode={handleToggleThemeMode} 
        palette={themePalette}
        onSelectPalette={setThemePalette}
        isFocusMode={isFocusMode}
        onToggleFocusMode={handleToggleFocusMode}
        workspace={workspace}
        allWorkspaces={allWorkspaces}
        onSwitchWorkspace={onSwitchWorkspace}
        onUpdateName={onUpdateName}
        onDuplicateWorkspace={onDuplicateWorkspace}
        onDeleteWorkspace={onDeleteWorkspace}
        onCreateWorkspace={onCreateWorkspace}
        quickActions={QUICK_CREATE_ACTIONS}
        onQuickAction={actions.handleQuickAction}
        labels={detachedLabels}
        onSelectLabel={actions.focusLabelCard}
        archivedCards={archivedCards}
        habits={habits}
        onRestoreArchivedCard={actions.restoreArchivedCard}
        onImportCards={actions.importCardsFromJson}
        onImportWorkspace={actions.importWorkspaceState}
        onCaptureSnapshot={actions.captureSnapshot}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onSyncNow={syncNow}
        syncMessage={syncError}
      />

      <div className={`focus-overlay ${isFocusMode ? 'is-active' : ''}`} aria-hidden="true" />
      {pullToSync.isPulling && (
        <div
          className="pull-sync-indicator"
          style={{ transform: `translateX(-50%) translateY(${Math.round(pullToSync.pullDistance * 0.5)}px)` }}
          role="status"
        >
          <span
            className="pull-sync-spinner"
            style={{ opacity: 0.4 + pullToSync.pullProgress * 0.6 }}
            aria-hidden="true"
          />
        </div>
      )}
      <WorkspaceWheelHandler workspaceRef={workspaceRef} onWheel={actions.handleWheel} />
      <div
        className={`workspace ${isPanning ? 'is-panning' : ''} ${draggingCard ? 'is-card-dragging' : ''}`}
        ref={workspaceRef}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(e) => { actions.startPanning(e); actions.startLongPress(e); actions.handleMiddleClick(e) }}
        onPointerMove={(e) => { actions.movePanning(e); actions.moveLongPress(e) }}
        onPointerUp={(e) => { actions.endPanning(e); actions.cancelLongPress() }}
        onPointerLeave={(e) => { actions.endPanning(e); actions.cancelLongPress() }}
      >
        <div className="board-stage" style={boardStageStyle}>
          <main className="board">
            {orderedCards}
          </main>
        </div>

        <ActionRail
          open={isRailOpen}
          onToggle={handleToggleRail}
          quickActions={QUICK_CREATE_ACTIONS}
          onQuickAction={actions.handleQuickAction}
        />
      </div>

      {toastMessage && (
        <div className="undo-toast" key={toastMessage}>{toastMessage}</div>
      )}

      {isLongPressHolding && (
        <div
          className="long-press-ring"
          style={{ left: longPressPos.x, top: longPressPos.y }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
            <circle className="long-press-ring-fill" cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="3" />
          </svg>
        </div>
      )}

      {longPressMenu.visible && (
        <LongPressContextMenu
          menu={longPressMenu}
          quickActions={QUICK_CREATE_ACTIONS}
          onAction={(actionId) => {
            actions.handleQuickAction(actionId, null, { x: longPressMenu.canvasX, y: longPressMenu.canvasY })
            actions.closeLongPressMenu()
          }}
          onClose={actions.closeLongPressMenu}
        />
      )}
    </div>
    </MobileCardOrderProvider>
  )
}

function LongPressContextMenu({ menu, quickActions, onAction, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <>
      <div className="long-press-backdrop" onClick={onClose} />
      <div
        ref={menuRef}
        className="long-press-menu"
        style={{ left: menu.x, top: menu.y }}
      >
        {quickActions.map((action) => (
          <button
            key={action.id}
            className="long-press-menu-item"
            onClick={() => onAction(action.id)}
          >
            <ActionRailIcon kind={action.icon} />
            <span>{action.title}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function WorkspaceWheelHandler({ workspaceRef, onWheel }) {
  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    const handleWheel = (e) => {
      onWheel(e)
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [workspaceRef, onWheel])
  
  return null
}
