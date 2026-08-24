#!/usr/bin/env node
// Runnable acceptance checks for the mobile optimization gates (GATES.md).
// Usage: node scripts/verify-mobile-gates.mjs <check-id>
// Prints "<ID> PASS" and exits 0 when the assertion holds, else details + exit 1.
import { readFileSync } from 'node:fs'

const id = process.argv[2]
const read = (p) => readFileSync(p, 'utf8')

const checks = {
  // G1 — PWA manifest orientation + platform-neutral description
  manifest() {
    const m = JSON.parse(read('public/manifest.webmanifest'))
    if (m.orientation !== 'any') throw new Error(`orientation=${m.orientation}`)
    if (m.description !== 'Mindful productivity workspace.') throw new Error(`description="${m.description}"`)
  },

  // G2 — viewport-fit=cover + safe-area insets + touch-action pan-y
  safearea() {
    const html = read('index.html')
    const css = read('src/index.css')
    if (!html.includes('viewport-fit=cover')) throw new Error('missing viewport-fit=cover')
    if (!css.includes('env(safe-area-inset-bottom')) throw new Error('missing safe-area-inset-bottom')
    if (!css.includes('touch-action: pan-y')) throw new Error('missing touch-action pan-y')
  },

  // G3 — click-outside detection uses pointerdown everywhere
  pointerdown() {
    const files = ['src/components/CardContextMenu.jsx', 'src/components/TopBar.jsx']
    for (const f of files) {
      const src = read(f)
      if (src.includes("addEventListener('mousedown'")) throw new Error(`${f} still binds mousedown`)
      if (!src.includes("addEventListener('pointerdown'")) throw new Error(`${f} missing pointerdown binding`)
    }
  },

  // G4 — Apple PWA meta tags + apple-touch-icon
  'apple-meta'() {
    const html = read('index.html')
    for (const needle of [
      'apple-mobile-web-app-capable',
      'apple-mobile-web-app-status-bar-style',
      'apple-touch-icon',
      'mobile-web-app-capable',
    ]) {
      if (!html.includes(needle)) throw new Error(`index.html missing ${needle}`)
    }
  },

  // G6 — hover-hidden controls revealed on touch + larger resizers
  'hover-fallback'() {
    const css = read('src/index.css')
    if (!css.includes('@media (hover: none)')) throw new Error('missing hover:none block')
    const hoverBlock = css.slice(css.indexOf('@media (hover: none)'))
    for (const cls of ['.picture-fit-btn', '.picture-actions', '.ql-item-actions', '.ql-drag-handle']) {
      if (!hoverBlock.includes(cls)) throw new Error(`hover:none block missing ${cls}`)
    }
    const mobileLayer = css.slice(css.indexOf('MOBILE / TOUCH LAYER'))
    const resizeBlock = mobileLayer.slice(mobileLayer.indexOf('.picture-resizer,'))
    if (!resizeBlock.includes('.note-resizer')) throw new Error('resizer enlargement missing note-resizer')
    if (!/\b28px/.test(resizeBlock)) throw new Error('resizer not enlarged to >=28px')
  },

  // G7 — 44px minimum touch targets at the column-layout breakpoint
  'touch-targets'() {
    const css = read('src/index.css')
    const start = css.indexOf('@media (max-width: 1200px)', css.indexOf('MOBILE / TOUCH LAYER'))
    const block = css.slice(start)
    for (const rule of ['.nav-box,', '.rail-button', '.card-menu']) {
      if (!block.includes(rule)) throw new Error(`1200px layer missing ${rule}`)
    }
    if (!block.includes('width: 44px')) throw new Error('44px width missing')
    if (!block.includes('min-height: 44px')) throw new Error('44px min-height missing')
  },

  // G10 — context menu bottom sheet + backdrop on phones
  'sheet-css'() {
    const css = read('src/index.css')
    if (!css.includes('.card-menu-backdrop')) throw new Error('missing .card-menu-backdrop')
    const bp = css.indexOf('@media (max-width: 700px)', css.indexOf('MOBILE / TOUCH LAYER'))
    const block = css.slice(bp)
    const panelAt = block.indexOf('.card-menu-panel')
    const panel = block.slice(panelAt, panelAt + 900)
    for (const needle of ['position: fixed', 'bottom: 0', 'width: 100%', 'border-radius: 16px 16px 0 0']) {
      if (!panel.includes(needle)) throw new Error(`sheet panel missing ${needle}`)
    }
  },

  // G11 — TopBar panels get backdrop + body scroll lock
  backdrop() {
    const topbar = read('src/components/TopBar.jsx')
    if (!topbar.includes('panel-backdrop')) throw new Error('TopBar missing panel-backdrop')
    if (!topbar.includes("document.body.style.overflow = 'hidden'")) throw new Error('TopBar missing scroll lock')
    const css = read('src/index.css')
    if (!css.includes('.panel-backdrop')) throw new Error('CSS missing .panel-backdrop')
  },

  // G12 — service worker caches Google Fonts offline
  'sw-fonts'() {
    const sw = read('public/sw.js')
    if (!sw.includes('fonts.googleapis.com')) throw new Error('sw.js missing fonts.googleapis.com route')
    if (!sw.includes('fonts.gstatic.com')) throw new Error('sw.js missing fonts.gstatic.com route')
    if (/CACHE_VERSION = 'v2'/.test(sw)) throw new Error('cache version not bumped')
  },

  // G17 — ultra-narrow breakpoint tightens grids
  'narrow-bp'() {
    const css = read('src/index.css')
    const bp = css.indexOf('@media (max-width: 400px)')
    if (bp < 0) throw new Error('no 400px breakpoint')
    const block = css.slice(bp)
    for (const rule of ['.label-stack', '.calendar-day']) {
      if (!block.includes(rule)) throw new Error(`400px block missing ${rule}`)
    }
    if (!block.includes('repeat(2, 1fr)')) throw new Error('label stack not reduced to 2 columns')
  },
}

if (!checks[id]) {
  console.error(`unknown check id: ${id} (known: ${Object.keys(checks).join(', ')})`)
  process.exit(2)
}

try {
  checks[id]()
  console.log(`${id} PASS`)
  process.exit(0)
} catch (error) {
  console.error(`${id} FAIL: ${error.message}`)
  process.exit(1)
}
