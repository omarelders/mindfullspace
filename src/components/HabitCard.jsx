import { createSignal, createMemo, Show, For, Switch, Match } from 'solid-js'
import { ChevronLeft, ChevronRight, Zap, GraduationCap, Code2, BookOpen, Dumbbell, Droplets, Sparkles, Check } from 'lucide-solid'
import { CardContextMenu } from './CardContextMenu'
import { buildDateKey, formatCalendarMonthLabel } from '../utils/dateUtils'
import { HABIT_ICON_OPTIONS, HABIT_ICON_EMOJI_FALLBACKS } from '../utils/constants'
import { playTaskCompleteSound } from '../utils/audio'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function normalizeHabitIconId(iconId) {
  if (HABIT_ICON_OPTIONS.some((option) => option.id === iconId)) {
    return iconId
  }

  if (iconId && HABIT_ICON_EMOJI_FALLBACKS[iconId]) {
    return HABIT_ICON_EMOJI_FALLBACKS[iconId]
  }

  return HABIT_ICON_OPTIONS[0].id
}

export function HabitIcon(props) {
  const normalizedIconId = () => normalizeHabitIconId(props.iconId)

  return (
    <Switch fallback={<Zap class="habit-icon-svg" aria-hidden="true" />}>
      <Match when={normalizedIconId() === 'running'}><Zap class="habit-icon-svg" aria-hidden="true" /></Match>
      <Match when={normalizedIconId() === 'studying'}><GraduationCap class="habit-icon-svg" aria-hidden="true" /></Match>
      <Match when={normalizedIconId() === 'coding'}><Code2 class="habit-icon-svg" aria-hidden="true" /></Match>
      <Match when={normalizedIconId() === 'reading'}><BookOpen class="habit-icon-svg" aria-hidden="true" /></Match>
      <Match when={normalizedIconId() === 'workout'}><Dumbbell class="habit-icon-svg" aria-hidden="true" /></Match>
      <Match when={normalizedIconId() === 'hydration'}><Droplets class="habit-icon-svg" aria-hidden="true" /></Match>
      <Match when={normalizedIconId() === 'meditation'}><Sparkles class="habit-icon-svg" aria-hidden="true" /></Match>
    </Switch>
  )
}

