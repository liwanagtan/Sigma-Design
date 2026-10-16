# Sigma roadmap

Updated: **15 October 2026**. Status: core editor and design-system phases **1–39 are complete**; local Figma import is implemented with fidelity limitations. The built-in terminal is complete for macOS/Linux. Reports redesign is complete; code creation, AI in the editor, full Figma interoperability, and live collaboration remain open.

This is the current backlog. Detailed phase specifications, past decisions, and implementation notes are in [roadmap history](roadmap-history.md). Project storage and migration details are in [project architecture](projects-architecture.md).

## Current product

| Area | Status | Current behavior |
| --- | --- | --- |
| Editor and design systems | Done | Components, variants, properties, tokens/modes/aliases, linked libraries, auto layout, constraints, grids, effects, history, comments, branches, page groups, and code inspection. |
| Repository workflow | Done | `.sigma/` files, CLI and workflow MCP, sync adapters, proposals, tickets/PRs, code capture, visual comparison, design-aware merging, and render-parity checks. |
| Projects and Home | Done | Sigma and Optics projects, user projects, metadata ownership migration, repository compatibility, and moving Drafts into projects. |
| Sigma reference files | Done | Tokens, Icons, and Components in Sigma. Foundations, Pages and UI, and Guide examples are permanently removed from the project, including archived copies. Actual Sigma styles/tokens and Lucide UI icons; temporary edits reset on leaving or refresh, while editable copies persist in Drafts. |
| Optics | Done | Sample design system inspired by Polaris, in its own project with persistent editable files. |
| Appearance | Done | Global Auto/Light/Dark and system preference tracking. Design canvas background always follows app appearance; the page background color control is removed. Reference content retains its applicable token modes. |
| Code tab | Partial | Renamed from Inspect to **Code**. Collapsed docs, resolved properties/labels, syntax-colored inspection, and a Create code workspace for editable HTML/CSS with sandboxed preview and export. Phase 51 remains in progress. |
| Local `.fig` import | Partial | Worker-based decoding, editable basic layers, import reports, bounded transfer/storage, and tested large-document reopening. Full conversion and round-trip support remain open. |
| Reports | Done | Project-scoped design-system report is accessible from the top bar, with **Go back to Files** to return. Phase 50 now has a scoped dashboard, verified metric definitions, searchable/paginated findings and library usage, exact layer/token links, and return navigation. UI approved by the user on 15 October 2026; scope, navigation, and usability regressions are verified. |
| Documentation | Partial | Navigation and page shell exist. Final content is deferred until before shipping. |

### Current Home decisions

- Sidebar: **search → Create New → Recents → Drafts → Archive → Projects**; Documentation stays at the bottom.
- Recents spans projects and Drafts, ordered by opening time with an edit-time fallback. Search spans active files and identifies their project or Drafts.
- Drafts contains every file without project ownership, across all file types. It is not a project.
- Project pages group files into **Design, Tokens, and Icons**; empty groups are hidden.
- Report opens for the selected project; **Go back to Files** returns to that project’s workspace.
- The top bar has the project icon on the left of its editable title, with Report, sort, grid/list, and appearance controls on the right. Project icons support Lucide glyphs and emoji.
- Create New in the sidebar offers Design file, Tokens file, Icons file, and Import. The open project is the destination; creation outside a project goes to Drafts.
- Covers and their controls are removed. An editable description appears below the project top bar and saves with project metadata. Grid/list preference is shared across Home views.
- Existing IDs, contents, versions, and library links survive migration. Library pickers offer the current scope plus explicit access to other projects and Drafts.

## Next priorities

1. **Design File reliability:** review the corrected Hug/Fill/min/max behavior, component authoring/navigation, inspector controls, and spacing overlays. Implementation and validation: [Design File reliability](design-file-reliability.md).

2. **Release readiness:** validate the new Home/project flows and prepare Documentation before shipping.
3. **Code creation:** turn selections, components, and pages into editable, previewable code using project tokens and existing components (Phase 51).
4. **AI in the editor:** shared document tools, the Assistant panel, and visual feedback/open-editor MCP (Phases 40–42).
5. **Live collaboration:** the shared document, live sessions, and collaborative undo/comments (Phases 47–49).
6. **Publish and pilot:** complete the release checklist, publish the npm package, and work with two or three pilot teams.
7. **Figma interoperability — lowest priority:** one consolidated phase covering native vector editing, reader validation, conversion/paste/CLI import, and `.fig` export. Existing local import remains available; completing this phase is not a release gate.

