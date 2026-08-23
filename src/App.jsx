import { useState, useCallback, useEffect, useRef } from 'react'
import { getInitialAppState, writeJsonStorage, readJsonStorage } from './utils/storage'
import { WORKSPACE_STORAGE_KEY_PREFIX, APP_STORAGE_KEY } from './utils/constants'
import { createId } from './utils/id'
import { WorkspaceBoard } from './components/WorkspaceBoard'
import { InstallPrompt } from './components/InstallPrompt'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { handleFirstSignIn } from './lib/migration'
import {
  ensureCloudWorkspace,
  renameCloudWorkspace,
  deleteCloudWorkspace,
} from './lib/cloudDb'

const WORKSPACES_LIST_KEY = 'mindfulspace_workspaces'

function generateId() {
  return createId('ws')
}

function WorkspaceManager() {
  const { user } = useAuth()
  const [allWorkspaces, setAllWorkspaces] = useState(() => getInitialAppState().workspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => getInitialAppState().activeWorkspaceId)
  const previousUserIdRef = useRef(null)

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
    if (user) {
      renameCloudWorkspace(user.id, id, nextName).catch((err) =>
        console.warn('[App] Cloud workspace rename failed:', err?.message)
      )
    }
  }, [user])

  const handleCreateWorkspace = useCallback((name) => {
    const newId = generateId()
    setAllWorkspaces(current => [...current, { id: newId, name: name || 'New Workspace' }])
    setActiveWorkspaceId(newId)
    if (user) {
      ensureCloudWorkspace(user.id, newId, name || 'New Workspace').catch((err) =>
        console.warn('[App] Cloud workspace create failed:', err?.message)
      )
    }
  }, [user])

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
      if (user) {
        ensureCloudWorkspace(user.id, newId, `${sourceWs.name} Copy`).catch((err) =>
          console.warn('[App] Cloud workspace duplicate failed:', err?.message)
        )
      }
      return [...current, { id: newId, name: `${sourceWs.name} Copy` }]
    })
  }, [user])

  const handleDeleteWorkspace = useCallback((id) => {
    setAllWorkspaces(current => {
      if (current.length <= 1) return current // Prevent deleting the last workspace
      const filtered = current.filter(ws => ws.id !== id)
      setActiveWorkspaceId(prev => (prev === id ? filtered[0].id : prev))
      // Cleanup storage
      try { localStorage.removeItem(`${WORKSPACE_STORAGE_KEY_PREFIX}${id}`) } catch { /* ignore */ }
      return filtered
    })
    // Remove the cloud registry row too — the FK cascade wipes its data so
    // the workspace cannot resurrect on another device. Fire-and-forget.
    if (user) {
      deleteCloudWorkspace(user.id, id).catch((err) =>
        console.warn('[App] Cloud workspace delete failed:', err?.message)
      )
    }
  }, [user])

  const handleSetAllWorkspaces = useCallback((workspaces, activeId = null) => {
    if (!Array.isArray(workspaces) || workspaces.length === 0) return
    setAllWorkspaces(workspaces)
    if (activeId && workspaces.some(w => w.id === activeId)) {
      setActiveWorkspaceId(activeId)
    } else if (!workspaces.some(w => w.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0].id)
    }
  }, [activeWorkspaceId])

  // Handle first sign in or account switch migration.
  // The heavy flow runs once per account (marker-guarded inside
  // handleFirstSignIn); passive session restores are no-ops — the sync
  // engine's mount reconciliation keeps data fresh instead.
  useEffect(() => {
    if (user && user.id !== previousUserIdRef.current) {
      previousUserIdRef.current = user.id
      handleFirstSignIn(user.id, (workspaces, activeId) => {
        handleSetAllWorkspaces(workspaces, activeId)
      }).catch((err) => {
        console.warn('[App] Sign-in sync failed:', err?.message)
      })
    } else if (!user) {
      previousUserIdRef.current = null
    }
  }, [user, handleSetAllWorkspaces])

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
            onSetAllWorkspaces={handleSetAllWorkspaces}
          />
        </ErrorBoundary>
      )}
      <InstallPrompt />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <WorkspaceManager />
    </AuthProvider>
  )
}

export default App

