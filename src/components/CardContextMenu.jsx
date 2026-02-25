import { useState, useRef, useEffect } from 'react'
import { Pencil, Palette, MoveRight, Minimize2, Maximize2, Copy, Archive, Trash2 } from 'lucide-react'
import { CARD_MENU_COLORS, CARD_MOVE_TARGETS } from '../utils/constants'

export function CardContextMenu({
  title,
  minimized,
  showTitleInput = true,
  onTitleChange,
  onColorChange,
  onMove,
  onToggleMinimize,
  onDuplicate,
  onArchive,
  onDelete,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [openSubmenu, setOpenSubmenu] = useState(null)
  const menuRef = useRef(null)

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

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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

  return (
    <div className="card-menu-wrap" ref={menuRef} onMouseDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="card-menu card-menu-trigger"
        aria-label="card menu"
        onMouseDown={stopMenuDrag}
        onClick={() => {
          setIsOpen((open) => !open)
          setOpenSubmenu(null)
        }}
      >
        ...
      </button>

      {isOpen && (
        <div className="card-menu-panel" role="menu" onMouseDown={(event) => event.stopPropagation()}>
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

          <div
            className="submenu-trigger-wrap"
            onMouseEnter={() => setOpenSubmenu('color')}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
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
                    style={{ backgroundColor: '#e0e0e0' }}
                    aria-label="reset color"
                    onClick={() => handleAction(() => onColorChange(null))}
                  />
                </div>
              </div>
            )}
          </div>

          <div
            className="submenu-trigger-wrap"
            onMouseEnter={() => setOpenSubmenu('move')}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
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
              if (window.confirm('Delete this card permanently?')) {
                handleAction(onDelete)
              }
            }}
          >
            <span className="card-menu-item-label">
              <Trash2 aria-hidden="true" />
              Delete
            </span>
          </button>


        </div>
      )}
    </div>
  )
}
