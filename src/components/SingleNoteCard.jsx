import { createMemo } from 'solid-js'
import { CardContextMenu } from './CardContextMenu'

export function SingleNoteCard(props) {
  const getShapeStyles = (shape) => {
    switch (shape) {
      case 'rounded':
        return { "border-radius": '12px' }
      case 'pill':
        return { "border-radius": '9999px', padding: '12px 24px' }
      case 'circle':
        return { "border-radius": '50%', "aspect-ratio": '1/1', display: 'flex', "align-items": 'center', "justify-content": 'center', padding: '24px' }
      case 'leaf':
        return { "border-radius": '50% 0 50% 0', padding: '16px 24px' }
      case 'rectangle':
      default:
        return { "border-radius": '4px' } // Default label styling
    }
  }

  const shapeStyles = createMemo(() => getShapeStyles(props.singleNote.shape || 'rectangle'))

  return (
    <div
      class={`floating-card single-note-card card-label ${props.singleNote.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      data-card-id={props.cardId}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.singleNote.color || undefined,
        color: props.textColor,
        "font-size": props.singleNote.fontSize ? `${props.singleNote.fontSize}px` : undefined,
        ...shapeStyles(),
      }}
    >
      <div
        class="label-drag-handle"
        onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)}
        style={{ flex: '1', cursor: props.onPointerDown ? 'grab' : 'default', "padding-right": '4px' }}
      >
        {props.singleNote.text}
      </div>
      <CardContextMenu
        title={props.singleNote.text}
        minimized={Boolean(props.singleNote.minimized)}
        fontSize={props.singleNote.fontSize || 11}
        onTitleChange={(nextText) => props.onUpdateText(props.singleNote.id, nextText)}
        onColorChange={(color) => props.onUpdateColor(props.singleNote.id, color)}
        onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.singleNote.id, nextSize)}
        onShapeChange={(shape) => props.onUpdateShape && props.onUpdateShape(props.singleNote.id, shape)}
        currentShape={props.singleNote.shape || 'rectangle'}
        onMove={(targetId) => props.onMoveCard(props.singleNote.id, targetId)}
        onToggleMinimize={() => props.onToggleMinimize(props.singleNote.id)}
        onDuplicate={() => props.onDuplicateCard(props.singleNote.id)}
        onArchive={() => props.onArchiveCard(props.singleNote.id)}
        onDelete={() => props.onDeleteCard(props.singleNote.id)}
      />
    </div>
  )
}
