import { createSignal, createEffect, createMemo, onMount, onCleanup, Show, For } from 'solid-js'
import {
  Archive,
  Menu,
  Search,
  Settings,
  AlertCircle,
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
  Palette,
  LogOut,
} from 'lucide-solid'
import { buildDateKey } from '../utils/dateUtils'
import { ConfirmModal } from './ConfirmModal'
import { ActionRailIcon } from './ActionRail'
import { exportWorkspace, parseWorkspaceBackup } from '../utils/backup'
import { PALETTE_OPTIONS } from '../utils/constants'
import { useAuth } from '../hooks/useAuth'
import { AuthForm } from './AuthForm'
import { SyncStatus } from './SyncStatus'

// Plain function: Solid components run once, so there is nothing to memoize.
export function TopBar(props) {
  // Keep the context object — destructuring would freeze these values
  const auth = useAuth()
  const [isQuickMenuOpen, setIsQuickMenuOpen] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [isSearchOpen, setIsSearchOpen] = createSignal(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = createSignal(false)
  const [activeAccountTab, setActiveAccountTab] = createSignal('profile')
  const [isFullscreen, setIsFullscreen] = createSignal(false)
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = createSignal(false)
  const [workspaceToDelete, setWorkspaceToDelete] = createSignal(null)
  const [alertMessage, setAlertMessage] = createSignal(null)

  const [isImportConfirmOpen, setIsImportConfirmOpen] = createSignal(false)
  const [selectedFile, setSelectedFile] = createSignal(null)
  let fileInputRef

  const [isImportCardsConfirmOpen, setIsImportCardsConfirmOpen] = createSignal(false)
  const [selectedCardsFile, setSelectedCardsFile] = createSignal(null)
  let importCardsInputRef

  const [storageUsage, setStorageUsage] = createSignal(0)
  const [storageQuota, setStorageQuota] = createSignal(0)

  let menuRef
  let quickMenuRef
  let searchRef
  let accountRef

  createEffect(() => {
    if (isAccountMenuOpen() && activeAccountTab() === 'settings') {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((estimate) => {
          setStorageUsage(estimate.usage || 0)
          setStorageQuota(estimate.quota || 0)
        }).catch(() => {})
      }
    }
  })

  const handleExportClick = () => {
    // Capture the live in-memory state so the export always reflects the
    // current workspace even if the debounced autosave hasn't flushed yet.
    const liveState = props.onCaptureSnapshot ? props.onCaptureSnapshot() : null
    exportWorkspace(props.workspace.id, props.workspace.name, liveState).catch((err) => {
      setAlertMessage(err.message || 'Export failed.')
    })
  }

  const handleImportClick = () => {
    fileInputRef?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setIsImportConfirmOpen(true)
    }
    e.target.value = ''
  }

  const handleConfirmImport = () => {
    if (selectedFile() && props.onImportWorkspace) {
      // Parse + restore images, then apply to reactive state directly — no page
      // reload. The previous state is pushed onto the undo stack by
      // importWorkspaceState, so the import can be undone.
      parseWorkspaceBackup(selectedFile())
        .then((sanitizedWorkspace) => {
          props.onImportWorkspace(sanitizedWorkspace)
          setIsImportConfirmOpen(false)
          setSelectedFile(null)
          setIsAccountMenuOpen(false)
        })
        .catch((err) => {
          setIsImportConfirmOpen(false)
          setSelectedFile(null)
          setAlertMessage(err.message || 'Import failed.')
        })
    }
  }

  const handleImportCardsClick = () => {
    importCardsInputRef?.click()
  }

  const handleImportCardsFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedCardsFile(file)
      setIsImportCardsConfirmOpen(true)
    }
    e.target.value = ''
  }

  const handleConfirmImportCards = () => {
    if (selectedCardsFile() && props.onImportCards) {
      props.onImportCards(selectedCardsFile())
      setIsImportCardsConfirmOpen(false)
      setSelectedCardsFile(null)
      setIsAccountMenuOpen(false)
    }
  }

  const labelOptions = createMemo(() => (Array.isArray(props.labels) ? props.labels : []))
  const filteredLabels = createMemo(() => {
    const normalizedQuery = searchQuery().trim().toLowerCase()
    return labelOptions().filter((label) =>
      !normalizedQuery || (label.text && label.text.toLowerCase().includes(normalizedQuery)),
    )
  })

  const habitOptions = createMemo(() => (Array.isArray(props.habits) ? props.habits : []))
  const archiveOptions = createMemo(() => (Array.isArray(props.archivedCards) ? props.archivedCards : []))

  const streak = createMemo(() => {
    const habits = habitOptions()
    if (habits.length === 0) {
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
      return habits.every((habit) => habit.completions?.[dateKey] === true)
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
  })
  const streakDays = () => streak().streakDays
  const streakTimeline = () => streak().streakTimeline

  const archivedItems = createMemo(
    () => [...archiveOptions()].sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0)),
  )

  onMount(() => {
    const handleClickOutside = (e) => {
      if (menuRef && !menuRef.contains(e.target)) {
        setIsWorkspaceMenuOpen(false)
      }

      if (quickMenuRef && !quickMenuRef.contains(e.target)) {
        setIsQuickMenuOpen(false)
      }

      if (searchRef && !searchRef.contains(e.target)) {
        setIsSearchOpen(false)
      }

      if (accountRef && !accountRef.contains(e.target)) {
        setIsAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    })
  })

  const handleSelectLabel = (label) => {
    if (props.onSelectLabel) {
      props.onSelectLabel(label.id)
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

  const profileName = () =>
    auth.isAuthenticated
      ? (auth.profile?.display_name || auth.user?.user_metadata?.full_name || auth.user?.email?.split('@')[0] || 'Mindful User')
      : 'Mindful User'
  const profileSubtitle = () =>
    auth.isAuthenticated
      ? auth.user?.email
      : 'Local workspace — your data stays on this device'
  const profileLevel = 1

  // Fullscreen hides the bar entirely — <Show> instead of an early return so
  // reactive tracking is never bypassed.
  return (
    <Show when={!isFullscreen()}>
      <header class="top-bar">
        <div class="top-left">
          <div class="account-menu-wrap" ref={accountRef}>
            <button
              type="button"
              class={`nav-box ${isAccountMenuOpen() ? 'is-open' : ''}`}
              aria-label="menu"
              aria-expanded={isAccountMenuOpen()}
              onClick={() => {
                setIsAccountMenuOpen((open) => !open)
                setIsQuickMenuOpen(false)
                setIsSearchOpen(false)
                setIsWorkspaceMenuOpen(false)
              }}
            >
              <Menu aria-hidden="true" />
              <Show when={auth.isAuthenticated}>
                <span class="auth-presence-dot" title={`Signed in as ${auth.user?.email || 'user'}`} aria-hidden="true" />
              </Show>
            </button>

            <Show when={isAccountMenuOpen()}>
              <section class="account-panel" aria-label="account menu">
                <div class="account-tabs">
                  <button
                    type="button"
                    class={`account-tab ${activeAccountTab() === 'profile' ? 'is-active' : ''}`}
                    onClick={() => setActiveAccountTab('profile')}
                  >
                    <User aria-hidden="true" />
                    Profile
                  </button>
                  <button
                    type="button"
                    class={`account-tab ${activeAccountTab() === 'archive' ? 'is-active' : ''}`}
                    onClick={() => setActiveAccountTab('archive')}
                  >
                    <Archive aria-hidden="true" />
                    Archive
                  </button>
                  <button
                    type="button"
                    class={`account-tab ${activeAccountTab() === 'settings' ? 'is-active' : ''}`}
                    onClick={() => setActiveAccountTab('settings')}
                  >
                    <Settings aria-hidden="true" />
                    Settings
                  </button>
                </div>

                <Show when={activeAccountTab() === 'profile'}>
                  <div class="account-content">
                    <Show
                      when={auth.isAuthenticated}
                      fallback={<AuthForm />}
                    >
                      <>
                        <div class="account-profile-grid">
                          <div class="account-avatar-wrap">
                            <div class="account-avatar">
                              <Show
                                when={auth.profile?.avatar_url}
                                fallback={<UserRound aria-hidden="true" />}
                              >
                                <img
                                  src={auth.profile.avatar_url}
                                  alt={profileName()}
                                  style={{ width: '100%', height: '100%', "border-radius": '50%', "object-fit": 'cover' }}
                                />
                              </Show>
                            </div>
                          </div>

                          <div class="account-meta-stack">
                            <div class="account-meta-card account-meta-strong">{profileName()}</div>
                            <div class="account-meta-card">
                              <User aria-hidden="true" />
                              Level {profileLevel}
                            </div>
                          </div>
                        </div>

                        <div class="account-email-row">
                          <span
                            class="account-email-dot"
                            style={{ background: '#2ecc71', "box-shadow": '0 0 8px #2ecc71' }}
                            aria-hidden="true"
                          />
                          <span>{profileSubtitle()}</span>
                        </div>

                        <SyncStatus
                          status={props.syncStatus ?? 'idle'}
                          lastSyncedAt={props.lastSyncedAt ?? null}
                          onSyncNow={props.onSyncNow ?? null}
                          message={props.syncMessage ?? null}
                        />

                        <button
                          type="button"
                          class="account-signout-btn"
                          onClick={async () => {
                            await auth.signOut()
                          }}
                        >
                          <LogOut size={15} />
                          <span>Sign Out</span>
                        </button>

                        <div class="account-streak-card">
                          <div class="account-streak-header">
                            <span>You're on a</span>
                            <span>{streakDays()} day streak in total 🔥</span>
                          </div>
                          <div class="account-streak-main">{streakDays()} day streak</div>

                          <div class="account-streak-track" aria-hidden="true">
                            <For each={streakTimeline()}>
                              {(node) => (
                                <span class={`streak-node ${node.status}`} />
                              )}
                            </For>
                          </div>
                        </div>
                      </>
                    </Show>
                  </div>
                </Show>

                <Show when={activeAccountTab() === 'archive'}>
                  <div class="account-content">
                    <Show
                      when={archivedItems().length > 0}
                      fallback={<div class="account-empty-state">No archived cards yet.</div>}
                    >
                      <div class="account-archive-list">
                        <For each={archivedItems().slice(0, 12)}>
                          {(entry) => (
                            <article class="account-archive-item">
                              <div class="account-archive-main">
                                <div class="account-archive-title">{formatArchiveTitle(entry)}</div>
                                <div class="account-archive-meta">
                                  {formatArchiveTypeLabel(entry.type)} •{' '}
                                  {new Date(entry.archivedAt || Date.now()).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </div>
                              </div>
                              <div class="account-archive-actions">
                                <button
                                  type="button"
                                  class="account-archive-restore"
                                  onClick={() => props.onRestoreArchivedCard?.(entry.id)}
                                >
                                  Restore
                                </button>
                              </div>
                            </article>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>

                <Show when={activeAccountTab() === 'settings'}>
                  <div class="account-content">
                    <div class="account-settings-list">
                      <div class="account-setting-row" style={{ "flex-direction": 'column', "align-items": 'flex-start', gap: '6px' }}>
                        <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                          <Show when={auth.isAuthenticated}>
                            <span class="auth-presence-dot" aria-hidden="true" />
                          </Show>
                          <strong>{auth.isAuthenticated ? 'Signed in' : 'Guest mode'}</strong>
                        </div>
                        <span style={{ "font-size": '12px', color: 'var(--ui-text)', opacity: 0.75, "word-break": 'break-all' }}>
                          {auth.isAuthenticated
                            ? `${auth.user?.email || profileName()} — your changes sync to the cloud`
                            : 'Sign in from the Profile tab to enable cloud sync'}
                        </span>
                      </div>
                      <div class="account-setting-row">
                        <span>Theme</span>
                        <button type="button" class="account-setting-btn" onClick={() => props.onToggleMode?.()}>
                          {props.mode === 'night' ? 'Switch to day' : 'Switch to night'}
                        </button>
                      </div>
                      <div class="account-setting-row" style={{ "flex-direction": 'column', "align-items": 'stretch', gap: '8px' }}>
                        <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                          <span style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                            <Palette aria-hidden="true" style={{ width: '14px', height: '14px', color: 'var(--ui-icon)' }} />
                            <span>Color Palette</span>
                          </span>
                        </div>
                        <div class="palette-picker-grid">
                          <For each={PALETTE_OPTIONS}>
                            {(p) => {
                              const isSelected = (props.palette || 'sage') === p.id
                              return (
                                <button
                                  type="button"
                                  class={`palette-option-btn ${isSelected ? 'is-active' : ''}`}
                                  onClick={() => props.onSelectPalette?.(p.id)}
                                  aria-label={`Select ${p.name} palette`}
                                  aria-pressed={isSelected}
                                >
                                  <div class="palette-preview-dots">
                                    <For each={p.swatches}>
                                      {(color) => (
                                        <span
                                          class="palette-preview-dot"
                                          style={{ "background-color": color }}
                                          aria-hidden="true"
                                        />
                                      )}
                                    </For>
                                  </div>
                                  <div class="palette-option-text">
                                    <span class="palette-name">{p.name}</span>
                                    <span class="palette-desc">{p.subtitle}</span>
                                  </div>
                                  <Show when={isSelected}>
                                    <span class="palette-active-badge">
                                      <Check style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                                    </span>
                                  </Show>
                                </button>
                              )
                            }}
                          </For>
                        </div>
                      </div>
                      <div class="account-setting-row">
                        <span>Export Workspace</span>
                        <button type="button" class="account-setting-btn" onClick={handleExportClick}>
                          Export JSON
                        </button>
                      </div>
                      <div class="account-setting-row">
                        <span>Import Workspace</span>
                        <button type="button" class="account-setting-btn" onClick={handleImportClick}>
                          Import JSON
                        </button>
                      </div>
                      <div class="account-setting-row">
                        <span>Import Cards</span>
                        <button type="button" class="account-setting-btn" onClick={handleImportCardsClick}>
                          Import Cards JSON
                        </button>
                      </div>
                      <div class="account-setting-row">
                        <span>Archived cards</span>
                        <strong>{archivedItems().length}</strong>
                      </div>
                      <div class="account-setting-row">
                        <span>Active habits</span>
                        <strong>{habitOptions().length}</strong>
                      </div>
                      <div class="account-setting-row">
                        <span>Labels</span>
                        <strong>{labelOptions().length}</strong>
                      </div>
                      <Show when={storageQuota() > 0}>
                        <div class="account-setting-row" style={{ "flex-direction": 'column', "align-items": 'flex-start', gap: '8px', "margin-top": '12px' }}>
                          <div style={{ display: 'flex', "justify-content": 'space-between', width: '100%', "font-size": '12px', color: 'var(--text-muted)' }}>
                            <span>Storage Usage</span>
                            <span>{(storageUsage() / 1024 / 1024).toFixed(2)} MB / {(storageQuota() / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'var(--panel-border)', "border-radius": '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, (storageUsage() / storageQuota()) * 100)}%`, background: 'var(--switch-track)', transition: 'width 0.3s ease' }} />
                          </div>
                          <div style={{ "font-size": '11px', color: 'var(--tone-gold)', display: 'flex', "align-items": 'center', gap: '4px', "margin-top": '4px' }}>
                            <AlertCircle size={12} />
                            <span>All your data is stored locally. Remember to export your workspace to back it up!</span>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                </Show>
              </section>
            </Show>
          </div>

          <div class="workspace-selector-wrap" ref={menuRef}>
            <button
              type="button"
              class={`welcome-box ${isWorkspaceMenuOpen() ? 'is-open' : ''}`}
              aria-label="workspace selector"
              onClick={() => {
                setIsWorkspaceMenuOpen((open) => !open)
                setIsAccountMenuOpen(false)
                setIsQuickMenuOpen(false)
                setIsSearchOpen(false)
              }}
            >
              <span class="welcome-text">{props.workspace.name}</span>
              <ChevronDown class="caret-icon" aria-hidden="true" />
            </button>

            <Show when={isWorkspaceMenuOpen()}>
              <section class="workspace-menu-panel" role="menu">
                <div class="workspace-list">
                  <For each={props.allWorkspaces}>
                    {(ws) => (
                      <div class={`workspace-item ${ws.id === props.workspace.id ? 'is-active' : ''}`}>
                        <Show
                          when={ws.id === props.workspace.id}
                          fallback={<div class="workspace-drag-handle-placeholder" />}
                        >
                          <div class="workspace-drag-handle">
                            <GripVertical aria-hidden="true" />
                          </div>
                        </Show>

                        <input
                          class="workspace-name-input"
                          value={ws.name}
                          onInput={(e) => props.onUpdateName(ws.id, e.currentTarget.value)}
                          onClick={() => {
                            if (ws.id !== props.workspace.id) {
                              props.onSwitchWorkspace(ws.id)
                              setIsWorkspaceMenuOpen(false)
                            }
                          }}
                        />

                        <div class="workspace-actions">
                          <button
                            type="button"
                            class="workspace-action-btn"
                            onClick={() => {
                              props.onSwitchWorkspace(ws.id)
                              setIsWorkspaceMenuOpen(false)
                            }}
                            aria-label="select workspace"
                          >
                            <Check aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            class="workspace-action-btn"
                            onClick={() => {
                              props.onDuplicateWorkspace(ws.id)
                              setIsWorkspaceMenuOpen(false)
                            }}
                            aria-label="duplicate workspace"
                          >
                            <Copy aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            class="workspace-action-btn workspace-delete-btn"
                            onClick={() => {
                              if (props.allWorkspaces.length <= 1) {
                                setAlertMessage("You must have at least one workspace.")
                                return
                              }
                              setWorkspaceToDelete(ws)
                            }}
                            aria-label="delete workspace"
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>

                <div class="workspace-menu-footer">
                  <button
                    type="button"
                    class="workspace-add-btn"
                    onClick={() => {
                      props.onCreateWorkspace()
                      setIsWorkspaceMenuOpen(false)
                    }}
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              </section>
            </Show>
          </div>

          <div class="quick-menu-wrap" ref={quickMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              class={`quick-box ${isQuickMenuOpen() ? 'is-open' : ''}`}
              aria-label="Add card"
              title="Add card"
              aria-expanded={isQuickMenuOpen()}
              aria-haspopup="menu"
              onClick={() => {
                setIsQuickMenuOpen((open) => !open)
                setIsAccountMenuOpen(false)
                setIsWorkspaceMenuOpen(false)
                setIsSearchOpen(false)
              }}
            >
              <FilePlus2 aria-hidden="true" />
              <ChevronDown class="caret-icon" aria-hidden="true" />
            </button>

            <Show when={isQuickMenuOpen()}>
              <div class="quick-menu" role="menu" aria-label="Add card menu">
                <For each={props.quickActions || []}>
                  {(action) => (
                    <button
                      type="button"
                      role="menuitem"
                      class="quick-menu-item"
                      onClick={() => {
                        props.onQuickAction?.(action.id)
                        setIsQuickMenuOpen(false)
                      }}
                    >
                      <ActionRailIcon kind={action.icon} />
                      <span>{action.title}</span>
                    </button>
                  )}
                </For>
                <div
                  style={{
                    height: '1px',
                    background: 'var(--surface-border)',
                    margin: '4px 0',
                    "grid-column": '1 / -1',
                  }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  role="menuitem"
                  class="quick-menu-item"
                  style={{ "grid-column": '1 / -1' }}
                  onClick={() => {
                    handleImportCardsClick()
                    setIsQuickMenuOpen(false)
                  }}
                >
                  <FilePlus2 aria-hidden="true" style={{ width: '16px', height: '16px' }} />
                  <span>Import Cards from JSON</span>
                </button>
              </div>
            </Show>
          </div>
        </div>

        <div class="top-right">
          <div class="label-search-wrap" ref={searchRef}>
            <label class="search-shell">
              <input
                type="text"
                value={searchQuery()}
                placeholder="Search for a label..."
                onFocus={() => {
                  setIsSearchOpen(true)
                  setIsAccountMenuOpen(false)
                  setIsWorkspaceMenuOpen(false)
                }}
                onInput={(event) => {
                  setSearchQuery(event.currentTarget.value)
                  setIsSearchOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && filteredLabels().length > 0) {
                    handleSelectLabel(filteredLabels()[0])
                  }

                  if (event.key === 'Escape') {
                    setIsSearchOpen(false)
                  }
                }}
              />
              <Search aria-hidden="true" />
            </label>

            <Show when={isSearchOpen()}>
              <div class="label-search-results" role="listbox" aria-label="label search results">
                <Show
                  when={filteredLabels().length > 0}
                  fallback={<div class="label-search-empty">No labels found</div>}
                >
                  <For each={filteredLabels()}>
                    {(label) => (
                      <button
                        type="button"
                        class="label-search-item"
                        style={{ "background-color": label.color || undefined, color: 'var(--label-text)' }}
                        onClick={() => handleSelectLabel(label)}
                      >
                        {label.text}
                      </button>
                    )}
                  </For>
                </Show>
              </div>
            </Show>
          </div>

          <button
            type="button"
            class={`icon-box focus-toggle ${props.isFocusMode ? 'is-active' : ''}`}
            aria-label={props.isFocusMode ? 'Exit Focus Mode' : 'Focus Mode'}
            aria-pressed={props.isFocusMode}
            onClick={() => props.onToggleFocusMode?.()}
          >
            <Crosshair aria-hidden="true" />
          </button>

          <button
            type="button"
            class="icon-box"
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
            type="button"
            class={`theme-switch ${props.mode === 'day' ? 'is-day' : 'is-night'}`}
            aria-label="theme switch"
            onClick={() => props.onToggleMode?.()}
          >
            <span class="theme-moon" />
          </button>
        </div>

        <ConfirmModal
          isOpen={!!workspaceToDelete()}
          title="Delete Workspace"
          message={`Are you sure you want to delete workspace "${workspaceToDelete()?.name}"?`}
          confirmText="Delete"
          onConfirm={() => {
            if (workspaceToDelete()) {
              props.onDeleteWorkspace(workspaceToDelete().id)
              setIsWorkspaceMenuOpen(false)
            }
            setWorkspaceToDelete(null)
          }}
          onCancel={() => setWorkspaceToDelete(null)}
        />

        <ConfirmModal
          isOpen={!!alertMessage()}
          title="Notice"
          message={alertMessage()}
          confirmText="OK"
          hideCancel={true}
          onConfirm={() => setAlertMessage(null)}
          onCancel={() => setAlertMessage(null)}
        />

        <ConfirmModal
          isOpen={isImportConfirmOpen()}
          title="Import Workspace"
          message="Are you sure you want to import this workspace? This will completely overwrite all cards and settings in your current active workspace!"
          confirmText="Overwrite & Import"
          onConfirm={handleConfirmImport}
          onCancel={() => {
            setIsImportConfirmOpen(false)
            setSelectedFile(null)
          }}
        />

        <ConfirmModal
          isOpen={isImportCardsConfirmOpen()}
          title="Import Cards"
          message="Are you sure you want to import cards from this file? The imported cards will be added to your current screen without replacing any existing cards."
          confirmText="Import Cards"
          onConfirm={handleConfirmImportCards}
          onCancel={() => {
            setIsImportCardsConfirmOpen(false)
            setSelectedCardsFile(null)
          }}
        />

        <input
          type="file"
          ref={fileInputRef}
          accept="application/json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <input
          type="file"
          ref={importCardsInputRef}
          accept="application/json"
          onChange={handleImportCardsFileChange}
          style={{ display: 'none' }}
        />
      </header>
    </Show>
  )
}
