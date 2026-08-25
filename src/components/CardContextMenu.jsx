import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js'
import { Pencil, Palette, MoveRight, Minimize2, Maximize2, Copy, Archive, Trash2, Type, Minus, Plus } from 'lucide-solid'
import { CARD_MENU_COLORS, CARD_MOVE_TARGETS } from '../utils/constants'
import { ConfirmModal } from './ConfirmModal'

export function CardContextMenu(props) {
  const [isOpen, setIsOpen] = createSignal(false)
  const [openSubmenu, setOpenSubmenu] = createSignal(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  let menuRef

  createEffect(() => {
    if (!isOpen()) {
      return
    }

    const handleClickOutside = (event) => {
      if (menuRef && !menuRef.contains(event.target)) {
        setIsOpen(false)
        setOpenSubmenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    onCleanup(() => document.removeEventListener('mousedown', handleClickOutside))
  })

  const closeMenu = () => {
    setIsOpen(false)
    setOpenSubmenu(null)
  }

  const handleAction = (action) => {
    action?.()
    closeMenu()
  }

  const stopMenuDrag = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div class="card-menu-wrap" ref={menuRef} onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        class="card-menu card-menu-trigger"
        aria-label="card menu"
        onPointerDown={stopMenuDrag}
        onClick={() => {
          setIsOpen((open) => !open)
          setOpenSubmenu(null)
        }}
      >
        ...
      </button>

      <Show when={isOpen()}>
        <div class="card-menu-panel" role="menu" onPointerDown={(event) => event.stopPropagation()}>
          <Show when={props.showTitleInput !== false}>
            <div class="card-menu-title-row">
              <Pencil aria-hidden="true" />
              <input
                type="text"
                value={props.title}
                placeholder="Write your title..."
                onInput={(event) => props.onTitleChange?.(event.currentTarget.value)}
              />
            </div>
          </Show>

          <Show when={props.onFontSizeChange}>
            <div class="card-menu-item card-menu-font-row" onPointerDown={(event) => event.stopPropagation()}>
              <span class="card-menu-item-label">
                <Type aria-hidden="true" />
                Font size
              </span>
              <div class="card-menu-font-actions">
                <button
                  type="button"
                  class="card-font-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onFontSizeChange(Math.max(props.minFontSize ?? 10, (props.fontSize || 14) - 2))
                  }}
                  disabled={(props.fontSize || 14) <= (props.minFontSize ?? 10)}
                  title="Decrease font size"
                  aria-label="Decrease font size"
                >
                  <Minus size={13} />
                </button>
                <span class="card-font-value">{props.fontSize || 14}px</span>
                <button
                  type="button"
                  class="card-font-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onFontSizeChange(Math.min(props.maxFontSize ?? 96, (props.fontSize || 14) + 2))
                  }}
                  disabled={(props.fontSize || 14) >= (props.maxFontSize ?? 96)}
                  title="Increase font size"
                  aria-label="Increase font size"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </Show>

          <div class="submenu-trigger-wrap">
            <button
              type="button"
              class={`card-menu-item ${openSubmenu() === 'color' ? 'is-active' : ''}`}
              onClick={() => setOpenSubmenu((submenu) => (submenu === 'color' ? null : 'color'))}
            >
              <span class="card-menu-item-label">
                <Palette aria-hidden="true" />
                Color
              </span>
              <span class="card-menu-arrow" aria-hidden="true">›</span>
            </button>
            <Show when={openSubmenu() === 'color'}>
              <div class="card-submenu card-color-submenu" role="menu">
                <div class="card-submenu-content">
                  <For each={CARD_MENU_COLORS}>
                    {(color) => (
                      <button
                        type="button"
                        class="card-color-option"
                        style={{ "background-color": color.value }}
                        aria-label={`set color ${color.id}`}
                        onClick={() => handleAction(() => props.onColorChange?.(color.value))}
                      />
                    )}
                  </For>
                  <button
                    type="button"
                    class="card-color-option reset-color"
                    style={{ "background-color": 'var(--palette-neutral)' }}
                    aria-label="reset color"
                    onClick={() => handleAction(() => props.onColorChange?.(null))}
                  />
                </div>
              </div>
            </Show>
          </div>

          <div class="submenu-trigger-wrap">
            <button
              type="button"
              class={`card-menu-item ${openSubmenu() === 'move' ? 'is-active' : ''}`}
              onClick={() => setOpenSubmenu((submenu) => (submenu === 'move' ? null : 'move'))}
            >
              <span class="card-menu-item-label">
                <MoveRight aria-hidden="true" />
                Move to
              </span>
              <span class="card-menu-arrow" aria-hidden="true">›</span>
            </button>
            <Show when={openSubmenu() === 'move'}>
              <div class="card-submenu card-move-submenu" role="menu">
                <div class="card-submenu-content">
                  <For each={CARD_MOVE_TARGETS}>
                    {(target) => (
                      <button
                        type="button"
                        class="card-move-option"
                        onClick={() => handleAction(() => props.onMove?.(target.id))}
                      >
                        {target.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          <Show when={props.onShapeChange}>
            <div class="submenu-trigger-wrap">
              <button
                type="button"
                class={`card-menu-item ${openSubmenu() === 'shape' ? 'is-active' : ''}`}
                onClick={() => setOpenSubmenu((submenu) => (submenu === 'shape' ? null : 'shape'))}
              >
                <span class="card-menu-item-label">
                  <Type aria-hidden="true" />
                  Shape
                </span>
                <span class="card-menu-arrow" aria-hidden="true">›</span>
              </button>
              <Show when={openSubmenu() === 'shape'}>
                <div class="card-submenu card-shape-submenu" role="menu">
                  <div class="card-submenu-content">
                    <For each={['rectangle', 'rounded', 'pill', 'circle', 'leaf']}>
                      {(shape) => (
                        <button
                          type="button"
                          class={`card-move-option ${(props.currentShape ?? 'rectangle') === shape ? 'is-selected' : ''}`}
                          onClick={() => handleAction(() => props.onShapeChange(shape))}
                          style={{ "text-transform": 'capitalize' }}
                        >
                          {shape}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          <button
            type="button"
            class="card-menu-item"
            onClick={() => handleAction(props.onToggleMinimize)}
          >
            <span class="card-menu-item-label">
              <Show when={props.minimized} fallback={<Minimize2 aria-hidden="true" />}>
                <Maximize2 aria-hidden="true" />
              </Show>
              {props.minimized ? 'Expand' : 'Minimize'}
            </span>
          </button>

          <button
            type="button"
            class="card-menu-item"
            onClick={() => handleAction(props.onDuplicate)}
          >
            <span class="card-menu-item-label">
              <Copy aria-hidden="true" />
              Duplicate
            </span>
          </button>

          <div class="card-menu-divider" />

          <button
            type="button"
            class="card-menu-item"
            onClick={() => handleAction(props.onArchive)}
          >
            <span class="card-menu-item-label">
              <Archive aria-hidden="true" />
              Archive
            </span>
          </button>

          <button
            type="button"
            class="card-menu-item delete-item"
            onClick={() => {
              setShowDeleteConfirm(true)
            }}
          >
            <span class="card-menu-item-label">
              <Trash2 aria-hidden="true" />
              Delete
            </span>
          </button>

        </div>
      </Show>

      <Show when={showDeleteConfirm()}>
        <ConfirmModal
          isOpen={true}
          title="Delete Card"
          message="Are you sure you want to delete this card permanently? This action cannot be undone."
          onConfirm={() => {
            setShowDeleteConfirm(false)
            handleAction(props.onDelete)
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Show>
    </div>
  )
}
