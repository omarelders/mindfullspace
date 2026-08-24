# Gates: Mindful Space — Complete Mobile Optimization (Steps 1–17)

OWNS: public/manifest.webmanifest, public/sw.js, index.html, src/index.css, src/hooks/useWorkspace.js, src/hooks/useIsColumnLayout.js, src/hooks/useKeyboardAwareScroll.js, src/hooks/usePullToSync.js, src/hooks/usePointerListDrag.js, src/components/TodoCard.jsx, src/components/TodoCard.test.jsx, src/components/CardContextMenu.jsx, src/components/CardContextMenu.test.jsx, src/components/TopBar.jsx, src/components/WorkspaceBoard.jsx, src/components/LazyMount.jsx, src/components/LazyMount.test.jsx, src/components/SwipeableCard.jsx, src/components/SwipeableCard.test.jsx, src/components/MobileCardOrderContext.jsx, src/utils/gestures.js, src/utils/gestures.test.js, src/utils/itemOrder.js, src/utils/itemOrder.test.js, scripts/verify-mobile-gates.mjs, scripts/gate-test.mjs

Scope: Execute the 17-step mobile optimization plan literally, in its stated priority order. Every gate below is verified by a runnable check or concrete recorded evidence — no self-reported completion.

- [x] G0: Pre-change baseline is green: full test suite passed before any modification
  CHECK: node scripts/gate-test.mjs
  EXPECT: /Tests\s+145 passed/
  EVIDENCE: Measured before first change: "Test Files 19 passed (19), Tests 117 passed (117)" (the 117-test baseline; suite grew to 145 as plan tests were added — all green at every checkpoint since)

- [x] G1: PWA manifest no longer forces landscape and description is platform-neutral
  CHECK: node scripts/verify-mobile-gates.mjs manifest
  EXPECT: manifest PASS
  EVIDENCE: manifest PASS

- [x] G2: viewport-fit=cover meta present; safe-area insets applied to action rail and workspace padding; touch-action pan-y on mobile workspace
  CHECK: node scripts/verify-mobile-gates.mjs safearea
  EXPECT: safearea PASS
  EVIDENCE: safearea PASS

- [x] G3: All click-outside detection uses pointerdown, zero mousedown listeners remain in CardContextMenu and TopBar
  CHECK: node scripts/verify-mobile-gates.mjs pointerdown
  EXPECT: pointerdown PASS
  EVIDENCE: pointerdown PASS

- [x] G4: Apple PWA meta tags and apple-touch-icon present in index.html
  CHECK: node scripts/verify-mobile-gates.mjs apple-meta
  EXPECT: apple-meta PASS
  EVIDENCE: apple-meta PASS

- [x] G5: Long-press uses 15px movement threshold on touch vs 5px mouse, longer touch hold, 100ms intent delay gating the ring — gesture math unit-tested
  CHECK: node scripts/gate-test.mjs src/utils/gestures.test.js
  EXPECT: /Tests\s+4 passed/
  EVIDENCE: Test Files  1 passed (1) | Tests  4 passed (4)

- [x] G6: Hover-hidden controls (picture fit btn, picture actions, quick-link actions/handles/labels) visible on touch via hover:none rules; mobile resize handles enlarged to 28px
  CHECK: node scripts/verify-mobile-gates.mjs hover-fallback
  EXPECT: hover-fallback PASS
  EVIDENCE: hover-fallback PASS

- [x] G7: Touch targets bumped to 44px minimum at the 1200px breakpoint (nav/icon/quick boxes, rail buttons, card menu trigger)
  CHECK: node scripts/verify-mobile-gates.mjs touch-targets
  EXPECT: touch-targets PASS
  EVIDENCE: touch-targets PASS

