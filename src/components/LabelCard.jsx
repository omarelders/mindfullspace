import { memo } from 'react'
import { CardContextMenu } from './CardContextMenu'

export const LabelCard = memo(function LabelCard({
  label,
  position,
  labelTextColor,
  onPointerDown,
  onUpdateText,
  onUpdateColor,
  onUpdateFontSize,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
  cardId,
}) {
  return (
    <div
      className={`floating-card label-card card-label ${label.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      data-card-id={cardId}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: label.color || undefined,
        color: labelTextColor,
        fontSize: label.fontSize ? `${label.fontSize}px` : undefined,
      }}
    >
      <div className="label-drag-handle" onPointerDown={(e) => onPointerDown(cardId, e)} style={{ flex: 1, cursor: onPointerDown ? 'grab' : 'default', paddingRight: '4px' }}>
        {label.text}
      </div>
      <CardContextMenu
        title={label.text}
        minimized={Boolean(label.minimized)}
        fontSize={label.fontSize || 11}
        onTitleChange={(nextText) => onUpdateText(label.id, nextText)}
        onColorChange={(color) => onUpdateColor(label.id, color)}
        onFontSizeChange={(nextSize) => onUpdateFontSize && onUpdateFontSize(label.id, nextSize)}
        onMove={(targetId) => onMoveCard(label.id, targetId)}
        onToggleMinimize={() => onToggleMinimize(label.id)}
        onDuplicate={() => onDuplicateCard(label.id)}
        onArchive={() => onArchiveCard(label.id)}
        onDelete={() => onDeleteCard(label.id)}
      />
    </div>
  )
})
