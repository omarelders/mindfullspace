# MindfulSpace Sync Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining correctness, data-isolation, deletion-retry, validation, upload, and security-header gaps found in the MindfulSpace audit.

**Architecture:** Keep the existing local-first SolidJS architecture, but make cloud reads fail closed, bind asynchronous sync work to the authenticated account generation, and scope durable retry metadata by user. Validate workspace/import/image data at storage and upload boundaries, while retaining cloud optimistic locking and avoiding deletion of image blobs that may still be referenced outside the current local board.

**Tech Stack:** SolidJS, Supabase JS/Postgres, IndexedDB, Vitest, Vite, Vercel headers.

**Spec:** Review findings recorded in the prior assistant audit of `mindfullspace-master`.

## Global Constraints

- Preserve local-first behavior when cloud operations fail.
- Never treat a cloud read failure as an empty cloud state.
- Never allow an asynchronous operation started for one authenticated user to mutate or write as another user.
- Keep image uploads limited to JPEG, PNG, GIF, and WebP, with size validation at every client boundary.
- Keep all existing tests passing and add regression coverage for each corrected behavior.

---

### Task 1: Add regression tests for fail-closed cloud reads and sync lifecycle

**Files:**
- Modify: `src/lib/cloudDb.test.js`
- Modify: `src/hooks/useSyncEngine.test.jsx`
- Modify: `src/lib/migration.test.js`

**Interfaces:**
- `fetchCloudWorkspaces` rejects query failures.
- `handleFirstSignIn` rejects when the workspace-list read fails and does not push local state.
- `createSyncEngine` does not push after reconciliation fails, including when a caller notifies it during the failed reconciliation.
- A user switch cancels a prior user’s pending push.

- [x] **Step 1: Write failing tests**

Add tests that reject `fetchCloudWorkspaces` errors, verify migration performs no push after that rejection, and exercise a rejected reconciliation followed by `notifyChange()` and the debounce interval. Add an auth-switch test with a pending retry/debounce for user A followed by user B.

- [x] **Step 2: Run the targeted tests and verify they fail for the current implementation**

Run: `npm run test:run`

Expected: the new tests fail because list reads currently return `[]`, reconciliation errors release the push gate, and account changes do not cancel pending work.

### Task 2: Implement fail-closed synchronization and account isolation

**Files:**
- Modify: `src/lib/cloudDb.js`
- Modify: `src/lib/migration.js`
- Modify: `src/hooks/useSyncEngine.jsx`
- Modify: `src/components/WorkspaceBoard.jsx`

**Interfaces:**
- Cloud list helpers reject errors instead of returning empty data.
- Sync engine tracks a user generation and rejects stale async continuations.
- Sync engine keeps reconciliation failure closed until an explicit retry/reconciliation succeeds.

- [x] **Step 1: Make cloud workspace-list reads reject errors**

Change `fetchCloudWorkspaces` to throw its query error. Change `syncWorkspaceList` to throw its upsert error; callers already await it and migration’s existing catch leaves the completion marker unset.

- [x] **Step 2: Add a reconciliation failure gate**

Track whether the current reconciliation failed. On a failed read, keep local state intact and prevent `performPush()` from writing until a later explicit/online reconciliation succeeds. Clear the failure only after a successful pull or a confirmed empty-row initialization.

- [x] **Step 3: Isolate user-bound asynchronous work**

On user ID changes, clear debounce/retry timers, reset user-bound snapshots/version/pending state, increment a generation token, and have reconciliation/push continuations verify that token and user ID before applying results.

- [x] **Step 4: Make the late-auth test reactive**

Pass only the live user accessor required by the sync engine, and update the test harness to use a Solid signal so the auth effect is proven to react without a manual `notifyChange()`.

- [x] **Step 5: Run the targeted tests and verify they pass**

Run: `npm run test:run`

Expected: all targeted tests pass and no local snapshot is pushed after a failed cloud read.

