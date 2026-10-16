# Sigma codebase and product review

Date: **15 October 2026**. Source baseline: commit `d99a3ca`, with the existing uncommitted README/source-parity documentation changes present. This is a point-in-time assessment, not a release certification or a record of fixes completed.

## Scope and evidence

The review inspected README, package/configuration files, CI, folder structure, entry points, routing, storage/models, schemas, tests, and the main editor/repository workflows. It made no file changes and did not install dependencies, change browser data, rerun the full test suite, or verify current CI results. Two in-memory probes checked SVG output construction and token readback comparison; neither wrote files. This document was added subsequently at the user's request.

“Working” below means an implemented path exists with supporting code/tests, not that every interaction was freshly exercised or is defect-free. Findings distinguish confirmed source behavior, probe results, and product assumptions. Recommendations are proposals, not implemented fixes. Current dependency vulnerability status was not audited.

## 1. What Sigma is

Sigma is a local design editor intended to live inside a software repository. Its proposed advantage is that designers and developers use the project's actual tokens, icons, and components, with Git supplying review and history.

There are two storage/workflow modes:

- **Standalone:** projects and documents live in browser storage.
- **Repository-connected:** a local Node server reads/writes `.sigma/` files and synchronizes supported changes with source files.

Evidence: [`src/project.js`](../src/project.js), [`src/files.js`](../src/files.js), [`bin/sigma-design.mjs`](../bin/sigma-design.mjs).

The inferred initial users are developers, design-system maintainers, and designers working closely with developers. Local servers, Git, configuration, manifests, adapters, and coding-agent skills are central. A nontechnical designer expecting accounts and instantly shareable team workspaces is less well served today. This audience assumption needs pilot validation.

### Architecture

| Area | Current implementation |
| --- | --- |
| Frontend | Vanilla JavaScript ES modules, HTML/CSS, SVG, imperative DOM updates; no frontend application framework. |
| State | Shared mutable document/editor state, normalizers, edit hooks, subscriptions, snapshot undo. |
| Rendering | SVG scene/overlays; some text uses HTML in SVG `foreignObject`; browser measurement determines text bounds. |
| Layout | Custom horizontal/vertical auto-layout engine, Hug/Fill/Fixed, min/max, breakpoints, RTL. |
| Browser database | IndexedDB projects, files, documents, versions; local/session storage preferences and recovery. |
| Backend | Local Node HTTP server, filesystem/Git operations, WebSocket/PTY terminal. |
| Repository model | Separate project format, stable IDs, path dependencies, omitted derived values, schemas and semantic validator. |
| Authentication | No accounts. Terminal uses local-origin checks and ephemeral capability; project API uses localhost checks and an `X-Sigma` write header. |
| AI | No model calls or built-in Assistant; skills and stdio workflow MCP invoke CLI operations. |
| Dependencies | xterm, fit addon, `ws`, optional `node-pty`, vendored Figma parser dependency chain. |
| Deployment | Local CLI/npm distribution; CI exists. No production team backend or cloud deployment configuration found. |

Sources: [`src/main.js`](../src/main.js), [`src/store.js`](../src/store.js), [`src/db.js`](../src/db.js), [`tools/server.mjs`](../tools/server.mjs), [`tools/terminal.mjs`](../tools/terminal.mjs), [`package.json`](../package.json), [`docs/schema/README.md`](schema/README.md).

### Feature inventory

