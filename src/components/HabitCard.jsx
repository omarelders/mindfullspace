import { useState, memo } from 'react'
import { ChevronLeft, ChevronRight, Zap, GraduationCap, Code2, BookOpen, Dumbbell, Droplets, Sparkles, Check } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'
import { buildDateKey, formatCalendarMonthLabel } from '../utils/dateUtils'
import { HABIT_ICON_OPTIONS, HABIT_ICON_EMOJI_FALLBACKS } from '../utils/constants'

function normalizeHabitIconId(iconId) {
  if (HABIT_ICON_OPTIONS.some((option) => option.id === iconId)) {
    return iconId
  }

  if (iconId && HABIT_ICON_EMOJI_FALLBACKS[iconId]) {
    return HABIT_ICON_EMOJI_FALLBACKS[iconId]
  }

  return HABIT_ICON_OPTIONS[0].id
}

function HabitIcon({ iconId }) {
  const normalizedIconId = normalizeHabitIconId(iconId)

  switch (normalizedIconId) {
    case 'running':
      return <Zap className="habit-icon-svg" aria-hidden="true" />
    case 'studying':
      return <GraduationCap className="habit-icon-svg" aria-hidden="true" />
    case 'coding':
      return <Code2 className="habit-icon-svg" aria-hidden="true" />
    case 'reading':
      return <BookOpen className="habit-icon-svg" aria-hidden="true" />
    case 'workout':
      return <Dumbbell className="habit-icon-svg" aria-hidden="true" />
    case 'hydration':
      return <Droplets className="habit-icon-svg" aria-hidden="true" />
    case 'meditation':
      return <Sparkles className="habit-icon-svg" aria-hidden="true" />
    default:
      return null
  }
}

