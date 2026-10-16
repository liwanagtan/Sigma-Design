# Sigma roadmap

Updated: **16 October 2026**. Direction: **ship a dependable Standalone release first, then resume repository-connected development.**

This roadmap separates the current product, the next release, and future work. Existing implementations and completed milestones remain part of Sigma; changing priorities does not erase them. The [codebase review](codebase-review-2026-10-15.md) supplies the current risk assessment. Its findings are open until fixes and validation are recorded.

## Where Sigma is today

Sigma is a local design tool with Design, Tokens, and Icons files, projects, reusable components, and design-system libraries. Standalone stores work in the browser. Repository-connected mode adds a local server, `.sigma/` files, source synchronization, and Git-oriented workflows.

The product has substantial implemented functionality, but it is **not yet declared ready for an unsupervised standalone release**. Security, save/recovery guarantees, concurrent-tab protection, editor reliability, accessibility, performance, and release packaging need acceptance work. “Implemented” describes existing behavior; it does not certify zero defects or complete source parity.

| Area | Current state | Release implications |
| --- | --- | --- |
| Design editor | Implemented: drawing tools, selection/transforms, frames/groups, text/images, snapping, grids, effects, constraints, auto layout, breakpoints and RTL. | Validate representative authoring journeys and supported complexity; close reliability gaps. |
| Components | Implemented: mains/instances, variants, overrides, text/boolean/icon/swap properties, slots, nested controls, documentation and playground. | Verify editing, sizing, propagation, undo and reopening together. |
| Tokens | Implemented: groups, aliases, modes/extensions, typography, shadows, motion, bindings, audit and contrast checks. | Validate aliases/types/modes and persistent linked-library workflows; audit is not parity certification. |
| Icons | Implemented: SVG import, bundled sets, editing metadata, publishing and library references. Sigma interface uses Lucide, with a separate brand mark. | Validate safe import, references, compatibility IDs and actual rendered use. |
| Projects/Home | Implemented: Sigma/Optics/user projects, Drafts, global Recents/search, descriptions, editable project icons, file-type grouping, archive and moves. | Verify destination/ownership, navigation, refresh, history and recovery. |
| Libraries/history | Implemented: accepted published snapshots, update review, autosave, named versions, restore, browser branches and comments. | Protect work across failed saves and concurrent tabs; browser history is not an independent backup. |
| Appearance | Implemented: Auto/Light/Dark, live system tracking, global controls and appearance-driven canvas background. | Verify both themes throughout the shipped interface and keep app appearance distinct from document token modes. |
| Reports — Phase 50 | Implemented and UI approved on 15 October 2026: scoped dashboard, explained counts, search/filter/pagination and exact item navigation. | Preserve completed work; measure reuse rather than claim design quality or complete source equivalence. |
| Sigma reference project | Tokens, Icons and Components exist; temporary edits reset on leave/refresh and editable copies persist in Drafts. Source parity remains partial. | Match actual app assets/definitions and verified controls; composite coverage is explicit. |
| Optics | Persistent editable sample design system inspired by Polaris, in its own project. | Use as a realistic authoring/library regression fixture. |
| Code — Phase 51 | Inspection and static HTML/CSS draft generation, editing, sandbox preview and copy/download implemented. Framework output and repository Apply incomplete. | Preserve bounded output; no expansion needed for standalone launch. |
| Figma — Phase 43 | Local worker import implemented with reports, bounded transfer and shared artwork. Fidelity is partial; instances detach and some artwork embeds. | Keep limitations clear and ensure safe failure; full interoperability remains lowest priority. |
| Terminal — Phase 52 | Implemented for macOS/Linux with workspace-bound PTY, dock, reconnect, limits and cleanup; Windows unavailable. | Requires a connected workspace; not a standalone release dependency. |
| Repository tools | Implemented: configuration, format/CLI/workflow MCP, adapters, live sync, captures/comparison, proposals, PR/ticket preparation and semantic merge. | Further development paused; audited correctness gaps remain open for resumption. |
| Documentation | Page/navigation and content exist, with stale guidance and missing release material. | Complete and reconcile before release. |
| Built-in AI / collaboration | Planned, not implemented. | Outside this release. |

## What Standalone must deliver

A user can organize a project, create Tokens and Icons, build reusable components and a small interface, link/publish/update libraries, close and reopen work, and back up/restore the complete project without developer intervention.

**Working distribution assumption:** a local browser application launched through npm. Confirm supported Node versions, operating systems and browsers during release definition. A hosted app, PWA or desktop wrapper is a separate decision, not a promised deliverable.

**Included:** Projects/Drafts, Design/Tokens/Icons, component authoring, local libraries, safe persistence/history/archive, backup/restore, appearance, existing Reports, bounded imports/exports and practical documentation.

