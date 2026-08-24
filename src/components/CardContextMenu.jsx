import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Palette, MoveRight, MoveUp, MoveDown, Minimize2, Maximize2, Copy, Archive, Trash2, Type, Minus, Plus } from 'lucide-react'
import { CARD_MENU_COLORS, CARD_MOVE_TARGETS } from '../utils/constants'
import { ConfirmModal } from './ConfirmModal'
import { useMobileCardOrderActions } from './MobileCardOrderContext'

// Mirrors the CSS breakpoint under which .card-menu-panel becomes a fixed
// bottom sheet. When matched, the open menu portals to <body> so no card's
// transform/stacking context can clip or misplace it.
const SHEET_QUERY = '(max-width: 700px)'

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function CardContextMenu({
  title,
  minimized,
  showTitleInput = true,
  onTitleChange,
  onColorChange,
  fontSize,
  onFontSizeChange,
  minFontSize = 10,
  maxFontSize = 96,
  onMove,
  onToggleMinimize,
  onDuplicate,
  onArchive,
  onDelete,
  onShapeChange,
  currentShape = 'rectangle',
  // Extra menu entries appended after "Duplicate".
  extraActions = [],
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [openSubmenu, setOpenSubmenu] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isSheetLayout, setIsSheetLayout] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(SHEET_QUERY).matches
  ))
  const menuRef = useRef(null)

  // Mobile column-layout reorder: resolve this menu's card via the DOM
  // (every card root carries data-card-id) and read the board-level actions.
  const orderActions = useMobileCardOrderActions()
  const [moveState, setMoveState] = useState({ canUp: false, canDown: false })
  useEffect(() => {
    if (!isOpen || !orderActions) return undefined
    const cardId = menuRef.current?.closest('[data-card-id]')?.getAttribute('data-card-id') || null
    setMoveState({
      canUp: Boolean(cardId && orderActions.canMove(cardId, 'up')),
      canDown: Boolean(cardId && orderActions.canMove(cardId, 'down')),
    })
    return undefined
  }, [isOpen, orderActions])

  const handleMoveInStack = (direction) => {
    if (!orderActions) return
    const cardId = menuRef.current?.closest('[data-card-id]')?.getAttribute('data-card-id')
    if (cardId) orderActions.move(cardId, direction)
  }

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(SHEET_QUERY)
    const update = () => setIsSheetLayout(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!isOpen || !isSheetLayout) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, isSheetLayout])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
        setOpenSubmenu(null)
      }
    }

    // pointerdown (not mousedown): touch taps must dismiss menus reliably,
    // and synthesized mouse events after scroll can target a different element.
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [isOpen])

  const closeMenu = () => {
    setIsOpen(false)
    setOpenSubmenu(null)
  }

  const handleAction = (action) => {
    action()
    closeMenu()
  }

  const stopMenuDrag = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const moveExtras = []
  if (orderActions) {
    moveExtras.push({
      id: 'move-up',
      label: 'Move up',
      icon: <MoveUp aria-hidden="true" />,
      disabled: !moveState.canUp,
      onRun: () => handleMoveInStack('up'),
    })
    moveExtras.push({
      id: 'move-down',
      label: 'Move down',
      icon: <MoveDown aria-hidden="true" />,
      disabled: !moveState.canDown,
      onRun: () => handleMoveInStack('down'),
    })
  }
  const allExtraActions = [...moveExtras, ...extraActions]

  const menuContent = (
    <>
      {showTitleInput && (
        <div className="card-menu-title-row">
          <Pencil aria-hidden="true" />
          <input
            type="text"
            value={title}
            placeholder="Write your title..."
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </div>
      )}

      {onFontSizeChange && (
        <div className="card-menu-item card-menu-font-row" onPointerDown={(event) => event.stopPropagation()}>
          <span className="card-menu-item-label">
            <Type aria-hidden="true" />
            Font size
          </span>
          <div className="card-menu-font-actions">
            <button
              type="button"
              className="card-font-btn"
              onClick={(e) => {
                e.stopPropagation()
                onFontSizeChange(Math.max(minFontSize, (fontSize || 14) - 2))
              }}
              disabled={(fontSize || 14) <= minFontSize}
              title="Decrease font size"
              aria-label="Decrease font size"
            >
              <Minus size={13} />
            </button>
            <span className="card-font-value">{fontSize || 14}px</span>
            <button
              type="button"
              className="card-font-btn"
              onClick={(e) => {
                e.stopPropagation()
                onFontSizeChange(Math.min(maxFontSize, (fontSize || 14) + 2))
              }}
              disabled={(fontSize || 14) >= maxFontSize}
              title="Increase font size"
              aria-label="Increase font size"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="submenu-trigger-wrap">
        <button
          type="button"
          className={`card-menu-item ${openSubmenu === 'color' ? 'is-active' : ''}`}
          onClick={() => setOpenSubmenu((submenu) => (submenu === 'color' ? null : 'color'))}
        >
          <span className="card-menu-item-label">
            <Palette aria-hidden="true" />
            Color
          </span>
          <span className="card-menu-arrow" aria-hidden="true">›</span>
        </button>
        {openSubmenu === 'color' && (
          <div className="card-submenu card-color-submenu" role="menu">
            <div className="card-submenu-content">
              {CARD_MENU_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className="card-color-option"
                  style={{ backgroundColor: color.value }}
                  aria-label={`set color ${color.id}`}
                  onClick={() => handleAction(() => onColorChange(color.value))}
                />
              ))}
              <button
                type="button"
                className="card-color-option reset-color"
                style={{ backgroundColor: 'var(--palette-neutral)' }}
                aria-label="reset color"
                onClick={() => handleAction(() => onColorChange(null))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="submenu-trigger-wrap">
        <button
          type="button"
          className={`card-menu-item ${openSubmenu === 'move' ? 'is-active' : ''}`}
          onClick={() => setOpenSubmenu((submenu) => (submenu === 'move' ? null : 'move'))}
        >
          <span className="card-menu-item-label">
            <MoveRight aria-hidden="true" />
            Move to
          </span>
          <span className="card-menu-arrow" aria-hidden="true">›</span>
        </button>
        {openSubmenu === 'move' && (
          <div className="card-submenu card-move-submenu" role="menu">
            <div className="card-submenu-content">
              {CARD_MOVE_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className="card-move-option"
                  onClick={() => handleAction(() => onMove(target.id))}
                >
                  {target.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {onShapeChange && (
        <div className="submenu-trigger-wrap">
          <button
            type="button"
            className={`card-menu-item ${openSubmenu === 'shape' ? 'is-active' : ''}`}
            onClick={() => setOpenSubmenu((submenu) => (submenu === 'shape' ? null : 'shape'))}
          >
            <span className="card-menu-item-label">
              <Type aria-hidden="true" />
              Shape
            </span>
            <span className="card-menu-arrow" aria-hidden="true">›</span>
          </button>
          {openSubmenu === 'shape' && (
            <div className="card-submenu card-shape-submenu" role="menu">
              <div className="card-submenu-content">
                {['rectangle', 'rounded', 'pill', 'circle', 'leaf'].map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    className={`card-move-option ${currentShape === shape ? 'is-selected' : ''}`}
                    onClick={() => handleAction(() => onShapeChange(shape))}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="card-menu-item"
        onClick={() => handleAction(onToggleMinimize)}
      >
        <span className="card-menu-item-label">
          {minimized ? <Maximize2 aria-hidden="true" /> : <Minimize2 aria-hidden="true" />}
          {minimized ? 'Expand' : 'Minimize'}
        </span>
      </button>

      <button
        type="button"
        className="card-menu-item"
        onClick={() => handleAction(onDuplicate)}
      >
        <span className="card-menu-item-label">
          <Copy aria-hidden="true" />
          Duplicate
        </span>
      </button>

      {allExtraActions.map((extra) => (
        <button
          key={extra.id}
          type="button"
          className={`card-menu-item ${extra.disabled ? 'is-disabled' : ''}`}
          disabled={Boolean(extra.disabled)}
          onClick={() => handleAction(extra.onRun)}
        >
          <span className="card-menu-item-label">
            {extra.icon}
            {extra.label}
          </span>
        </button>
      ))}

      <div className="card-menu-divider" />

      <button
        type="button"
        className="card-menu-item"
        onClick={() => handleAction(onArchive)}
      >
        <span className="card-menu-item-label">
          <Archive aria-hidden="true" />
          Archive
        </span>
      </button>

      <button
        type="button"
        className="card-menu-item delete-item"
        onClick={() => {
          setShowDeleteConfirm(true)
        }}
      >
        <span className="card-menu-item-label">
          <Trash2 aria-hidden="true" />
          Delete
        </span>
      </button>
    </>
  )

  const sheetAnimation = prefersReducedMotion() ? 'none' : undefined

  return (
    <div className="card-menu-wrap" ref={menuRef} onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="card-menu card-menu-trigger"
        aria-label="card menu"
        aria-expanded={isOpen}
        onPointerDown={stopMenuDrag}
        onClick={() => {
          setIsOpen((open) => !open)
          setOpenSubmenu(null)
        }}
      >
        ...
      </button>

      {isOpen && !isSheetLayout && (
        <div className="card-menu-panel" role="menu" onPointerDown={(event) => event.stopPropagation()}>
          {menuContent}
        </div>
      )}

      {isOpen && isSheetLayout && createPortal(
        <>
          <button
            type="button"
            className="card-menu-backdrop"
            aria-label="close menu"
            style={{ animation: sheetAnimation }}
            onClick={closeMenu}
          />
          <div
            className="card-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label={title ? `${title} options` : 'Card options'}
            style={{ animation: sheetAnimation }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {menuContent}
          </div>
        </>,
        document.body,
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          isOpen={true}
          title="Delete Card"
          message="Are you sure you want to delete this card permanently? This action cannot be undone."
          onConfirm={() => {
            setShowDeleteConfirm(false)
            handleAction(onDelete)
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
