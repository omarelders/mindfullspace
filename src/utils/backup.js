import { getImage, saveImage } from './imageStore'
import { readJsonStorage, writeJsonStorage, validateWorkspaceState } from './storage'
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

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' })
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
        const sanitizedWorkspace = validateWorkspaceState(rawWorkspace)

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
    reader.readAsText(file, 'UTF-8')
  })
}

export async function parseImportedCards(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data) {
          throw new Error('Invalid JSON file format.')
        }

        let rawWorkspace = {}
        if (data.workspace && typeof data.workspace === 'object') {
          rawWorkspace = data.workspace
        } else if (Array.isArray(data)) {
          const columns = []
          const customLabels = []
          const notes = []
          const timers = []
          const counters = []
          const stopwatches = []
          const calendars = []
          const habits = []
          const pictures = []
          const quickLinks = []
          const quotes = []

          data.forEach((item) => {
            if (!item || typeof item !== 'object') return
            const type = item.type || ''
            if (type === 'todo' || Array.isArray(item.items) || type === 'col') columns.push(item)
            else if (type === 'label' || item.role) customLabels.push(item)
            else if (type === 'timer' || typeof item.remainingSeconds === 'number') timers.push(item)
            else if (type === 'counter' || typeof item.initialValue === 'number' || typeof item.value === 'number') counters.push(item)
            else if (type === 'stopwatch' || typeof item.elapsedSeconds === 'number') stopwatches.push(item)
            else if (type === 'calendar' || item.entries) calendars.push(item)
            else if (type === 'habit' || item.completions) habits.push(item)
            else if (type === 'picture' || item.imageId) pictures.push(item)
            else if (type === 'quick-links' || Array.isArray(item.links)) quickLinks.push(item)
            else if (type === 'quote' || item.author !== undefined) quotes.push(item)
            else if (type === 'note' || item.text !== undefined) notes.push(item)
          })

          rawWorkspace = {
            ...(columns.length > 0 && { columns }),
            ...(customLabels.length > 0 && { customLabels }),
            ...(notes.length > 0 && { notes }),
            ...(timers.length > 0 && { timers }),
            ...(counters.length > 0 && { counters }),
            ...(stopwatches.length > 0 && { stopwatches }),
            ...(calendars.length > 0 && { calendars }),
            ...(habits.length > 0 && { habits }),
            ...(pictures.length > 0 && { pictures }),
            ...(quickLinks.length > 0 && { quickLinks }),
            ...(quotes.length > 0 && { quotes }),
          }
        } else if (typeof data === 'object') {
          rawWorkspace = data
        }

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

        const result = {
          columns: Array.isArray(rawWorkspace.columns) ? rawWorkspace.columns : null,
          customLabels: Array.isArray(rawWorkspace.customLabels) ? rawWorkspace.customLabels : null,
          notes: Array.isArray(rawWorkspace.notes) ? rawWorkspace.notes : null,
          timers: Array.isArray(rawWorkspace.timers) ? rawWorkspace.timers : null,
          counters: Array.isArray(rawWorkspace.counters) ? rawWorkspace.counters : null,
          stopwatches: Array.isArray(rawWorkspace.stopwatches) ? rawWorkspace.stopwatches : null,
          calendars: Array.isArray(rawWorkspace.calendars) ? rawWorkspace.calendars : null,
          habits: Array.isArray(rawWorkspace.habits) ? rawWorkspace.habits : null,
          pictures: Array.isArray(rawWorkspace.pictures) ? rawWorkspace.pictures : null,
          quickLinks: Array.isArray(rawWorkspace.quickLinks) ? rawWorkspace.quickLinks : null,
          quotes: Array.isArray(rawWorkspace.quotes) ? rawWorkspace.quotes : null,
          cardPositions: rawWorkspace.cardPositions && typeof rawWorkspace.cardPositions === 'object' ? rawWorkspace.cardPositions : {},
          drafts: rawWorkspace.drafts && typeof rawWorkspace.drafts === 'object' ? rawWorkspace.drafts : {}
        }

        resolve(result)
      } catch (err) {
        reject(new Error('Import cards failed: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsText(file, 'UTF-8')
  })
}

