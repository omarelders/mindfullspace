import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PictureCard } from './PictureCard'
import { exportWorkspace, importWorkspace } from '../utils/backup'
import { readJsonStorage, writeJsonStorage } from '../utils/storage'
import { WORKSPACE_STORAGE_KEY_PREFIX } from '../utils/constants'
import { saveImage, getImage, deleteImage } from '../utils/imageStore'

// Mock the image store to avoid IndexedDB issues in tests
vi.mock('../utils/imageStore', () => ({
  getImage: vi.fn().mockResolvedValue(new Blob(['mock'], { type: 'image/png' })),
  saveImage: vi.fn().mockResolvedValue('mock-image-id'),
  deleteImage: vi.fn().mockResolvedValue(true),
  MAX_IMAGE_SIZE: 5 * 1024 * 1024
}))

vi.mock('../utils/storage', () => ({
  readJsonStorage: vi.fn(),
  writeJsonStorage: vi.fn(),
  validateWorkspaceState: vi.fn(val => val)
}))

// Mock URL.createObjectURL since JSDOM doesn't support it natively
beforeEach(() => {
  URL.createObjectURL = vi.fn().mockReturnValue('mock-object-url')
  URL.revokeObjectURL = vi.fn()
})

const defaultProps = {
  picture: {
    id: 'pic-1',
    title: 'Test Picture',
    width: 200,
    height: 150,
    imageId: 'img-123'
  },
  position: { x: 100, y: 100 },
  onUpdateDimensions: vi.fn(),
  onUpdateFitMode: vi.fn(),
  onUpdateImageId: vi.fn(),
  onUpdateTitle: vi.fn(),
  onUpdateColor: vi.fn(),
  onMoveCard: vi.fn(),
  onToggleMinimize: vi.fn(),
  onDuplicateCard: vi.fn(),
  onArchiveCard: vi.fn(),
  onDeleteCard: vi.fn(),
  scale: 1,
}