### Task 3: Add scoped, reconnect-safe workspace deletion retries

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/lib/cloudDb.test.js`
- Add or modify: `src/utils/pendingWorkspaceDeletes.test.js`

**Interfaces:**
- Pending delete records have `{ userId, workspaceId }` shape.
- Retry runs on login and `online`, is idempotent, and cannot overwrite a newer queue update.

- [x] **Step 1: Write failing queue tests**

Test that a failed deletion is queued with its user ID, a different user does not replay it, and a concurrent queue addition survives a completed flush. The App integration registers the reconnect listener.

- [x] **Step 2: Run the tests and verify the current implementation fails**

Run: `npm run test:run`

Expected: the current string-ID queue and login-only retry behavior fail these tests.

- [x] **Step 3: Implement a user-scoped queue helper**

Normalize legacy string entries only when the current user is known, persist structured records, filter retries by exact user ID, and use a flush token/merge-on-write so an in-flight flush cannot erase newly queued deletions.

- [x] **Step 4: Register the online retry listener and verify tests pass**

Run: `npm run test:run`

Expected: deletion failures remain durable, retries happen after reconnection, and cross-account replay is impossible.

### Task 4: Harden image lifecycle and upload/import validation

**Files:**
- Modify: `src/hooks/useWorkspace.js`
- Modify: `src/lib/imageSync.js`
- Modify: `src/utils/imageStore.js`
- Modify: `src/utils/backup.js`
- Modify: `src/components/PictureCard.jsx`
- Modify: `src/components/PictureCard.test.jsx`
- Modify: `src/hooks/useWorkspace.test.jsx`
- Modify: `supabase-schema.sql`

**Interfaces:**
- Image MIME validation is shared and only accepts JPEG, PNG, GIF, and WebP.
- Backup/import restoration rejects unsupported image MIME types and oversized blobs.
- Cloud deletion is conservative and does not delete a blob unless the application can prove it is unreferenced for that user.

- [x] **Step 1: Write failing tests**

Add tests for spoofed SVG content/type, SVG in backup data, oversized imported images, and image replacement while another workspace/device reference cannot be proven absent. Add cloud upload tests that reject unsupported MIME types.

- [x] **Step 2: Run targeted tests and verify the current implementation fails**

Run: `npm run test:run`

Expected: current client-only checks and unconditional cloud deletion fail the new cases.

- [x] **Step 3: Implement shared image validation and safe import handling**

Use a shared MIME allowlist, enforce size and MIME checks in `saveImage`, `uploadImageToCloud`, backup decoding, and PictureCard handling. Reject SVG regardless of filename and do not accept arbitrary base64 content types.

- [x] **Step 4: Make deletion conservative**

Keep local cleanup reference-aware, but do not delete cloud image objects from a single workspace mutation unless a user-wide reference index is available. Leave cleanup to an explicit safe garbage-collection path or retain the cloud object.

- [x] **Step 5: Run targeted tests and verify they pass**

Run: `npm run test:run`

Expected: invalid uploads/imports are rejected and valid shared images remain available.

### Task 5: Complete malformed workspace-state validation and security headers

**Files:**
- Modify: `src/utils/storage.js`
- Modify: `src/utils/storage.test.js`
- Modify: `vercel.json`
- Modify: `GATES.md`

**Interfaces:**
- Every persisted collection contains only render-safe object records with safe nested structures.
- CSP does not permit inline scripts and includes modern document restrictions.
- Gate evidence names real tests and reports the current 175-test count.

- [x] **Step 1: Write failing malformed-state tests**

Add malformed `customLabels`, `archivedCards`, pictures, notes, stopwatches, and card-position fixtures, then assert validation returns safe arrays/records and the workspace factory can render them without throwing.

- [x] **Step 2: Run the tests and verify they fail**

Run: `npm run test:run`

Expected: null labels and unvalidated nested records expose the current crash/unsafe-shape behavior.

- [x] **Step 3: Implement complete normalization**

Filter invalid records, normalize IDs/text/booleans/numbers/colors for every card collection, validate archived card envelopes and nested data, and constrain positions/drafts to render-safe values.

- [x] **Step 4: Harden CSP and document headers**

Remove unnecessary `script-src 'unsafe-inline'`, add `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, and `form-action 'self'`, while retaining the app’s required style/font/image/connect sources.

- [x] **Step 5: Run targeted tests and verify they pass**

Run: `npm run test:run`

Expected: malformed data is normalized safely and all tests pass.

### Task 6: Full verification and audit evidence update

**Files:**
- Modify: `GATES.md`

- [x] **Step 1: Run the complete test suite**

Run: `npm run test:run`

Expected: 30 test files pass with the current test count or higher and zero failures.

- [x] **Step 2: Run lint, build, dependency audit, and diff checks**

Run: `npm run lint`; `npm run build`; `npm audit --omit=dev --audit-level=moderate`; `git diff --check`

Expected: every command exits successfully.

- [x] **Step 3: Review the final diff and update evidence**

Confirm every gate cites an existing test name or an actually executed command, document that deployed Supabase/Vercel integration still requires environment-level verification, and report the final counts from fresh command output.