| Area | Assessment and boundary |
| --- | --- |
| Projects/Home | **Working:** projects, Drafts, Recents, search, descriptions, icons, grouped files. |
| File management | **Working for browser files:** creation, duplication, rename, download, archive, restore, deletion. Repository lifecycle differs. |
| Canvas/editor | **Working:** tools, selection, transforms, snapping, groups, frames, images, text. |
| Layout | **Working within custom model:** auto layout, sizing, constraints, breakpoints, RTL; broad reliability/performance still need validation. |
| Components | **Working:** mains, instances, overrides, variants, properties, swaps, icons, slots; these represent designs rather than execute code components. |
| Component docs/playground | **Working:** documentation and property-driven previews. |
| Tokens | **Working within supported formats/types:** groups, aliases, modes, extensions, typography, shadows, motion; other stacks need adapters. |
| Audit/contrast | **Working heuristics:** not comprehensive accessibility or design-quality certification. |
| Icons | **Working for supported SVG shapes:** sets/import, publishing, linking; artwork can be simplified. |
| Libraries | **Working:** accepted published snapshots and update review in browser files; repository files follow disk/Git semantics. |
| Persistence/history | **Working with gaps:** autosave, recovery, named versions, restore. See integrity findings below. |
| Comments | **Working locally/in files:** replies/resolution; self-entered authors, no verified identity/live team service. |
| Branches/merge | **Working for eligible browser Design files:** repository workflow uses Git/proposals. |
| Reports | **Working:** scope, metrics, filters, findings, navigation; reuse indicators, not source-parity proof. |
| Export | **Working within renderer limits:** SVG/PNG/JPEG/documentation; raster export can fall back to SVG. |
| Repository setup | **Working for CSS variables, DTCG, SVG:** unsupported stacks require adapters/agent assistance. |
| Token/icon live sync | **Working for supported mappings:** safety and verification weaknesses remain. |
| Code capture/library rebuild | **Partial but substantial:** requires prepared component page, bridge, manifest; not arbitrary repository understanding. |
| Design component → source | **Partial:** mapped CSS/selected code edits; unsupported work handed to agent/person. |
| Proposals/workflow | **Working tooling:** semantic changesets, merge driver, PR/ticket preparation; external publishing is agent/tool mediated. |
| Code inspection | **Working:** CSS, token references, component API, accessibility metadata. |
| HTML/CSS creation | **Partial:** editable draft, sandbox preview, export; general framework generation/repository Apply unfinished. |
| Figma import | **Partial:** real parser/conversion, detached instances, fidelity limits. |
| Terminal | **Working implementation for macOS/Linux:** real shell; Windows unavailable. |
| Sigma reference project | **Partial parity:** derived tokens/icons/tracked controls; composite coverage incomplete. |
| Documentation | **Partial/stale:** actual content exists, some navigation guidance superseded. |
| Built-in AI/open-document MCP | **Planned:** existing MCP is repository workflow tooling. |
| Live collaboration | **Planned:** no current Yjs/WebRTC implementation. |
| Accounts/roles/hosted sharing | **Deferred/planned:** no functioning service. |
| Native pen/vector/booleans/full Figma interchange | **Planned beyond bounded import.** |

Sources: [`src/commands.js`](../src/commands.js), [`src/components.js`](../src/components.js), [`src/component-ui.js`](../src/component-ui.js), [`src/variables.js`](../src/variables.js), [`src/libraries.js`](../src/libraries.js), [`src/branches.js`](../src/branches.js), [`src/use-report.js`](../src/use-report.js), [`docs/roadmap.md`](roadmap.md).

The core editor is not broadly stubbed/mocked. The main risk is overstating coverage of real but bounded implementations.

### Main user journeys

1. **Browser design system:** choose project/Drafts → create Tokens/Icons → edit/publish → create Design → link libraries → author components/variants → publish/instantiate → review later updates. Consumers retain accepted snapshots. Sources: `files.js`, `libraries.js`, `component-ui.js`, `variables-ui.js`.
2. **Repository work:** `init` → detect sources/configure adapters → `dev` → open `.sigma/` → edit/browser autosave → explicitly save repository file → default live sync may update source → poll disk and reload/conflict. Browser save, repository save, and source write are distinct. Sources: `bin/sigma-design.mjs:serve`, `project.js:saveToProject`, `live-sync.mjs:afterSave`.
3. **Code-derived components:** prepare real component page/bridge/manifest → capture DOM → convert to editable structures → compare layout → rebuild. Not universal automatic source conversion. Sources: `capture-from-code.js`, `capture-to-sigma.js`, `code-check.js`.
4. **Proposals:** compare against HEAD/disk → select semantic changes → save changeset and renders → CLI/agent prepares code/review. Editor does not complete external ticket/PR lifecycle itself. Source: `propose.js`.
5. **Figma/code creation:** worker import → bounded conversion/report; separately, normalize design → static HTML/CSS draft/preview/export. Instances expand and tokens become current-mode snapshots. Sources: `figma-import-file.js`, `code-create.js`.