describe('PictureCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly with given picture properties', () => {
    render(<PictureCard {...defaultProps} />)
    expect(screen.getByText('Test Picture')).toBeInTheDocument()
  })

  it('resizes card using pointer events at scale 1', () => {
    render(<PictureCard {...defaultProps} scale={1} />)

    // In JSDOM, we have to mock setPointerCapture and releasePointerCapture
    const resizer = document.querySelector('.picture-resizer')
    resizer.setPointerCapture = vi.fn()
    resizer.releasePointerCapture = vi.fn()

    // Start resize
    fireEvent.pointerDown(resizer, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    expect(resizer.setPointerCapture).toHaveBeenCalledWith(1)

    // Move
    fireEvent.pointerMove(resizer, { clientX: 150, clientY: 130, pointerId: 1 })

    // Stop
    fireEvent.pointerUp(resizer, { pointerId: 1 })
    expect(resizer.releasePointerCapture).toHaveBeenCalledWith(1)

    // Math: original + (move / scale) -> 200 + 50 = 250 width, 150 + 30 = 180 height
    expect(defaultProps.onUpdateDimensions).toHaveBeenCalledWith(250, 180)
  })

  it('scales pointer movement correctly (scale < 1)', () => {
    render(<PictureCard {...defaultProps} scale={0.5} />)

    const resizer = document.querySelector('.picture-resizer')
    resizer.setPointerCapture = vi.fn()
    resizer.releasePointerCapture = vi.fn()

    fireEvent.pointerDown(resizer, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(resizer, { clientX: 150, clientY: 130, pointerId: 1 })
    fireEvent.pointerUp(resizer, { pointerId: 1 })

    // dx = 50 / 0.5 = 100, dy = 30 / 0.5 = 60
    // new width: 200 + 100 = 300, new height: 150 + 60 = 210
    expect(defaultProps.onUpdateDimensions).toHaveBeenCalledWith(300, 210)
  })

  it('scales pointer movement correctly (scale > 1)', () => {
    render(<PictureCard {...defaultProps} scale={2} />)

    const resizer = document.querySelector('.picture-resizer')
    resizer.setPointerCapture = vi.fn()
    resizer.releasePointerCapture = vi.fn()

    fireEvent.pointerDown(resizer, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(resizer, { clientX: 200, clientY: 160, pointerId: 1 })
    fireEvent.pointerUp(resizer, { pointerId: 1 })

    // dx = 100 / 2 = 50, dy = 60 / 2 = 30
    // new width: 200 + 50 = 250, new height: 150 + 30 = 180
    expect(defaultProps.onUpdateDimensions).toHaveBeenCalledWith(250, 180)
  })

  it('enforces minimum dimensions (180x120)', () => {
    render(<PictureCard {...defaultProps} scale={1} />)

    const resizer = document.querySelector('.picture-resizer')
    resizer.setPointerCapture = vi.fn()
    resizer.releasePointerCapture = vi.fn()

    fireEvent.pointerDown(resizer, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    // Move backward significantly to trigger minimum boundaries
    fireEvent.pointerMove(resizer, { clientX: -500, clientY: -500, pointerId: 1 })
    fireEvent.pointerUp(resizer, { pointerId: 1 })

    expect(defaultProps.onUpdateDimensions).toHaveBeenCalledWith(180, 120)
  })

  it('cancels resize properly using pointerCancel', () => {
    render(<PictureCard {...defaultProps} scale={1} />)

    const resizer = document.querySelector('.picture-resizer')
    resizer.setPointerCapture = vi.fn()
    resizer.releasePointerCapture = vi.fn()

    fireEvent.pointerDown(resizer, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(resizer, { clientX: 150, clientY: 130, pointerId: 1 })
    fireEvent.pointerCancel(resizer, { pointerId: 1 })

    expect(resizer.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(defaultProps.onUpdateDimensions).not.toHaveBeenCalled()
  })

  it('toggles fit mode correctly', async () => {
    render(<PictureCard {...defaultProps} />)
    // The image state loads asynchronously, so we wait for the preview and the button to appear.
    const toggleBtn = await screen.findByLabelText('Toggle fit mode')
    fireEvent.click(toggleBtn)
    expect(defaultProps.onUpdateFitMode).toHaveBeenCalledWith('pic-1', 'cover')
  })
})

describe('Backup UTF-8 Encoding & Image References', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn().mockReturnValue('mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('exportWorkspace correctly creates JSON with UTF-8 charset blob', async () => {
    readJsonStorage.mockReturnValue({
      pictures: [{ id: '1', imageId: 'test-img' }],
      archivedCards: []
    })

    getImage.mockResolvedValue(new Blob(['img data'], { type: 'image/png' }))

    const clickMock = vi.fn()
    const mockAnchor = { click: clickMock, href: '', download: '' }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})

    let blobSpy;
    // Intercept Blob constructor to verify charset
    const OriginalBlob = global.Blob
    global.Blob = function (content, options) {
      blobSpy = { content, options }
      return new OriginalBlob(content, options)
    }

    await exportWorkspace('ws-1', 'Test Workspace')

    expect(blobSpy.options.type).toBe('application/json;charset=utf-8')
    expect(mockAnchor.download).toContain('Test_Workspace_backup')
    expect(clickMock).toHaveBeenCalled()

    global.Blob = OriginalBlob
  })

  it('importWorkspace correctly enforces UTF-8 decoding on readAsText', async () => {
    const mockFile = new File(['{"version": 1, "workspace": {}, "images": {}}'], 'backup.json', { type: 'application/json' })

    // We mock FileReader
    const readAsTextSpy = vi.fn()
    const OriginalFileReader = global.FileReader
    global.FileReader = class {
      constructor() {
        this.onload = null
        this.onerror = null
      }
      readAsText(file, encoding) {
        readAsTextSpy(file, encoding)
        this.result = '{"version": 1, "workspace": {}, "images": {}}'
        if (this.onload) this.onload({ target: { result: this.result } })
      }
    }

    await importWorkspace('ws-1', mockFile)

    expect(readAsTextSpy).toHaveBeenCalledWith(mockFile, 'UTF-8')
    expect(writeJsonStorage).toHaveBeenCalled()

    global.FileReader = OriginalFileReader
  })
})
