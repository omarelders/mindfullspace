import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Archive,
  Menu,
  Search,
  Settings,
  User,
  UserRound,
  ChevronDown,
  GripVertical,
  Check,
  Copy,
  Trash2,
  Plus,
  FilePlus2,
  Crosshair,
  Expand,
  Tag,
  FileText,
  ListTodo,
  Hash,
  Timer,
  TimerReset,
  Link2,
  CalendarDays,
  Sparkles,
  Image,
} from 'lucide-react'
import { buildDateKey } from '../utils/dateUtils'

function ActionRailIcon({ kind }) {
  switch (kind) {
    case 'label':
      return <Tag aria-hidden="true" />
    case 'note':
      return <FileText aria-hidden="true" />
    case 'todo-list':
      return <ListTodo aria-hidden="true" />
    case 'counter':
      return <Hash aria-hidden="true" />
    case 'timer':
      return <Timer aria-hidden="true" />
    case 'stopwatch':
      return <TimerReset aria-hidden="true" />
    case 'quick-links':
      return <Link2 aria-hidden="true" />
    case 'calendar':
      return <CalendarDays aria-hidden="true" />
    case 'habit':
      return <Sparkles aria-hidden="true" />
    case 'picture':
      return <Image aria-hidden="true" />
    default:
      return null
  }
}

export function TopBar({
  mode,
  onToggleMode,
  isFocusMode,
  onToggleFocusMode,
  workspace,
  allWorkspaces,
  onSwitchWorkspace,
  onUpdateName,
  onDuplicateWorkspace,
  onDeleteWorkspace,
  onCreateWorkspace,
  isWorkspaceMenuOpen,
  setIsWorkspaceMenuOpen,
  quickActions,
  onQuickAction,
  labels,
  onSelectLabel,
  archivedCards,
  habits,
  onRestoreArchivedCard,
}) {
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [activeAccountTab, setActiveAccountTab] = useState('profile')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const accountRef = useRef(null)
  const labelOptions = Array.isArray(labels) ? labels : []
  const archiveOptions = Array.isArray(archivedCards) ? archivedCards : []
  const habitOptions = Array.isArray(habits) ? habits : []
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredLabels = labelOptions.filter((label) =>
    !normalizedQuery || label.text.toLowerCase().includes(normalizedQuery),
  )

  const { streakDays, streakTimeline } = useMemo(() => {
    if (habitOptions.length === 0) {
      return {
        streakDays: 0,
        streakTimeline: [-3, -2, -1, 0, 1, 2].map((offset) => {
          const date = new Date()
          date.setDate(date.getDate() + offset)
          const dateKey = buildDateKey(date.getFullYear(), date.getMonth(), date.getDate())
          let status = 'missed'
          if (offset > 0) status = 'future'
          else if (offset === 0) status = 'today'
          return { key: `${dateKey}-${offset}`, status }
        }),
      }
    }

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const cursor = new Date(todayStart)
    let nextStreakDays = 0

    const isAllDoneOnDate = (dateKey) => {
      return habitOptions.every((habit) => habit.completions?.[dateKey] === true)
    }

    while (isAllDoneOnDate(buildDateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()))) {
      nextStreakDays += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    const timelineOffsets = [-3, -2, -1, 0, 1, 2]
    const nextTimeline = timelineOffsets.map((offset) => {
      const date = new Date(todayStart)
      date.setDate(todayStart.getDate() + offset)
      const dateKey = buildDateKey(date.getFullYear(), date.getMonth(), date.getDate())

      let status = 'missed'
      if (offset > 0) {
        status = 'future'
      } else if (isAllDoneOnDate(dateKey)) {
        status = offset === 0 ? 'today-done' : 'done'
      } else if (offset === 0) {
        status = 'today'
      }

      return {
        key: `${dateKey}-${offset}`,
        status,
      }
    })

    return {
      streakDays: nextStreakDays,
      streakTimeline: nextTimeline,
    }
  }, [habitOptions])

  const archivedItems = useMemo(
    () => [...archiveOptions].sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0)),
    [archiveOptions],
  )

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsQuickMenuOpen(false)
      }

      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false)
      }

      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setIsAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleSelectLabel = (label) => {
    if (onSelectLabel) {
      onSelectLabel(label.id)
    }
    setSearchQuery('')
    setIsSearchOpen(false)
  }

  const formatArchiveTypeLabel = (type) => {
    if (type === 'todo') return 'Todo'
    if (type === 'label') return 'Label'
    if (type === 'note') return 'Note'
    if (type === 'timer') return 'Timer'
    if (type === 'counter') return 'Counter'
    if (type === 'stopwatch') return 'Stopwatch'
    if (type === 'calendar') return 'Calendar'
    if (type === 'habit') return 'Habit'
    return 'Card'
  }

  const formatArchiveTitle = (entry) => {
    const data = entry?.data || {}
    if (entry?.type === 'label') return data.text || 'Label'
    if (entry?.type === 'todo') return data.title || 'Todo List'
    if (entry?.type === 'note') return data.title || (data.text ? data.text.slice(0, 28) : 'Note')
    if (entry?.type === 'timer') return data.title || 'Timer'
    if (entry?.type === 'counter') return data.title || 'Counter'
    if (entry?.type === 'stopwatch') return data.title || 'Stopwatch'
    if (entry?.type === 'calendar') return data.title || 'Calendar'
    if (entry?.type === 'habit') return data.title || 'Habit'
    return 'Archived Card'
  }

  const profileName = 'Omar Elders'
  const profileEmail = 'omarelders1968@gmail.com'
  const profileLevel = 1

  if (isFullscreen) return null

  return (
    <header className="top-bar">
      <div className="top-left">
        <div className="account-menu-wrap" ref={accountRef}>
          <button
            className={`nav-box ${isAccountMenuOpen ? 'is-open' : ''}`}
            aria-label="menu"
            aria-expanded={isAccountMenuOpen}
            onClick={() => {
              setIsAccountMenuOpen((open) => !open)
              setIsQuickMenuOpen(false)
              setIsSearchOpen(false)
            }}
          >
            <Menu aria-hidden="true" />
          </button>

          {isAccountMenuOpen && (
            <section className="account-panel" aria-label="account menu">
              <div className="account-tabs">
                <button
                  type="button"
                  className={`account-tab ${activeAccountTab === 'profile' ? 'is-active' : ''}`}
                  onClick={() => setActiveAccountTab('profile')}
                >
                  <User aria-hidden="true" />
                  Profile
                </button>
                <button
                  type="button"
                  className={`account-tab ${activeAccountTab === 'archive' ? 'is-active' : ''}`}
                  onClick={() => setActiveAccountTab('archive')}
                >
                  <Archive aria-hidden="true" />
                  Archive
                </button>
                <button
                  type="button"
                  className={`account-tab ${activeAccountTab === 'settings' ? 'is-active' : ''}`}
                  onClick={() => setActiveAccountTab('settings')}
                >
                  <Settings aria-hidden="true" />
                  Settings
                </button>
              </div>

              {activeAccountTab === 'profile' && (
                <div className="account-content">
                  <div className="account-profile-grid">
                    <div className="account-avatar-wrap">
                      <div className="account-avatar">
                        <UserRound aria-hidden="true" />
                      </div>
                    </div>

                    <div className="account-meta-stack">
                      <div className="account-meta-card account-meta-strong">{profileName}</div>
                      <div className="account-meta-card">
                        <User aria-hidden="true" />
                        Level {profileLevel}
                      </div>

                    </div>
                  </div>

                  <div className="account-email-row">
                    <span className="account-email-dot" aria-hidden="true" />
                    <span>{profileEmail}</span>
                  </div>

                  <div className="account-streak-card">
                    <div className="account-streak-header">
                      <span>You're on a</span>
                      <span>{streakDays} day streak in total 🔥</span>
                    </div>
                    <div className="account-streak-main">{streakDays} day streak</div>

                    <div className="account-streak-track" aria-hidden="true">
                      {streakTimeline.map((node) => (
                        <span key={node.key} className={`streak-node ${node.status}`} />
                      ))}
                    </div>
                  </div>

                  <button type="button" className="account-subscribe-btn">
                    Subscribe to mindfulspace+
                  </button>
                </div>
              )}

              {activeAccountTab === 'archive' && (
                <div className="account-content">
                  {archivedItems.length > 0 ? (
                    <div className="account-archive-list">
                      {archivedItems.slice(0, 12).map((entry) => (
                        <article key={entry.id} className="account-archive-item">
                          <div className="account-archive-main">
                            <div className="account-archive-title">{formatArchiveTitle(entry)}</div>
                            <div className="account-archive-meta">
                              {formatArchiveTypeLabel(entry.type)} •{' '}
                              {new Date(entry.archivedAt || Date.now()).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </div>
                          <div className="account-archive-actions">
                            <button
                              type="button"
                              className="account-archive-restore"
                              onClick={() => onRestoreArchivedCard?.(entry.id)}
                            >
                              Restore
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="account-empty-state">No archived cards yet.</div>
                  )}
                </div>
              )}

              {activeAccountTab === 'settings' && (
                <div className="account-content">
                  <div className="account-settings-list">
                    <div className="account-setting-row">
                      <span>Theme</span>
                      <button type="button" className="account-setting-btn" onClick={onToggleMode}>
                        {mode === 'night' ? 'Switch to day' : 'Switch to night'}
                      </button>
                    </div>
                    <div className="account-setting-row">
                      <span>Archived cards</span>
                      <strong>{archivedItems.length}</strong>
                    </div>
                    <div className="account-setting-row">
                      <span>Active habits</span>
                      <strong>{habitOptions.length}</strong>
                    </div>
                    <div className="account-setting-row">
                      <span>Labels</span>
                      <strong>{labelOptions.length}</strong>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="workspace-selector-wrap" ref={menuRef}>
          <button
            className={`welcome-box ${isWorkspaceMenuOpen ? 'is-open' : ''}`}
            aria-label="workspace selector"
            onClick={() => {
              setIsWorkspaceMenuOpen(open => !open)
              setIsAccountMenuOpen(false)
              setIsQuickMenuOpen(false)
              setIsSearchOpen(false)
            }}
          >
            <span className="welcome-text">{workspace.name}</span>
            <ChevronDown className="caret-icon" aria-hidden="true" />
          </button>

          {isWorkspaceMenuOpen && (
            <section className="workspace-menu-panel" role="menu">
              <div className="workspace-list">
                {allWorkspaces.map(ws => (
                  <div key={ws.id} className={`workspace-item ${ws.id === workspace.id ? 'is-active' : ''}`}>
                    {ws.id === workspace.id ? (
                      <div className="workspace-drag-handle">
                        <GripVertical aria-hidden="true" />
                      </div>
                    ) : (
                      <div className="workspace-drag-handle-placeholder" />
                    )}
                    
                    <input
                      className="workspace-name-input"
                      value={ws.name}
                      onChange={(e) => onUpdateName(ws.id, e.target.value)}
                      onClick={() => {
                        if (ws.id !== workspace.id) {
                          onSwitchWorkspace(ws.id)
                          setIsWorkspaceMenuOpen(false)
                        }
                      }}
                    />

                    <div className="workspace-actions">
                      <button
                        className="workspace-action-btn"
                        onClick={() => {
                          onSwitchWorkspace(ws.id)
                          setIsWorkspaceMenuOpen(false)
                        }}
                        aria-label="select workspace"
                      >
                        <Check aria-hidden="true" />
                      </button>
                      
                      <button
                        className="workspace-action-btn"
                        onClick={() => {
                          onDuplicateWorkspace(ws.id)
                          setIsWorkspaceMenuOpen(false)
                        }}
                        aria-label="duplicate workspace"
                      >
                        <Copy aria-hidden="true" />
                      </button>

                      <button
                        className="workspace-action-btn workspace-delete-btn"
                        onClick={() => {
                          if (allWorkspaces.length <= 1) {
                            alert("You must have at least one workspace.")
                            return
                          }
                          if (window.confirm(`Delete workspace "${ws.name}"?`)) {
                            onDeleteWorkspace(ws.id)
                            setIsWorkspaceMenuOpen(false)
                          }
                        }}
                        aria-label="delete workspace"
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="workspace-menu-footer">
                <button
                  className="workspace-add-btn"
                  onClick={() => {
                    onCreateWorkspace()
                    setIsWorkspaceMenuOpen(false)
                  }}
                >
                  <Plus aria-hidden="true" />
                </button>
              </div>
            </section>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            className="quick-box"
            aria-label="quick create"
            onClick={() => {
              setIsQuickMenuOpen((open) => !open)
              setIsAccountMenuOpen(false)
              setIsSearchOpen(false)
            }}
          >
            <FilePlus2 aria-hidden="true" />
            <ChevronDown className="caret-icon" aria-hidden="true" />
          </button>

          {isQuickMenuOpen && (
            <div className="quick-menu">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className="quick-menu-item"
                  onClick={() => {
                    onQuickAction(action.id)
                    setIsQuickMenuOpen(false)
                  }}
                >
                  <ActionRailIcon kind={action.icon} />
                  {action.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="top-right">
        <div className="label-search-wrap" ref={searchRef}>
          <label className="search-shell">
            <input
              type="text"
              value={searchQuery}
              placeholder="Search for a label..."
              onFocus={() => {
                setIsSearchOpen(true)
                setIsAccountMenuOpen(false)
              }}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setIsSearchOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && filteredLabels.length > 0) {
                  handleSelectLabel(filteredLabels[0])
                }

                if (event.key === 'Escape') {
                  setIsSearchOpen(false)
                }
              }}
            />
            <Search aria-hidden="true" />
          </label>

          {isSearchOpen && (
            <div className="label-search-results" role="listbox" aria-label="label search results">
              {filteredLabels.length > 0 ? (
                filteredLabels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className="label-search-item"
                    style={{ backgroundColor: label.color || undefined, color: 'var(--label-text)' }}
                    onClick={() => handleSelectLabel(label)}
                  >
                    {label.text}
                  </button>
                ))
              ) : (
                <div className="label-search-empty">No labels found</div>
              )}
            </div>
          )}
        </div>



        <button
          type="button"
          className={`icon-box focus-toggle ${isFocusMode ? 'is-active' : ''}`}
          aria-label={isFocusMode ? 'Exit Focus Mode' : 'Focus Mode'}
          aria-pressed={isFocusMode}
          onClick={onToggleFocusMode}
        >
          <Crosshair aria-hidden="true" />
        </button>

        <button
          className="icon-box"
          aria-label="fullscreen"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {})
            } else if (document.exitFullscreen) {
              document.exitFullscreen().catch(() => {})
            }
          }}
        >
          <Expand aria-hidden="true" />
        </button>

        <button
          className={`theme-switch ${mode === 'day' ? 'is-day' : 'is-night'}`}
          aria-label="theme switch"
          onClick={onToggleMode}
        >
          <span className="theme-moon" />
        </button>
      </div>
    </header>
  )
}