## Remaining feature milestones

Milestones below follow feature priority. Phase 43 now consolidates the former Figma Phases 43–46; their original specifications remain in history. AI and collaboration retain their existing phase numbers; Reports is Phase 50, code creation is Phase 51, and the terminal is Phase 52. **Done** means implemented in the stated scope; **Partial** means usable behavior exists with outstanding acceptance work; **Planned** means a future milestone; **Deferred** means outside the current release scope.

| Phase | Milestone | Status | Remaining outcome |
| --- | --- | --- | --- |
| 50 | Reports usability and design | Done | Scoped dashboard, explained metrics, searchable findings and usage, exact layer/token navigation, and user-approved UI. |
| 51 | Code creation | In progress | Create editable code for selections/components/pages, reuse project components and tokens, preview and validate results, and copy/download or apply project files through an explicit action. |
| 52 | Built-in terminal | Done | A shared resizable terminal dock in Design/Tokens, real workspace-bound PTY sessions through the local server, streaming output, keyboard isolation, reconnect, and process cleanup. |
| 40 | Shared document tools | Planned | One validated registry for reading/editing documents through the Assistant and MCP, using normal edit functions and undo. |
| 41 | Assistant panel | Planned | Streaming chat, selection/page context, tool activity, Stop, provider/key settings, and one undo step per turn. |
| 42 | Visual feedback and open-editor MCP | Planned | Render frames/selections for inspection and let an external agent edit the open document through the local server. |
| 47 | Shared Yjs document | Planned | Concurrent edits converge; source data is shared and derived layers/token values rebuild locally. |
| 48 | Live sessions | Planned | Share links, WebRTC connection/signaling, presence, reconnecting, and host saves to repository storage. |
| 49 | Collaborative undo/comments | Planned | Undo affects only the person's edits; comments and Tokens/Icons files participate in live sessions. |
| 43 | Figma interoperability (formerly 43–46) | Partial · lowest priority | Native vector/pen/boolean editing; broader reader validation; faithful conversion and library/token links; Figma paste and CLI import; best-effort `.fig` export and round-trip validation. |

### Phase 50: Reports usability and design

Completed: dashboard and scoped counts; local/linked/unresolved instances; resolved and type-checked token bindings; per-field typography; hidden/reference/handoff/date/file filters; no-data/error/offline states; bounded searchable findings and usage lists; exact layer/token drill-down and Back to Report. Proposals is restored to repository project top bars and its route guard is fixed. A usability review added resettable scope/detail filters, visible active coverage filters, broken-link prioritization, and clearer findings-versus-values wording. The user approved the Reports UI on 15 October 2026. Validation: 88 Node tests passed for the implementation and 257 browser tests passed after the usability refinements.

Help users answer **what is using the design system, where the gaps are, and what to do next**.

- **UI:** design a readable summary, file-level breakdowns, and focused detail views for component/token usage. Use Sigma components/tokens, support Light/Dark and smaller viewports, and keep long tables searchable/sortable instead of overwhelming the page.
- **Metric definitions:** explain counts, denominators, rounding, and filters. Distinguish local and linked library components, eligible token-bound values, and unsupported/imported content. Show meaningful zero versus no-data states; usage percentages alone are not a design-quality score.
- **Scope and trust:** clearly name the project, files/pages measured, and freshness. Verify inclusion rules for hidden layers, component definitions versus instances, reference/sample pages, and external library dependencies; surface missing/unavailable data rather than presenting it as zero.
- **Useful actions:** let users filter and drill into files/pages and navigate to relevant layers or library items. Explain unused items within the measured scope, and offer concrete review/fix suggestions without automatically deleting or changing designs.
- **Interaction states:** clear loading, empty, error, and offline states; preserve filter context and the **Go back to Files** navigation. Recompute or refresh after relevant design/library changes.
- **Done when:** representative projects produce verified counts and understandable results, users can move from a finding to the relevant design and back, accessibility/appearance checks pass, and tests cover scope/filter changes, rounding/no-data cases, and navigation. Review the design and wording with users before closing the phase.

