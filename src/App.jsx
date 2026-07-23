import { useState, useCallback, useEffect } from 'react'
import { getInitialAppState, writeJsonStorage, readJsonStorage } from './utils/storage'
import { WORKSPACE_STORAGE_KEY_PREFIX, APP_STORAGE_KEY } from './utils/constants'
import { WorkspaceBoard } from './components/WorkspaceBoard'
import { InstallPrompt } from './components/InstallPrompt'

const WORKSPACES_LIST_KEY = 'mindfulspace_workspaces'

function generateId() {
  return `ws-${Date.now()}-${Math.floor(Math.random() * 100000)}`
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

  useEffect(() => {
    writeJsonStorage(APP_STORAGE_KEY, {
      workspaces: allWorkspaces,
      activeWorkspaceId: activeWorkspaceId
    })
  }, [allWorkspaces, activeWorkspaceId])

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

  return (
    <>
      {allWorkspaces.map(ws => (
        <WorkspaceBoard
          key={ws.id}
          workspace={ws}
          isVisible={ws.id === activeWorkspaceId}
          allWorkspaces={allWorkspaces}
          onSwitchWorkspace={handleSwitchWorkspace}
          onUpdateName={handleUpdateWorkspaceName}
          onDuplicateWorkspace={handleDuplicateWorkspace}
          onDeleteWorkspace={handleDeleteWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
        />
      ))}
      <InstallPrompt />
    </>
  )
}

export default App
