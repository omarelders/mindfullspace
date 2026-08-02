import { memo } from 'react'
import { CardContextMenu } from './CardContextMenu'

export const SingleNoteCard = memo(function SingleNoteCard({
  singleNote,
  position,
  textColor,
  onPointerDown,
  onUpdateText,
  onUpdateColor,
  onUpdateFontSize,
  onUpdateShape,
  onMoveCard,
  onToggleMinimize,
  onDuplicateCard,
  onArchiveCard,
  onDeleteCard,
  isPopping,
  cardId,
}) {
  const getShapeStyles = (shape) => {
    switch (shape) {
      case 'rounded':
        return { borderRadius: '12px' }
      case 'pill':
        return { borderRadius: '9999px', padding: '12px 24px' }
      case 'circle':
        return { borderRadius: '50%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }
      case 'leaf':
        return { borderRadius: '50% 0 50% 0', padding: '16px 24px' }
      case 'rectangle':
      default:
        return { borderRadius: '4px' } // Default label styling
    }
  }

  const shapeStyles = getShapeStyles(singleNote.shape || 'rectangle')

  return (
    <div
      className={`floating-card single-note-card card-label ${singleNote.minimized ? 'is-minimized' : ''} ${isPopping ? 'is-popping' : ''}`}
      data-card-id={cardId}
      style={{
        left: position?.x,
        top: position?.y,
        margin: position ? 0 : undefined,
        backgroundColor: singleNote.color || undefined,
        color: textColor,
        fontSize: singleNote.fontSize ? `${singleNote.fontSize}px` : undefined,
        ...shapeStyles
      }}
    >
      <div className="label-drag-handle" onPointerDown={(e) => onPointerDown(cardId, e)} style={{ flex: 1, cursor: onPointerDown ? 'grab' : 'default', paddingRight: '4px' }}>
        {singleNote.text}
      </div>
      <CardContextMenu
        title={singleNote.text}
        minimized={Boolean(singleNote.minimized)}
        fontSize={singleNote.fontSize || 11}
        onTitleChange={(nextText) => onUpdateText(singleNote.id, nextText)}
        onColorChange={(color) => onUpdateColor(singleNote.id, color)}
        onFontSizeChange={(nextSize) => onUpdateFontSize && onUpdateFontSize(singleNote.id, nextSize)}
        onShapeChange={(shape) => onUpdateShape && onUpdateShape(singleNote.id, shape)}
        currentShape={singleNote.shape || 'rectangle'}
        onMove={(targetId) => onMoveCard(singleNote.id, targetId)}
        onToggleMinimize={() => onToggleMinimize(singleNote.id)}
        onDuplicate={() => onDuplicateCard(singleNote.id)}
        onArchive={() => onArchiveCard(singleNote.id)}
        onDelete={() => onDeleteCard(singleNote.id)}
      />
    </div>
  )
})
