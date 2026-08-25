import { createSignal, createEffect, onMount, onCleanup, createMemo, Show } from 'solid-js'
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
  // Keep the context object live — never destructure
  const auth = useAuth()
  const _initial = getInitialAppState()
  const [allWorkspaces, setAllWorkspaces] = createSignal(_initial.workspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = createSignal(_initial.activeWorkspaceId)

  // Closure variables replace React refs — the component body runs once
  let previousUserId = null
  let lastRemoteAppValue = null

  onMount(() => {
    // Cleanup legacy keys
    try {
      localStorage.removeItem(WORKSPACES_LIST_KEY)
      localStorage.removeItem('mindfulspace_activeWorkspace')
    } catch {
      // ignore
    }
  })

  // Cross-tab sync for the workspace list. Without this, two open tabs would
  // clobber each other's list writes (created/deleted/renamed workspaces
  // would silently vanish).
  createEffect(() => {
    const workspaces = allWorkspaces()
    const activeId = activeWorkspaceId()
    const serialized = JSON.stringify({ workspaces, activeWorkspaceId: activeId })
    if (serialized === lastRemoteAppValue) {
      // Identical to what another tab just sent us — don't echo it back.
      lastRemoteAppValue = null
      return
    }
    writeJsonStorage(APP_STORAGE_KEY, {
      workspaces,
      activeWorkspaceId: activeId
    })
  })

  onMount(() => {
    const handleStorage = (e) => {
      if (e.key !== APP_STORAGE_KEY || e.newValue === null) return
      try {
        const incoming = JSON.parse(e.newValue)
        if (!Array.isArray(incoming?.workspaces) || incoming.workspaces.length === 0) return
        lastRemoteAppValue = e.newValue
        setAllWorkspaces(incoming.workspaces)
        setActiveWorkspaceId((prev) => {
          if (incoming.workspaces.some((ws) => ws && ws.id === prev)) return prev
          const fallbackId =
            typeof incoming.activeWorkspaceId === 'string' &&
            incoming.workspaces.some((ws) => ws && ws.id === incoming.activeWorkspaceId)
              ? incoming.activeWorkspaceId
              : incoming.workspaces[0].id
          return prev === fallbackId ? prev : fallbackId
        })
      } catch {
        // Ignore malformed payloads from other tabs.
      }
    }
    window.addEventListener('storage', handleStorage)
    onCleanup(() => window.removeEventListener('storage', handleStorage))
  })

  function handleSwitchWorkspace(id) {
    setActiveWorkspaceId(id)
  }

  function handleUpdateWorkspaceName(id, nextName) {
    setAllWorkspaces((current) =>
      current.map((ws) => ws.id === id ? { ...ws, name: nextName } : ws)
    )
    const user = auth.user
    if (user) {
      renameCloudWorkspace(user.id, id, nextName).catch((err) =>
        console.warn('[App] Cloud workspace rename failed:', err?.message)
      )
    }
  }

  function handleCreateWorkspace(name) {
    const newId = generateId()
    setAllWorkspaces((current) => [...current, { id: newId, name: name || 'New Workspace' }])
    setActiveWorkspaceId(newId)
    const user = auth.user
    if (user) {
      ensureCloudWorkspace(user.id, newId, name || 'New Workspace').catch((err) =>
        console.warn('[App] Cloud workspace create failed:', err?.message)
      )
    }
  }

  function handleDuplicateWorkspace(id) {
    setAllWorkspaces((current) => {
      const sourceWs = current.find((ws) => ws.id === id)
      if (!sourceWs) return current
      const newId = generateId()
      // Copy storage
      const sourceState = readJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${id}`)
      if (sourceState) {
        writeJsonStorage(`${WORKSPACE_STORAGE_KEY_PREFIX}${newId}`, sourceState)
      }
      setActiveWorkspaceId(newId)
      const user = auth.user
      if (user) {
        ensureCloudWorkspace(user.id, newId, `${sourceWs.name} Copy`).catch((err) =>
          console.warn('[App] Cloud workspace duplicate failed:', err?.message)
        )
      }
      return [...current, { id: newId, name: `${sourceWs.name} Copy` }]
    })
  }

  function handleDeleteWorkspace(id) {
    setAllWorkspaces((current) => {
      if (current.length <= 1) return current // Prevent deleting the last workspace
      const filtered = current.filter((ws) => ws.id !== id)
      setActiveWorkspaceId((prev) => (prev === id ? filtered[0].id : prev))
      // Cleanup storage
      try { localStorage.removeItem(`${WORKSPACE_STORAGE_KEY_PREFIX}${id}`) } catch { /* ignore */ }
      return filtered
    })
    // Remove the cloud registry row too — the FK cascade wipes its data so
    // the workspace cannot resurrect on another device. Fire-and-forget.
    const user = auth.user
    if (user) {
      deleteCloudWorkspace(user.id, id).catch((err) =>
        console.warn('[App] Cloud workspace delete failed:', err?.message)
      )
    }
  }

  function handleSetAllWorkspaces(workspaces, activeId = null) {
    if (!Array.isArray(workspaces) || workspaces.length === 0) return
    setAllWorkspaces(workspaces)
    if (activeId && workspaces.some((w) => w.id === activeId)) {
      setActiveWorkspaceId(activeId)
    } else if (!workspaces.some((w) => w.id === activeWorkspaceId())) {
      setActiveWorkspaceId(workspaces[0].id)
    }
  }

  // Handle first sign in or account switch migration.
  // The heavy flow runs once per account (marker-guarded inside
  // handleFirstSignIn); passive session restores are no-ops — the sync
  // engine's mount reconciliation keeps data fresh instead.
  createEffect(() => {
    const user = auth.user
    if (user && user.id !== previousUserId) {
      previousUserId = user.id
      handleFirstSignIn(user.id, (workspaces, activeId) => {
        handleSetAllWorkspaces(workspaces, activeId)
      }).catch((err) => {
        console.warn('[App] Sign-in sync failed:', err?.message)
      })
    } else if (!user) {
      previousUserId = null
    }
  })

  const activeWorkspace = createMemo(
    () => allWorkspaces().find((ws) => ws.id === activeWorkspaceId()),
  )

  return (
    <>
      <Show when={activeWorkspace()} keyed>
        {(workspace) => (
          // keyed <Show> remounts on workspace ID change (replaces key={}):
          // each workspace gets a fresh ErrorBoundary + board instance.
          <ErrorBoundary>
            <WorkspaceBoard
              workspace={workspace}
              isVisible={true}
              allWorkspaces={allWorkspaces()}
              onSwitchWorkspace={handleSwitchWorkspace}
              onUpdateName={handleUpdateWorkspaceName}
              onDuplicateWorkspace={handleDuplicateWorkspace}
              onDeleteWorkspace={handleDeleteWorkspace}
              onCreateWorkspace={handleCreateWorkspace}
              onSetAllWorkspaces={handleSetAllWorkspaces}
            />
          </ErrorBoundary>
        )}
      </Show>
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
