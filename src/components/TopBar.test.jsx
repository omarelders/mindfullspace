import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopBar } from './TopBar'

describe('TopBar', () => {
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
    isWorkspaceMenuOpen: false,
    setIsWorkspaceMenuOpen: vi.fn(),
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
})

