import { createSignal, createEffect, onCleanup, Show } from 'solid-js'
import { ImagePlus, Upload, Maximize, Minimize } from 'lucide-solid'
import { CardContextMenu } from './CardContextMenu'
import { getImage, saveImage } from '../utils/imageStore'
import { validateImageBlob } from '../utils/imageValidation'
import { useAuth } from '../hooks/useAuth'
import { uploadImageToCloud, downloadImageFromCloud } from '../lib/imageSync'

export function PictureCard(props) {
  // Keep the context object live — never destructure
  const auth = useAuth()
  const customStyle = () => props.picture.fontSize ? { "font-size": `${props.picture.fontSize}px` } : undefined
  const [objectUrl, setObjectUrl] = createSignal(null)
  const [isDragOver, setIsDragOver] = createSignal(false)
  const [isResizing, setIsResizing] = createSignal(false)
  const [resizedDimensions, setResizedDimensions] = createSignal(null)
  const [error, setError] = createSignal(null)
  let fileInputRef
  let resizerRef

  // Load image from IndexedDB when imageId changes (with cloud fallback).
  // Blob URL lifecycle: onCleanup inside the effect revokes on both
  // re-evaluation and disposal so URLs never leak (plan risk #8).
  createEffect(() => {
    const imageId = props.picture.imageId
    let revoked = false
    if (!imageId) {
      setObjectUrl(null)
      return
    }
    getImage(imageId)
      .then(async (blob) => {
        if (revoked) return
        const user = auth.user
        if (blob) {
          const validation = await validateImageBlob(blob)
          if (validation.valid) {
            setObjectUrl(URL.createObjectURL(blob))
          } else if (!revoked) {
            setObjectUrl(null)
            setError('The stored image is invalid and was not displayed.')
          }
        } else if (user) {
          // Cloud fallback when image isn't in local IndexedDB
          const cloudBlob = await downloadImageFromCloud(user.id, imageId)
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
    onCleanup(() => {
      revoked = true
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    })
  })

  async function handleFile(file) {
    setError(null)
    const validation = await validateImageBlob(file)
    if (!validation.valid) {
      setError(validation.reason === 'too-large'
        ? `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`
        : 'Please select a valid image file (JPEG, PNG, GIF, or WebP). SVGs are not allowed.')
      return
    }
    try {
      const oldImageId = props.picture.imageId
      const newImageId = `img-${props.picture.id}-${Date.now()}`
      await saveImage(newImageId, file)
      const user = auth.user
      if (user) {
        uploadImageToCloud(user.id, newImageId, file).catch(() => {})
      }
      if (props.onUpdateImageId) {
        props.onUpdateImageId(props.picture.id, newImageId, oldImageId)
      }
    } catch (err) {
      setError(err.message || 'Failed to save image.')
    }
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function openFilePicker() {
    fileInputRef?.click()
  }

  let resizeState = null

  function handleResizePointerDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    e.target.setPointerCapture(e.pointerId)
    setIsResizing(true)

    const startWidth = props.picture.width || 280
    const startHeight = props.picture.height || (resizerRef?.closest('.picture-card')?.offsetHeight || 200)

    resizeState = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth,
      startHeight,
    }

    setResizedDimensions({ width: startWidth, height: startHeight })
  }

  function handleResizePointerMove(e) {
    if (!isResizing() || !resizeState) return

    const scale = typeof props.scale === 'function' ? props.scale() : (props.scale ?? 1)
    const dx = (e.clientX - resizeState.startX) / scale
    const dy = (e.clientY - resizeState.startY) / scale

    const newWidth = Math.max(180, resizeState.startWidth + dx)
    const newHeight = Math.max(120, resizeState.startHeight + dy)

    setResizedDimensions({ width: newWidth, height: newHeight })
  }

  function handleResizePointerUp(e) {
    if (!isResizing()) return

    e.target.releasePointerCapture(e.pointerId)
    setIsResizing(false)

    if (resizedDimensions() && props.onUpdateDimensions) {
      props.onUpdateDimensions(resizedDimensions().width, resizedDimensions().height)
    }

    resizeState = null
    setResizedDimensions(null)
  }

  function handleResizePointerCancel(e) {
    if (!isResizing()) return
    e.target.releasePointerCapture(e.pointerId)
    setIsResizing(false)
    resizeState = null
    setResizedDimensions(null)
  }

  const fitMode = () => props.picture.fitMode || 'contain'
  const toggleFitMode = () => {
    if (props.onUpdateFitMode) {
      props.onUpdateFitMode(props.picture.id, fitMode() === 'contain' ? 'cover' : 'contain')
    }
  }

  return (
    <section
      class={`floating-card picture-card ${props.picture.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      data-card-id={props.cardId}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        width: resizedDimensions()?.width !== undefined ? `${resizedDimensions().width}px` : props.picture.width !== undefined ? `${props.picture.width}px` : undefined,
        height: resizedDimensions()?.height !== undefined ? `${resizedDimensions().height}px` : props.picture.height !== undefined ? `${props.picture.height}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.picture.color || undefined,
        "z-index": isResizing() ? 1000 : undefined,
      }}
    >
      <header class="card-header" onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)} style={{ cursor: props.onPointerDown ? 'grab' : 'default' }}>
        <span class="card-title">{props.picture.title}</span>
        <CardContextMenu
          title={props.picture.title}
          minimized={Boolean(props.picture.minimized)}
          fontSize={props.picture.fontSize || 13}
          onTitleChange={(nextTitle) => props.onUpdateTitle(props.picture.id, nextTitle)}
          onColorChange={(color) => props.onUpdateColor(props.picture.id, color)}
          onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.picture.id, nextSize)}
          onMove={(targetId) => props.onMoveCard(props.picture.id, targetId)}
          onToggleMinimize={() => props.onToggleMinimize(props.picture.id)}
          onDuplicate={() => props.onDuplicateCard(props.picture.id)}
          onArchive={() => props.onArchiveCard(props.picture.id)}
          onDelete={() => props.onDeleteCard(props.picture.id)}
        />
      </header>

      <Show when={!props.picture.minimized}>
        <div class="picture-body">
          <Show
            when={objectUrl()}
            fallback={
              <div
                class={`picture-dropzone ${isDragOver() ? 'is-drag-over' : ''}`}
                onClick={openFilePicker}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <ImagePlus class="picture-dropzone-icon" />
                <span class="picture-dropzone-text" style={customStyle()}>Click or drop an image</span>
                <span class="picture-dropzone-hint">Max 5MB • JPG, PNG, GIF, WebP</span>
              </div>
            }
          >
            {(url) => (
              <div class="picture-preview">
                <img
                  src={url()}
                  alt={props.picture.title || 'Uploaded picture'}
                  class="picture-img"
                  style={{ "object-fit": fitMode() }}
                />
                <div class="picture-actions">
                  <button type="button" class="picture-action-btn" style={customStyle()} onClick={toggleFitMode} aria-label="Toggle fit mode">
                    {fitMode() === 'contain' ? <Maximize size={14} /> : <Minimize size={14} />}
                    {fitMode() === 'contain' ? 'Cover' : 'Contain'}
                  </button>
                  <button type="button" class="picture-action-btn" style={customStyle()} onClick={openFilePicker} aria-label="Replace image">
                    <Upload size={14} />
                    Replace
                  </button>
                </div>
              </div>
            )}
          </Show>

          <Show when={error()}>
            <div class="picture-error">{error()}</div>
          </Show>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
      </Show>
      <Show when={!props.picture.minimized}>
        <div
          ref={resizerRef}
          class="picture-resizer"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerCancel}
        />
      </Show>
    </section>
  )
}