export function HabitCard(props) {
  const customStyle = () => props.habit.fontSize ? { "font-size": `${props.habit.fontSize}px` } : undefined
  const weekdayLabels = WEEKDAY_LABELS

  const stats = createMemo(() => {
    const habit = props.habit
    const firstDayOfMonth = new Date(habit.year, habit.month, 1)
    const fWeekday = (firstDayOfMonth.getDay() + 6) % 7
    const dInMonth = new Date(habit.year, habit.month + 1, 0).getDate()
    const t = new Date()
    const tStart = new Date(t.getFullYear(), t.getMonth(), t.getDate())
    const curYear = tStart.getFullYear()
    const curMonth = tStart.getMonth()
    const curDay = tStart.getDate()
    const tKey = buildDateKey(t.getFullYear(), t.getMonth(), t.getDate())
    const viewingCurrent = habit.year === curYear && habit.month === curMonth

    let doneViewed = 0
    for (let day = 1; day <= dInMonth; day += 1) {
      const dateKey = buildDateKey(habit.year, habit.month, day)
      if (habit.completions?.[dateKey]) {
        doneViewed += 1
      }
    }

    let missingViewed = 0
    if (viewingCurrent) {
      for (let day = 1; day < curDay; day += 1) {
        const dateKey = buildDateKey(habit.year, habit.month, day)
        if (!habit.completions?.[dateKey]) {
          missingViewed += 1
        }
      }
    }

    let doneCurrent = 0
    for (let day = 1; day <= curDay; day += 1) {
      const dateKey = buildDateKey(curYear, curMonth, day)
      if (habit.completions?.[dateKey]) {
        doneCurrent += 1
      }
    }

    return {
      firstWeekday: fWeekday,
      daysInMonth: dInMonth,
      todayStart: tStart,
      todayKey: tKey,
      isViewingCurrentMonth: viewingCurrent,
      doneInViewedMonth: doneViewed,
      missingInViewedMonth: missingViewed,
      doneInCurrentMonth: doneCurrent,
    }
  })

  const todayIsDone = () => Boolean(props.habit.completions?.[stats().todayKey])
  const hasHabitTitle = () => Boolean((props.habit.title || '').trim())
  const selectedIconId = () => normalizeHabitIconId(props.habit.icon)
  const selectedIconIndex = () => HABIT_ICON_OPTIONS.findIndex((option) => option.id === selectedIconId())
  const [editingName, setEditingName] = createSignal(false)
  const [editingNameValue, setEditingNameValue] = createSignal('')

  const handleToggleDate = (dateKey) => {
    const isDone = Boolean(props.habit.completions?.[dateKey])
    if (!isDone) {
      playTaskCompleteSound()
    }
    if (props.onToggleDate) props.onToggleDate(props.habit.id, dateKey)
  }

  const startEditingName = () => {
    setEditingName(true)
    setEditingNameValue(props.habit.title || '')
  }

  const cancelEditingName = () => {
    setEditingName(false)
    setEditingNameValue('')
  }

  const commitEditingName = () => {
    const nextTitle = editingNameValue().trim()
    if (!nextTitle) {
      cancelEditingName()
      return
    }

    if (nextTitle !== (props.habit.title || '')) {
      props.onUpdateTitle(props.habit.id, nextTitle)
    }

    cancelEditingName()
  }

  const cycleHabitIcon = (direction) => {
    const totalOptions = HABIT_ICON_OPTIONS.length
    if (!totalOptions) {
      return
    }

    const startIndex = selectedIconIndex() >= 0 ? selectedIconIndex() : 0
    const nextIndex = (startIndex + direction + totalOptions) % totalOptions
    props.onUpdateIcon(props.habit.id, HABIT_ICON_OPTIONS[nextIndex].id)
  }

  return (
    <section
      data-card-id={props.cardId}
      class={`floating-card habit-card card-habit ${props.habit.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.habit.color || undefined,
      }}
    >
      <header class="card-header" onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)} style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}>
        <span class="card-title">{props.habit.title || 'Habit'}</span>
        <CardContextMenu
          title={props.habit.title || 'Habit'}
          minimized={Boolean(props.habit.minimized)}
          fontSize={props.habit.fontSize || 42}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.habit.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.habit.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.habit.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.habit.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.habit.id)}
          onDuplicate={() => props.onDuplicateCard(props.habit.id)}
          onArchive={() => props.onArchiveCard(props.habit.id)}
          onDelete={() => props.onDeleteCard(props.habit.id)}
        />
      </header>

      <Show when={!props.habit.minimized}>
        <div class="habit-body">
          <Show
            when={props.habit.view === 'calendar'}
            fallback={
              <div class="habit-summary-view">
                <div class="habit-icon-switcher">
                  <button
                    type="button"
                    class="habit-icon-nav"
                    onClick={() => cycleHabitIcon(-1)}
                    aria-label="previous habit icon"
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>

                  <div class="habit-icon-circle" aria-hidden="true">
                    <HabitIcon iconId={selectedIconId()} />
                  </div>

                  <button
                    type="button"
                    class="habit-icon-nav"
                    onClick={() => cycleHabitIcon(1)}
                    aria-label="next habit icon"
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>

                <div class="habit-title-row">
                  <Show
                    when={editingName()}
                    fallback={
                      <button
                        type="button"
                        class={`habit-name habit-name-btn ${hasHabitTitle() ? 'is-custom' : ''}`}
                        style={customStyle()}
                        onClick={startEditingName}
                        aria-label="edit habit name"
                      >
                        {props.habit.title || 'Habit...'}
                      </button>
                    }
                  >
                    <input
                      type="text"
                      class="habit-name-edit"
                      style={customStyle()}
                      value={editingNameValue()}
                      onInput={(event) => setEditingNameValue(event.currentTarget.value)}
                      onBlur={commitEditingName}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitEditingName()
                        }

                        if (event.key === 'Escape') {
                          cancelEditingName()
                        }
                      }}
                    />
                  </Show>

                  <button
                    type="button"
                    class="habit-open-calendar"
                    aria-label="open habit calendar"
                    onClick={() => props.onSetView(props.habit.id, 'calendar')}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  class={`habit-check-btn ${todayIsDone() ? 'is-done' : ''}`}
                  onClick={() => handleToggleDate(stats().todayKey)}
                  aria-label="toggle today habit done"
                >
                  <Check aria-hidden="true" />
                </button>

                <div class="habit-done-text">{stats().doneInCurrentMonth} x done</div>
              </div>
            }
          >
            <div class="habit-calendar-view">
              <div class="habit-calendar-toolbar">
                <button
                  type="button"
                  class="habit-back-btn"
                  aria-label="back to habit"
                  onClick={() => props.onSetView(props.habit.id, 'summary')}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>

                <div class="habit-month-nav">
                  <button
                    type="button"
                    class="habit-nav-btn"
                    aria-label="previous month"
                    onClick={() => props.onChangeMonth(props.habit.id, -1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <h4 class="habit-month-label">{formatCalendarMonthLabel(props.habit.year, props.habit.month)}</h4>
                  <button
                    type="button"
                    class="habit-nav-btn"
                    aria-label="next month"
                    onClick={() => props.onChangeMonth(props.habit.id, 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div class="habit-weekdays">
                <For each={weekdayLabels}>
                  {(label) => <span>{label}</span>}
                </For>
              </div>

              <div class="habit-days-grid">
                <For each={Array.from({ length: stats().firstWeekday })}>
                  {() => <span class="habit-day habit-day-empty" />}
                </For>
                <For each={Array.from({ length: stats().daysInMonth })}>
                  {(_, index) => {
                    const dayNumber = index() + 1
                    const dateKey = buildDateKey(props.habit.year, props.habit.month, dayNumber)
                    const isDone = Boolean(props.habit.completions?.[dateKey])
                    const dayStart = new Date(props.habit.year, props.habit.month, dayNumber)
                    const isToday = dayStart.getTime() === stats().todayStart.getTime()
                    const isMissed = stats().isViewingCurrentMonth && dayStart < stats().todayStart && !isDone
                    const isFuture = dayStart > stats().todayStart
                    const canToggle = dayStart <= stats().todayStart

                    return (
                      <button
                        type="button"
                        class={`habit-day ${isDone ? 'is-done' : ''} ${isMissed ? 'is-missed' : ''} ${isFuture ? 'is-future' : ''} ${isToday ? 'is-today' : ''}`}
                        onClick={() => handleToggleDate(dateKey)}
                        disabled={!canToggle}
                        aria-label={`toggle habit for day ${dayNumber}`}
                      >
                        {dayNumber}
                      </button>
                    )
                  }}
                </For>
              </div>

              <div class="habit-calendar-stats">
                <span>{stats().doneInViewedMonth} done</span>
                <span>{stats().missingInViewedMonth} missing</span>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </section>
  )
}
