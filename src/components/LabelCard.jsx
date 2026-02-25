import { memo } from 'react'
import { CardContextMenu } from './CardContextMenu'

export const LabelCard = memo(function LabelCard({
  label,
  position,
  labelTextColor,
  onMouseDown,
  onUpdateText,
  onUpdateColor,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
}) {
  return (
    <div
      className={`floating-card label-card card-label ${label.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      data-card-id={label.id}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: label.color || undefined,
        color: labelTextColor,
      }}
    >
      <div className="label-drag-handle" onMouseDown={onMouseDown} style={{ flex: 1, cursor: onMouseDown ? 'grab' : 'default', paddingRight: '4px' }}>
        {label.text}
      </div>
      <CardContextMenu
        title={label.text}
        minimized={Boolean(label.minimized)}
        onTitleChange={(nextText) => onUpdateText(label.id, nextText)}
        onColorChange={(color) => onUpdateColor(label.id, color)}
        onMove={(targetId) => onMoveCard(label.id, targetId)}
        onToggleMinimize={() => onToggleMinimize(label.id)}
        onDuplicate={() => onDuplicateCard(label.id)}
        onArchive={() => onArchiveCard(label.id)}
        onDelete={() => onDeleteCard(label.id)}
      />
    </div>
  )
})
