import { createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js'
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
import { createWorkspace } from '../hooks/useWorkspace'
import { createDocumentTitleTimer } from '../hooks/useDocumentTitleTimer'
import { useAuth } from '../hooks/useAuth'
import { createSyncEngine } from '../hooks/useSyncEngine'
import { QUICK_CREATE_ACTIONS } from '../utils/constants'
import { supportsNativeZoom } from '../utils/browserSupport'

export function WorkspaceBoard(props) {
  let workspaceEl
  // Ref-compatible accessor: the workspace factory accepts either a DOM node
  // or a React-style { current } ref — it normalizes both.
  const workspaceRef = () => workspaceEl

  const ws = createWorkspace(props.workspace.id, workspaceRef)
  const {
    setThemeMode, setThemePalette, setIsFocusMode, setIsRailOpen,
  } = ws.setters
  const actions = ws.actions

  const auth = useAuth()
  const sync = createSyncEngine({
    workspaceId: props.workspace.id,
    captureSnapshot: actions.captureSnapshot,
    getUser: () => auth.user,
    get user() { return auth.user },
    workspaceName: props.workspace.name,
    onRemoteWorkspaceLoaded: actions.importWorkspaceState,
  })

  // Trigger debounced cloud sync whenever local state changes.
  // captureSnapshot deep-reads every slice, so this effect tracks all of them.
  createEffect(() => {
    const _tracked = actions.captureSnapshot()
    void _tracked
    sync.notifyChange()
  })

  createDocumentTitleTimer(
    () => ws.state.timers,
    () => props.workspace.name,
  )

  const handleToggleThemeMode = () => setThemeMode((mode) => (mode === 'night' ? 'day' : 'night'))
  const handleToggleFocusMode = () => setIsFocusMode((active) => !active)
  const handleToggleRail = () => setIsRailOpen((isOpen) => !isOpen)

  // Non-passive wheel listener: Solid JSX can't set { passive: false },
  // so attach manually (replaces the React WorkspaceWheelHandler component).
  onMount(() => {
    const el = workspaceRef()
    if (!el) return
    el.addEventListener('wheel', actions.handleWheel, { passive: false })
    onCleanup(() => el.removeEventListener('wheel', actions.handleWheel))
  })

  const boardStageStyle = () => supportsNativeZoom
    ? {
        left: `${ws.state.viewport.x / ws.state.viewport.scale}px`,
        top: `${ws.state.viewport.y / ws.state.viewport.scale}px`,
        zoom: `${ws.state.viewport.scale}`,
      }
    : {
        left: '0px',
        top: '0px',
        transform: `translate(${ws.state.viewport.x}px, ${ws.state.viewport.y}px) scale(${ws.state.viewport.scale})`,
      }

  return (
    <div
      class={`app-shell theme-${ws.state.themeMode} palette-${ws.state.themePalette} ${ws.state.isFocusMode ? 'is-focus-mode' : ''}`}
      style={{
        '--workspace-bg': ws.state.theme.workspaceBg,
        '--workspace-bg-alt': ws.state.theme.workspaceBgAlt,
        '--navbar-bg-start': ws.state.theme.navbarBgStart,
        '--navbar-bg-mid': ws.state.theme.navbarBgMid,
        '--navbar-bg-end': ws.state.theme.navbarBgEnd,
        '--surface-panel': ws.state.theme.panel,
        '--surface-panel-muted': ws.state.theme.panelMuted,
        '--surface-border': ws.state.theme.panelBorder,
        '--ui-text': ws.state.theme.text,
        '--ui-text-strong': ws.state.theme.textStrong,
        '--ui-icon': ws.state.theme.icon,
        '--input-text': ws.state.theme.inputText,
        '--input-placeholder': ws.state.theme.inputPlaceholder,
        '--card-text': ws.state.theme.cardText,
        '--card-ui-soft': ws.state.theme.cardUiSoft,
        '--card-ui-mid': ws.state.theme.cardUiMid,
        '--card-ui-strong': ws.state.theme.cardUiStrong,
        '--tone-charcoal': ws.state.theme.toneCharcoal,
        '--tone-gold': ws.state.theme.toneGold,
        '--tone-violet': ws.state.theme.toneViolet,
        '--tone-red': ws.state.theme.toneRed,
        '--tone-blue': ws.state.theme.toneBlue,
        '--card-counter-bg': ws.state.theme.cardCounter,
        '--card-stopwatch-bg': ws.state.theme.cardStopwatch,
        '--card-calendar-bg': ws.state.theme.cardCalendar,
        '--card-habit-bg': ws.state.theme.cardHabit,
        '--ink-strong': ws.state.theme.inkStrong,
        '--label-routine': ws.state.theme.labelRoutine,
        '--label-programming': ws.state.theme.labelProgramming,
        '--label-english': ws.state.theme.labelEnglish,
        '--label-text': ws.state.theme.labelText,
        '--rail-button-bg': ws.state.theme.railButton,
        '--rail-button-icon': ws.state.theme.railIcon,
        '--switch-track': ws.state.theme.switchTrack,
        '--switch-knob': ws.state.theme.switchKnob,
        '--palette-color-1': ws.state.theme.palette.color1,
        '--palette-color-2': ws.state.theme.palette.color2,
        '--palette-color-3': ws.state.theme.palette.color3,
        '--palette-color-4': ws.state.theme.palette.color4,
        '--palette-color-5': ws.state.theme.palette.color5,
        '--palette-color-6': ws.state.theme.palette.color6,
        '--palette-color-7': ws.state.theme.palette.color7,
        '--palette-color-8': ws.state.theme.palette.color8,
        '--palette-color-9': ws.state.theme.palette.color9,
        '--palette-color-10': ws.state.theme.palette.color10,
        '--palette-neutral': ws.state.theme.palette.neutral,
      }}
    >
      <TopBar
        mode={ws.state.themeMode}
        onToggleMode={handleToggleThemeMode}
        palette={ws.state.themePalette}
        onSelectPalette={setThemePalette}
        isFocusMode={ws.state.isFocusMode}
        onToggleFocusMode={handleToggleFocusMode}
        workspace={props.workspace}
        allWorkspaces={props.allWorkspaces}
        onSwitchWorkspace={props.onSwitchWorkspace}
        onUpdateName={props.onUpdateName}
        onDuplicateWorkspace={props.onDuplicateWorkspace}
        onDeleteWorkspace={props.onDeleteWorkspace}
        onCreateWorkspace={props.onCreateWorkspace}
        quickActions={QUICK_CREATE_ACTIONS}
        onQuickAction={actions.handleQuickAction}
        labels={ws.state.detachedLabels}
        onSelectLabel={actions.focusLabelCard}
        archivedCards={ws.state.archivedCards}
        habits={ws.state.habits}
        onRestoreArchivedCard={actions.restoreArchivedCard}
        onImportCards={actions.importCardsFromJson}
        onImportWorkspace={actions.importWorkspaceState}
        onCaptureSnapshot={actions.captureSnapshot}
        syncStatus={sync.syncStatus}
        lastSyncedAt={sync.lastSyncedAt}
        onSyncNow={sync.syncNow}
        syncMessage={sync.syncError}
      />

      <div class={`focus-overlay ${ws.state.isFocusMode ? 'is-active' : ''}`} aria-hidden="true" />
      <div
        class={`workspace ${ws.state.isPanning ? 'is-panning' : ''} ${ws.state.draggingCard ? 'is-card-dragging' : ''}`}
        ref={workspaceEl}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(e) => { actions.startPanning(e); actions.startLongPress(e); actions.handleMiddleClick(e) }}
        onPointerMove={(e) => { actions.movePanning(e); actions.moveLongPress(e) }}
        onPointerUp={(e) => { actions.endPanning(e); actions.cancelLongPress() }}
        onPointerLeave={(e) => { actions.endPanning(e); actions.cancelLongPress() }}
      >
        <div class="board-stage" style={boardStageStyle()}>
          <main class="board">
            <For each={ws.state.columns}>
              {(column) => (
                <TodoCard
                  cardId={column.id}
                  column={column}
                  draft={ws.state.drafts[column.id]}
                  onDraftChange={actions.setDraft}
                  onAdd={actions.addItem}
                  onUpdateItemText={actions.updateItemText}
                  onUpdateItemDetails={actions.updateItemDetails}
                  onDeleteItem={actions.deleteItem}
                  onDragStartItem={actions.handleDragStartItem}
                  onDragOverItem={actions.handleDragOverItem}
                  onDropOnItem={actions.handleDropOnItem}
                  onDropOnList={actions.handleDropOnList}
                  onDragEndItem={actions.handleDragEndItem}
                  draggingItemId={ws.state.dragState.columnId === column.id ? ws.state.dragState.itemId : null}
                  position={ws.state.cardPositions[column.id]}
                  onPointerDown={actions.handleCardPointerDown}
                  onUpdateTitle={actions.updateTodoCardTitle}
                  onUpdateColor={actions.updateTodoCardColor}
                  onUpdateFontSize={actions.updateTodoCardFontSize}
                  onMoveCard={actions.moveCardToTarget}
                  onToggleMinimize={actions.toggleTodoCardMinimize}
                  onDuplicateCard={actions.duplicateTodoCard}
                  onArchiveCard={actions.archiveTodoCard}
                  onDeleteCard={actions.deleteTodoCard}
                  isPopping={ws.state.poppingCardIds.has(column.id)}
                />
              )}
            </For>

            <For each={ws.state.detachedLabels}>
              {(label) => (
                <LabelCard
                  cardId={label.id}
                  label={label}
                  labelTextColor={ws.state.theme.labelText}
                  position={ws.state.cardPositions[label.id]}
                  onPointerDown={actions.handleCardPointerDown}
                  onUpdateText={actions.updateLabelText}
                  onUpdateColor={actions.updateLabelColor}
                  onUpdateFontSize={actions.updateLabelFontSize}
                  onMoveCard={actions.moveCardToTarget}
                  onToggleMinimize={actions.toggleLabelMinimize}
                  onDuplicateCard={actions.duplicateLabelCard}
                  onArchiveCard={actions.archiveLabelCard}
                  onDeleteCard={actions.deleteLabelCard}
                  isPopping={ws.state.poppingCardIds.has(label.id)}
                />
              )}
            </For>

            <For each={ws.state.singleNotes}>
              {(note) => (
                <SingleNoteCard
                  cardId={note.id}
                  singleNote={note}
                  position={ws.state.cardPositions[note.id]}
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
                  isPopping={ws.state.poppingCardIds.has(note.id)}
                />
              )}
            </For>

            <For each={ws.state.notes}>
              {(note) => (
                <NoteCard
                  cardId={note.id}
                  note={note}
                  position={ws.state.cardPositions[note.id]}
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
                  onUpdateDimensions={(w, h) => actions.updateNoteDimensions(note.id, w, h)}
                  scale={ws.state.viewport.scale}
                  isPopping={ws.state.poppingCardIds.has(note.id)}
                />
              )}
            </For>

            <For each={ws.state.timers}>
              {(timer) => (
                <TimerCard
                  cardId={timer.id}
                  timer={timer}
                  position={ws.state.cardPositions[timer.id]}
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
                  isPopping={ws.state.poppingCardIds.has(timer.id)}
                />
              )}
            </For>

            <For each={ws.state.counters}>
              {(counter) => (
                <CounterCard
                  cardId={counter.id}
                  counter={counter}
                  position={ws.state.cardPositions[counter.id]}
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
                  isPopping={ws.state.poppingCardIds.has(counter.id)}
                />
              )}
            </For>

            <For each={ws.state.stopwatches}>
              {(stopwatch) => (
                <StopwatchCard
                  cardId={stopwatch.id}
                  stopwatch={stopwatch}
                  position={ws.state.cardPositions[stopwatch.id]}
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
                  isPopping={ws.state.poppingCardIds.has(stopwatch.id)}
                />
              )}
            </For>

            <For each={ws.state.calendars}>
              {(calendar) => (
                <CalendarCard
                  cardId={calendar.id}
                  calendar={calendar}
                  allHabits={ws.state.habits}
                  position={ws.state.cardPositions[calendar.id]}
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
                  isPopping={ws.state.poppingCardIds.has(calendar.id)}
                />
              )}
            </For>

            <For each={ws.state.habits}>
              {(habit) => (
                <HabitCard
                  cardId={habit.id}
                  habit={habit}
                  position={ws.state.cardPositions[habit.id]}
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
                  isPopping={ws.state.poppingCardIds.has(habit.id)}
                />
              )}
            </For>

            <For each={ws.state.pictures}>
              {(picture) => (
                <PictureCard
                  cardId={picture.id}
                  picture={picture}
                  position={ws.state.cardPositions[picture.id]}
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
                  onUpdateDimensions={(w, h) => actions.updatePictureDimensions(picture.id, w, h)}
                  onUpdateFitMode={actions.updatePictureFitMode}
                  scale={ws.state.viewport.scale}
                  isPopping={ws.state.poppingCardIds.has(picture.id)}
                />
              )}
            </For>

            <For each={ws.state.quickLinks}>
              {(qlCard) => (
                <QuickLinksCard
                  cardId={qlCard.id}
                  quickLinkCard={qlCard}
                  position={ws.state.cardPositions[qlCard.id]}
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
                  isPopping={ws.state.poppingCardIds.has(qlCard.id)}
                />
              )}
            </For>

            <For each={ws.state.quotes}>
              {(quote) => (
                <QuoteCard
                  cardId={quote.id}
                  quote={quote}
                  position={ws.state.cardPositions[quote.id]}
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
                  onUpdateDimensions={(w, h) => actions.updateQuoteDimensions(quote.id, w, h)}
                  scale={ws.state.viewport.scale}
                  isPopping={ws.state.poppingCardIds.has(quote.id)}
                />
              )}
            </For>
          </main>
        </div>

        <ActionRail
          open={ws.state.isRailOpen}
          onToggle={handleToggleRail}
          quickActions={QUICK_CREATE_ACTIONS}
          onQuickAction={actions.handleQuickAction}
        />
      </div>

      <Show when={ws.state.toastMessage}>
        <div class="undo-toast">{ws.state.toastMessage}</div>
      </Show>

      <Show when={ws.state.isLongPressHolding}>
        <div
          class="long-press-ring"
          style={{ left: `${ws.state.longPressPos.x}px`, top: `${ws.state.longPressPos.y}px` }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="3" />
            <circle class="long-press-ring-fill" cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="3" />
          </svg>
        </div>
      </Show>

      <Show when={ws.state.longPressMenu.visible}>
        <LongPressContextMenu
          menu={ws.state.longPressMenu}
          quickActions={QUICK_CREATE_ACTIONS}
          onAction={(actionId) => {
            actions.handleQuickAction(actionId, null, { x: ws.state.longPressMenu.canvasX, y: ws.state.longPressMenu.canvasY })
            actions.closeLongPressMenu()
          }}
          onClose={actions.closeLongPressMenu}
        />
      </Show>
    </div>
  )
}

function LongPressContextMenu(props) {
  let menuRef

  onMount(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', handleKey)
    onCleanup(() => window.removeEventListener('keydown', handleKey))
  })

  return (
    <>
      <div class="long-press-backdrop" onClick={() => props.onClose()} />
      <div
        ref={menuRef}
        class="long-press-menu"
        style={{ left: `${props.menu.x}px`, top: `${props.menu.y}px` }}
      >
        <For each={props.quickActions}>
          {(action) => (
            <button
              type="button"
              class="long-press-menu-item"
              onClick={() => props.onAction(action.id)}
            >
              <ActionRailIcon kind={action.icon} />
              <span>{action.title}</span>
            </button>
          )}
        </For>
      </div>
    </>
  )
}
