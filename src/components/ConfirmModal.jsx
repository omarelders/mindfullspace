import { Show, onCleanup, createEffect, mergeProps } from 'solid-js'
import { Portal } from 'solid-js/web'
import { AlertCircle, X } from 'lucide-solid'

export function ConfirmModal(props) {
  const merged = mergeProps({ confirmText: 'Delete', cancelText: 'Cancel', hideCancel: false }, props)

  // Handle Escape / Enter keys with a capturing listener to stop background keys
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      merged.onCancel?.()
    }
    if (e.key === 'Enter') {
      e.stopPropagation()
      merged.onConfirm?.()
    }
  }

  createEffect(() => {
    if (!merged.isOpen) return
    document.addEventListener('keydown', handleKeyDown, true)
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown, true))
  })

  return (
    <Show when={merged.isOpen}>
      <Portal mount={document.body}>
        {/* Hardcode colors so it works globally outside of .app-shell where CSS variables might not be provided */}
        <div class="confirm-modal-overlay" onPointerDown={(e) => e.stopPropagation()}>
          <div class="confirm-modal-content">
            <button type="button" class="confirm-modal-close" onClick={() => merged.onCancel?.()} aria-label="close">
              <X size={16} />
            </button>
            <div class="confirm-modal-header">
              <AlertCircle class="confirm-modal-icon" size={24} />
              <h3 class="confirm-modal-title">{merged.title}</h3>
            </div>
            <p class="confirm-modal-message">{merged.message}</p>
            <div class="confirm-modal-actions">
              <Show when={!merged.hideCancel}>
                <button type="button" class="confirm-modal-btn cancel" onClick={() => merged.onCancel?.()}>{merged.cancelText}</button>
              </Show>
              <button type="button" class="confirm-modal-btn confirm" onClick={() => merged.onConfirm?.()}>{merged.confirmText}</button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