**Outside the release:** new repository integrations/source Apply, proposal/PR expansion, terminal expansion, built-in AI, live collaboration, accounts/roles, native vector/pen/boolean expansion and full Figma round trips. Preserve existing implementations. Fix shared security/data-integrity defects when necessary, without reopening repository feature development.

## What we will do next

These release milestones use **S1–S7** so historical phase numbers remain stable. **S1/S2 and S3 are in progress:** the [standalone release contract](standalone-release.md) records safety, persistence and package evidence; the [architecture decision record](standalone-architecture.md) records the first React/store and Yoga experiments and remaining gates. S4–S7 remain planned. Work is ordered by dependencies and acceptance gates, not fixed dates.

| Milestone | Outcome | Exit gate | Effort |
| --- | --- | --- | --- |
| **S1 — Release contract** | Define scope, distribution/support matrix, representative documents and standalone/service boundaries. | Written support contract and acceptance journeys; clear excluded features. | Small |
| **S2 — Security and durable work** | Safe imports/rendering, conflict-safe browser saves, failed-save recovery, complete project backups and migrations. | Hostile imports cannot execute code; failures retain recoverable work; concurrent tabs cannot silently overwrite; backups restore in a clean profile. | Medium–large |
| **S3 — Architecture and prototypes** | Separate UI, commands/history, model/layout, renderer and storage; evaluate React and canvas/layout options. | Bounded prototypes and documented measured adoption decisions; compatibility demonstrated. | Medium |
| **S4 — Shared UI modernization** | Incremental typed UI and accessible common controls, preserving Sigma styling. | Migrated slices pass behavior, keyboard, appearance and reference-parity checks. Full conversion is not automatically a release gate. | Large, incremental |
| **S5 — Editor reliability and performance** | Verify sizing, text, component building, libraries, interactions and supported document complexity. | Representative authoring/undo/reopen/export journeys pass within measured budgets. | Large |
| **S6 — Release preparation** | Documentation, onboarding, clean installs/upgrades, packaging, fonts/offline policy and cross-browser CI. | A clean installation completes the release journeys with no uncaught errors or misleading dead ends. | Medium |
| **S7 — Pilot and release** | Observe two or three users/teams completing standalone tasks, fix blockers and publish a verified release. | Users complete tasks without developer intervention; security/data-loss blockers closed; package/support claims verified. | Findings-driven |

### S1–S2: first implementation priorities

1. Fix imported Design JSON attribute injection and audit nested libraries and markup sinks. Enforce field/type/asset validation and practical limits, including ordinary JSON imports. Review R1 in the [audit](codebase-review-2026-10-15.md).
2. Add revisions or a single-writer/conflict strategy for browser tabs. Cross-tab notifications alone are insufficient (R5).
3. Retain dirty work after storage failure, show persistent saving/saved/failed states, provide retry/export, and guard navigation (R6).
4. Provide complete project backup/restore: metadata, documents, required library relationships and a stated history policy. Test restoring into a fresh profile and document origin/port-bound storage.
5. Validate migration, archive/restore, history, ownership and linked-file recovery; do not equate same-database versions with backups.

Do not postpone these protections behind a framework or renderer rewrite. Database-open retry, isolated upgrade/aborted-upgrade preservation, and copying saved history from unreadable files are implemented. A synchronous write-failure regression verifies transaction rollback. The packed CLI/install smoke check passed locally on Node 24/macOS without native optional dependencies; Linux/macOS Node 22/24 package CI is configured but unverified. Actual quota exhaustion, physical database corruption and package-upgrade validation remain open.

Implemented so far: import/render guards, revision-checked saves, visible save status, explicit per-tab recovery and project backup/atomic restore with history and dependencies. The editor now uses a bounded arithmetic parser and a stricter CSP; Figma schema compilation is confined to its worker. Local verification reached 115 Node tests on Node 24 and 297 browser tests. Remaining S1/S2 work includes migration/corruption/quota coverage, broader import and mutation-path review, and fresh install/platform validation. Node 22/24 are CI targets; remote results are still required. See the [increment evidence and limitations](standalone-release.md).

### S3–S4: technology direction

**Proposed direction, subject to prototype acceptance:** React + TypeScript + Vite for the application interface; Sigma tokens and scoped CSS for appearance; accessible primitives such as Radix for menus/dialogs/selects. HTML/CSS remain underlying technologies. No migration or dependency adoption is completed or authorized by a status label in this document.

