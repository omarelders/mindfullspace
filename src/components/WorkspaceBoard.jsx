import { useRef } from 'react'
import { ActionRail } from './ActionRail'
import { TodoCard } from './TodoCard'
import { LabelCard } from './LabelCard'
import { NoteCard } from './NoteCard'
import { TimerCard } from './TimerCard'
import { CounterCard } from './CounterCard'
import { StopwatchCard } from './StopwatchCard'
import { CalendarCard } from './CalendarCard'
import { HabitCard } from './HabitCard'
import { PictureCard } from './PictureCard'
import { QuickLinksCard } from './QuickLinksCard'
import { TopBar } from './TopBar'
import { useWorkspace } from '../hooks/useWorkspace'
import { QUICK_CREATE_ACTIONS } from '../utils/constants'

// Note: supportsNativeZoom check omitted for simplicity but would typically come from a utility
const supportsNativeZoom = 'zoom' in document.createElement('div').style

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
      columns, drafts, viewport, isPanning, isRailOpen, isFocusMode, themeMode, theme,
      dragState, notes, timers, counters, stopwatches, calendars, habits, pictures, quickLinks,
      archivedCards, detachedLabels, cardPositions, draggingCard, poppingCardIds, toastMessage
    },
    setters: { setThemeMode, setIsFocusMode, setIsRailOpen },
    actions
  } = useWorkspace(workspace.id, workspaceRef)

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
        isWorkspaceMenuOpen={false} // Would need lifting state if we want to share this, but internal to TopBar works for now
        setIsWorkspaceMenuOpen={() => {}} 
        quickActions={QUICK_CREATE_ACTIONS}
        onQuickAction={actions.handleQuickAction}
        labels={detachedLabels}
        onSelectLabel={actions.focusLabelCard}
        archivedCards={archivedCards}
        habits={habits}
        onRestoreArchivedCard={actions.restoreArchivedCard}
      />

      <div className={`focus-overlay ${isFocusMode ? 'is-active' : ''}`} aria-hidden="true" />

      <div
        className={`workspace ${isPanning ? 'is-panning' : ''} ${draggingCard ? 'is-card-dragging' : ''}`}
        ref={workspaceRef}
        onContextMenu={(event) => event.preventDefault()}
        onWheel={actions.handleWheel}
        onMouseDown={actions.startPanning}
        onMouseMove={actions.movePanning}
        onMouseUp={actions.endPanning}
        onMouseLeave={actions.endPanning}
      >
        <div className="board-stage" style={boardStageStyle}>
          <main className="board">
            {columns.map((column) => (
              <TodoCard
                key={column.id}
                column={column}
                draft={drafts[column.id]}
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
                draggingItemId={dragState.columnId === column.id ? dragState.itemId : null}
                position={cardPositions[column.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(column.id, e)}
                onUpdateTitle={actions.updateTodoCardTitle}
                onUpdateColor={actions.updateTodoCardColor}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleTodoCardMinimize}
                onDuplicateCard={actions.duplicateTodoCard}
                onArchiveCard={actions.archiveTodoCard}
                onDeleteCard={actions.deleteTodoCard}
                isPopping={poppingCardIds.has(column.id)}
              />
            ))}

            {detachedLabels.map((label) => (
              <LabelCard
                key={label.id}
                label={label}
                labelTextColor={theme.labelText}
                position={cardPositions[label.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(label.id, e)}
                onUpdateText={actions.updateLabelText}
                onUpdateColor={actions.updateLabelColor}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleLabelMinimize}
                onDuplicateCard={actions.duplicateLabelCard}
                onArchiveCard={actions.archiveLabelCard}
                onDeleteCard={actions.deleteLabelCard}
                isPopping={poppingCardIds.has(label.id)}
              />
            ))}

            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                position={cardPositions[note.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(note.id, e)}
                onUpdateTitle={actions.updateNoteTitle}
                onUpdateText={actions.updateNoteText}
                onUpdateColor={actions.updateNoteColor}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleNoteMinimize}
                onDuplicateCard={actions.duplicateNoteCard}
                onArchiveCard={actions.archiveNoteCard}
                onDeleteCard={actions.deleteNoteCard}
                isPopping={poppingCardIds.has(note.id)}
              />
            ))}
            
            {timers.map((timer) => (
              <TimerCard
                key={timer.id}
                timer={timer}
                position={cardPositions[timer.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(timer.id, e)}
                onUpdateTitle={actions.updateTimerTitle}
                onUpdateColor={actions.updateTimerColor}
                onUpdateRemainingSeconds={actions.updateTimerRemainingSeconds}
                onUpdateInitialSeconds={actions.updateTimerInitialSeconds}
                onUpdatePomodoroConfig={actions.updatePomodoroConfig}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleTimerMinimize}
                onDuplicateCard={actions.duplicateTimerCard}
                onArchiveCard={actions.archiveTimerCard}
                onDeleteCard={actions.deleteTimerCard}
                isPopping={poppingCardIds.has(timer.id)}
              />
            ))}
            
            {counters.map((counter) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                position={cardPositions[counter.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(counter.id, e)}
                onUpdateTitle={actions.updateCounterTitle}
                onUpdateValue={actions.updateCounterValue}
                onUpdateColor={actions.updateCounterColor}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleCounterMinimize}
                onDuplicateCard={actions.duplicateCounterCard}
                onArchiveCard={actions.archiveCounterCard}
                onDeleteCard={actions.deleteCounterCard}
                isPopping={poppingCardIds.has(counter.id)}
              />
            ))}

            {stopwatches.map((stopwatch) => (
              <StopwatchCard
                key={stopwatch.id}
                stopwatch={stopwatch}
                position={cardPositions[stopwatch.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(stopwatch.id, e)}
                onUpdateTitle={actions.updateStopwatchTitle}
                onUpdateColor={actions.updateStopwatchColor}
                onUpdateElapsedSeconds={actions.updateStopwatchElapsedSeconds}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.toggleStopwatchMinimize}
                onDuplicateCard={actions.duplicateStopwatchCard}
                onArchiveCard={actions.archiveStopwatchCard}
                onDeleteCard={actions.deleteStopwatchCard}
                isPopping={poppingCardIds.has(stopwatch.id)}
              />
            ))}

            {calendars.map((calendar) => (
              <CalendarCard
                key={calendar.id}
                calendar={calendar}
                position={cardPositions[calendar.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(calendar.id, e)}
                onUpdateTitle={actions.updateCalendarTitle}
                onUpdateColor={actions.updateCalendarColor}
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
            ))}

            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                position={cardPositions[habit.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(habit.id, e)}
                onUpdateTitle={actions.updateHabitTitle}
                onUpdateIcon={actions.updateHabitIcon}
                onUpdateColor={actions.updateHabitColor}
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
            ))}

            {pictures.map((picture) => (
              <PictureCard
                key={picture.id}
                picture={picture}
                position={cardPositions[picture.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(picture.id, e)}
                onUpdateTitle={actions.updatePictureTitle}
                onUpdateColor={actions.updatePictureColor}
                onMoveCard={actions.moveCardToTarget}
                onToggleMinimize={actions.togglePictureMinimize}
                onDuplicateCard={actions.duplicatePictureCard}
                onArchiveCard={actions.archivePictureCard}
                onDeleteCard={actions.deletePictureCard}
                onUpdateImageId={actions.updatePictureImageId}
                onUpdateDimensions={(width, height) => actions.updatePictureDimensions(picture.id, width, height)}
                scale={viewport.scale}
                isPopping={poppingCardIds.has(picture.id)}
              />
            ))}

            {quickLinks.map((qlCard) => (
              <QuickLinksCard
                key={qlCard.id}
                quickLinkCard={qlCard}
                position={cardPositions[qlCard.id]}
                onMouseDown={(e) => actions.handleCardMouseDown(qlCard.id, e)}
                onUpdateTitle={actions.updateQuickLinksTitle}
                onUpdateColor={actions.updateQuickLinksColor}
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
            ))}
          </main>
        </div>

        <ActionRail
          open={isRailOpen}
          onToggle={() => setIsRailOpen((isOpen) => !isOpen)}
          quickActions={QUICK_CREATE_ACTIONS}
          onQuickAction={actions.handleQuickAction}
        />
      </div>

      {toastMessage && (
        <div className="undo-toast" key={toastMessage}>{toastMessage}</div>
      )}
    </div>
  )
}
