# Standalone release contract and implementation

Updated 16 October 2026. This is the working S1 contract and S2 implementation record; it is not a release approval. See the [roadmap](roadmap.md) and [audit](codebase-review-2026-10-15.md).

## Scope

Ship a local browser design application: Projects/Drafts, Design/Tokens/Icons, components, local published libraries, appearance, existing Reports/history/archive, bounded import/export, recovery and complete backup/restore. Repository feature expansion, terminal expansion, AI, collaboration and full Figma interoperability remain paused/outside this release. Keep shared code compatible and retain existing regression coverage.

Working distribution is the npm-launched local server. No hosted service, PWA or desktop wrapper is promised. Desktop browser editing is the initial target; cross-browser and operating-system support claims must be established by release tests. The package and contributor guidance now require Node 22+, recommend Node 24 LTS, and configure CI for Node 22/24. This is a release target, not evidence that those new CI jobs have run. [Node's release table](https://nodejs.org/en/about/previous-releases) identifies 22/24 as supported LTS lines and 18/20 as EOL at this update.

## Required release journeys

1. Create a project and Draft; rename, move and reopen files without changing identity/history/links.
2. Create Light/Dark token aliases and an icon library; publish and link them in a Design file.
3. Build a nested auto-layout component with variants, text/icon properties and instances; verify token modes, content sizing and overrides.
4. Publish/accept an update without losing consumer overrides; undo/redo and reopen preserve authored intent.
5. Archive/restore and restore a historical version with recoverable replaced work.
6. Import supported files safely; malformed/oversized input leaves no partial file and produces an actionable error.
7. Survive storage failures and competing-tab saves without silently discarding or overwriting edits.
8. Back up a complete project and restore it in a clean profile with required dependencies; history retention policy must be specified.
9. Fresh package installation/upgrade and supported browser/appearance/keyboard paths complete without uncaught errors.

Fixtures should include Sigma controls, Optics, a small user-authored page, deep nested layouts, long/wrapping text, mixed modes, linked libraries, malformed imports and large artwork. Measure supported complexity before advertising performance limits.

## First implementation increment

- Added structural inspection for browser JSON and clipboard imports, with nesting/object/layer limits, numeric geometry checks, identifier/font checks, embedded-image-only policy and sanitization of nested library icon artwork.
- Ordinary JSON file imports are capped at 64 MiB before reading. Figma retains its separate input/expanded-transfer budgets. These are ingestion bounds, not guaranteed editing capacity.
- Escaped paint, effect, identifier and scalar attributes in SVG rendering, including the demonstrated event-attribute injection. Legacy malformed scalar geometry is converted to a safe numeric rendering fallback.
- Banners/storage error text use text nodes. The app entry point adds CSP defense in depth against inline scripts/events, objects and unapproved resource origins. This does not replace validation or establish a complete security audit.
- At this first increment CSP retained `unsafe-eval` for arithmetic and Figma schema compilation. The fourth increment below supersedes that editor-page allowance.
- Content writes increment a browser metadata revision; view-only saves do not. Open-file autosaves compare the loaded revision atomically and refuse stale overwrites.
- Failed saves retain an error, show retry/download recovery, prevent ordinary file navigation from completing and request browser unload confirmation. Recovery stashes carry a base revision; stale recovered edits open separately from the saved content and cannot silently overwrite it.
- Browser CI runner now treats uncaught page errors as failures.

## Still open

This work does not close all of S1/S2. Comprehensive ingestion/schema coverage, remaining mutation paths, corruption/quota testing, migration recovery and broader resource/performance controls remain. Recovery checkpoints are not independent backups and large stashes can fail. Conflicting edits can be copied/downloaded; there is no visual merge flow yet. Clean install/support matrix, architecture experiments and React/canvas decisions remain upcoming work.

## Second increment — project portability and mutation safety

- Home sidebar now offers **Backup and restore** for a selected browser project or Drafts. Repository-owned projects use their existing repository backup workflow instead.
- A readonly IndexedDB transaction captures owned active/archived files, full saved history and transitive linked sources (including historical dependencies). Missing stored documents/history cause backup to fail rather than silently omit content. Missing linked source files are reported; embedded accepted snapshots remain present. Thumbnails are deliberately omitted from the restore contract and can be regenerated.
- Portable format `sigma-project-backup`, version 1, stores document strings with the existing shared-artwork encoding. Input/output is capped at 256 MiB. Limits are ingestion safeguards, not performance guarantees; very large histories/artwork can exceed the cap.
- Restore validates before writing, creates a new user project, preserves project description/icon, archive state, layer/token/component IDs, accepted publications, views and all saved versions. File/version IDs are new to avoid collisions; library links, branch source IDs and historical links are remapped. Unavailable sources get isolated placeholder identities so they cannot accidentally bind to unrelated existing files. Restored built-ins are ordinary editable files, with no automatic reset/repository attachment.
- Restore uses one write transaction across projects, files, docs and versions. Collisions abort all writes; repeated restores get unique project names. Original projects/files remain untouched.
- Renaming an open file first saves its edits and refuses stale content. Named-history operations stop after failed saves. History restoration checks revision and atomically saves the replaced document alongside the restored content; a concurrent change aborts both.
- Runtime document ingestion now rejects duplicate/empty page/layer IDs and unsupported layer types, and initializes omitted container children.

Validation: **106 Node tests and 291 browser tests passed**. Browser coverage includes independent/duplicate restore, archived files, linked/history dependencies, corrupt-history rejection, transaction rollback, rename/history conflicts and prior editor regressions. A real UI round trip downloaded a two-file backup and restored it through the picker into a second origin with fresh storage; the design's token color and named history were verified. Node backup tests cover malformed archives, identity remapping, unavailable sources and shared Figma artwork. No release/commit/push is implied.

## Validation of this increment

101 Node tests passed. 286 browser tests passed in the in-app browser, including the real Design-editor iframe, hostile SVG attributes, rejected imports, stale saves, storage failure/retry and stale recovery. The shell browser runner could not launch Chromium under the current sandbox, so browser validation used the in-app browser; this is not a fresh headless CI result. `git diff --check` passed. No commit/push or release has been performed.

## Third increment — visible status and session-isolated recovery

- All three file headers show pending/saving/saved-in-browser/error state, with separate temporary-example and historical-preview labels. Saving viewport changes alone does not falsely mark document content as unsaved. Header menus expose Save now and file-specific recovery.
- Checkpoints are keyed by both file and tab. Shared Figma artwork retains its compact encoding. Failed saves checkpoint immediately, not just on unload; quota/blocked recovery storage requests download and unload protection. Successful saves clear only that tab's checkpoint when no newer work is pending.
- File reads no longer apply or delete recovery content. This supersedes the first increment's automatic recovery-on-open behavior: even a matching revision should not silently choose among multiple editing sessions.
- Home exposes an unsaved-recovery count and global recovery list. Legacy single-slot and unreadable records remain reviewable. Valid recovery opens as an independent Draft; invalid records can be downloaded raw for manual salvage. When the current file cannot save, a persisted recovered copy can open in a new tab while the original edits remain open.
- Explicit discard compares the exact reviewed raw record and refuses deletion if another tab changed it. Reading/copying recovery never discards another session's work.
- Shared dialogs now have accessible names, dialog semantics, initial focus, Tab wrapping and focus restoration, including programmatic close paths.
- Import inspection reuses the semantic validator for typed token values and extension overrides, rejecting string payloads masquerading as numeric geometry. Numeric layout fields are checked too.
- New status/recovery composites remain explicit entries in the source-parity backlog; primitive token coverage does not imply their full Design-file representation. Stylesheet-derived source data was regenerated.

Validation: **111 Node tests and 296 browser tests passed**. Browser tests cover all three real file headers (including pending/saved/error), no recovery for viewport-only saves, independent recovery copies, legacy entries, stale discard protection and dialog focus. An actual recovery-dialog interaction opened a recovered Icons file as a saved Draft. `git diff --check` passed. This increment does not introduce React, replace the canvas, resume repository feature work, or claim standalone release readiness.

## Fourth increment — strict editor policy and supported runtime targets

- Replaced numeric-input `Function()` evaluation with a bounded arithmetic parser: precedence, parentheses, unary signs, exponentiation, decimal commas and existing px/%/degree suffixes; malformed, nonfinite and excessive inputs fail without executing JavaScript. Unit suffixes remain scalar labels, not unit conversion.
- Removed `unsafe-eval` from the editor document's CSP. The actual editor iframe verifies that dynamic JavaScript compilation throws while arithmetic property edits still work.
- The dedicated Figma worker alone receives a separate CSP allowing the pinned decoder's schema compilation. Its network connections and nested workers are denied. The policy follows the resolved worker file, including encoded URLs, and static responses use `nosniff`. This requires the supplied local server; alternate hosting must preserve the worker policy.
- Verified binary Figma decode using a worker constructed from the strict editor iframe. The page remains free of evaluation permission; this is containment, not a claim that the third-party compiler no longer generates code. [Worker policy semantics](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#content_security_policy).
- Corrected embedded-image validation to accept the UTF-8 SVG data URIs produced by Sigma's Figma converter; backup/restore now has a regression for that exact representation.
- Reconciled package/lockfile, setup docs and CI around supported Node 22/24 release targets, removing obsolete dependency-free server claims. No package has been published, and no fresh remote CI result is implied.

Validation: **115 Node tests passed on Node 24.19.0**, including the final server-header changes. **297 browser tests passed** in the in-app browser, including strict editor CSP, arithmetic edits and worker-based Figma decoding. `git diff --check` passed. Node 22, the remote CI matrix and cross-browser/platform release checks remain unverified. Full import review and the rest of the roadmap remain open; this is not a release-readiness claim.

## Fifth increment — retryable database connections and upgrade preservation

- Extracted the IndexedDB connection/schema boundary. A failed open now clears only its own cached attempt, so a later explicit operation can retry instead of remaining permanently attached to a rejected promise. Unexpected connection closure also permits reconnection; blocked upgrades retain the existing close-other-tabs guidance.
- Additive upgrades ensure both required indexes exist, including an existing versions store lacking its `fileId` index. Upgrade errors abort instead of deleting or recreating user storage.
- Isolated real-browser databases verify upgrades from versions 1 and 2 preserve file ownership/archive metadata, current documents and named history. An intentionally aborted upgrade preserves the old schema/content and succeeds on retry. These tests use unique temporary databases, not the user's Sigma database.
- Validation: **117 Node tests passed on Node 24; 300 browser tests passed** in the in-app browser. The final upgrade-handler change also passed the targeted Node connection tests. `git diff --check` passed. Physical disk corruption, actual browser quota exhaustion, clean packaged installation and the support matrix remain open; these tests do not establish those broader guarantees.

## Sixth increment — installed standalone package check

- Added `npm run test:package`. It packs the checkout and performs a real npm install into an independent temporary consumer, with optional dependencies omitted and install scripts enabled. It checks the CLI help/start path, required licenses/bundles, relative editor module dependencies, Optics tokens and static assets, the decoder worker policy, and the standalone repository-API boundary. It asserts the native PTY package is absent and removes the temporary install afterward. This is a Node/server package check, not a browser interaction test.
- Fixed the package allowlist to include its README-linked documentation and contributing guide, which were missing from installed distributions.
- Added Linux/macOS × Node 22/24 package jobs to CI. Those jobs are configured, not remotely verified or published.
- Validation: the installed tarball passed on **Node 24.19.0, macOS arm64** with registry-fetched dependencies, and then passed again using the populated cache offline. The final archive contained 188 files (about 1.35 MB compressed), including the documentation referenced by its README. `git diff --check` passed. The offline second run proves cached installation, not an offline editor support claim. Browser storage continuity across actual release upgrades, package installation on the other targets, license inventory review and user-facing publication remain open.

## Seventh increment — unreadable files and partial-write rollback

- Saved file reads now distinguish absent metadata from missing/unreadable document data. A conservative legacy-compatible structure check runs before switching the editor's active document; it does not claim full stored-document/schema validation.
- The actual app offers a saved-file recovery dialog when that read fails. Home and Archive file menus also expose it. Readable versions copy into independent Drafts without replacing current data/history, and unsaved recovery remains separately accessible. Invalid/missing versions fail explicitly before creating a copy. A failed save in the currently open file retains that session and offers a new-tab link to the saved copy.
- Fixed a transaction hole: if a later synchronous write threw after an earlier request was queued, the promise rejected but the transaction could still commit. The common transaction wrapper now aborts. A quota-error injection on the metadata write verifies both metadata and the queued document roll back, then retry succeeds.
- Validation: **118 Node tests and 304 browser tests passed**. Browser coverage includes missing current data, malformed ordinary/compact Figma records, unchanged historical sources, invalid recovery candidates, transaction rollback, and the real app opening a historical copy from the recovery dialog. The installed-package check passed again on Node 24/macOS with optional dependencies omitted. `git diff --check` passed.
- Limits: the quota test injects a synchronous `QuotaExceededError`; it does not exhaust the disk or prove physical-corruption repair. Recovery depends on readable versions/checkpoints/backups. It cannot reconstruct missing content, and the new composite remains in the source-parity backlog.

## Eighth increment — first architecture experiments

- S3 is now in progress. The private `experiments/standalone-architecture` package pins React/React DOM, TypeScript, Vite, Yoga and browser test tooling separately from Sigma's runtime. Package smoke now asserts experiments do not ship.
- React's cached immutable snapshot adapter delegates edits, normalization, undo/redo and serialization to the real Sigma modules. A separate legacy DOM subscriber demonstrates a single canonical store. The inspector mounts/unmounts independently. The legacy JS cast is an explicit unchecked boundary, not a completed typed model.
- An in-app browser interaction verified arithmetic width edits, Hug geometry, existing undo/redo, unmount/remount, serialize/reopen, dark appearance and invalid-expression rejection. Build/typecheck and four Yoga-versus-current-layout rectangle comparisons passed on Node 24/macOS. Both Yoga mappings matched the four cases; text/nesting/component semantics and performance remain unproven.
- Added reproducible browser checks and a prototype CI job. Local Playwright could not run because its matching Chromium executable is absent; the configured remote job is not a result. Existing app entry points, runtime dependencies and renderer remain unchanged by this experiment.
- Root validation: **118 Node tests passed**, installed-package smoke passed with experiments excluded, and `git diff --check` passed. See `docs/standalone-architecture.md` and the experiment README for evidence, sizes, sources, limitations and remaining adoption gates. S4 and the full S3 exit gate remain incomplete.

## Ninth increment — controlled renderer probe

- Added a second, separately built architecture entry point comparing Sigma's actual SVG renderer/hit logic with Fabric 7.4.0 and Konva 10.9.0 native rectangle adapters. Dependencies remain pinned inside the private experiment and excluded from the installed Sigma package.
- Production-build checks in the in-app browser passed with 1,000 and 5,000 rectangles: expected hit identities, nonempty exports and unchanged shared source fixture. Raw results record browser, DPR, surface dimensions and 20 update/pick samples. An explicit out-of-timing SVG-cache reset prevents reused baseline objects from biasing repeat setups. Initial development measurements were replaced with the final production-build, cache-controlled evidence.
- The repeatable prototype browser script now includes renderer correctness and cache-reset assertions. Local headless Chromium remains unavailable; no remote CI pass is claimed. Typecheck and the multi-entry Vite production build passed on Node 24/macOS. Installed-package smoke passed with experiments excluded; `git diff --check` passed.
- Measurements are synchronous call times, not interaction-to-paint latency or a speed ranking: SVG and canvas have different paint boundaries. The probe has no text/IME, nested transforms/clipping, icons, selection-editing, export-fidelity or memory proof. Keep production SVG; those adoption gates remain open. See the architecture decision record and experiment evidence for exact scope.
