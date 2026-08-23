import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  uploadImageToCloud,
  downloadImageFromCloud,
  deleteImageFromCloud,
  extractAllImageIds,
  syncAllLocalImages,
  downloadMissingImages,
} from './imageSync'
import * as imageStore from '../utils/imageStore'

const mockUpload = vi.fn()
const mockDownload = vi.fn()
const mockRemove = vi.fn()
const mockMaybeSingle = vi.fn()
const mockSelect = vi.fn()
const mockUpsert = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    storage: {
      from: () => ({
        upload: (...args) => mockUpload(...args),
        download: (...args) => mockDownload(...args),
        remove: (...args) => mockRemove(...args),
      }),
    },
    from: (table) => ({
      select: (...args) => {
        mockSelect(table, ...args)
        return {
          eq: (f1, v1) => {
            mockEq(f1, v1)
            return {
              eq: (f2, v2) => {
                mockEq(f2, v2)
                return {
                  maybeSingle: () => mockMaybeSingle(),
                }
              },
              in: (field, values) => {
                mockIn(field, values)
                return Promise.resolve({ data: [{ image_id: 'img-existing' }], error: null })
              },
              maybeSingle: () => mockMaybeSingle(),
            }
          },
        }
      },
      upsert: (data, opts) => {
        mockUpsert(table, data, opts)
        return Promise.resolve({ error: null })
      },
      delete: () => ({
        eq: (f1, v1) => ({
          eq: (f2, v2) => {
            mockDelete(table, f1, v1, f2, v2)
            return Promise.resolve({ error: null })
          },
        }),
      }),
    }),
  },
}))

describe('imageSync module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ data: { path: 'path' }, error: null })
    mockDownload.mockResolvedValue({ data: new Blob(['data'], { type: 'image/png' }), error: null })
    mockRemove.mockResolvedValue({ data: {}, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { storage_path: 'u-1/img-1.png' }, error: null })
  })

  it('rejects images larger than 5MB', async () => {
    const largeBlob = { size: 6 * 1024 * 1024, type: 'image/png' }
    const result = await uploadImageToCloud('u-1', 'img-large', largeBlob)
    expect(result).toBeNull()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('uploads valid image blob to user-scoped storage path', async () => {
    const blob = new Blob(['small image'], { type: 'image/jpeg' })
    const path = await uploadImageToCloud('user-123', 'img-abc', blob)

    expect(path).toBe('user-123/img-abc.jpeg')
    expect(mockUpload).toHaveBeenCalledWith(
      'user-123/img-abc.jpeg',
      blob,
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true })
    )
    expect(mockUpsert).toHaveBeenCalledWith(
      'images',
      expect.objectContaining({
        image_id: 'img-abc',
        user_id: 'user-123',
        storage_path: 'user-123/img-abc.jpeg',
      }),
      expect.objectContaining({ onConflict: 'image_id,user_id' })
    )
  })

  it('downloads image from cloud and caches in IndexedDB', async () => {
    const saveSpy = vi.spyOn(imageStore, 'saveImage').mockResolvedValue(true)
    const downloadedBlob = new Blob(['downloaded content'], { type: 'image/png' })
    mockDownload.mockResolvedValue({ data: downloadedBlob, error: null })

    const blob = await downloadImageFromCloud('user-123', 'img-xyz')

    expect(blob).toBeTruthy()
    expect(mockDownload).toHaveBeenCalledWith('u-1/img-1.png')
    expect(saveSpy).toHaveBeenCalledWith('img-xyz', downloadedBlob)
  })

  it('deletes image from both Storage and database registry', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { storage_path: 'user-123/img-del.png' }, error: null })

    await deleteImageFromCloud('user-123', 'img-del')

    expect(mockRemove).toHaveBeenCalledWith(['user-123/img-del.png'])
    expect(mockDelete).toHaveBeenCalledWith('images', 'image_id', 'img-del', 'user_id', 'user-123')
  })

  it('extracts all active and archived image IDs from workspace state', () => {
    const wsState = {
      pictures: [{ id: 'p1', imageId: 'img-1' }, { id: 'p2', imageId: 'img-2' }],
      archivedCards: [
        { type: 'picture', data: { imageId: 'img-archived' } },
        { type: 'todo', data: {} },
      ],
    }

    const ids = extractAllImageIds(wsState)
    expect(ids).toContain('img-1')
    expect(ids).toContain('img-2')
    expect(ids).toContain('img-archived')
    expect(ids).toHaveLength(3)
  })

  it('batches uploads of un-uploaded images', async () => {
    vi.spyOn(imageStore, 'getImage').mockResolvedValue(new Blob(['img'], { type: 'image/png' }))

    const wsState = {
      pictures: [{ id: 'p1', imageId: 'img-new-1' }, { id: 'p2', imageId: 'img-existing' }],
      archivedCards: [],
    }

    await syncAllLocalImages('user-123', wsState)

    // img-existing is returned by mockIn, so only img-new-1 should be uploaded
    expect(mockUpload).toHaveBeenCalledWith('user-123/img-new-1.png', expect.anything(), expect.anything())
  })
})