### Strong implementation choices

- Repository serialization omits derived data and keeps stable identities, enabling useful semantic Git diffs.
- CLI/editor share pure logic.
- Library snapshots provide controlled updates.
- Capture, conversion, comparison, and semantic merges offer stronger differentiation than the canvas alone.
- Terminal includes capability checks, resource bounds, reconnection, and process cleanup.

Sources: `project-format.js`, `changesets.js`, `libraries.js`, `tools/terminal.mjs`, schema documentation.

## 2. Findings and gaps

### R1 — Critical: imported values can inject SVG attributes

**Evidence: confirmed source path and in-memory output probe; no end-to-end browser exploit performed.**

`files.js:importFiles()` accepts Design JSON without a comprehensive runtime validation/sanitization gate. `store.js:migrateDocument()` migrates structure rather than validates security. `render.js:paint()` interpolates color directly into an attribute, and `renderScene()` uses `innerHTML`.

A color containing a quote and event attribute produced:

```html
fill="red" onpointerenter="globalThis.__sigmaReview=1"
```

Script executing in the editor origin could reach its repository APIs and terminal connection endpoint. Local capability checks do not protect against script inside the trusted origin.

**Recommendation:** validate imported fields/nested libraries, constrain types/values, construct attributes safely, audit HTML sinks, add hostile-import tests and defense-in-depth CSP.

Sources: [`src/files.js`](../src/files.js), [`src/store.js`](../src/store.js), [`src/render.js`](../src/render.js), [`tools/terminal.mjs`](../tools/terminal.mjs).

### R2 — Critical: repository stale-write protection has a race

**Evidence: source control flow; not exercised against disk.**

PUT `/api/project/file` checks mtime before awaiting the body. Another edit can occur during that await and then be overwritten without a final check. Atomic rename prevents partial files, not lost updates. Missing `base` also bypasses checking; some capture writes omit it.

**Recommendation:** serialize by path, recheck before commit, require explicit preconditions/overwrite semantics, test overlapping requests and external edits.

Source: [`tools/server.mjs:api`](../tools/server.mjs), [`src/capture-from-code.js:putJSON`](../src/capture-from-code.js).

### R3 — High: token adapter verification can falsely succeed

**Evidence: source and in-memory merge probe.**

`writeThroughAdapter()` checks `mergeTokenCollections()` results for `added`/`changed`, ignoring `onlyInSigma`. Desired tokens with empty readback land in `onlyInSigma`; the failure gate stays false. This can skip rollback after incomplete writes. `checkAll()` uses a similar gate. Icon comparison also needs an explicit policy for extra Sigma entries.

**Recommendation:** define expected equality versus deliberately unmapped entries, fail on missing expected output, and return precise diagnostics. “Matches code” must state the scope actually verified.

Sources: [`tools/sigma.mjs:writeThroughAdapter/checkAll`](../tools/sigma.mjs), [`src/token-sync.js:mergeTokenCollections`](../src/token-sync.js), [`src/icon-sync.js`](../src/icon-sync.js).

### R4 — High: source apply is not a consistently reviewed transaction

Saving mapped `.sigma/` files can immediately write source. Minimal token edits and adapter snapshots help, but design save and code synchronization are separate. Failures can leave design saved and code out of sync; component writes span files without a complete transaction, include string replacement, and have no general build/render gate. `saveToProject()` logs validation errors but still writes.

**Recommendation:** explicit live/reviewed modes, diff, validation, conflict detection, recoverable multi-file apply, and structured success/failure outcomes.

Sources: [`src/project.js:saveToProject`](../src/project.js), [`tools/live-sync.mjs:afterSave/writeComponents`](../tools/live-sync.mjs), [`tools/sigma.mjs:componentsWrite`](../tools/sigma.mjs).

### R5 — High: concurrent browser tabs can overwrite edits

BroadcastChannel warns about saves, but `persistCurrent()` has no revision precondition. Full-document saves from two tabs can overwrite each other. Existence checks correctly prevent resurrection after deletion, but do not prevent concurrent edit loss.

**Recommendation:** revision checks, single-writer lease, or explicit conflict handling.

