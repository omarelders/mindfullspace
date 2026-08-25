import { For, Switch, Match, Show } from 'solid-js'
import { Plus, Tag, FileText, ListTodo, Hash, TimerReset, Timer, Link2, CalendarDays, CircleCheck, Image, Quote, StickyNote } from 'lucide-solid'

export function ActionRailIcon(props) {
  return (
    <Switch fallback={null}>
      <Match when={props.kind === 'label'}><Tag aria-hidden="true" /></Match>
      <Match when={props.kind === 'singlenote' || props.kind === 'single-note'}><StickyNote aria-hidden="true" /></Match>
      <Match when={props.kind === 'note'}><FileText aria-hidden="true" /></Match>
      <Match when={props.kind === 'todo-list'}><ListTodo aria-hidden="true" /></Match>
      <Match when={props.kind === 'counter'}><Hash aria-hidden="true" /></Match>
      <Match when={props.kind === 'stopwatch'}><TimerReset aria-hidden="true" /></Match>
      <Match when={props.kind === 'timer'}><Timer aria-hidden="true" /></Match>
      <Match when={props.kind === 'quick-links'}><Link2 aria-hidden="true" /></Match>
      <Match when={props.kind === 'calendar'}><CalendarDays aria-hidden="true" /></Match>
      <Match when={props.kind === 'habit'}><CircleCheck aria-hidden="true" /></Match>
      <Match when={props.kind === 'picture'}><Image aria-hidden="true" /></Match>
      <Match when={props.kind === 'quote'}><Quote aria-hidden="true" /></Match>
    </Switch>
  )
}

// 12 Items distributed across 2 concentric orbital arcs:
// Outer Arc: 7 items (indices 0..6), Radius 228px, Angles 6°..86°
// Inner Arc: 5 items (indices 7..11), Radius 134px, Angles 6°..86°
const ORBITAL_LAYOUT = [
  // Outer Arc (7 items)
  { radius: 228, angle: 6 },
  { radius: 228, angle: 19.3 },
  { radius: 228, angle: 32.7 },
  { radius: 228, angle: 46 },
  { radius: 228, angle: 59.3 },
  { radius: 228, angle: 72.7 },
  { radius: 228, angle: 86 },
  // Inner Arc (5 items)
  { radius: 134, angle: 6 },
  { radius: 134, angle: 26 },
  { radius: 134, angle: 46 },
  { radius: 134, angle: 66 },
  { radius: 134, angle: 86 },
]

export function ActionRail(props) {
  return (
    <aside class={`action-rail orbital-rail ${props.open ? 'is-open' : ''}`} aria-label="action rail">
      <div class={`rail-items ${props.open ? 'open' : ''}`}>
        <For each={props.quickActions}>
          {(action, index) => {
            const i = index()
            const config = ORBITAL_LAYOUT[i] || { radius: 180, angle: 45 }
            const rad = (config.angle * Math.PI) / 180
            const tx = -(config.radius * Math.cos(rad)).toFixed(1)
            const ty = -(config.radius * Math.sin(rad)).toFixed(1)
            const isInner = i >= 7

            return (
              <button
                type="button"
                class={`rail-button orbital-satellite ${isInner ? 'inner-orbit' : 'outer-orbit'}`}
                aria-label={action.title}
                title={action.title}
                data-card-type={action.id}
                style={{
                  '--item-index': `${i}`,
                  '--orbit-index': `${isInner ? i - 7 : i}`,
                  '--is-inner': isInner ? 1 : 0,
                  '--total-items': `${props.quickActions.length}`,
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                }}
                onClick={() => props.onQuickAction(action.id)}
              >
                <ActionRailIcon kind={action.icon} />
              </button>
            )
          }}
        </For>
      </div>

      <button
        type="button"
        class={`rail-button rail-add ${props.open ? 'is-open' : ''}`}
        aria-label={props.open ? 'Close action menu' : 'Add card'}
        title={props.open ? 'Close action menu' : 'Add card'}
        aria-expanded={props.open}
        onClick={() => props.onToggle?.()}
      >
        <Plus aria-hidden="true" />
      </button>
    </aside>
  )
}
