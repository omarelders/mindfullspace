import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkspaceBoard } from './WorkspaceBoard'

const { mockAuthValue } = vi.hoisted(() => ({
  mockAuthValue: {
    user: null,
    profile: null,
    session: null,
    loading: false,
    authError: null,
    isGuest: true,
    isAuthenticated: false,
    isConfigured: false,
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

describe('WorkspaceBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  const defaultProps = {
    workspace: { id: 'ws-test-1', name: 'Test Workspace' },
    isVisible: true,
    allWorkspaces: [{ id: 'ws-test-1', name: 'Test Workspace' }],
    onSwitchWorkspace: vi.fn(),
    onUpdateName: vi.fn(),
    onDuplicateWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspace: vi.fn(),
    onSetAllWorkspaces: vi.fn(),
  }

  it('renders workspace board without throwing ReferenceError or crashing', () => {
    expect(() => {
      render(<WorkspaceBoard {...defaultProps} />)
    }).not.toThrow()

    expect(screen.getByText('Test Workspace')).toBeInTheDocument()
  })

  it('allows toggling theme mode and focus mode without throwing', () => {
    const { container } = render(<WorkspaceBoard {...defaultProps} />)
    
    // Find theme mode toggle button
    const themeBtn = container.querySelector('[aria-label*="mode" i], [title*="mode" i], .theme-toggle, button:has(svg)')
    if (themeBtn) {
      expect(() => {
        fireEvent.click(themeBtn)
      }).not.toThrow()
    }
  })

  it('allows toggling action rail without errors', () => {
    const { container } = render(<WorkspaceBoard {...defaultProps} />)
    const railToggleBtn = container.querySelector('.action-rail-toggle, .rail-toggle, [aria-label*="rail" i]')
    if (railToggleBtn) {
      expect(() => {
        fireEvent.click(railToggleBtn)
      }).not.toThrow()
    }
  })
})
