import { describe, it, expect } from 'vitest'
import { render, screen } from '@solidjs/testing-library'
import { WorkspaceBoard } from './WorkspaceBoard'
import { AuthProvider } from '../hooks/useAuth'

// Full-board render smoke test. Guards against runtime ReferenceErrors on
// mount (e.g. a setter missing from the workspace `setters` object),
// a crash class that previously shipped because no test rendered the board.
describe('WorkspaceBoard smoke', () => {
  it('renders the full board without crashing in guest mode', () => {
    render(() => (
      <AuthProvider>
        <WorkspaceBoard
          workspace={{ id: 'ws-smoke', name: 'Smoke Board' }}
          isVisible={true}
          allWorkspaces={[{ id: 'ws-smoke', name: 'Smoke Board' }]}
          onSwitchWorkspace={() => {}}
          onUpdateName={() => {}}
          onDuplicateWorkspace={() => {}}
          onDeleteWorkspace={() => {}}
          onCreateWorkspace={() => {}}
        />
      </AuthProvider>
    ))

    // TopBar chrome mounted…
    expect(screen.getByRole('button', { name: /^menu$/i })).toBeInTheDocument()
    // …and the active workspace name made it into the workspace selector.
    expect(screen.getByText('Smoke Board')).toBeInTheDocument()
  })
})
