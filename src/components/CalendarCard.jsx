import { memo, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'
import { HabitIcon } from './HabitCard'
import { buildDateKey, formatCalendarMonthLabel, formatCalendarEntryLabel } from '../utils/dateUtils'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const CalendarCard = memo(function CalendarCard({
  calendar,
  allHabits = [],
  position,
  onPointerDown,
  onUpdateTitle,
  onUpdateColor,
  onUpdateFontSize,
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
  cardId,
}) {
  const customStyle = calendar.fontSize ? { fontSize: `${calendar.fontSize}px` } : undefined
  const entryStyle = calendar.fontSize ? { fontSize: `${Math.max(10, Math.round(calendar.fontSize * 0.85))}px` } : undefined
  const { firstWeekday, daysInMonth, todayKey } = useMemo(() => {
    const firstDayOfMonth = new Date(calendar.year, calendar.month, 1)
    const fWeekday = (firstDayOfMonth.getDay() + 6) % 7
    const dInMonth = new Date(calendar.year, calendar.month + 1, 0).getDate()
    const today = new Date()
    const tKey = buildDateKey(today.getFullYear(), today.getMonth(), today.getDate())
    return { firstWeekday: fWeekday, daysInMonth: dInMonth, todayKey: tKey }
  }, [calendar.year, calendar.month])

  const weekdayLabels = WEEKDAY_LABELS
  const currentEntry = calendar.selectedDate ? calendar.entries?.[calendar.selectedDate] || '' : ''

  return (
    <section
      data-card-id={cardId}
      className={`floating-card calendar-card card-calendar ${calendar.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: calendar.color || undefined,
      }}
    >
      <header className="card-header" onPointerDown={(e) => onPointerDown(cardId, e)} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
        <span className="card-title">{calendar.title || 'Calendar'}</span>
        <CardContextMenu
          title={calendar.title || 'Calendar'}
          minimized={Boolean(calendar.minimized)}
          fontSize={calendar.fontSize || 16}
          onTitleChange={(nextTitle) => onUpdateTitle(calendar.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(calendar.id, color)}
          onFontSizeChange={(nextSize) => onUpdateFontSize && onUpdateFontSize(calendar.id, nextSize)}
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

              {allHabits?.length > 0 && (
                <div className="calendar-entry-habits">
                  <div className="calendar-entry-habits-title">Habits</div>
                  <div className="calendar-entry-habits-list">
                    {allHabits.map((habit) => {
                      const isDone = Boolean(habit.completions?.[calendar.selectedDate])
                      return (
                        <div key={habit.id} className={`calendar-entry-habit-item ${isDone ? 'is-done' : ''}`} title={habit.title || 'Habit'}>
                          <div className="calendar-entry-habit-icon">
                            <HabitIcon iconId={habit.icon} />
                          </div>
                          <span className="calendar-entry-habit-name">{habit.title || 'Habit'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <textarea
                className="calendar-entry-input"
                style={entryStyle}
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
                      style={customStyle}
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
})