Sources: [`src/files.js:persistCurrent`](../src/files.js), [`src/main.js:onRemoteChange`](../src/main.js), [`src/db.js:updateFile`](../src/db.js).

### R6 — High: autosave failure does not prevent navigation

`persistCurrent()` catches storage failures, toasts, and resolves; `closeCurrentFile()` can proceed after `saveNow()`. There is no durable failure state protecting the open document. Recovery localStorage is bounded and can fail for large files. Browser data is origin-bound, including localhost port; versions in the same database are not an independent backup.

**Recommendation:** durable dirty/error state, retry/export recovery, navigation protection, complete project backup/restore.

Sources: [`src/files.js:persistCurrent/stashPending/closeCurrentFile`](../src/files.js), [`src/store.js:flushSave`](../src/store.js), [`src/db.js`](../src/db.js).

### R7 — High: capture/check results can be misleading or incomplete

- `putJSON()` does not check `response.ok`.
- Bridge readiness times out, but subsequent `ask()` requests have no individual timeout.
- `openCodeCheck()` continues after `saveToProject()`, which catches failures without returning a structured success result.
- Missing captures are mentioned, but zero returned differences can still lead to “Everything matches the code.”

**Recommendation:** propagate failures, time out each request, require successful saves, and separate complete parity from partial/unavailable coverage.

Sources: [`src/capture-from-code.js`](../src/capture-from-code.js), [`src/code-check.js`](../src/code-check.js).

### R8 — High: large-document performance is not established

Import's shared artwork/transfer strategy is useful, but editing still normalizes at commit/render, repeatedly syncs instances/resolves tokens/measures text, runs nested layout convergence, serializes cache keys, and snapshots whole documents. Undo keeps a minimum number of snapshots, so its nominal memory budget is not a strict ceiling. A 100 MB input does not establish sustainable editing performance. No measured complexity budget was established in this review.

**Recommendation:** benchmark representative node counts/depth/artwork, publish limits, then optimize measured hot paths and incremental invalidation.

Sources: [`src/lay-out.js`](../src/lay-out.js), [`src/layout.js`](../src/layout.js), [`src/store.js:commit`](../src/store.js), [`src/render.js:renderScene`](../src/render.js), [`src/text.js:measureText`](../src/text.js).

### R9 — High: Sigma reference project does not yet prove the complete product loop

The registry tracks 22 control families and explicitly lists outstanding composites (dialogs, picker, navigation, cards, Reports, Terminal, Code creation). No root repository config makes the built-in Sigma project follow the customer connected-repository workflow; built-in edits skip persistence. Extracted CSS literals represented as tokens do not establish that the app consumes shared token definitions.

**Recommendation:** complete one self-hosted repository loop, maintain source provenance, and verify component parity rather than equating token binding with source usage.

Sources: [`src/ui-component-registry.js`](../src/ui-component-registry.js), [`src/files.js`](../src/files.js), [`src/sigma-design-system.js`](../src/sigma-design-system.js), [`tools/design-system/build.mjs`](../tools/design-system/build.mjs).

### Other gaps

| Area | Evidence-based assessment |
| --- | --- |
| Accessibility | Some labels/keyboard handling/specialized focus management exist; shared `libraries.js:modal()` lacks dialog semantics, focus trap, initial focus and restoration. Design audits do not certify editor accessibility. |
| Validation | Strong repository validator, inconsistent ingestion/write enforcement. Plain JSON imports do not have `.fig` worker/budget treatment. |
| Permissions | No team roles or verified authors. Adapters are trusted executable project code, not sandboxed plugins. |
| Portability | Individual downloads exist; no complete browser-project export including metadata/history/relationships found. |
| Repository moves | `home.js:moveDraftDialog()` writes sequentially; partial failure retains Drafts but can leave earlier repository writes. |
| Reports | Reference/type presence is not alias/value/render/source parity. |
| Privacy | Google Fonts are external; imported image URLs reach the renderer, so absolute “nothing else leaves” wording is too strong for arbitrary input. |
| Diagnostics | Console/toast/local write logs; no persistent error ledger/support bundle/production monitoring found. |
| Structure | `panels.js` >2,000 lines; several core modules >1,000; mutable global state and imperative handlers raise coupling. |
| Type safety | No configured TypeScript/static checking gate or broad JSDoc contract. |
| Dependencies | Pinning exists, but no fresh vulnerability audit; vendored parser maintenance and native PTY support remain obligations. |

