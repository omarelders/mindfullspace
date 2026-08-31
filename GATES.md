# Gates: Fix Audit Findings in Mindful Space

OWNS: GATES.md src/components/WorkspaceBoard.jsx src/hooks/useSyncEngine.jsx src/lib/cloudDb.js src/components/PictureCard.jsx src/hooks/useWorkspace.js src/utils/storage.js src/utils/imageValidation.js src/utils/pendingWorkspaceDeletes.js src/components/CalendarCard.jsx src/App.jsx vercel.json supabase-schema.sql src/hooks/useSyncEngine.test.jsx src/lib/cloudDb.test.js src/hooks/useWorkspace.test.jsx src/components/PictureCard.test.jsx src/utils/storage.test.js src/utils/imageValidation.test.js src/utils/pendingWorkspaceDeletes.test.js src/components/CalendarCard.test.jsx

Scope: Implement and verify fixes for all 8 severity-ranked findings in mindfullspace-master, ensuring data integrity, security, offline-first reliability, and clean test coverage.

- [x] G1: Dynamic auth resolution in Sync Engine (Finding 1)
  Resolve user dynamically via accessor getUser on every sync action, push, pull, and realtime event so late-loading auth or account switches do not capture stale null.
  EVIDENCE: `npm run test:run` passed. `useSyncEngine.test.jsx` covers reactive late auth and account-switch isolation, including cancellation of pending retries and empty-account initialization protection.

- [x] G2: Cloud read error differentiation & abort protection (Finding 2)
  Differentiate missing records from read errors in pullWorkspace and abort synchronization on error to prevent overwriting cloud workspaces.
  EVIDENCE: `npm run test:run` passed. `cloudDb.test.js` verifies pull errors throw, `migration.test.js` verifies no migration push follows a workspace-list read failure, and `useSyncEngine.test.jsx` verifies a failed reconciliation blocks pushes.

- [x] G3: Atomic version checking in direct DB fallback (Finding 3)
  Include expected version filter in fallback UPDATE query to prevent lost updates and TOCTOU races.
  EVIDENCE: `npm run test:run` passed. `cloudDb.test.js` verifies both the version-filtered update path and the “concurrent initial fallback insert wins the race” conflict path.

- [x] G4: Reference-aware image replacement (Finding 4)
  Check active and archived picture card references across the workspace before deleting replaced images.
  EVIDENCE: `npm run test:run` passed. `useWorkspace.test.jsx` verifies duplicate-card and cross-workspace references prevent local image deletion; cloud image deletion is intentionally conservative.

- [x] G5: Pre-mutation undo snapshots for card creation (Finding 5)
  Capture undo snapshot before mutating card collections in all handleAdd* actions so Ctrl+Z undoes card additions.
  EVIDENCE: `npm run test:run` passed. `useWorkspace.test.jsx` verifies pre-mutation snapshots allow Ctrl+Z to immediately undo new card additions.

- [x] G6: Deep schema validation & safe rendering (Finding 6)
  Deeply validate nested card structures in storage.js and safely handle calendar entries in CalendarCard.jsx.
  EVIDENCE: `npm run test:run` passed. `storage.test.js` and `useWorkspace.test.jsx` cover nested normalization, malformed labels/archives, and render-boundary safety.

- [x] G7: Robust cloud workspace deletion (Finding 7)
  Properly track, handle, and report cloud workspace deletion failures instead of fire-and-forget silent divergence.
  EVIDENCE: `npm run test:run` passed. `pendingWorkspaceDeletes.test.js` verifies exact user scoping and in-flight queue preservation; App retries on login and browser reconnect, while `deleteCloudWorkspace` propagates failures.

- [x] G8: Production security headers & upload hardening (Finding 8)
  Configure complete security headers in vercel.json (CSP, HSTS, X-Frame-Options, etc.) and harden image upload validation.
  EVIDENCE: Global security headers (CSP without inline scripts, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and document restrictions) configured in vercel.json. Shared MIME, size, and magic-byte validation is covered by `imageValidation.test.js`, `imageSync.test.js`, and `PictureCard.test.jsx`; Supabase storage policy excludes SVG.

- [x] G9: Full test suite, linting, and production build verification
  Run full vitest suite, eslint, and vite build to verify complete regression-free integration.
  EVIDENCE: `npm run test:run` (30 test files, 175 tests passed), `npm run lint` (0 errors), `npm run build` (165 modules transformed), `npm audit --omit=dev --audit-level=moderate` (0 vulnerabilities), and `git diff --check` all passed.
