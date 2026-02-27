import { Plus, Tag, FileText, ListTodo, Hash, TimerReset, Timer, Link2, CalendarDays, CircleCheck, Image } from 'lucide-react'

export function ActionRailIcon({ kind }) {
  switch (kind) {
    case 'label':
      return <Tag aria-hidden="true" />
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
    default:
      return null
  }
}

export function ActionRail({ open, onToggle, quickActions, onQuickAction }) {
  return (
    <aside className="action-rail" aria-label="action rail">
      <div className={`rail-items ${open ? 'open' : ''}`}>
        {quickActions.map((action) => (
          <button
            key={action.id}
            className="rail-button"
            aria-label={action.title}
            onClick={() => {
              onQuickAction(action.id)
              onToggle() // Close the menu
            }}
          >
            <ActionRailIcon kind={action.icon} />
            <span className="rail-button-label">{action.title}</span>
          </button>
        ))}
      </div>
      <button
        className="rail-button rail-add"
        aria-label="toggle action menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Plus aria-hidden="true" />
      </button>
    </aside>
  )
}