Sources: `src/libraries.js:modal`, `src/home.js:moveDraftDialog`, `src/use-report.js`, `src/render.js`, `docs/data-and-ai.md`, `tools/lib/adapters.mjs`, `package.json`.

### Testing and developer experience

Tests cover layout, components, tokens, imports, merging, adapters, server boundaries, terminal lifecycle, and parity. CI config runs Node 20/22, Chromium, example checks, CSS-example render parity, and macOS terminal tests. This is meaningful coverage, but current execution results were not checked in this review.

Gaps:

- Browser runner collects page errors but does not include them in final failure determination.
- Chromium CI only; no Firefox/Safari matrix.
- Render-parity CI targets one CSS example, not every supported stack.
- No lint/static-type gate; Playwright installed separately from locked development dependencies.
- README “no dependencies” conflicts with package runtime dependencies.
- Node requirements conflict: README/package 18, contributing guide 20.
- README/guide retain old sample/sidebar guidance; roadmap checklist names retired files.
- No release/publish workflow found; publication remains a checklist item.

Sources: [CI](../.github/workflows/ci.yml), [`tools/test/run-browser-tests.mjs`](../tools/test/run-browser-tests.mjs), [`tools/test/run-render-parity.mjs`](../tools/test/run-render-parity.mjs), [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`README.md`](../README.md), [`src/welcome-guide.js`](../src/welcome-guide.js), [`docs/roadmap.md`](roadmap.md).

**Launch assessment:** unsupervised reliance on untrusted imports or automatic source sync should wait for security/data-integrity fixes. A supervised local pilot is attainable earlier than a broadly marketed team service.

## 3. Prioritized recommendations

Effort estimates describe scope, not calendar commitments.

### Critical — before users rely on their work being safe

| Action | Purpose and location | Effort |
| --- | --- | --- |
| Fix imported-document injection | Validate/constrain imports; safe rendering; nested libraries and HTML sink audit. `files.js`, `render.js`, `icon-library.js`, `main.js`. | Medium |
| Conflict-safe saves | Per-path/final preconditions and browser revisions. `server.mjs`, `files.js`, `db.js`. | Medium |
| Correct readback verification | Fail missing expected output; distinguish intentional extras. `tools/sigma.mjs`, token/icon sync. | Small–medium |
| Protect failed saves | Durable dirty/error state, recovery/navigation guards. `files.js`, `store.js`, `main.js`. | Medium |
| Safe source apply | Live/reviewed choice, validation, recovery and transaction boundaries. `project.js`, `live-sync.mjs`, CLI writers. | Large |

### High impact

| Action | Purpose and location | Effort |
| --- | --- | --- |
| One complete repository loop | Prove central promise using root integration/adapters/capture/proposal/apply/parity. | Large |
| Trustworthy captures | HTTP checks, timeouts, missing coverage and save outcomes. Capture/check modules. | Small–medium |
| Correctness CI matrix | Concurrency, hostile imports, missing adapter output, failed storage, page-error failures. | Medium |
| Performance budgets | Benchmark and optimize normalization/layout/render/text based on evidence. | Large |
| Accessible shared modal | Improve common dialog semantics/focus and layer navigation. | Medium |
| Docs/package cleanup | Consistent claims/setup, clean packed installation. README/guide/roadmap/package/CI. | Small–medium |
| Complete backup/restore | Browser projects, metadata, history, dependency relationships. DB/file modules. | Medium |

### Nice to have

| Action | Purpose and location | Effort |
| --- | --- | --- |
| Gradual module extraction/types | Reduce coupling; start with model/persistence contracts, avoid wholesale rewrite. | Medium–large |
| Offline/self-hosted fonts | Privacy and reproducible rendering. `index.html`, fonts, exports. | Small–medium |
| Opt-in diagnostics export | Support without automatic document transmission. | Medium |
| Additional framework adapters | Expand only after first integration is proven. | Large |
| AI/collaboration | Add after core trust loop; significant new security/correctness surfaces. | Large |

## 4. Product assessment

### Problem and evidence

