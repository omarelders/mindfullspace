import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'
import { getImage, saveImage, deleteImage, MAX_IMAGE_SIZE } from '../utils/imageStore'

export const PictureCard = memo(function PictureCard({
  picture,
  position,
  onMouseDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onUpdateImageId,
  onUpdateDimensions,
  scale = 1,
  isPopping,
}) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const resizerRef = useRef(null)

  // Load image from IndexedDB on mount or when imageId changes
  useEffect(() => {
    let revoked = false
    if (!picture.imageId) {
      setObjectUrl(null)
      return
    }
    getImage(picture.imageId)
      .then((blob) => {
        if (revoked) return
        if (blob) {
          setObjectUrl(URL.createObjectURL(blob))
        } else {
          setObjectUrl(null)
        }
      })
      .catch(() => {
        if (!revoked) setObjectUrl(null)
      })
    return () => {
      revoked = true
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [picture.imageId])

  const handleFile = useCallback(async (file) => {
    setError(null)
    if (!file || !file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`)
      return
    }
    try {
      const oldImageId = picture.imageId
      const newImageId = `img-${picture.id}-${Date.now()}`
      await saveImage(newImageId, file)
      if (onUpdateImageId) onUpdateImageId(picture.id, newImageId)
      
      // Cleanup old image from storage if it exists
      if (oldImageId) {
        deleteImage(oldImageId).catch(err => console.error('Failed to cleanup old image:', err))
      }
    } catch (err) {
      setError(err.message || 'Failed to save image.')
    }
  }, [picture.id, picture.imageId, onUpdateImageId])

  const handleFileInput = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleResizeStart = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    
    setIsResizing(true)
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = picture.width || 280
    const startHeight = picture.height || (resizerRef.current?.closest('.picture-card')?.offsetHeight || 200)

    const handleMouseMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      const newWidth = Math.max(160, startWidth + dx)
      const newHeight = Math.max(80, startHeight + dy)
      
      // Update visually during drag
      const card = resizerRef.current?.closest('.picture-card')
      if (card) {
        card.style.width = `${newWidth}px`
        card.style.height = `${newHeight}px`
      }
    }

    const handleMouseUp = (upEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      setIsResizing(false)
      
      const dx = (upEvent.clientX - startX) / scale
      const dy = (upEvent.clientY - startY) / scale
      const finalWidth = Math.max(160, startWidth + dx)
      const finalHeight = Math.max(80, startHeight + dy)
      
      if (onUpdateDimensions) {
        onUpdateDimensions(finalWidth, finalHeight)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [picture.width, picture.height, scale, onUpdateDimensions])

  return (
    <section
      className={`floating-card picture-card ${picture.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      data-card-id={picture.id}
      style={{
        left: position?.x,
        top: position?.y,
        width: picture.width || undefined,
        height: picture.height || undefined,
        margin: position ? 0 : undefined,
        backgroundColor: picture.color || undefined,
        zIndex: isResizing ? 1000 : undefined,
      }}
    >
      <header className="card-header" onMouseDown={onMouseDown} style={{ cursor: onMouseDown ? 'grab' : 'default' }}>
        <span className="card-title">{picture.title}</span>
        <CardContextMenu
          title={picture.title}
          minimized={Boolean(picture.minimized)}
          onTitleChange={(nextTitle) => onUpdateTitle(picture.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(picture.id, color)}
          onMove={(targetId) => onMoveCard(picture.id, targetId)}
          onToggleMinimize={() => onToggleMinimize(picture.id)}
          onDuplicate={() => onDuplicateCard(picture.id)}
          onArchive={() => onArchiveCard(picture.id)}
          onDelete={() => onDeleteCard(picture.id)}
        />
      </header>

      {!picture.minimized && (
        <div className="picture-body">
          {objectUrl ? (
            <div className="picture-preview">
              <img src={objectUrl} alt={picture.title || 'Uploaded picture'} className="picture-img" />
              <button type="button" className="picture-replace-btn" onClick={openFilePicker} aria-label="Replace image">
                <Upload size={14} />
                Replace
              </button>
            </div>
          ) : (
            <div
              className={`picture-dropzone ${isDragOver ? 'is-drag-over' : ''}`}
              onClick={openFilePicker}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <ImagePlus className="picture-dropzone-icon" />
              <span className="picture-dropzone-text">Click or drop an image</span>
              <span className="picture-dropzone-hint">Max 5MB • JPG, PNG, GIF, WebP</span>
            </div>
          )}

          {error && <div className="picture-error">{error}</div>}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
      )}
      {!picture.minimized && (
        <div 
          ref={resizerRef}
          className="picture-resizer" 
          onMouseDown={handleResizeStart}
        />
      )}
    </section>
  )
})
