import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { ImagePlus, Upload, Maximize, Minimize } from 'lucide-react'
import { CardContextMenu } from './CardContextMenu'
import { getImage, saveImage, deleteImage, MAX_IMAGE_SIZE } from '../utils/imageStore'
import { useAuth } from '../hooks/useAuth'
import { uploadImageToCloud, downloadImageFromCloud, deleteImageFromCloud } from '../lib/imageSync'

export const PictureCard = memo(function PictureCard({
  picture,
  position,
  onPointerDown,
  onUpdateTitle,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  onUpdateImageId,
  onUpdateDimensions,
  onUpdateFitMode,
  onUpdateFontSize,
  scale = 1,
  isPopping,
  cardId,
}) {
  const { user } = useAuth()
  const customStyle = picture.fontSize ? { fontSize: `${picture.fontSize}px` } : undefined
  const [objectUrl, setObjectUrl] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizedDimensions, setResizedDimensions] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const resizerRef = useRef(null)

  // Load image from IndexedDB on mount or when imageId changes (with cloud fallback)
  useEffect(() => {
    let revoked = false
    if (!picture.imageId) {
      setObjectUrl(null)
      return
    }
    getImage(picture.imageId)
      .then(async (blob) => {
        if (revoked) return
        if (blob) {
          setObjectUrl(URL.createObjectURL(blob))
        } else if (user) {
          // Cloud fallback when image isn't in local IndexedDB
          const cloudBlob = await downloadImageFromCloud(user.id, picture.imageId)
          if (!revoked && cloudBlob) {
            setObjectUrl(URL.createObjectURL(cloudBlob))
          } else if (!revoked) {
            setObjectUrl(null)
          }
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
  }, [picture.imageId, user])

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
      if (user) {
        uploadImageToCloud(user.id, newImageId, file).catch(() => {})
      }
      if (onUpdateImageId) onUpdateImageId(picture.id, newImageId)
      
      // Cleanup old image from local and cloud storage if it exists
      if (oldImageId) {
        deleteImage(oldImageId).catch(err => console.error('Failed to cleanup old image:', err))
        if (user) {
          deleteImageFromCloud(user.id, oldImageId).catch(() => {})
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to save image.')
    }
  }, [picture.id, picture.imageId, onUpdateImageId, user])

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

  const resizeState = useRef(null)

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    
    e.target.setPointerCapture(e.pointerId)
    setIsResizing(true)

    const startWidth = picture.width || 280
    const startHeight = picture.height || (resizerRef.current?.closest('.picture-card')?.offsetHeight || 200)

    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth,
      startHeight
    }

    setResizedDimensions({ width: startWidth, height: startHeight })
  }, [picture.width, picture.height])

  const handlePointerMove = useCallback((e) => {
    if (!isResizing || !resizeState.current) return

    const { startX, startY, startWidth, startHeight } = resizeState.current
    const dx = (e.clientX - startX) / scale
    const dy = (e.clientY - startY) / scale

    const newWidth = Math.max(180, startWidth + dx)
    const newHeight = Math.max(120, startHeight + dy)

    setResizedDimensions({ width: newWidth, height: newHeight })
  }, [isResizing, scale])

  const handlePointerUp = useCallback((e) => {
    if (!isResizing) return

    e.target.releasePointerCapture(e.pointerId)
    setIsResizing(false)

    if (resizedDimensions && onUpdateDimensions) {
      onUpdateDimensions(resizedDimensions.width, resizedDimensions.height)
    }

    resizeState.current = null
    setResizedDimensions(null)
  }, [isResizing, resizedDimensions, onUpdateDimensions])

  const handlePointerCancel = useCallback((e) => {
    if (!isResizing) return
    e.target.releasePointerCapture(e.pointerId)
    setIsResizing(false)
    resizeState.current = null
    setResizedDimensions(null)
  }, [isResizing])

  const fitMode = picture.fitMode || 'contain'
  const toggleFitMode = useCallback(() => {
    if (onUpdateFitMode) {
      onUpdateFitMode(picture.id, fitMode === 'contain' ? 'cover' : 'contain')
    }
  }, [fitMode, onUpdateFitMode, picture.id])

  return (
    <section
      className={`floating-card picture-card ${picture.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      data-card-id={cardId}
      style={{
        left: position?.x,
        top: position?.y,
        width: resizedDimensions?.width || picture.width || undefined,
        height: resizedDimensions?.height || picture.height || undefined,
        margin: position ? 0 : undefined,
        backgroundColor: picture.color || undefined,
        zIndex: isResizing ? 1000 : undefined,
      }}
    >
      <header className="card-header" onPointerDown={(e) => onPointerDown(cardId, e)} style={{ cursor: onPointerDown ? 'grab' : 'default' }}>
        <span className="card-title">{picture.title}</span>
        <CardContextMenu
          title={picture.title}
          minimized={Boolean(picture.minimized)}
          fontSize={picture.fontSize || 13}
          onTitleChange={(nextTitle) => onUpdateTitle(picture.id, nextTitle)}
          onColorChange={(color) => onUpdateColor(picture.id, color)}
          onFontSizeChange={(nextSize) => onUpdateFontSize && onUpdateFontSize(picture.id, nextSize)}
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
              <img
                src={objectUrl}
                alt={picture.title || 'Uploaded picture'}
                className="picture-img"
                style={{ objectFit: fitMode }}
              />
              <div className="picture-actions">
                <button type="button" className="picture-action-btn" style={customStyle} onClick={toggleFitMode} aria-label="Toggle fit mode">
                  {fitMode === 'contain' ? <Maximize size={14} /> : <Minimize size={14} />}
                  {fitMode === 'contain' ? 'Cover' : 'Contain'}
                </button>
                <button type="button" className="picture-action-btn" style={customStyle} onClick={openFilePicker} aria-label="Replace image">
                  <Upload size={14} />
                  Replace
                </button>
              </div>
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
              <span className="picture-dropzone-text" style={customStyle}>Click or drop an image</span>
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      )}
    </section>
  )
})