Design/code drift is a credible problem. Sigma's sync, manifests, capture, and parity architecture are a plausible response. Code does not establish willingness to adopt, acceptable setup effort, designer comfort with local tools, or retention. Assume the first customer is a small developer-led team with an existing design system, and validate that assumption.

### Value and alternatives

The strongest value proposition is: **change a real design-system decision visually, inspect implementation impact, and produce a safe, reviewable repository change.**

Relevant alternatives, checked through official sources during review:

- Figma Code Connect maps code components/APIs to design components and developer workflows: [official overview](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect?trk=article-ssr-frontend-pulse_little-text-block).
- Penpot provides [tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) and [components](https://help.penpot.app/user-guide/design-systems/components/); canvas plus tokens is not sufficient differentiation.
- Builder markets reuse of existing components in [design-to-code workflows](https://site.builder.io/m/design-to-code).
- A component showcase plus Git and a coding agent is an inferred practical alternative for developer-led teams, avoiding a second editable document but offering less freeform design.

These sources establish competing capabilities, not comparative quality, demand for Sigma, or a hands-on benchmark. Product capabilities may change after this review.

### Feasibility and costs

A local tool supporting a defined token format, SVGs, one framework/styling stack, mapped components, and reviewed repository changes is feasible. A general design-editor competitor plus universal bidirectional conversion, AI runtime, and collaboration is much harder to maintain simultaneously.

Hard problems: stable identity through refactors; browser-to-canvas layout translation; alias provenance; preserving handwritten code; concurrent human/Git/agent edits; large documents; collaborative undo/conflicts. Current local execution avoids built-in AI API charges and most service costs, but engineering, platform support, adapters, and users' existing agent costs remain. Future collaboration introduces service/relay costs not yet established by implementation.

Custom rendering/layout and reverse-engineered Figma parsing are substantial maintenance obligations. License positioning must be clear: Apache plus Commons Clause is not unrestricted open source; publication wording merits review. This is a product-positioning observation, not legal advice. Sources: `LICENSE`, `NOTICE`, README, package dependencies, roadmap.

### Focus, risks, verdict

Core value: **trustworthy design-system work inside the real project**. General editor breadth, slots, branches, docs generation, Reports, terminal, Figma import and static code generation are substantial, but collectively risk delaying proof of the core loop.

Largest risks:

1. Source damage or lost user work.
2. Setup/mapping cost exceeds user tolerance.
3. Design becomes another drifting representation.
4. Designers cannot participate comfortably in the local/Git workflow.
5. Editor breadth consumes integration capacity.
6. Alternatives become good enough before Sigma establishes a clear advantage.

**Verdict: continue with refocusing.** Preserve the editor/repository foundation, pause major breadth expansion, fix trust failures, and prove one narrow workflow with actual teams. The implementation justifies a serious pilot, not a universal safe-round-trip claim.

## Executive summary — five sentences

Sigma is a substantial local design editor with unusually developed repository, token, capture, and semantic-review tooling. Its central design-to-code promise remains partial, and the code contains concrete security and data-integrity weaknesses that should precede further feature expansion. The most urgent findings concern SVG injection, concurrent saves, incomplete adapter verification, and recovery after failed persistence. The product's strongest opportunity is a narrow, reliable workflow for changing an existing design system through reviewed repository updates. Continue with that focus and validate it with pilot teams before investing further in general editor breadth, built-in AI, or collaboration.

## Top five actions, in order

1. Fix imported-document injection and audit trusted-origin boundaries.
2. Prevent lost work: concurrent saves, storage recovery, honest adapter verification.
3. Make source changes explicitly reviewable/recoverable, validated before acceptance.
4. Make Sigma's own repository the complete reference integration: tokens → icons → components → source change → parity.
5. Pilot with two or three teams; measure setup effort, successful changes, failures and voluntary return usage.

## Open questions

1. Is the first daily user a developer, design-system maintainer, or nontechnical designer?
2. Which one framework/styling stack receives the first fully supported integration?
3. Should saving immediately write source, or should reviewed proposals be the default?
4. Is standalone browser storage production work or primarily evaluation/playground?
5. Which real teams have completed useful work without the creator's help?
6. Does the first release succeed at token editing, existing component updates, or complete interface building?
