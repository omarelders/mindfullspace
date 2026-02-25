import { memo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'
import { buildDateKey, formatCalendarMonthLabel, formatCalendarEntryLabel } from '../utils/dateUtils'

export const CalendarCard = memo(function CalendarCard({
  calendar,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
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
}) {
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const firstDayOfMonth = new Date(calendar.year, calendar.month, 1)
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(calendar.year, calendar.month + 1, 0).getDate()
  const today = new Date()
  const todayKey = buildDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const currentEntry = calendar.selectedDate ? calendar.entries?.[calendar.selectedDate] || '' : ''

  return (
    <section
      className={`floating-card calendar-card card-calendar ${calendar.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: calendar.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{calendar.title || 'Calendar'}</span>
        <CardContextMenu
          title={calendar.title || 'Calendar'}
          minimized={Boolean(calendar.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(calendar.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(calendar.id, color)}
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
              <textarea
                className="calendar-entry-input"
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
