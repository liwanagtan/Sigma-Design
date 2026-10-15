# Project-based Sigma architecture

Status: implemented, 14 October 2026. This replaces the standalone Welcome file section with project-scoped file navigation and a separate documentation experience. Includes project ownership migration, scoped navigation, creation/move flows, and HTML documentation.

## Product model

Projects own Design, Tokens, and Icons files. Drafts holds files that do not yet belong to a project. The current project or Drafts menu controls the home’s file lists and creation/import destinations. Documentation is global product documentation, not a file collection.

| Scope | Contents | Behavior |
|---|---|---|
| Sigma | Current Welcome Tokens, Foundations, Components, Pages and UI, Icons, and the existing canvas guide examples | Built-in design-system examples retain temporary editing/reset behavior. Icons contains Sigma glyphs only. |
| Optics | The sample design system inspired by Polaris: Optics Tokens, Icons, Foundations, and Components | Ordinary editable, saved files; migration preserves user changes. |
| Drafts | Files without project ownership, including existing personal files, imported Figma designs, and editable copies | A separate scope, not a project. Files persist normally and can be moved into a project later. |
| User-created project | New Design, Tokens, and Icons files | Empty on creation; name supplied by the user. |

Proposed naming: retain the old canvas Guide as **Guide examples** in Sigma. **Documentation** becomes the documentation view and links to those examples. Documentation and editable example canvases therefore have distinct destinations.

A connected repository is also a selectable project, backed by the existing `.sigma/` adapter. Browser projects remain usable when a repository is connected. The selector does not imply arbitrary folder access or connecting additional repositories.

## Navigation and interactions

Home sidebar, top to bottom:

1. Sigma identity, global file search, and Create New.
2. Recents.
3. Drafts.
4. Archive.
5. Projects, with project names and a New project plus button.
6. Project files appear on the project page, grouped by Design, Tokens, and Icons; empty groups are hidden.
7. Documentation anchored at the bottom of the sidebar.


The Projects group lists project names with a **New project** plus button. Each project has a clickable icon picker for emoji (including custom pasted emoji) or Sigma glyphs, plus Reset icon. Choices persist in project metadata and do not alter files. Drafts is a separate menu immediately under Recents, lists all files without project ownership across every content type, and is never a project or project entry. Selecting a project opens its Recents; file filters then operate on that project. The creation dialog has a project-name field, inline validation, Cancel, and Create. Reject blank or duplicate names; create the project and select it immediately.

Selecting Drafts or a project refreshes Recents, file-kind lists, search results, Report, and Archive for that scope. New files, file imports, drops, and ordinary duplicates target the selected scope. **Make an editable copy** of a temporary Sigma example saves the copy in Drafts, ready to move into a project.

Draft cards have **Move to project…**, with a destination picker and New project option. Support moving one file or a selection of draft files. After a successful move, those files leave Drafts and appear in the destination project; retain the current Drafts selection and show an **Open project** action. Moving between browser scopes changes ownership metadata atomically and preserves IDs, content, versions, thumbnails, and token/component/icon links. Referenced libraries can remain in Drafts and continue resolving; offer to include related draft library files without silently moving them. For a repository destination, use the existing export/move adapter and conflict handling; archive the browser draft only after the disk writes and link validation succeed. A failed move retains the drafts.

Documentation opens documentation with a chapter list, readable article content, and links to example files/pages. It remains available from Drafts and every project and does not silently change the selected scope. Following a Sigma example link selects Sigma and opens the corresponding file/page. Returning Home then shows Sigma’s files. Documentation content is deferred until before Sigma ships; the current content is left unchanged for now.

## Storage and state

Keep the current vanilla ES-module architecture and IndexedDB storage.

- Add a `projects` store, keyed by stable ID: `{ id, name, kind, source?, createdAt, updatedAt }`.
- `kind`: `builtin`, `user`, or `repository`; built-in source identifies `sigma` or `optics`. Built-in ownership does not make Optics files read-only.
- Add an indexed `projectId` to file metadata. An absent or null `projectId` means Drafts; Drafts has no project record. Its list filters small metadata records for absent ownership rather than querying the IndexedDB index with an invalid null key. Keep documents, thumbnails, versions, and file IDs in their existing stores.
- Preserve existing `meta.project` repository-origin metadata. It is not the new ownership field and must not be overwritten.
- Store the selected scope preference per browser tab as `{ type: "drafts" }` or `{ type: "project", projectId }`, so switching scopes in one tab does not unexpectedly change another tab’s editing context. Restore its valid selection on refresh; direct file links take precedence.
- Keep project lookup/creation/selection in a new `src/projects.js`. Preserve `src/project.js` as the repository adapter; the similar names must be documented clearly.
- Introduce a small project-aware file-source interface for listing, creating, importing, opening, and reporting. Browser sources delegate to IndexedDB; the connected repository source delegates to the existing server adapter.
- Repository identity must be stable and supplied by the server/config, not inferred from a display name or localhost port. Offline repositories stay visible with their connection state.

A file belongs either to Drafts or to one project. Moving between browser scopes changes its `projectId`; moving metadata does not change file IDs, document contents, embedded artwork, or library references. Project rename changes only project metadata.

## Scope boundaries and dependencies

