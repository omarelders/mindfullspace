import { CardContextMenu } from './CardContextMenu'

export function LabelCard(props) {
  return (
    <div
      class={`floating-card label-card card-label ${props.label.minimized ? 'is-minimized' : ''} ${props.isPopping ? 'is-popping' : ''}`}
      data-card-id={props.cardId}
      style={{
        left: props.position?.x !== undefined ? `${props.position.x}px` : undefined,
        top: props.position?.y !== undefined ? `${props.position.y}px` : undefined,
        margin: props.position ? '0' : undefined,
        "background-color": props.label.color || undefined,
        color: props.labelTextColor,
        "font-size": props.label.fontSize ? `${props.label.fontSize}px` : undefined,
      }}
    >
      <div
        class="label-drag-handle"
        onPointerDown={(e) => props.onPointerDown?.(props.cardId, e)}
        style={{ flex: '1', cursor: props.onPointerDown ? 'grab' : 'default', "padding-right": '4px' }}
      >
        {props.label.text}
      </div>
      <CardContextMenu
        title={props.label.text}
        minimized={Boolean(props.label.minimized)}
        fontSize={props.label.fontSize || 11}
        onTitleChange={(nextText) => props.onUpdateText(props.label.id, nextText)}
        onColorChange={(color) => props.onUpdateColor(props.label.id, color)}
        onFontSizeChange={(nextSize) => props.onUpdateFontSize && props.onUpdateFontSize(props.label.id, nextSize)}
        onMove={(targetId) => props.onMoveCard(props.label.id, targetId)}
        onToggleMinimize={() => props.onToggleMinimize(props.label.id)}
        onDuplicate={() => props.onDuplicateCard(props.label.id)}
        onArchive={() => props.onArchiveCard(props.label.id)}
        onDelete={() => props.onDeleteCard(props.label.id)}
      />
    </div>
  )
}
