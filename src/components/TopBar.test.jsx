import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopBar } from './TopBar'

const { mockAuthValue } = vi.hoisted(() => ({
  mockAuthValue: {
    user: null,
    profile: null,
    session: null,
    loading: false,
    authError: null,
    isGuest: true,
    isAuthenticated: false,
    isConfigured: true,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    updateDisplayName: vi.fn(),
    clearError: vi.fn(),
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuthValue,
  AuthProvider: ({ children }) => children,
}))

describe('TopBar', () => {
  beforeEach(() => {
    mockAuthValue.user = null
    mockAuthValue.profile = null
    mockAuthValue.isAuthenticated = false
    mockAuthValue.isGuest = true
    vi.clearAllMocks()
  })

  const defaultProps = {
    mode: 'night',
    onToggleMode: vi.fn(),
    isFocusMode: false,
    onToggleFocusMode: vi.fn(),
    workspace: { id: 'ws-1', name: 'Default Workspace' },
    allWorkspaces: [{ id: 'ws-1', name: 'Default Workspace' }],
    onSwitchWorkspace: vi.fn(),
    onUpdateName: vi.fn(),
    onDuplicateWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspace: vi.fn(),
    quickActions: [],
    onQuickAction: vi.fn(),
    labels: [{ id: 'l1', text: 'Work' }],
    onSelectLabel: vi.fn(),
    archivedCards: [],
    habits: [{ id: 'h1', title: 'Exercise' }],
    onRestoreArchivedCard: vi.fn(),
  }

  it('renders settings tab without crashing and shows label count', () => {
    render(<TopBar {...defaultProps} />)

    // Open account menu
    const menuButton = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(menuButton)

    // Click on Settings tab
    const settingsTab = screen.getByRole('button', { name: /settings/i })
    fireEvent.click(settingsTab)

    // Verify settings rows render
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByText('Labels')).toBeInTheDocument()
    expect(screen.getByText('Import Cards')).toBeInTheDocument()
  })

  it('renders color palette options and triggers onSelectPalette when clicked', () => {
    const onSelectPalette = vi.fn()
    render(<TopBar {...defaultProps} palette="sage" onSelectPalette={onSelectPalette} />)

    // Open account menu
    const menuButton = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(menuButton)

    // Click on Settings tab
    const settingsTab = screen.getByRole('button', { name: /settings/i })
    fireEvent.click(settingsTab)

    expect(screen.getByText('Color Palette')).toBeInTheDocument()
    expect(screen.getByText('Sage & Stone')).toBeInTheDocument()
    expect(screen.getByText('Cosmic Classic')).toBeInTheDocument()

    // Click Cosmic Classic palette option
    const classicBtn = screen.getByRole('button', { name: /Select Cosmic Classic palette/i })
    fireEvent.click(classicBtn)

    expect(onSelectPalette).toHaveBeenCalledWith('classic')
  })

  it('opens the workspace menu and switches to another workspace', () => {
    const onSwitchWorkspace = vi.fn()
    render(
      <TopBar
        {...defaultProps}
        allWorkspaces={[
          { id: 'ws-1', name: 'Default Workspace' },
          { id: 'ws-2', name: 'Deep Work' },
        ]}
        onSwitchWorkspace={onSwitchWorkspace}
      />
    )

    // Workspace menu is closed initially
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // Clicking the workspace selector opens the menu
    fireEvent.click(screen.getByRole('button', { name: /workspace selector/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Deep Work')).toBeInTheDocument()

    // Selecting the second workspace triggers the switch callback
    const selectButtons = screen.getAllByLabelText('select workspace')
    fireEvent.click(selectButtons[1])
    expect(onSwitchWorkspace).toHaveBeenCalledWith('ws-2')
  })

  it('renders AuthForm in profile tab when user is guest', () => {
    render(<TopBar {...defaultProps} />)

    // Open account menu
    const menuButton = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(menuButton)

    // Profile tab is active by default
    expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/sign in with google/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/sign in with github/i)).toBeInTheDocument()
  })

  it('renders user details and sign out button in profile tab when authenticated', () => {
    mockAuthValue.user = { id: 'u-1', email: 'alex@example.com' }
    mockAuthValue.profile = { display_name: 'Alex Mindful' }
    mockAuthValue.isAuthenticated = true
    mockAuthValue.isGuest = false

    render(<TopBar {...defaultProps} syncStatus="idle" lastSyncedAt={Date.now()} />)

    // Open account menu
    const menuButton = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(menuButton)

    expect(screen.getByText('Alex Mindful')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    // SyncStatus renders the status label plus a separate "Last synced"
    // timestamp row — both may match this pattern.
    expect(screen.getAllByText(/cloud sync active|synced \d/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()

    // Clicking Sign Out calls signOut
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(mockAuthValue.signOut).toHaveBeenCalled()
  })
})