The isolated React/TypeScript/Vite prototype now edits Sigma's real store with existing layout, undo/redo and serialization; a separate legacy subscriber observes the same changes. Four rectangular Yoga cases match current sizing. A second probe checks native Fabric/Konva rectangles alongside actual Sigma SVG at 1,000/5,000 objects, recording synchronous setup/update/pick calls and export presence. It verifies identities and an unchanged source fixture, not editor fidelity or a performance winner. These are initial compatibility results, not a production migration, complete typing or renderer/layout replacement. Prototype dependencies remain outside the shipped package. Full text/IME, nesting/clipping, export-fidelity, memory and interaction-latency gates remain open.

Retain and progressively type the document model and commands. Keep persisted IDs, file compatibility, library links, undo semantics, and existing pure logic. Do not introduce two competing canonical document stores or allow React and legacy handlers to own the same DOM region.

Migration order: shared controls → Home/projects/Drafts → Tokens → Icons → Design inspector/layers/assets. Use one bounded real UI slice first. Update Sigma's own reference files alongside changed controls. A framework does not fix unsafe interpolation, save conflicts, or layout semantics by itself.

**Canvas decision:** retain current SVG initially. Compare **Fabric.js** and **Konva** through a bounded prototype using the same Sigma fixtures. Evaluate text/IME, nested transforms/clipping, icons/artwork, selection/hit testing, exports, memory and interaction latency. Keep component/token/variant/slot semantics in Sigma's model; a drawing library is not the entire design editor.

Evaluate **Yoga** separately for layout if useful; Hug/Fill/Fixed, intrinsic text sizing, breakpoints and document compatibility still require explicit contracts. PixiJS is a later rendering candidate only if profiling warrants it. tldraw has production licensing requirements and different editor semantics; adopting Penpot would be a full platform/fork strategy, not a small replacement. No candidate is selected merely by feature count or popularity.

Storage wrappers such as Dexie are optional evaluations after persistence guarantees are defined; replacing the wrapper alone does not solve conflicts, backup or recovery. Avoid unrelated dependency churn.

Prototype exit: record baseline/candidate measurements, missing semantics, migration cost, license/distribution constraints and a go/no-go decision. If a replacement cannot demonstrate a concrete advantage, improve the existing backend. Do not ship an unfinished second engine as the default.

