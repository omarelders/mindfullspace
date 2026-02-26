import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, X } from 'lucide-react'

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Delete", 
  cancelText = "Cancel",
  hideCancel = false
}) {
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
      if (e.key === 'Enter') {
        e.stopPropagation()
        onConfirm()
      }
    }
    
    // Add capturing listener to stop background keys
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onCancel, onConfirm])

  if (!isOpen) return null

  // Hardcode colors so it works globally outside of .app-shell where CSS variables might not be provided
  return createPortal(
    <div className="confirm-modal-overlay" onMouseDown={(e) => e.stopPropagation()}>
      <div className="confirm-modal-content">
        <button className="confirm-modal-close" onClick={onCancel} aria-label="close">
          <X size={16} />
        </button>
        <div className="confirm-modal-header">
          <AlertCircle className="confirm-modal-icon" size={24} />
          <h3 className="confirm-modal-title">{title}</h3>
        </div>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          {!hideCancel && <button className="confirm-modal-btn cancel" onClick={onCancel}>{cancelText}</button>}
          <button className="confirm-modal-btn confirm" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