export const HabitCard = memo(function HabitCard({
  habit,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateIcon,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onSetView,
  onChangeMonth,
  onToggleDate,
  isPopping,
}) {
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const firstDayOfMonth = new Date(habit.year, habit.month, 1)
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(habit.year, habit.month + 1, 0).getDate()
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const currentYear = todayStart.getFullYear()
  const currentMonth = todayStart.getMonth()
  const currentDayOfMonth = todayStart.getDate()
  const todayKey = buildDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const todayIsDone = Boolean(habit.completions?.[todayKey])
  const hasHabitTitle = Boolean((habit.title || '').trim())
  const selectedIconId = normalizeHabitIconId(habit.icon)
  const selectedIconIndex = HABIT_ICON_OPTIONS.findIndex((option) => option.id === selectedIconId)
  const isViewingCurrentMonth = habit.year === currentYear && habit.month === currentMonth
  const [editingName, setEditingName] = useState(false)
  const [editingNameValue, setEditingNameValue] = useState('')

  const startEditingName = () => {
    setEditingName(true)
    setEditingNameValue(habit.title || '')
  }

  const cancelEditingName = () => {
    setEditingName(false)
    setEditingNameValue('')
  }

  const commitEditingName = () => {
    const nextTitle = editingNameValue.trim()
    if (!nextTitle) {
      cancelEditingName()
      return
    }

    if (nextTitle !== (habit.title || '')) {
      onUpdateTitle(habit.id, nextTitle)
    }

    cancelEditingName()
  }

  const cycleHabitIcon = (direction) => {
    const totalOptions = HABIT_ICON_OPTIONS.length
    if (!totalOptions) {
      return
    }

    const startIndex = selectedIconIndex >= 0 ? selectedIconIndex : 0
    const nextIndex = (startIndex + direction + totalOptions) % totalOptions
    onUpdateIcon(habit.id, HABIT_ICON_OPTIONS[nextIndex].id)
  }

  let doneInViewedMonth = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = buildDateKey(habit.year, habit.month, day)
    if (habit.completions?.[dateKey]) {
      doneInViewedMonth += 1
    }
  }

  let missingInViewedMonth = 0
  if (isViewingCurrentMonth) {
    for (let day = 1; day < currentDayOfMonth; day += 1) {
      const dateKey = buildDateKey(habit.year, habit.month, day)
      if (!habit.completions?.[dateKey]) {
        missingInViewedMonth += 1
      }
    }
  }

  let doneInCurrentMonth = 0
  for (let day = 1; day <= currentDayOfMonth; day += 1) {
    const dateKey = buildDateKey(currentYear, currentMonth, day)
    const isDone = Boolean(habit.completions?.[dateKey])
    if (isDone) {
      doneInCurrentMonth += 1
    }
  }

  return (
    <section
      className={`floating-card habit-card card-habit ${habit.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: habit.color || undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{habit.title || 'Habit'}</span>
        <CardContextMenu
          title={habit.title || 'Habit'}
          minimized={Boolean(habit.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(habit.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(habit.id, color)}
          onMove={(targetId) => onMoveCard(habit.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(habit.id)}
          onDuplicate={() => onDuplicateCard(habit.id)}
          onArchive={() => onArchiveCard(habit.id)}
          onDelete={() => onDeleteCard(habit.id)}
        />
      </header>

      {!habit.minimized && (
        <div className="habit-body">
          {habit.view === 'calendar' ? (
            <div className="habit-calendar-view">
              <div className="habit-calendar-toolbar">
                <button
                  type="button"
                  className="habit-back-btn"
                  aria-label="back to habit"
                  onClick={() => onSetView(habit.id, 'summary')}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>

                <div className="habit-month-nav">
                  <button
                    type="button"
                    className="habit-nav-btn"
                    aria-label="previous month"
                    onClick={() => onChangeMonth(habit.id, -1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <h4 className="habit-month-label">{formatCalendarMonthLabel(habit.year, habit.month)}</h4>
                  <button
                    type="button"
                    className="habit-nav-btn"
                    aria-label="next month"
                    onClick={() => onChangeMonth(habit.id, 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="habit-weekdays">
                {weekdayLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="habit-days-grid">
                {Array.from({ length: firstWeekday }).map((_, index) => (
                  <span key={`habit-blank-${index}`} className="habit-day habit-day-empty" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const dayNumber = index + 1
                  const dateKey = buildDateKey(habit.year, habit.month, dayNumber)
                  const isDone = Boolean(habit.completions?.[dateKey])
                  const dayStart = new Date(habit.year, habit.month, dayNumber)
                  const isToday = dayStart.getTime() === todayStart.getTime()
                  const isMissed = isViewingCurrentMonth && dayStart < todayStart && !isDone
                  const isFuture = dayStart > todayStart
                  const canToggle = dayStart <= todayStart

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={`habit-day ${isDone ? 'is-done' : ''} ${isMissed ? 'is-missed' : ''} ${isFuture ? 'is-future' : ''} ${isToday ? 'is-today' : ''}`}
                      onClick={() => onToggleDate(habit.id, dateKey)}
                      disabled={!canToggle}
                      aria-label={`toggle habit for day ${dayNumber}`}
                    >
                      {dayNumber}
                    </button>
                  )
                })}
              </div>

              <div className="habit-calendar-stats">
                <span>{doneInViewedMonth} done</span>
                <span>{missingInViewedMonth} missing</span>
              </div>
            </div>
          ) : (
            <div className="habit-summary-view">
              <div className="habit-icon-switcher">
                <button
                  type="button"
                  className="habit-icon-nav"
                  onClick={() => cycleHabitIcon(-1)}
                  aria-label="previous habit icon"
                >
                  <ChevronLeft aria-hidden="true" />
                </button>

                <div className="habit-icon-circle" aria-hidden="true">
                  <HabitIcon iconId={selectedIconId} />
                </div>

                <button
                  type="button"
                  className="habit-icon-nav"
                  onClick={() => cycleHabitIcon(1)}
                  aria-label="next habit icon"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <div className="habit-title-row">
                {editingName ? (
                  <input
                    type="text"
                    className="habit-name-edit"
                    value={editingNameValue}
                    onChange={(event) => setEditingNameValue(event.target.value)}
                    onBlur={commitEditingName}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitEditingName()
                      }

                      if (event.key === 'Escape') {
                        cancelEditingName()
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className={`habit-name habit-name-btn ${hasHabitTitle ? 'is-custom' : ''}`}
                    onClick={startEditingName}
                    aria-label="edit habit name"
                  >
                    {habit.title || 'Habit...'}
                  </button>
                )}

                <button
                  type="button"
                  className="habit-open-calendar"
                  aria-label="open habit calendar"
                  onClick={() => onSetView(habit.id, 'calendar')}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                className={`habit-check-btn ${todayIsDone ? 'is-done' : ''}`}
                onClick={() => onToggleDate(habit.id, todayKey)}
                aria-label="toggle today habit done"
              >
                <Check aria-hidden="true" />
              </button>

              <div className="habit-done-text">{doneInCurrentMonth} x done</div>
            </div>
          )}
        </div>
      )}
    </section>
  )
})