Reference research: [incremental React adoption](https://react.dev/learn/add-react-to-an-existing-project), [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility), [Fabric](https://www.fabricjs.com/), [Konva](https://konvajs.org/docs/), [Yoga](https://www.yogalayout.dev/docs/about-yoga), [tldraw licensing](https://tldraw.dev/community/license). Recheck versions/licenses before adoption.

### S5: editor acceptance

Use the existing [Design File reliability contract](design-file-reliability.md) as a starting point, not a blanket guarantee:

- Hug/Fill/Fixed, min/max, nested layouts, text wrapping, hidden/absolute children, RTL and breakpoints.
- Component propagation, variants, overrides, nested controls, slots and main-component navigation.
- Tokens/aliases/Light–Dark resolution, Icons, published libraries and update acceptance.
- Selection, transforms, snapping, constraints, clipping, effects, undo/redo and save/reopen.
- Safe bounded `.fig` import with honest simplification reports; existing HTML/CSS output and image/SVG export limits.
- Benchmark node count, nesting, artwork, editing latency and memory on stated hardware. Compressed import size is not an editing-performance guarantee.

Preserve the [source-parity approach](sigma-source-parity.md): actual icons/tokens first, actual control anatomy/states next, browser-to-canvas verification. Sigma contains only Tokens, Icons and Components; do not restore retired Foundations, Pages and UI or Guide examples. The Foundation token collection remains valid. Optics remains a separate persistent editable sample.

### S6–S7: release gates

- [ ] Scope/support matrix and local distribution decision confirmed.
- [ ] Imported-document security and shared trust boundaries verified.
- [ ] Concurrent-tab protection and failed-save recovery verified.
- [ ] Complete backup restores IDs, content and required dependencies in a clean profile.
- [ ] Existing-file migrations/history/archive pass repeatable recovery tests.
- [ ] Core component/UI-building journeys pass both appearance modes and supported browsers.
- [ ] Keyboard/focus/labels and shared dialogs/menus tested; design accessibility audit is not a substitute.
- [ ] Practical document/performance limits measured and documented.
- [ ] CI fails on uncaught page errors; unit/browser/schema and standalone end-to-end checks pass.
- [ ] Chromium/Firefox/WebKit coverage configured according to support policy; actual Safari checked if supported.
- [ ] Documentation matches navigation, reset/persistence behavior, storage risks and import/export limitations.
- [ ] Font/network/offline behavior explicitly defined and tested.
- [ ] Standalone has no misleading repository-only actions; feature boundaries preserve future integration.
- [ ] Fresh packed install, upgrade and launch verified; Node requirements, dependencies, licenses/notices and package contents reconciled.
- [ ] Pilot users create Light/Dark tokens, import icons, build a variant component/page, update a library, reopen, back up and restore without intervention.
- [ ] Publish and verify the release through the user-facing installation path; no open security/data-loss blockers within supported scope.

## Coming after the Standalone release

These are future outcomes, **not simultaneous active work or delivery-date commitments**. Reassess priorities using pilot results before resuming.

| Track | Preserved work | Next outcome |
| --- | --- | --- |
| Repository-connected mode — paused | Format/config, CLI/MCP, adapters, live sync, capture/parity, proposals and semantic merges. | Fix audit R2/R3/R4/R7: conflict-safe writes, honest readback, capture errors/timeouts and explicit reviewed/recoverable source Apply. Prove one supported stack and Sigma's self-repository loop. |
| Code creation — Phase 51, partial | Static HTML/CSS generation/edit/preview/export and existing inspection. | Framework component mappings, ownership/regeneration conflicts, broader fidelity and repository Apply. [Plan](code-creation-plan.md). |
| AI — Phases 40–42, planned | Existing agent skills and workflow MCP are separate from this work. | Validated document tools/undo → Assistant/provider/cancellation → visual feedback/open-editor MCP; decide credentials/data policy at implementation. |
| Collaboration — Phases 47–49, planned | Local comments, branches and cross-tab notifications exist; no live team editing. | Shared document → sessions/presence/reconnect → isolated undo/comments and host saves; validate trust/signaling/relay costs. |
| Terminal — Phase 52, implemented scope | macOS/Linux local workspace sessions and lifecycle handling. | Preserve regression coverage; expansion/platform support only after standalone. [Plan](terminal-plan.md). |
| Figma — Phase 43, partial; lowest priority | Bounded local import. Former Phases 43–46 consolidated. | Native vectors/pen/booleans, faithful variables/components/layout, paste/CLI and best-effort export/round trips. Not a standalone gate. |
| Longer term — deferred | No team service assumed. | Accounts/roles/cloud sharing, hosted service/GitHub App, plugin/automation API and additional distribution options require separate decisions. |

## Completed work retained

Historical phase completion records remain intact. Completion means the functionality recorded at the time was implemented in its stated scope; release hardening can uncover follow-up defects without deleting that achievement.

| Milestone | Retained outcome |
| --- | --- |
| Phases 1–14 | Initial standalone editor and core authoring capabilities. |
| Phases 15–19 — Part D | Design-system/editor expansion; original specifications and completion notes retained in history. |
| Phases 20–30 — Part E | Team/workflow, capture/design-to-code and review-related tooling; acceptance scope retained in history. |
| Phases 31–35 — Part F | Installable repository integration, adapters/live sync and code capture/checking. Expansion now paused. |
| Phases 36–37 — Part G | Optics sample design system. |
| Phases 38–39 — Part H | Page groups and file tools rail. |
| Phase 50 | Reports redesign/navigation, scoped metrics/findings and user-approved UI. |
| Phase 52 | Terminal implementation for supported macOS/Linux local-workspace scope. |
| Subsequent Home/editor improvements | Projects/Drafts architecture, configurable project icons/descriptions, appearance, Code inspector/docs, component sizing/navigation/spacing feedback, Lucide migration and source-parity work. Some acceptance/parity remains open. |
| Retired reference cleanup | Permanent removal of built-in Foundations, Pages and UI, Guide examples, and obsolete capture/teaching runtime sources; retained Tokens/Icons/Components and necessary compatibility data. |

Detailed records are preserved in [original roadmap history](roadmap-history.md). The [complete roadmap immediately before this reset](history/roadmap-before-standalone-first-2026-10-15.md) preserves the previous status tables, phase acceptance criteria, validation notes, completed checkboxes and superseded decisions without rewriting them. It is historical, not an active priority list.

## Current navigation decisions

Sidebar: search → Create New → Recents → Drafts → Archive → Projects; Documentation at the bottom. Drafts is ownership-free work, not a project. Recents/search span projects and Drafts. Project pages group Design/Tokens/Icons and hide empty groups. Top bar contains project icon/title, Report, sort, view and appearance; descriptions remain below, no cover/large heading. Report returns with **Go back to Files**. Creation/import targets the open project or Drafts outside projects. Library pickers default to scope with explicit other-project/Drafts access. Existing IDs/history/links must survive changes.

## Maintaining this roadmap

Keep current state, active release gates and future work distinct. Record evidence when closing gates; do not use past passing counts as a fresh release result. Technology proposals remain proposals until experiments support adoption. Preserve completed milestones and historical identifiers, link detailed plans rather than growing this page with execution logs, and do not resume repository feature work implicitly through standalone tasks.
