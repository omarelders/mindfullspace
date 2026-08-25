import { createMemo, Show, For } from 'solid-js'
import { ChevronLeft, ChevronRight } from 'lucide-solid'
import { CardContextMenu } from './CardContextMenu'
import { HabitIcon } from './HabitCard'
import { buildDateKey, formatCalendarMonthLabel, formatCalendarEntryLabel } from '../utils/dateUtils'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarCard(props) {
  const allHabits = () => props.allHabits || []
  const customStyle = () => props.calendar.fontSize ? { "font-size": `${props.calendar.fontSize}px` } : undefined
  const entryStyle = () => props.calendar.fontSize ? { "font-size": `${Math.max(10, Math.round(props.calendar.fontSize * 0.85))}px` } : undefined

  const monthGeometry = createMemo(() => {
    const firstDayOfMonth = new Date(props.calendar.year, props.calendar.month, 1)
    const fWeekday = (firstDayOfMonth.getDay() + 6) % 7
    const dInMonth = new Date(props.calendar.year, props.calendar.month + 1, 0).getDate()
    const today = new Date()
    const tKey = buildDateKey(today.getFullYear(), today.getMonth(), today.getDate())
    return { firstWeekday: fWeekday, daysInMonth: dInMonth, todayKey: tKey }
  })

  const currentEntry = () => (props.calendar.selectedDate ? props.calendar.entries?.[props.calendar.selectedDate] || '' : '')

  return (
    <section
      data-card-id={props.cardId}
      class={`floating-card calendar-card card-calendar ${props.calendar.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.calendar.color || undefined,
      }}
    >
      <header class="card-header" onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)} style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}>
        <span class="card-title">{props.calendar.title || 'Calendar'}</span>
        <CardContextMenu
          title={props.calendar.title || 'Calendar'}
          minimized={Boolean(props.calendar.minimized)}
          fontSize={props.calendar.fontSize || 16}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.calendar.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.calendar.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.calendar.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.calendar.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.calendar.id)}
          onDuplicate={() => props.onDuplicateCard(props.calendar.id)}
          onArchive={() => props.onArchiveCard(props.calendar.id)}
          onDelete={() => props.onDeleteCard(props.calendar.id)}
        />
      </header>

      <Show when={!props.calendar.minimized}>
        <div class="calendar-panel-shell">
          <Show
            when={props.calendar.selectedDate}
            fallback={
              <div class="calendar-month-view">
                <div class="calendar-toolbar">
                  <button
                    type="button"
                    class="calendar-nav-btn"
                    aria-label="previous month"
                    onClick={() => props.onChangeMonth(props.calendar.id, -1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <h4 class="calendar-month-label">{formatCalendarMonthLabel(props.calendar.year, props.calendar.month)}</h4>
                  <button
                    type="button"
                    class="calendar-nav-btn"
                    aria-label="next month"
                    onClick={() => props.onChangeMonth(props.calendar.id, 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>

                <div class="calendar-weekdays">
                  <For each={WEEKDAY_LABELS}>
                    {(label) => <span>{label}</span>}
                  </For>
                </div>

                <div class="calendar-days-grid">
                  <For each={Array.from({ length: monthGeometry().firstWeekday })}>
                    {(_, index) => (
                      <span class="calendar-day calendar-day-empty" />
                    )}
                  </For>
                  <For each={Array.from({ length: monthGeometry().daysInMonth })}>
                    {(_, index) => {
                      const dayNumber = index() + 1
                      const dateKey = buildDateKey(props.calendar.year, props.calendar.month, dayNumber)
                      const hasEntry = Boolean(props.calendar.entries?.[dateKey]?.trim())
                      const isToday = dateKey === monthGeometry().todayKey

                      return (
                        <button
                          type="button"
                          class={`calendar-day ${isToday ? 'is-today' : ''} ${hasEntry ? 'has-entry' : ''}`}
                          style={customStyle()}
                          onClick={() => props.onOpenDay(props.calendar.id, dateKey)}
                          aria-label={`open day ${dayNumber}`}
                        >
                          {dayNumber}
                        </button>
                      )
                    }}
                  </For>
                </div>
              </div>
            }
          >
            <div class="calendar-entry-view">
              <div class="calendar-entry-top">
                <button
                  type="button"
                  class="calendar-back-btn"
                  aria-label="back to calendar month"
                  onClick={() => props.onCloseDay(props.calendar.id)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <div class="calendar-entry-date">{formatCalendarEntryLabel(props.calendar.selectedDate)}</div>
              </div>

              <Show when={allHabits().length > 0}>
                <div class="calendar-entry-habits">
                  <div class="calendar-entry-habits-title">Habits</div>
                  <div class="calendar-entry-habits-list">
                    <For each={allHabits()}>
                      {(habit) => {
                        const isDone = Boolean(habit.completions?.[props.calendar.selectedDate])
                        return (
                          <div class={`calendar-entry-habit-item ${isDone ? 'is-done' : ''}`} title={habit.title || 'Habit'}>
                            <div class="calendar-entry-habit-icon">
                              <HabitIcon iconId={habit.icon} />
                            </div>
                            <span class="calendar-entry-habit-name">{habit.title || 'Habit'}</span>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <textarea
                class="calendar-entry-input"
                style={entryStyle()}
                value={currentEntry()}
                onInput={(event) => props.onUpdateEntry(props.calendar.id, props.calendar.selectedDate, event.currentTarget.value)}
                placeholder="Write your journal entry..."
              />
            </div>
          </Show>
        </div>
      </Show>
    </section>
  )
}
