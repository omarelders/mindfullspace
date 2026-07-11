import { getImage, saveImage } from './imageStore'
import { readJsonStorage, writeJsonStorage } from './storage'
import { WORKSPACE_STORAGE_KEY_PREFIX } from './constants'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64DataUrl) {
  try {
    const parts = base64DataUrl.split(';base64,')
    const contentType = parts[0].split(':')[1]
    const raw = window.atob(parts[1])
    const rawLength = raw.length
    const uInt8Array = new Uint8Array(rawLength)
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i)
    }
    return new Blob([uInt8Array], { type: contentType })
  } catch (err) {
    throw new Error('Failed to decode base64 image data: ' + err.message)
  }
}

export async function exportWorkspace(workspaceId, workspaceName) {
  const storageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`
  const workspaceState = readJsonStorage(storageKey)
  if (!workspaceState) {
    throw new Error('Workspace state not found in local storage.')
  }

  // Find all referenced imageIds in picture cards (active and archived)
  const imageIds = new Set()
  if (Array.isArray(workspaceState.pictures)) {
    workspaceState.pictures.forEach((pic) => {
      if (pic.imageId) imageIds.add(pic.imageId)
    })
  }
  if (Array.isArray(workspaceState.archivedCards)) {
    workspaceState.archivedCards.forEach((entry) => {
      if (entry.type === 'picture' && entry.data?.imageId) {
        imageIds.add(entry.data.imageId)
      }
    })
  }

  // Retrieve images from IndexedDB and convert to base64
  const images = {}
  for (const imageId of imageIds) {
    try {
      const blob = await getImage(imageId)
      if (blob) {
        images[imageId] = await blobToBase64(blob)
      }
    } catch (err) {
      console.error(`Failed to retrieve image ${imageId} from IndexedDB:`, err)
    }
  }

  const exportData = {
    version: 1,
    workspace: workspaceState,
    images,
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const cleanName = (workspaceName || 'workspace').replace(/[^a-z0-9_-]/gi, '_')
  const dateStr = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `${cleanName}_backup_${dateStr}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importWorkspace(workspaceId, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data || data.version !== 1 || !data.workspace) {
          throw new Error('Invalid export file format. Missing version or workspace.')
        }

        const rawWorkspace = data.workspace
        
        // Basic shape validation (similar to getInitialWorkspaceState guards)
        const sanitizedWorkspace = {
          columns: Array.isArray(rawWorkspace.columns) ? rawWorkspace.columns : [],
          drafts: rawWorkspace.drafts && typeof rawWorkspace.drafts === 'object' ? rawWorkspace.drafts : {},
          viewport:
            rawWorkspace.viewport &&
            Number.isFinite(rawWorkspace.viewport.x) &&
            Number.isFinite(rawWorkspace.viewport.y) &&
            Number.isFinite(rawWorkspace.viewport.scale)
              ? rawWorkspace.viewport
              : { x: 0, y: 0, scale: 1 },
          themeMode: rawWorkspace.themeMode === 'day' ? 'day' : 'night',
          notes: Array.isArray(rawWorkspace.notes) ? rawWorkspace.notes : [],
          timers: Array.isArray(rawWorkspace.timers) ? rawWorkspace.timers : [],
          counters: Array.isArray(rawWorkspace.counters) ? rawWorkspace.counters : [],
          stopwatches: Array.isArray(rawWorkspace.stopwatches) ? rawWorkspace.stopwatches : [],
          calendars: Array.isArray(rawWorkspace.calendars) ? rawWorkspace.calendars : [],
          habits: Array.isArray(rawWorkspace.habits) ? rawWorkspace.habits : [],
          pictures: Array.isArray(rawWorkspace.pictures) ? rawWorkspace.pictures : [],
          quickLinks: Array.isArray(rawWorkspace.quickLinks) ? rawWorkspace.quickLinks : [],
          archivedCards: Array.isArray(rawWorkspace.archivedCards) ? rawWorkspace.archivedCards : [],
          customLabels: Array.isArray(rawWorkspace.customLabels) ? rawWorkspace.customLabels : [],
          cardPositions:
            rawWorkspace.cardPositions && typeof rawWorkspace.cardPositions === 'object'
              ? rawWorkspace.cardPositions
              : {},
        }

        // Restore images into IndexedDB
        if (data.images && typeof data.images === 'object') {
          for (const [imageId, base64Str] of Object.entries(data.images)) {
            try {
              const blob = base64ToBlob(base64Str)
              await saveImage(imageId, blob)
            } catch (err) {
              console.error(`Failed to restore image ${imageId} to IndexedDB:`, err)
            }
          }
        }

        // Write configuration back to localStorage
        const storageKey = `${WORKSPACE_STORAGE_KEY_PREFIX}${workspaceId}`
        writeJsonStorage(storageKey, sanitizedWorkspace)
        resolve()
      } catch (err) {
        reject(new Error('Import failed: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsText(file)
  })
}
