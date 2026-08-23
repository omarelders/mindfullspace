import { useState, useCallback, useEffect, useRef } from 'react'
import { getInitialAppState, writeJsonStorage, readJsonStorage } from './utils/storage'
import { WORKSPACE_STORAGE_KEY_PREFIX, APP_STORAGE_KEY } from './utils/constants'
import { createId } from './utils/id'
import { WorkspaceBoard } from './components/WorkspaceBoard'
import { InstallPrompt } from './components/InstallPrompt'
import { ErrorBoundary } from './components/ErrorBoundary'

const WORKSPACES_LIST_KEY = 'mindfulspace_workspaces'

function generateId() {
  return createId('ws')
}

function App() {
  const [allWorkspaces, setAllWorkspaces] = useState(() => getInitialAppState().workspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => getInitialAppState().activeWorkspaceId)

  useEffect(() => {
    // Cleanup legacy keys
    try {
      localStorage.removeItem(WORKSPACES_LIST_KEY)
      localStorage.removeItem('mindfulspace_activeWorkspace')
    } catch {
      // ignore
    }
  }, [])

  // Cross-tab sync for the workspace list. Without this, two open tabs would
  // clobber each other's list writes (created/deleted/renamed workspaces
  // would silently vanish).
  const lastRemoteAppValueRef = useRef(null)

  useEffect(() => {
    const serialized = JSON.stringify({ workspaces: allWorkspaces, activeWorkspaceId })
    if (serialized === lastRemoteAppValueRef.current) {
      // Identical to what another tab just sent us — don't echo it back.
      lastRemoteAppValueRef.current = null
      return
    }
    writeJsonStorage(APP_STORAGE_KEY, {
      workspaces: allWorkspaces,
      activeWorkspaceId: activeWorkspaceId
    })
  }, [allWorkspaces, activeWorkspaceId])

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key !== APP_STORAGE_KEY || e.newValue === null) return
      try {
        const incoming = JSON.parse(e.newValue)
        if (!Array.isArray(incoming?.workspaces) || incoming.workspaces.length === 0) return
        lastRemoteAppValueRef.current = e.newValue
        setAllWorkspaces(incoming.workspaces)
        setActiveWorkspaceId(prev => {
          if (incoming.workspaces.some(ws => ws && ws.id === prev)) return prev
          const fallbackId =
            typeof incoming.activeWorkspaceId === 'string' &&
            incoming.workspaces.some(ws => ws && ws.id === incoming.activeWorkspaceId)
              ? incoming.activeWorkspaceId
              : incoming.workspaces[0].id
          return prev === fallbackId ? prev : fallbackId
        })
      } catch {
        // Ignore malformed payloads from other tabs.
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const handleSwitchWorkspace = useCallback((id) => {
    setActiveWorkspaceId(id)
  }, [])

  const handleUpdateWorkspaceName = useCallback((id, nextName) => {
    setAllWorkspaces(current =>
      current.map(ws => ws.id === id ? { ...ws, name: nextName } : ws)
    )
  }, [])

  const handleCreateWorkspace = useCallback((name) => {
    const newId = generateId()
    setAllWorkspaces(current => [...current, { id: newId, name: name || 'New Workspace' }])
    setActiveWorkspaceId(newId)
  }, [])

  const handleDuplicateWorkspace = useCallback((id) => {
    setAllWorkspaces(current => {
      const sourceWs = current.find(ws => ws.id === id)
      if (!sourceWs) return current
      const newId = generateId()
      // Copy storage
      const sourceState = readJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${id}`)
      if (sourceState) {
        writeJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${newId}`, sourceState)
      }
      setActiveWorkspaceId(newId)
      return [...current, { id: newId, name: `${sourceWs.name} Copy` }]
    })
  }, [])

  const handleDeleteWorkspace = useCallback((id) => {
    setAllWorkspaces(current => {
      if (current.length <= 1) return current // Prevent deleting the last workspace
      const filtered = current.filter(ws => ws.id !== id)
      setActiveWorkspaceId(prev => (prev === id ? filtered[0].id : prev))
      // Cleanup storage
      try { localStorage.removeItem(`${WORKSPACE_STORAGE_KEY_PREFIX}${id}`) } catch { /* ignore */ }
      return filtered
    })
  }, [])

  const activeWorkspace = allWorkspaces.find(ws => ws.id === activeWorkspaceId)

  return (
    <>
      {activeWorkspace && (
        <ErrorBoundary key={activeWorkspace.id}>
          <WorkspaceBoard
            key={activeWorkspace.id}
            workspace={activeWorkspace}
            isVisible={true}
            allWorkspaces={allWorkspaces}
            onSwitchWorkspace={handleSwitchWorkspace}
            onUpdateName={handleUpdateWorkspaceName}
            onDuplicateWorkspace={handleDuplicateWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
          />
        </ErrorBoundary>
      )}
      <InstallPrompt />
    </>
  )
}

export default App