### Phase 51: Code creation

First increment implemented: **HTML/CSS**, selected by the user, with selection/page generation, current-mode token snapshots, editable sources, sandboxed preview, viewport widths, copy/download, breakpoint CSS, and draft-discard protection. Verified on an Optics button; 261 browser tests and 88 Node tests pass. Repository Apply/ownership conflicts, framework mappings, broader fidelity, and responsive-page visual comparisons remain open. Implementation sequence and acceptance boundaries: [Code creation plan](code-creation-plan.md).

Build on the **Code** tab and existing repository handoff/design-to-code workflow so users can create usable components and pages from their designs.

- **User flow:** choose a selection, component, or page; choose a supported code target; generate, inspect/edit, and preview the result. Make generation progress, errors, and unsupported features understandable.
- **Project integration:** reuse mapped code components, variant/property APIs, tokens/modes, and icons. Preserve auto layout, responsive behavior, and accessibility semantics where supported; clearly identify custom layers and missing mappings.
- **Output:** coherent source files, styles, imports, and required assets, with copy/download for browser projects and a diff plus explicit Apply action for connected repositories. Keep existing inspection/snippet tools available.
- **Ownership and scope:** decide the first supported target and adapter before implementation. Define how generated files and subsequent manual edits are tracked on regeneration; preserve user edits and surface conflicts. AI assistance can extend this workflow later; Phase 51 does not require the Assistant panel or promise automatic code-to-design round trips.
- **Validation:** check source syntax/builds for the chosen target, preview representative outputs, and compare them with the design. Show dependencies and fidelity limitations before applying changes.
- **Done when:** a component and responsive page built from Sigma/Optics tokens and components can be generated, edited, previewed, and exported/applied into a working example project; regeneration preserves manual work or reports conflicts; tests cover bindings, imports/assets, unsupported cases, and file ownership.

### Phase 52: Built-in terminal

- **Implemented:** Design/Tokens dock, explicit workspace connection, real PTY sessions, keyboard isolation, Light/Dark rendering, bounded streaming, reconnect/restart, session limits, and job cleanup. Browser and Node regressions pass locally and in CI, including Linux Node 20/22 and the macOS terminal lifecycle job. macOS arm64 package installation and real commands are verified. Windows remains outside the first release scope with clear guidance.

- **UI:** Terminal icon in Design and Tokens rails opens a resizable bottom dock, closed by default, with session tabs, workspace/shell context, copy/paste, and clear connection/exit status. Hiding preserves running commands; End session terminates them.
- **Workspace:** sessions belong to a connected local workspace and are reused across its Design/Tokens files. Browser-only projects and Drafts must connect a workspace before execution; project switches never silently reuse another project's shell.
- **Runtime:** real interactive PTY via the local Node server and authenticated bidirectional transport. Validate Host/Origin and session capabilities; stream bounded output and keep shell input separate from editor shortcuts and document data.
- **Persistence:** sessions/transcripts are separate from files, publishing, sample resets, and design undo. Handle reconnect, server restart, resource limits, and process cleanup explicitly; no automatic command replay.
- **Done when:** real commands, interactive input, resize, interrupt, switching/reconnect, and termination work in both file kinds; no accidental design edits, cross-workspace session exposure, unauthenticated execution, or orphan processes. Validate packaging and declared platform support.
- Detailed UI, architecture, connection limits, implementation sequence, and acceptance criteria: [Built-in terminal plan](terminal-plan.md).

### AI acceptance and decisions

- Start Phase 40 with model-free tool tests: valid edits, useful error results, and undo after a sequence of calls.
- Phase 41 is ready when a request to build a screen from Optics works through those tools with one-step undo and cancellation.
- Phase 42 is ready when the Assistant inspects a render and corrects its work, and an external agent can make equivalent edits over MCP.
- Confirm provider/model availability, SDK behavior, credential storage, and the data policy at implementation time. Historical model identifiers are tentative, not current requirements.
- Preserve local-first ownership, treat document text/tool results as data, and keep edits within Sigma's normal validation and undo paths. Existing workflow MCP is separate from planned open-document tools.

### Live collaboration acceptance

