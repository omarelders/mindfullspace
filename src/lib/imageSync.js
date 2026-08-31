import { supabase } from './supabase'
import { getImage, saveImage } from '../utils/imageStore'
import { validateImageBlob, imageExtensionForMime } from '../utils/imageValidation'

const BUCKET_NAME = 'user-images'
const MAX_CONCURRENT_UPLOADS = 3
const SAFE_IMAGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/

export async function uploadImageToCloud(userId, imageId, blob) {
  if (!supabase || !userId || !imageId || !SAFE_IMAGE_ID.test(imageId) || !blob) return null

  const validation = await validateImageBlob(blob)
  if (!validation.valid) {
    console.warn(`[ImageSync] Image ${imageId} was rejected (${validation.reason}).`)
    return null
  }

  const mimeType = validation.mimeType
  const ext = imageExtensionForMime(mimeType)
  const storagePath = `${userId}/${imageId}.${ext}`

  try {
    // 1. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, blob, {
        contentType: mimeType,
        upsert: true,
      })

    if (uploadError) {
      console.warn('[ImageSync] Storage upload failed:', uploadError.message)
      return null
    }

    // 2. Record in public.images registry table
    const { error: dbError } = await supabase
      .from('images')
      .upsert(
        {
          image_id: imageId,
          user_id: userId,
          storage_path: storagePath,
          size_bytes: blob.size,
          mime_type: mimeType,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'image_id,user_id',
        }
      )

    if (dbError) {
      console.warn('[ImageSync] Image registry record failed:', dbError.message)
    }

    return storagePath
  } catch (err) {
    console.warn('[ImageSync] Unexpected upload error:', err.message)
    return null
  }
}

export async function downloadImageFromCloud(userId, imageId) {
  if (!supabase || !userId || !imageId) return null

  try {
    // 1. Look up storage path from database registry
    const { data: record, error: lookupError } = await supabase
      .from('images')
      .select('storage_path')
      .eq('image_id', imageId)
      .eq('user_id', userId)
      .maybeSingle()

    if (lookupError || !record?.storage_path) {
      return null
    }

    // 2. Download binary blob from Supabase Storage
    const { data: blob, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(record.storage_path)

    if (downloadError || !blob) {
      return null
    }

    const validation = await validateImageBlob(blob)
    if (!validation.valid) {
      console.warn(`[ImageSync] Rejected invalid cloud image ${imageId} (${validation.reason}).`)
      return null
    }

    // 3. Cache blob in local IndexedDB for instant future reads
    await saveImage(imageId, blob)

    return blob
  } catch (err) {
    console.warn('[ImageSync] Unexpected download error:', err.message)
    return null
  }
}

export async function deleteImageFromCloud(userId, imageId) {
  if (!supabase || !userId || !imageId) return

  try {
    const { data: record } = await supabase
      .from('images')
      .select('storage_path')
      .eq('image_id', imageId)
      .eq('user_id', userId)
      .maybeSingle()

    if (record?.storage_path) {
      await supabase.storage.from(BUCKET_NAME).remove([record.storage_path])
      await supabase
        .from('images')
        .delete()
        .eq('image_id', imageId)
        .eq('user_id', userId)
    }
  } catch (err) {
    console.warn('[ImageSync] Cloud delete failed:', err.message)
  }
}

export function extractAllImageIds(workspaceState) {
  const imageIds = new Set()
  if (!workspaceState) return []

  if (Array.isArray(workspaceState.pictures)) {
    workspaceState.pictures.forEach((pic) => {
      if (pic?.imageId) imageIds.add(pic.imageId)
    })
  }

  if (Array.isArray(workspaceState.archivedCards)) {
    workspaceState.archivedCards.forEach((entry) => {
      if (entry?.type === 'picture' && entry?.data?.imageId) {
        imageIds.add(entry.data.imageId)
      }
    })
  }

  return Array.from(imageIds)
}

export async function syncAllLocalImages(userId, workspaceState, onProgress = null) {
  if (!supabase || !userId || !workspaceState) return

  const imageIds = extractAllImageIds(workspaceState)
  if (imageIds.length === 0) return

  try {
    // Check which images are already registered in the cloud
    const { data: existingRows } = await supabase
      .from('images')
      .select('image_id')
      .eq('user_id', userId)
      .in('image_id', imageIds)

    const existingSet = new Set(existingRows?.map((r) => r.image_id) || [])
    const toUpload = imageIds.filter((id) => !existingSet.has(id))

    let completed = 0

    // Process batch with concurrency control
    for (let i = 0; i < toUpload.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = toUpload.slice(i, i + MAX_CONCURRENT_UPLOADS)
      await Promise.allSettled(
        batch.map(async (imageId) => {
          try {
            const blob = await getImage(imageId)
            if (blob) {
              await uploadImageToCloud(userId, imageId, blob)
            }
          } catch (err) {
            console.warn(`[ImageSync] Failed to upload image ${imageId}:`, err.message)
          } finally {
            completed++
            onProgress?.(completed, toUpload.length)
          }
        })
      )
    }
  } catch (err) {
    console.warn('[ImageSync] Batch sync error:', err.message)
  }
}

export async function downloadMissingImages(userId, workspaceState) {
  if (!supabase || !userId || !workspaceState) return

  const imageIds = extractAllImageIds(workspaceState)
  if (imageIds.length === 0) return

  for (const imageId of imageIds) {
    try {
      const localBlob = await getImage(imageId)
      if (!localBlob) {
        await downloadImageFromCloud(userId, imageId)
      }
    } catch {
      // Ignore individual image download failure
    }
  }
}
