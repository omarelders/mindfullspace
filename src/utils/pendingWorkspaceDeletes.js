const PENDING_DELETES_PREFIX = 'mindful_pending_workspace_deletes:'
const activeFlushes = new Map()

function storageKey(userId) {
  return `${PENDING_DELETES_PREFIX}${encodeURIComponent(userId)}`
}

function readRecords(userId) {
  if (!userId || typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) || '[]')
    return Array.isArray(parsed)
      ? parsed.filter((record) => record && record.userId === userId && typeof record.workspaceId === 'string' && record.workspaceId.length > 0)
      : []
  } catch {
    return []
  }
}

function writeRecords(userId, records) {
  if (!userId || typeof window === 'undefined') return
  try {
    if (records.length > 0) {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(records))
    } else {
      window.localStorage.removeItem(storageKey(userId))
    }
  } catch {
    // Queue persistence is best effort; the local workspace remains deleted.
  }
}

export function readPendingWorkspaceDeletes(userId) {
  return readRecords(userId)
}

export function enqueuePendingWorkspaceDelete(userId, workspaceId) {
  if (!userId || !workspaceId) return
  const pending = readRecords(userId)
  if (!pending.some((record) => record.workspaceId === workspaceId)) {
    writeRecords(userId, [...pending, { userId, workspaceId }])
  }
}

export async function flushPendingWorkspaceDeletes(userId, deleteWorkspace) {
  if (!userId || typeof deleteWorkspace !== 'function') return
  if (activeFlushes.has(userId)) return activeFlushes.get(userId)

  const flushPromise = flushQueue(userId, deleteWorkspace)
  activeFlushes.set(userId, flushPromise)
  try {
    await flushPromise
  } finally {
    if (activeFlushes.get(userId) === flushPromise) activeFlushes.delete(userId)
  }
}

async function flushQueue(userId, deleteWorkspace) {
  const pending = readRecords(userId)
  if (pending.length === 0) return

  const results = await Promise.allSettled(
    pending.map((record) => deleteWorkspace(userId, record.workspaceId))
  )
  const failedIds = new Set(
    pending
      .filter((_, index) => results[index].status === 'rejected')
      .map((record) => record.workspaceId)
  )

  // Merge against the current queue so a delete enqueued while this flush was
  // in flight cannot be erased by a stale write.
  const current = readRecords(userId)
  const flushedIds = new Set(pending.map((record) => record.workspaceId))
  const survivors = current.filter((record) =>
    !flushedIds.has(record.workspaceId) || failedIds.has(record.workspaceId)
  )
  writeRecords(userId, survivors)
}