- Keep peer-to-peer editing distinct from account-based cloud sharing and permissions.
- Validate concurrent moves/deletes/property changes, component/token normalization, reconnecting, host saves, and undo isolation before declaring the live phases complete.
- Confirm signaling/TURN, link trust, encryption, and dependency choices before implementation; historical architecture details are in the archive.

### Phase 43: consolidated Figma acceptance and limitations

- Scope includes editable vector paths/handles, the pen tool, live boolean operations, SVG export, and vector persistence through save/merge. Imported SVG artwork does not satisfy native editing acceptance.
- Already implemented: `.fig` import through Home/drop, local worker decoding, editable pages/basic layers/component definitions, saved simplification reports, and memory-aware transfer/storage/history.
- Current limitations: instances are detached; vectors/complex fills may be embedded SVG; layout rules, variable/style links, mixed typography, masks, and some transforms/effects still need conversion work.
- Expand genuine-file fixtures and compare imported screens with Figma renders. Validate predictable errors, reopen/save behavior, and memory use by document complexity; compressed file size alone does not guarantee importability.
- This phase closes when native vector editing works, reader coverage and conversion fidelity meet the documented supported scope, paste/CLI import work, and exported `.fig` files open in Figma and survive import → export → import.
- Lowest feature priority: schedule this after AI, collaboration, and release/pilot work; it does not block shipping the current bounded importer.

## Release checklist

- [ ] Finalize Documentation content before shipping; keep the current content unchanged until that work is scheduled.
- [ ] Validate migration/idempotence, global Recents/search, Drafts ownership, grouped project pages, Create New/import destinations, moves, direct links, refresh, and back/forward navigation.
- [x] Restore the project-scoped Report in the top bar, with **Go back to Files** to return to the workspace.
- [x] Validate Reports usability and metric correctness against Phase 50 acceptance criteria; user approved the UI on 15 October 2026.
- [x] Make repository Proposals discoverable from the new project UI and verify its project scope.
- [ ] Validate repository offline/reconnect behavior, cached ownership, external library links, and failed moves retaining original drafts.
- [ ] Review the Design File reliability changes with the user; retain the new sizing, component and live-inspector regressions.
- [ ] Keep Sigma Tokens/Foundations/Components/Icons and captured Pages and UI synchronized with shipped interface changes.
- [ ] Run release CI, browser/Node suites, schema checks, and example render-parity checks. Recent local tests are implementation evidence, not a substitute for release checks.
- [ ] Confirm import limitations, dependency notices, package contents, installation/start instructions, and release version.
- [ ] Review license/attribution wording for publication and confirm npm package availability/access before publishing.
- [ ] Publish `sigma-design` and validate installation in a clean project.
- [ ] Recruit two or three pilot teams and prioritize feedback from their workflows.

## Deferred

- **Plugin and automation API:** define extension boundaries and a scripting API before building plugins.
- **Account-based sharing/team permissions:** cross-device token/library publishing, roles, and shared history need a backend.
- **Hosted team service:** GitHub App, sign-in, permissions, and audit logs for designers working without git.

## Maintaining this roadmap

Keep this file focused on current behavior, unfinished acceptance criteria, and release gates. Update status when evidence supports it; move completed detail into history or a focused specification instead of appending another narrative. Mark old UI decisions **Superseded** rather than carrying them as active requirements.

Superseded editor naming: **Inspect** is now **Code**; existing code inspection behavior is retained.

Superseded Home decisions: project dropdown, Files sidebar group, Welcome file section, separate new-file buttons, project covers, large project heading area, and a separate file toolbar. Their history remains in [the archive](roadmap-history.md).

For implementation, name the milestone or checklist item, read its focused specification/history if needed, and validate the affected behavior.

### Reference consistency maintenance

In progress: [Sigma source parity](sigma-source-parity.md). Verify icons first, app-derived tokens second, then real control anatomy/state parity. Primitive coverage does not imply all app composites are covered.

The Optics rebuild uses the complete Lucide catalogue and validates serialized files before writing. Sigma Components and Foundations bind measured design decisions to tokens; intentional teaching examples remain separate. Canonical icon choices hide duplicate compatibility aliases while retaining stored IDs. The retired Pages and UI capture pipeline is removed; active controls are checked with source-parity fixtures.
