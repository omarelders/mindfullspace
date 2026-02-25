import { useState, useCallback, useEffect } from 'react'
import { readJsonStorage, writeJsonStorage } from './utils/storage'
import { WORKSPACE_STORAGE_KEY_PREFIX, APP_STORAGE_KEY } from './utils/constants'
import { WorkspaceBoard } from './components/WorkspaceBoard'

const WORKSPACES_LIST_KEY = 'mindfulspace_workspaces'
const DEFAULT_WORKSPACES = [{ id: 'default', name: 'Main Workspace' }]

function generateId() {
  return `ws-${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

function App() {
  const [allWorkspaces, setAllWorkspaces] = useState(() => {
    const stored = readJsonStorage(WORKSPACES_LIST_KEY)
    return Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_WORKSPACES
  })

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    const stored = readJsonStorage('mindfulspace_activeWorkspace')
    return typeof stored === 'string' ? stored : DEFAULT_WORKSPACES[0].id
  })

  useEffect(() => {
    writeJsonStorage(WORKSPACES_LIST_KEY, allWorkspaces)
  }, [allWorkspaces])

  useEffect(() => {
    writeJsonStorage('mindfulspace_activeWorkspace', activeWorkspaceId)
  }, [activeWorkspaceId])

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
    </>
  )
}

export default App