All home lists are scoped to Drafts or the selected project. File-kind and name filters are applied after ownership filtering. No implicit All Files fallback is introduced.

Library pickers default to the selected scope's published files. An explicit **Other projects and Drafts** choice allows using Sigma or Optics libraries from Drafts or personal projects. Existing cross-project links continue resolving regardless of the selected scope; ownership is navigation scope, not an authorization boundary. Show the source project alongside external libraries.

Report starts with the selected scope's design files but may resolve their external library dependencies. Browser storage usage remains a browser-wide number unless explicitly labelled as project usage.

Direct `#/file/<id>` links keep working and select Drafts or the owning project. Add project home links, such as `#/project/<id>/<section>`, Drafts links such as `#/drafts/<section>`, and documentation links, such as `#/guide/<chapter>`. Opening files and switching scopes must finish the existing save/reset lifecycle before navigation. Back/forward and refresh restore the route and scope consistently.

## Migration and seeding

Upgrade IndexedDB once to add the project store and file ownership index. Run a restartable, idempotent migration:

1. Create/reuse stable Sigma and Optics project records. Do not create a fallback personal project; existing unassigned files belong to Drafts.
2. Assign sample/Welcome files to Sigma using their metadata flags, including archived historical samples. Do not classify by editable display names.
3. Assign `optics`-flagged files to Optics, preserving edited documents and published versions.
4. Associate existing repository-cache records with the repository project using their source identity.
5. Keep remaining unowned files in Drafts with no project ownership (`projectId: null`). Include archived files and editable copies; do not discard anything.
6. Change only metadata and write the completion marker atomically with ownership assignments. Repeated startup must not duplicate projects or seeded files.
7. Seed/refresh generated Sigma files inside Sigma. Continue the existing sample reset/version migration behavior. Seed Optics once into Optics, never recreate or overwrite its edited files.

Avoid decoding/re-encoding large Figma documents during this migration: ownership belongs to small metadata records. Keep shared-artwork storage intact.

For existing users, restore a valid prior scope or use Drafts; opening a bookmarked file selects its owning scope. On a fresh installation, open Documentation with Drafts selected and Sigma available as the example project. Creating the first personal project selects that project.

## Documentation architecture

Use structured chapter data in `src/welcome-guide.js` and a dedicated renderer/view. Reuse documentation content from the current canvas Guide where appropriate, but present it as real HTML articles with headings, navigation, and actionable example links.

Give generated Sigma examples stable logical keys in metadata (for example `sigma:components`, `sigma:tokens`, `sigma:guide-examples`). Documentation links resolve those keys rather than generated file IDs, so regeneration does not break links. Page links likewise resolve stable keys or known page identities with a clear fallback when an example is missing.

Keep sample regeneration triggered by example-project setup/version checks, not by rendering every documentation chapter.

## Implementation sequence

1. **Ownership and migration:** IndexedDB upgrade, project records, project-aware queries, deterministic seeding, and ownership migration. Preserve existing behavior until the UI is switched over.
2. **Home navigation:** sidebar Projects group, New project dialog, project routes/preferences, scoped Recents/Design/Tokens/Icons/Archive/Report, correct create/import/copy destinations, and Move to project for draft files.
3. **Documentation:** documentation chapters and example links; remove the old Welcome file-list section. Keep the canvas examples in Sigma.
4. **Repository and library integration:** selectable connected repository source, offline states, explicit external-library browsing, and saved-file lifecycle across project changes.
5. **Verification and release:** migration/restart tests, navigation and scope checks, updated README/help, and manual browser verification using the user's existing data.

Project deletion, cloud sync, teams, and opening arbitrary additional repository folders are outside this change. The requested project selector and creation flow do not depend on them.

## Acceptance criteria

- Sigma and the Polaris-inspired Optics sample design system are separate projects with the correct files; Documentation contains documentation rather than file cards.
- Selecting Drafts or a project shows only its Design/Tokens/Icons files, Recents, search results, and supported Archive entries.
- New project creation produces an empty project and selects it; new files/imports land there.
- Existing personal files, large Figma imports, and their archived files remain in Drafts; edited Optics documents remain in Optics. Migration preserves their contents, IDs, and history.
- Draft files can be moved into an existing or newly created project. Batch moves preserve dependencies and are atomic for browser projects; failed repository moves retain the drafts.
- Existing file URLs, token/component/icon bindings, external libraries, and version history still work.
- Documentation links open the current example even after Sigma samples regenerate.
- Temporary sample edits reset as before; editable copies are saved in Drafts and can be moved into a user project.
- Refresh, back/forward, missing/stale selections, concurrent tabs, interrupted migration, and repository offline/reconnect states behave predictably.
- Tests prove project-scoped listing and mutation destinations, without loading every design document to build the home page.

## Project workspace pages

Project pages support an editable title and clickable project icon. Covers are removed from the page and an editable description appears below the top bar and saves with project metadata. Sort and grid/list controls sit in the top bar beside the project title and icon and share the Home preference. Recents is global, ordered by last opening with an edit-time fallback. Sidebar search spans all active browser file metadata and labels each result with its project or Drafts. Create New offers Design, Tokens, Icons, and Import; its destination is the open project, otherwise Drafts. Legacy kind routes continue to open the project workspace.
