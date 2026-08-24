import { Plus, Tag, FileText, ListTodo, Hash, TimerReset, Timer, Link2, CalendarDays, CircleCheck, Image, Quote, StickyNote } from 'lucide-react'

export function ActionRailIcon({ kind }) {
  switch (kind) {
    case 'label':
      return <Tag aria-hidden="true" />
    case 'singlenote':
    case 'single-note':
      return <StickyNote aria-hidden="true" />
    case 'note':
      return <FileText aria-hidden="true" />
    case 'todo-list':
      return <ListTodo aria-hidden="true" />
    case 'counter':
      return <Hash aria-hidden="true" />
    case 'stopwatch':
      return <TimerReset aria-hidden="true" />
    case 'timer':
      return <Timer aria-hidden="true" />
    case 'quick-links':
      return <Link2 aria-hidden="true" />
    case 'calendar':
      return <CalendarDays aria-hidden="true" />
    case 'habit':
      return <CircleCheck aria-hidden="true" />
    case 'picture':
      return <Image aria-hidden="true" />
    case 'quote':
      return <Quote aria-hidden="true" />
    default:
      return null
  }
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

export function ActionRail({ open, onToggle, quickActions, onQuickAction }) {
  return (
    <aside className={`action-rail orbital-rail ${open ? 'is-open' : ''}`} aria-label="action rail">
      <div className={`rail-items ${open ? 'open' : ''}`}>
        {quickActions.map((action, index) => {
          const config = ORBITAL_LAYOUT[index] || { radius: 180, angle: 45 }
          const rad = (config.angle * Math.PI) / 180
          const tx = -(config.radius * Math.cos(rad)).toFixed(1)
          const ty = -(config.radius * Math.sin(rad)).toFixed(1)
          const isInner = index >= 7

          return (
            <button
              key={action.id}
              className={`rail-button orbital-satellite ${isInner ? 'inner-orbit' : 'outer-orbit'}`}
              aria-label={action.title}
              title={action.title}
              data-card-type={action.id}
              style={{
                '--item-index': index,
                '--orbit-index': isInner ? index - 7 : index,
                '--is-inner': isInner ? 1 : 0,
                '--total-items': quickActions.length,
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
              }}
              onClick={() => onQuickAction(action.id)}
            >
              <ActionRailIcon kind={action.icon} />
            </button>
          )
        })}
      </div>

      <button
        className={`rail-button rail-add ${open ? 'is-open' : ''}`}
        aria-label={open ? 'Close action menu' : 'Add card'}
        title={open ? 'Close action menu' : 'Add card'}
        aria-expanded={open}
        onClick={onToggle}
      >
        <Plus aria-hidden="true" />
      </button>
    </aside>
  )
}