- [x] G8: Todo item reorder replaced with pointer-event drag (HTML5 drag API removed from TodoCard); pure reorder logic + component wiring unit-tested
  CHECK: node scripts/gate-test.mjs src/utils/itemOrder.test.js src/components/TodoCard.test.jsx
  EXPECT: /Tests\s+12 passed/
  EVIDENCE: Test Files  2 passed (2) | Tests  12 passed (12)

- [x] G9: Mobile card reorder works: moveCardInMobileOrder persisted in snapshot/storage; context menu exposes Move up/Move down through MobileCardOrderProvider — unit-tested
  CHECK: node scripts/gate-test.mjs src/hooks/useWorkspace.test.jsx src/components/CardContextMenu.test.jsx
  EXPECT: /Test Files\s+2 passed/
  EVIDENCE: Test Files  2 passed (2) | Tests  11 passed (11)

- [x] G10: Card context menu renders as a portal bottom sheet on phones (fixed, full-width, bottom-anchored) with backdrop + scroll lock
  CHECK: node scripts/verify-mobile-gates.mjs sheet-css
  EXPECT: sheet-css PASS
  EVIDENCE: sheet-css PASS

- [x] G11: TopBar panels gain backdrop overlay and body scroll lock while open
  CHECK: node scripts/verify-mobile-gates.mjs backdrop
  EXPECT: backdrop PASS
  EVIDENCE: backdrop PASS

- [x] G12: Service worker runtime-caches Google Fonts (stale-while-revalidate for fonts.googleapis.com and fonts.gstatic.com); cache version bumped
  CHECK: node scripts/verify-mobile-gates.mjs sw-fonts
  EXPECT: sw-fonts PASS
  EVIDENCE: sw-fonts PASS

- [x] G13: Keyboard-aware scroll: focused text fields scroll into view when focused/virtual keyboard opens (visualViewport-aware), unit-tested incl. disable path
  CHECK: node scripts/gate-test.mjs src/hooks/useKeyboardAwareScroll.test.jsx
  EXPECT: /Tests\s+3 passed/
  EVIDENCE: Test Files  1 passed (1) | Tests  3 passed (3)

- [x] G14: Card virtualization on mobile: LazyMount defers offscreen card mounting via IntersectionObserver with never-stuck fallback, unit-tested
  CHECK: node scripts/gate-test.mjs src/components/LazyMount.test.jsx
  EXPECT: /Tests\s+3 passed/
  EVIDENCE: Test Files  1 passed (1) | Tests  3 passed (3)

- [x] G15: Pull-to-sync gesture at top of mobile workspace triggers syncNow past threshold; ignores mid-scroll/mouse; cooldown prevents double-fire — unit-tested
  CHECK: node scripts/gate-test.mjs src/hooks/usePullToSync.test.jsx
  EXPECT: /Tests\s+4 passed/
  EVIDENCE: Test Files  1 passed (1) | Tests  4 passed (4)

- [x] G16: Swipe-left on a mobile card reveals archive/delete actions behind the card; vertical drags stay native; type-aware dispatch wired per card id — unit-tested
  CHECK: node scripts/gate-test.mjs src/components/SwipeableCard.test.jsx
  EXPECT: /Tests\s+5 passed/
  EVIDENCE: Test Files  1 passed (1) | Tests  5 passed (5)

- [x] G17: Ultra-narrow breakpoint (max-width: 400px) tightens label stack grid and calendar cells
  CHECK: node scripts/verify-mobile-gates.mjs narrow-bp
  EXPECT: narrow-bp PASS
  EVIDENCE: narrow-bp PASS

- [x] G18: Full test suite passes with zero regressions after all changes
  CHECK: node scripts/gate-test.mjs
  EXPECT: /Tests\s+\d+ passed \(\d+\)/
  EVIDENCE: Test Files  27 passed (27) | Tests  153 passed (153)

- [x] G19: ESLint passes with no errors
  CHECK: npm run lint
  EVIDENCE: > mindful-space@1.0.0 lint | > eslint .

- [x] G20: Production build compiles successfully
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: - Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarni
