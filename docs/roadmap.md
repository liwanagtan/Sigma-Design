# Sigma roadmap

Status: **Every phase is done: Phases 1–14, Part D (15–19), Part E (20–30), Part F (31–35) Part G (36–37, Optics) and Part H (38, page groups)**, and the small and medium items from the "Later" and "Follow-ups" lists. Drawing icons is no longer planned (icons come from icon libraries).

**What's next, in order:**

1. **Finalize the project:** Optics is in (Phases 36–37: every Polaris component, a page each), as files of your own. What's still open: plugins and automation (Part D, "Later": large, needs an API design first) and what needs a backend (real sharing in Part C; the hosted team service in Part E). The license files are in (see "Open source").
2. **Publish to npm:** claim `sigma-design` and publish the package (Phase 32 made it ready).
3. **Pilot teams:** two or three teams, after npm, to shape the workflow around how they actually work.

The repository's settings are done: auto-merge is on, and `main` is protected (the four CI checks must pass to merge a pull request; no force pushes or deleting it).

## Scope

**Part A: Files**

- **Files home.** A homepage that lists every Sigma file in the browser, with thumbnails. You can create, open, rename, duplicate, import, download and delete files there. Each file gets its own link.

**Part B: Design systems**

1. **Components and instances.** Create a component, place instances of it, override properties on an instance, and push changes from the main component to every instance.
2. **Variants.** Group components into a component set that has variant properties such as `Size=Large, State=Hover`, and switch an instance between variants.
3. **Component properties.** Boolean (show or hide a layer), text (a label's content) and instance swap (which nested component is used).
4. **Variables.** Color, number, string and boolean variables, organised in collections, with **modes** (for example Light/Dark) and **aliases** (a variable that points at another variable). They can be bound to layer properties.
5. **Extended collections.** A collection that inherits the variables and modes of a parent collection and stores only the values it overrides. Parent changes keep flowing down, and extensions can themselves be extended.

Out of scope for now: cloud sync and sharing between devices (needs a backend), team libraries and publishing, constraints other than auto layout, prototyping, code export of tokens.

## Ground rules

- Keep the current stack: vanilla ES modules, no build step. Run with `python3 serve.py`.
- Geometry and paint stay *materialized* on nodes. The renderer, hit testing, layout and export keep reading plain props like `n.w` and `n.fills`. New features compute those props in the normalize pipeline instead of teaching every module about components or variables.
- Every phase ends with: no console errors, a manual test in the browser pane, README and `?` shortcuts updated, and a commit.

# Part A: Files

## Phase 1: Files home (priority)

Today Sigma keeps a single document in one `localStorage` slot. **New file** and **Open file…** replace it, so there's no way to keep several files. This phase adds a homepage that lists every file, like Figma's file browser.

### Decisions

- **Storage moves to IndexedDB.** It has far more room than `localStorage`, which matters once images are involved. Add a small promise wrapper, `src/db.js`, with no dependencies, and a database `sigma` with two object stores:
  - `files`: metadata only, `{ id, name, createdAt, updatedAt, thumbnail }`, where `thumbnail` is a PNG `Blob`. The homepage loads just this store, so it stays fast however big the files are.
  - `docs`: the full document, keyed by file id, `{ id, doc, views }`. It's loaded only when a file is opened.
- **Each file gets a link.** Hash routing: `#/` is the homepage and `#/file/<id>` is the editor. Both views live in `index.html`, and `main.js` gains a tiny router. Back/forward, bookmarks and "open in new tab" all work.
- **Autosave writes the open file's record.** It stays debounced, as now, and also bumps `updatedAt`. `localStorage` is then kept only for UI preferences such as export settings.
- **Thumbnails reuse the export pipeline.** Render the first page's content with `buildSVG`, then draw it to a 400×300 canvas. Regenerate after 2 seconds of inactivity and when leaving the file. If rendering fails, show a neutral placeholder.
- **Undo history is per file and in memory only.** Switching files clears it, as it does today when a file is opened.
- **One-time migration.** On first run, if the old `sigma.document.v1` key exists, import it as a file. Remove the old key only after the IndexedDB write has succeeded, so nobody loses their current work.
- **Keep data safe.** Call `navigator.storage.persist()` so the browser is less likely to evict the database. Show storage used in the homepage footer.
- **Several tabs.** Use a `BroadcastChannel`. If the same file is edited in another tab, show a banner: "This file changed in another tab — Reload". The last write wins, but the user is warned. The homepage also refreshes when any tab saves.

### Homepage UI

- **Header:** the Σ logo, a search field, **New design file** and **Import**.
- **Sidebar:** **Recents** and **All files**. Folders can come later.
- **Grid of cards:** each shows the thumbnail, the file name and "Edited 2 hours ago". Clicking opens the file.
- **Card menu**, via right-click or a "…" button: Open, Open in new tab, Rename, Duplicate, Download (`.sigma.json`) and Delete. Delete asks for confirmation.
- **Sort:** last edited (the default), name or date created. There's also a grid/list toggle.
- **Import:** drag `.sigma.json` files anywhere on the page, or use the Import button. Each import becomes a new file and never replaces one.
- **Empty state:** "Create your first file", with buttons for a blank file and the sample file.

### Changes inside the editor

- **Σ menu:**
  - adds **Back to files** (⌘\ is free; pick a shortcut and add it to `?`)
  - **New file** creates a new record and navigates to it
  - **Open file…** imports as a new file
  - **Open sample file** creates a new file from the sample
  - none of these replace the current file any more
- **File name field:** renames the record, and the homepage updates.
- **Missing file:** opening `#/file/<id>` for a file that doesn't exist shows "File not found" with a link back home.

### Done when

- Three files can be created, each with different content. They all appear on the homepage with correct thumbnails, sorted by last edit.
- Rename, duplicate, delete, download and import all work.
- The existing autosaved document shows up as a file after upgrading.
- Two tabs on the same file show the reload banner.
- Reloading a `#/file/<id>` link reopens that file.

### What shipped (notes from implementation)

- **No Back to files shortcut.** Figma doesn't have one either, so it's a Σ menu item. The browser Back button also works.
- **Migrated thumbnails come later.** A file migrated from an earlier version gets its thumbnail the first time it's opened. Until then the card shows a placeholder in the page's background color.
- **Imported file names.** An imported file is named after its filename, not the name stored inside it.
- **View-only saves are separate.** Pan and zoom update only the stored view, never the document, so a tab that is only looking at a file can't overwrite another tab's edits. **Reload** in the "changed in another tab" banner discards this tab's copy rather than saving it first.

### Effect on Part B

Storing files in IndexedDB removes the `localStorage` size risk listed under Risks. It also gives copy/paste between files (Phase 9) a real use. Later, "libraries" could reference components and variables from other files in the same database.

# Part B: Design systems

## Key architecture decisions

### 1. Instances are materialized copies

An instance stores a real child tree, copied from its main component and kept in sync. This means rendering, selection, layers panel, auto layout and export all work without changes.

- Each instance child gets a **stable derived id**: `${instanceId}/${sourceNodeId}`, and nested instances add more segments. Selection and undo survive a re-sync because ids don't change.
- Each instance child keeps `sourceId`, the id of the node it was copied from.
- Children inside an instance **cannot be moved or resized**, matching Figma. Hit testing still selects them, but move and resize are blocked. The instance itself can be resized. Its children respond through auto layout. Fixed-position children stay pinned top-left until constraints exist; see Risks.

### 2. Overrides are recorded explicitly, keyed by layer-name path

- `instance.overrides = { "<namePath>": { prop: value, ... } }`.
- `namePath` is the chain of layer names from the component root, such as `"Content/Label"`. When siblings share a name, use `Name#2`. Keying by name, not id, is what lets overrides survive a **variant switch**, which is how Figma does it.
- Overridable props: `fills`, `strokes`, `strokeWidth`, `opacity`, `visible`, `text`, the font props, `radius`, `name`, the `bindings` entries, and the nested instance's `componentId`, `propValues` and `variantProps`.

### 3. All property edits go through one function

Add `applyEdit(node, props)` in `store.js`. Every edit path calls it: `setProps`, the text editor's `input` handler, `toggleVisible`, paint edits, rename, and arrow nudges. It does three things:

1. If the node is inside an instance and the prop is overridable, it writes the value into the instance's `overrides`. If the prop isn't overridable, it ignores the edit.
2. If the prop is bound to a variable, it removes that binding, matching Figma: typing a raw value detaches the variable.
3. It sets the value on the node.

Doing this refactor first (Phase 2) keeps every later phase small.

### 4. One normalize pipeline, in a fixed order

`normalizeDocument()` in `store.js` already runs before every render and commit. It becomes:

1. `syncInstances()`: rebuild each instance's children from its main component, then apply the instance's property values and overrides. Run depth-first so nested instances resolve. Detect cycles.
2. `resolveVariables()`: for every node with `bindings`, compute the effective mode and write the resolved value into the bound prop.
3. `fixGroups()`.
4. `applyLayouts()`.
5. `fixGroups()`.

### 5. Variables resolve into the bound props

The bound prop keeps the last resolved value, so the renderer and export never need to know about variables. If a variable is deleted, its bindings are dropped and the last value stays in place.

## Data model

All new fields are optional, so old documents keep working. Add `doc.version = 2` and a migration step in `migrateDocument()`.

```js
// Main component: a frame-like node
{ id, type: 'component', name: 'Button', /* all frame props: layout, fills, children… */
  description: '',
  props: {                       // component property definitions
    'p1': { name: 'Label', type: 'text', default: 'Button' },
    'p2': { name: 'Show icon', type: 'boolean', default: true },
    'p3': { name: 'Icon', type: 'instance', default: '<componentId>' },
  } }

// Component set (variants): a frame-like container of components
{ id, type: 'componentSet', name: 'Button', children: [/* components named "Size=Large, State=Default" */],
  variantProps: { Size: ['Small', 'Large'], State: ['Default', 'Hover'] },   // derived from child names
  props: { /* shared text/boolean/instance properties */ } }

// A layer inside a component, bound to component properties
{ …, propRefs: { visible: 'p2', text: 'p1', componentId: 'p3' } }

// Instance: frame-like, materialized children
{ id, type: 'instance', componentId: '<component id>',
  variantProps: { Size: 'Large', State: 'Default' },   // only when the main lives in a set
  propValues: { p1: 'Buy now', p2: false },
  overrides: { 'Label': { fills: [ … ] } },
  children: [ /* derived copies with id `${instanceId}/${sourceId}` and sourceId */ ] }

// Variables
doc.variables = {
  collections: [
    { id: 'c1', name: 'Color', modes: [{ id: 'm1', name: 'Light' }, { id: 'm2', name: 'Dark' }], defaultModeId: 'm1',
      variables: [
        { id: 'v1', name: 'bg/primary', type: 'color', valuesByMode: { m1: '#FFFFFF', m2: '#1E1E1E' } },
        { id: 'v2', name: 'text/primary', type: 'color', valuesByMode: { m1: { alias: 'v9' }, m2: '#FFFFFF' } },
      ] },
    // Extended collection: inherits modes + variables from its parent, stores only overrides
    { id: 'c2', name: 'Color (Brand B)', extends: 'c1',
      modes: [{ id: 'm1b', name: 'Light', parentModeId: 'm1' }, { id: 'm2b', name: 'Dark', parentModeId: 'm2' }],
      overrides: { v1: { m1b: '#FFF8F0' } } },
  ],
};

// A layer bound to variables, and pinning a mode
{ …, bindings: { 'fills.0.color': 'v1', 'radius': 'v5', 'layout.gap': 'v6', 'text': 'v7', 'visible': 'v8' },
     modes: { c1: 'm2' } }            // this layer and its children use Dark; pages may also set `modes`
```

**Variable types and what they can bind to:**

| Type | Bindable props |
| --- | --- |
| color | `fills.N.color`, `strokes.N.color`. A color value may carry alpha, written `#RRGGBBAA`. The alpha multiplies the paint's opacity. |
| number | `w`, `h`, `radius`, `opacity`, `strokeWidth`, `fontSize`, `lineHeight`, `letterSpacing`, `layout.gap`, `layout.pt` / `pr` / `pb` / `pl` |
| string | `text`, `fontFamily` |
| boolean | `visible` |

**Mode resolution for a node:** use the nearest ancestor (including the node itself) whose `modes` names this collection. Failing that, use the page's `modes`. Failing that, use the collection's default mode. For an extended collection, look up the extension's override for that mode first, then fall back to the parent's value for `parentModeId`, repeating up the chain. Follow aliases with a depth limit of 16 and cycle detection; on a cycle, keep the last value and log a warning.

## Phases

### Phase 2: Foundations (refactor, no new features)

- **"Frame-like" helper.** Add `isFrameLike(n)`, true for `frame`, `component`, `componentSet` and `instance`. Replace the 29 `type === 'frame'` checks in `hit.js`, `layout.js`, `render.js`, `interact.js`, `commands.js`, `io.js` and `panels.js`. Some checks are genuinely frame-only; keep those, for example "Clip content" defaults.
- **Edit funnel.** Add `applyEdit(node, props)`, described above, and route every edit path through it. For now it only sets values.
- **Pipeline.** Restructure `normalizeDocument()` into the ordered pipeline. Add empty `syncInstances` and `resolveVariables` stubs in the new files `src/components.js` and `src/variables.js`.
- **Versioning.** Add `doc.version` and `migrateDocument()` versioning.
- **Test page.** Add `tests/index.html`, a tiny in-browser assert runner for the pure functions: layout, sync, variable resolution. Run it from the browser pane at `/tests/`.
- **Done when:** the app behaves exactly as before, and the tests page passes.

### Phase 3: Components and instances (core)

- **Create component** (⌥⌘K): a single frame becomes `type: 'component'`. Anything else is wrapped in a new component.
- **Create instance:** the duplicate shortcut, copy/paste and ⌥-drag on a main component create instances. Add an **Assets** tab next to Layers in the left panel. It lists local components, and you can drag one onto the canvas or click to place it.
- **`syncInstances()`:** copy the main component's subtree with derived ids, then apply overrides by `namePath`.
- **Instance children:** they're selectable but locked for move and resize. Overridable edits go through `applyEdit` into `overrides`.
- **Instance commands:** Detach instance (⌥⌘B) makes the subtree plain frames with fresh ids. Go to main component selects it and zooms there. Reset all overrides.
- **Rendering and panels:**
  - Layer icons: diamond outline for components, a filled diamond for instances.
  - Components get a purple accent (`#9747FF`) for their selection outline and frame labels, as in Figma.
  - The right panel gets a "Component" or "Instance" section.
- **Guards:** a component can't contain an instance of itself, directly or through nesting. Block this on insert and paste.
- **Deleting a main component** leaves its instances as they are, marked "Main component missing". Detach is the only action offered.
- **Done when:** changing a fill or text in the main updates every instance. An overridden instance keeps its override. Resizing an auto-layout instance reflows its children. Undo/redo works across all of it.

### Phase 4: Component properties

- **Defining properties:** a "Properties" section on a selected component lists definitions (add, rename, delete, set default) for the boolean, text and instance-swap types.
- **Binding layers:** when a layer inside a component is selected, a small "link" button next to Visible, Text and the nested instance's component lets you bind it to a property. This sets `propRefs`.
- **Instance controls:** the instance panel shows a control per property: a toggle, a text field or a component picker. Values are stored in `propValues` and applied in `syncInstances()`. Precedence is property value, then explicit override, then main component.
- **Instance swap:** on a nested instance, it changes `componentId` and keeps overrides where the name paths still match.
- **Done when:** a Button component with Label (text), Show icon (boolean) and Icon (swap) properties can be configured per instance from the panel.

### Phase 5: Variants

- **Combine as variants:** selecting two or more components and choosing it creates a `componentSet` that is frame-like and auto-laid-out with a dashed purple border. Each component's name is parsed into `Prop=Value` pairs.
- **Editing the set:** in the panel you can add or rename a variant property and add a value. Renaming rewrites the child component names.
- **Variant instances:** an instance of a variant shows a dropdown per variant property. Changing one finds the component whose values match, sets `componentId`, re-syncs and keeps overrides by name path. If no exact match exists, pick the closest one and show a warning.
- **Assets panel:** shows component sets as a single entry. Dragging one creates the default variant, which is the first child.
- **Done when:** a Button set with Size × State switches variants on an instance and keeps an overridden label.

### Phase 6: Variables (core)

- **Variables editor:** a modal, opened from the main menu and from the right panel when nothing is selected. It works like a table:
  - collections are listed on the left
  - variable rows are grouped by the `/` in their names
  - each mode is a column
  - you can add, rename and delete collections, modes and variables
  - values are edited with a color picker, a number field, a text field or a toggle
- **`resolveVariables()`** handles the single default mode, plus aliases and cycle detection.
- **Binding UI:**
  - A "bind" button sits on paint rows and on the relevant number fields, text content and visibility. It opens a picker filtered by type.
  - A bound field shows a pill with the variable name. Clicking the pill detaches it.
  - `applyEdit` detaches on manual edit.
- **Done when:** binding a fill and a corner radius to variables and then editing those variables updates the canvas live. Undo covers variable edits. Save and open round-trip.

### Phase 7: Modes

- **Mode controls:** the Layer section of the right panel gets a "variable mode" control per collection used inside the selection. It offers Auto (inherit) or a specific mode and writes `node.modes`. The same control appears on the Page section.
- **Mode inheritance:** resolution walks ancestors, as described under Data model. Instances can pin a mode, so a Dark instance of a Light component works.
- **Done when:** one frame shows Light, a duplicate set to Dark shows Dark, and nested frames can flip back.

### Phase 8: Extended collections

- **Creating one:** "Extend collection" in the variables editor creates `extends: parentId`, with one mode per parent mode (`parentModeId`). It inherits every parent variable and stores only overrides.
- **Editor view:** inherited values appear greyed with a "reset to inherited" action. Overridden cells are highlighted. New variables and modes can only be added to the root collection, and they appear in all of its extensions.
- **Binding:** a binding still points at the root variable id. The *collection* chosen by the mode lookup decides which values apply. When a node's `modes` names an extended collection, its overrides apply to that subtree. This is how one component library gets re-skinned per brand.
- **Done when:** a "Brand B" extension overrides two colors. A frame set to Brand B shows them, while the rest of the variables still follow the parent, including after the parent changes.
- **Watch:** forum users report conflicts when a component pins a mode in a collection that is also extended. Test that combination specifically.

### Phase 9: Integration and polish

- **Variables in components:** bindings inside components flow to instances. An instance can override a binding by binding a different variable.
- **Copy/paste between files:** pasting nodes that reference missing variables or components keeps their resolved values. Pasting into a file that has a matching variable *name* rebinds by name.
- **Assets panel:** search, collapsed groups by `/` in component names, and component descriptions.
- **Performance:** cache `namePath` maps per component, and skip `syncInstances()` for instances whose main hasn't changed. Track this with a `version` counter bumped by `applyEdit` on any node inside a component. Aim for 60fps dragging with 200 instances.
- **Docs:** update the README and the shortcuts list. Add a design-system sample page to `sample.js`: a Button set, a Card using it, and Light/Dark plus Brand B variables.

## Risks and open questions

- **Constraints.** Without them, resizing an instance only reflows auto-layout children; fixed children stay pinned top-left. Option: add basic constraints (left / right / left-and-right / center / scale) as a Phase 3.5, since Figma users rely on them heavily.
- **Override keys by name.** Renaming a layer inside a main component orphans existing overrides, which Figma also does. Acceptable, but the instance panel should show "N overrides no longer apply".
- ~~**Snapshot undo size.**~~ Done: undo keeps up to 200 steps and fewer for big files, capped at about 100 MB in total (`UNDO_CHARS` in `store.js`).
- **Cycles.** These can come from nested instances or variable aliases. Both need hard guards in the pipeline, not just in the UI.

# Part C: Design tokens

This is where Sigma deliberately differs from Figma. Figma treats variables as a feature inside a design file. In Sigma, **design tokens** are their own product: a token file is a source of truth that a designer, team or org owns, and design files consume it.

## Decisions

1. **Name.** "Variables" is renamed **Design tokens** everywhere in the UI. Internal code names (`variables.js`, `doc.variables`) stay, to avoid churn.
2. **File kinds.** Every file is a **Design file** or a **Token file**. The home page has a separate **Design tokens** group and a **New token file** button. Token files don't have a canvas. They open a full-screen token editor.
3. **Publish and accept updates** (like a Figma library). Editing a token file changes nothing for consumers until you **Publish**, which creates a numbered version. A design file stores a snapshot of the version it accepted. When a newer version exists, it shows "Token updates available", and you review and accept. Bad edits can't instantly change everyone's work, and design files keep working when the token file isn't available.
4. **Several token files per design file.** For example, a design file can use "Core" and "Brand B" together.
5. **Local tokens stay possible** in design files, as a scratchpad. A **Move to token file…** action promotes them, and bindings keep working because token ids don't change.
6. **Existing variables convert automatically.** A design file's variables become a token file named "<file> tokens", published as v1 and linked to the design file it came from.
7. **Colors carry opacity.** Every color token has an explicit opacity, shown on a checkerboard swatch. A layer using the token gets its paint opacity from it.
8. **Typography tokens.** A single token bundles font family, weight, size, line height and letter spacing. Each part can be a value or an alias to another token, such as size → `font/size/lg`. A text layer links one typography token instead of five fields. Figma keeps text styles in a separate system; Sigma doesn't.
9. **Code-friendly.** Token files export to the W3C Design Tokens format (DTCG `tokens.json`) and to CSS custom properties, and can import DTCG JSON. That makes the token file the source of truth for developers as well as designers.
10. **Sharing with a team.** For now, token files are shared by exporting and importing files. Syncing between people needs a backend, which is listed as a later step.

## Data model

```js
// Files: meta.kind tells the home page and the router what a file is.
files: { id, name, kind: 'design' | 'tokens', updatedAt, thumbnail, tokenVersion? }

// A token file's document
{ kind: 'tokens', name, version, collections: [/* same shape as doc.variables.collections */],
  published: { version: 3, publishedAt, notes, collections: [/* snapshot */] } }

// A design file links token files and keeps the accepted snapshot of each
doc.libraries = [{ fileId, name, version: 3, collections: [/* snapshot of that published version */] }]
doc.variables.collections  // local (scratchpad) tokens, as today

// Token ids are globally unique, so bindings keep pointing at a token id. The resolver indexes local
// collections plus every linked library snapshot.

// Color token: '#RRGGBB' or '#RRGGBBAA'. The editor shows hex + opacity %.
// Typography token value: each field is a value or { alias: tokenId } of the matching primitive type
{ fontFamily: 'Inter', fontWeight: 600, fontSize: { alias: 'size-lg' }, lineHeight: 140, letterSpacing: 0 }
// A text layer binds it with bindings.typography = tokenId (sets all five properties)
```

## Phases

### Phase 10: Rename and file kinds

- **Rename** "Variables" to "Design tokens" in every label, menu, panel and the README.
- **File kinds:** add `kind` to file metadata. Existing files are `design`.
- **Home page:** sidebar groups **Design files** and **Design tokens**. Recents shows both, with a kind badge. Add a **New token file** button. Token-file thumbnails are swatch palettes generated from their color tokens.
- **Routing:** `#/file/<id>` opens the canvas editor for design files and the token editor for token files. A token file gets an empty token editor for now; Phase 11 fills it in.
- **Done when:** you can create, rename, duplicate and delete a token file from the home page, and it opens without a canvas.

### Phase 11: Token file editor

- **Full-screen layout**, built from today's variables editor:
  - left: collections, with extensions nested
  - center: the token table, one column per mode
  - right: an inspector for the selected token (description, aliases, which tokens alias it)
  - top: file name, search and a type filter
- **Previews:** color swatches on a checkerboard, and so on per type.
- **Descriptions:** tokens get a `description` for documentation.
- **Done when:** a token file can be built from scratch with collections, modes, extensions, aliases and descriptions, with undo, without opening a canvas.

### Phase 12: Color opacity and typography tokens

- **Color opacity:** an opacity % field in the editor and in the design file's token picker. Swatches show transparency.
- **Typography type:** a composite token. The editor shows a live sample ("The quick brown fox"), and each part can alias a token. `fontWeight` becomes a bindable number.
- **Text section in design files:** a **Text style** picker lists typography tokens with an "Aa" preview. Linking one sets all five properties. Changing any of them by hand detaches the typography token.
- **Done when:** a heading style token drives several text layers, and changing its size token (via an alias) updates them all.

### Phase 13: Linking design files to token files

- **Linking:** a **Libraries** dialog in design files lets you add or remove token files. Linking takes the latest published snapshot.
- **Publish:** the token editor has **Publish** (with optional notes). It increments the version, stores the snapshot, and notifies open tabs.
- **Accepting updates:** when a newer version exists, design files show "Token updates available". You review what changed (added, changed and removed tokens) and accept or skip. Tokens removed in a new version keep their last value, and their layers are flagged.
- **Local tokens:** they're shown in the picker under "Local". **Move to token file…** moves local collections into a new or existing token file, publishes it, and links it.
- **Migration:** design files with variables get a linked token file (v1) on first open after the update.
- **Done when:** editing a color in a token file and publishing shows an update banner in an open design file, and accepting it recolors the bound layers.

### Phase 14: Export and import

- **Export DTCG `tokens.json`:** groups come from `/` in names, modes become separate sets, extensions become separate sets, aliases are written as `{group.token}`, and color uses the DTCG color format (including alpha).
- **Export CSS:** custom properties, with `:root` for the default mode and a `[data-theme="dark"]` block per other mode.
- **Import:** DTCG JSON creates a new token file, or merges into an open one.
- **Done when:** exporting and re-importing a token file round-trips without loss, and the CSS works in a plain web page.

### Later (needs a backend)

- **Real sharing:** token files shared across people and devices, with roles (who can publish).
- ~~**History:**~~ Done locally: every file has a version history in the browser (autosave versions, named versions, one per publish), with read-only viewing, restore and "duplicate as new file". Syncing it between devices still needs a backend.

## How to resume in a new session

> "Read `docs/roadmap.md` and implement Phase N. Follow the ground rules, test in the browser pane, then commit."

Update the **Status** line at the top and tick the phase off below as you go:

- [x] Phase 1: Files home (priority)
- [x] Phase 2: Foundations
- [x] Phase 3: Components and instances
- [x] Phase 4: Component properties
- [x] Phase 5: Variants
- [x] Phase 6: Variables (core)
- [x] Phase 7: Modes
- [x] Phase 8: Extended collections
- [x] Phase 9: Integration and polish
- [x] Phase 10: Rename and file kinds
- [x] Phase 11: Token file editor
- [x] Phase 12: Color opacity and typography tokens
- [x] Phase 13: Linking design files to token files
- [x] Phase 14: Export and import
- [x] Phase 20: File schema
- [x] Phase 21: Project folder storage
- [x] Phase 22: Tokens sync skill (first milestone)
- [x] Phase 23: Icons sync
- [x] Phase 24: Code handoff (Part D, Phase 15)
- [x] Phase 25: Propose change
- [x] Phase 26: Team workflow (GitHub; Notion when connected)
- [x] Phase 27: Comments
- [x] Phase 28: Component library onboarding
- [x] Phase 29: Page onboarding
- [x] Phase 30: Design to code for components
- [x] Phase 31: Project mode in the editor
- [x] Phase 32: Install like a dev tool (npm package `sigma-design`)
- [x] Phase 33: Setup by the agent: adapters, rules and project skills
- [x] Phase 34: Live sync while Sigma runs
- [x] Phase 35: Sigma renders the project's components
- [x] Phase 17: Design system use report (Part D)
- [x] Phase 18: Running the system (Part D)
- [x] Phase 19: Visual change review (Part D)
- [x] Phase 16: Accessibility checks and annotations (Part D; done after Phase 19)
- [x] Phase 36: Optics, a working design system inspired by Polaris (Part G)
- [x] Phase 37: Optics Components: every Polaris component, a page each (Part G)
- [x] Phase 38: Page groups (Part H)

## Follow-ups

Things noticed while building, not yet done:

- ~~**Groups as objects.**~~ Done: `collection.groups = [{ id, name, parentId, description }]` (array order is display order) and `variable.groupId`; token names are derived full paths (`token-groups.js`). The sidebar is one Collection → Group tree. Older files convert on load, with ids derived from collection + path so published and linked copies convert identically.
- ~~**Token groups and references.**~~ Done: a group tree per collection (create, rename, nest, ungroup, delete, drag tokens in), and references to other tokens with a `{` picker, value previews and the full chain in the inspector. References can point into linked token files; publishing carries those files along (`published.dependencies`) so design files resolve them.

- ~~**Rendering performance.**~~ Done: text that doesn't wrap is drawn as SVG `<text>`. With 200 card instances (about 400 text layers), a frame went from about 17 ms to about 8 ms. Wrapping text still uses HTML (`foreignObject`), because SVG text can't wrap.
- ~~**Orphaned overrides.**~~ Done: instances show "N overrides no longer apply" with a Clear button.
- ~~**Constraints.**~~ Done: Left / Right / Left & right / Center / Scale (and vertical), applied to frames and resized instances.
- ~~**Exposed nested properties.**~~ Done: a nested instance can expose its properties; outer instances show its controls.
- ~~**Libraries.**~~ Done: a design file publishes its components as numbered versions. Other design files link them in **Libraries…**, use them from Assets, and review and accept updates, the same way as token files. Library components are stored as a snapshot in `doc.componentLibraries`.
- ~~**Design system foundations**~~ (from Figma's designsystems.com starter guides). Done:
  - **Layout grids:** columns, rows and square grids on frames, snapping, ⌃G, token-bound count, gutter and margin (`grids.js`).
  - **Contrast:** text layers against what's behind them, and contrast pairs on color tokens, per mode (`contrast.js`).
  - **Effects and shadow tokens:** drop shadow, inner shadow and layer blur (SVG filters); a composite Shadow token type, in DTCG and CSS.
  - **Component search** matches description keywords.
  - **Motion tokens:** Duration and Easing types, in DTCG and CSS. Nothing on the canvas uses them yet (no prototyping).
  - **Text case:** as typed, upper, lower and title case on text layers.
- ~~**Corners, strokes, sizes and text.**~~ Done: a radius per corner, strokes on some sides only, min / max width and height for hug and fill sizes (auto-width text wraps at its max width), and text truncation after a number of lines.
- ~~**Component libraries record their Sigma Tokens file.**~~ Done: a file linking the library starts using that Sigma Tokens file, or matches its tokens by name in its own (another brand).
- ~~**Sigma Icons.**~~ Done:
  - **Sigma Icons files:** a third file kind. SVGs are imported safely (plain shapes only, colors become the layer's color), grouped by style (outline, filled) and group, searched by name and keywords, and published as versions.
  - **Icons in components:** design files link Sigma Icons files and keep copies of only the icons they use; icon layers (only in main components, for now) have a size, a color token and a stroke width; instances can't override them.
  - **Icon property:** instances choose an icon, optionally from some groups only. Component libraries bring the Sigma Icons files they use.
  - **Lucide:** **+ Sigma Icons ▾ → Lucide** adds the whole set (`tools/build-lucide.py` builds `icon-sets/lucide.json` from a pinned version).
  - **Welcome to Sigma:** a sample Sigma Icons file and a tenth guide page, Sigma Icons.

# Part D: Design and development (later)

From Figma's "Design & Development", "Operations" and "Schema" guides on designsystems.com. These are big pieces of work, so they start **after Sigma's design and tokens are final**. Phase 15 comes first: it's the main reason Sigma exists.

Everything here works locally in the browser unless it says it needs a backend.

## Phase 15: Code handoff (priority)

Close the gap between design and code: a developer selects a layer and gets code that uses the design system's names.

- **Inspect panel:** a third tab next to Design. For the selected layer it shows:
  - its CSS (size, layout, padding, gap, radius, fills, strokes, effects, typography), with each token-bound value written as the token's CSS variable, such as `var(--surface-default)`, matching **Export CSS variables**
  - which tokens it uses, with their values in the current mode
  - for an instance: the component, its variant and its property values, written as code props (`<Button style="primary" label="Get started" />`)
  - copy buttons for each block
- **Code names per platform:** each token can have its own name for Web, iOS and Android (like Figma's variable code syntax), used in the Inspect panel and in exports. If none is set, the name comes from the token's path.
- **Component code names:** a component and its properties can carry the name they have in code, so the design mirrors the code library ("stack mirroring").
- Questions to settle first: which code targets beyond CSS (React props, SwiftUI, Compose), and whether code names live in token files only or in design files too.

## Phase 16: Accessibility checks and annotations

Planned after Phases 17–19. In a project, its results also go into design pull requests (Part E's "Later" list).

- **Annotations** on layers: alt text for images, accessible labels for icon-only buttons, heading levels, and focus order. They show in the Inspect panel.
- **Check accessibility** for a frame, like eBay's Include plugin: a list of issues with the reason for each, such as text contrast below AA (using `contrast.js`), tap targets under 44×44 or 48×48, very small text, or images with no alt text.
- Component-level guidance (keyboard behavior, roles) in the component's description or a new field.
- **What shipped:** annotations in `node.a11y` (`src/a11y.js`): alt text or decorative for images and icons, an
  accessible label, a role, a heading level for text, and a place in the focus order. They're edited in a new
  **Accessibility** block in the Inspect panel, which also shows what they mean in HTML (`alt`, `aria-label`,
  `<h2>`, `role`). An instance uses its main component's annotations unless it sets its own, and the layers
  inside an instance can be annotated per instance (an override). A layer's role is its own, else its
  component's docs, else a guess from the component's name ("Icon button" is a button). **Check
  accessibility…** (main menu, or the Inspect block) checks the selected frames or the whole page:
  - text contrast below AA (disabled states are exempt, as WCAG says);
  - controls under 24×24 (an error) or under 44×44 / 48×48 (a warning; iOS or Material);
  - text under 12px;
  - images without alt text that aren't decorative;
  - controls with no text and no label;
  - headings that skip a level;
  - focus order numbers used twice.

  Each kind gives its WCAG reason. Copies of one component layer show once, with a count, and can be selected
  or annotated. Component docs gain a **role** and **keyboard and screen readers** guidance, shown in Assets,
  Inspect and the documentation page. A component's "Accessibility checked" readiness passes when both are
  written and the check finds no errors in it, or when someone confirms it by hand. In a project, **Propose
  change** runs the check on the changed components and pages, saves the result in the changeset, and the pull
  request body gets an **Accessibility** section. Verified on `examples/css-app`: the Danger button's white label
  on `#EF4343` is 3.78:1 (an error, on both Settings frames and on the library's Danger Default and Focus
  variants; its darker Hover passes), and the 32px buttons and 42px inputs are under 44×44. Annotating a Button
  instance with a label and a focus order shows `aria-label` in Inspect, and the same focus number on two buttons
  is reported. Writing Button's role and keyboard docs doesn't make it ready, because of the Danger contrast.

## Phase 17: Design system use report

The **token audit** (done, `audit.js`) already finds one-off values and deprecated uses in the open file; this phase measures across files.

Like Pinterest's FigStats, measured across every design file in this browser (in a project, the project's design files):

- the share of layers that come from library components
- the share of colors, type and spacing that use tokens rather than one-off values
- the most-used components and tokens, and those nobody uses
- per file and overall, with a way to limit it to recently edited files or pages marked as handoff
- **What shipped:** `src/use-report.js` (pure: it measures documents as Sigma opens them, so the files home and the
  command line agree). Component share: instances against all layers on pages outside component definitions (an
  instance counts once). Token share: every color (fills, strokes), type, spacing (padding, and a gap between two
  or more layers), radius and shadow value bound to a token against all of them, in components and on pages,
  leaving out layers inside instances; a value bound to a token counts even though project files leave its number
  out. Most-used components (by set) and tokens; components with no instance anywhere; tokens nobody binds and no
  token points at. In the GUI, a **Report** section on the files home (the project's design files, or this
  browser's), with filters for files edited in the last 7, 30 or 90 days and for pages marked for handoff (a new
  **Mark for handoff** in a page's right-click menu; `"handoff": true` in the file format). On the command line,
  `sigma-design report [--days N] [--handoff] [--json]`. Verified on `examples/css-app`: 29% of the pages' layers are
  library components (18 instances of 62 layers) and 85% of values use tokens (the library 74%: the Input's padding
  includes its border), Button, Card and Input are used, and the two motion tokens aren't; with the Projects page
  marked for handoff, 37% and 100%, the same in the GUI and on the command line.

## Phase 18: Running the system

From Figma's "Operations" guides on designsystems.com. These matter once other designers and developers rely on Sigma's libraries, so they come with or after Phase 15, not before. (Deprecation and the token audit were done earlier, while finalizing the tokens.)

- **Component matrix:** an overview of every component in a library with a status (Draft, In review, Ready, Deprecated) and a readiness checklist ("definition of ready"): named, purpose written, variants and states defined, tokens applied, breakpoint behavior, documented, accessibility checked, code linked. The matrix shows where each component stands and where work is stuck.
- **Component docs:** beyond one description: the purpose first (what it's for and what it isn't), usage guidance, do and don't examples (linked frames), and a link to the component's code (with Phase 15's code names). Shown in Assets, the playground and the Inspect panel.
- **Changelog:** one "What's new" history per library, from publish notes and the automatic list of changes, exportable as Markdown to start a newsletter or release notes.
- **Documentation site:** generate a page from a library's tokens and components to share. Sharing it beyond this browser needs the backend from "Real sharing".
- **What shipped:** a status (Draft, In review, Ready; Deprecated wins) and docs on a component or set
  (`src/component-docs.js`): purpose, what it's not for, usage, Do and Don't examples (frames in the file) and a
  code link, edited from **Docs…** in the component's menu, where the status is set too; shown in Assets' tooltip,
  the Design panel, the playground and the Inspect panel. **Component status…** (main menu) is the matrix: every
  component with its status and readiness checklist; Sigma checks the name (not a default one), purpose, variants
  (two or more), tokens (90% of its values, the set's own background left out), docs (usage and a Do or Don't) and
  code (a code name or link), and a person ticks breakpoints, accessibility, and variants for a component with none.
  Each row says what's next and opens the component. **Changelog…** (`src/changelog.js`): in a project, the
  proposals that changed the file with their pull requests and tickets; in the browser, its publishes, each with
  what changed since the one before; copy or download as Markdown, also `sigma-design changelog [--file PATH]`.
  **Export documentation page** (`src/doc-site.js`): one HTML file with each component's variant previews (the same
  SVG as Export), status, docs with Do and Don't previews, variant and component properties with their code names,
  and the tokens it uses per mode with their CSS names. Live sync leaves status and docs out of agent tasks (they
  don't change code). Verified on `examples/css-app`: Button's docs saved to the library file, the matrix shows
  Button at 80% tokens, Input 44% and Card 62%, the changelog lists PR #1 and the proposed "Button says Next", and
  the documentation page shows the ten Button variants and both token collections.

## Phase 19: Visual change review

From Figma's Schema talks ("Taking cues from code": test-driven design and visual regression tests; Zalando on large system updates). Like Phase 18, it matters once library updates reach files you aren't watching.

- **Before and after:** when publishing a library, accepting an update, or comparing with a version in version history, show each affected component (and, in a design file, the frames that use it) rendered before and after, side by side.
- **Highlight differences:** an overlay that marks what changed, like a blend-mode diff of the two renders, so small shifts in spacing, color or size stand out.
- **What it touched:** the number of instances and files affected, linked to them, next to the existing text summary ("changed: button/primary/background").
- Built on what's there: renders come from `buildSVG`, versions from the version history, and library updates already know which components and tokens changed.
- **What shipped:** `src/visual-review.js`. Every top-level layer, every component variant (a set's one by one)
  and every library component is rendered as it is and as it would be, in a copy of the file
  (`store.withDocument`: swapped in, laid out like an opened file, text measured, then put back; nothing is
  emitted, saved or undone). Both sides go through the copy, so only the change shows, and renders are taken at
  the origin, so moving a frame isn't a change. Whatever renders differently is listed (Changed, New, Removed)
  with Before, After and Differences: a pixel comparison with the changed pixels in magenta over the faded render,
  a box around them and the share of pixels that changed. Three places: **Compare…** on each card in Review
  updates (this file with the update accepted: the library's components and the frames that use them, and how
  many instances), **Compare…** in Publish components (the last publish against now, and the other files with
  instances of what changed, linked to open them; in a project, its design files), and **Compare with current…**
  in a version's ⋯ menu in the version history. Layers in the open file can be selected from the review.
  Verified on `examples/css-app`: a wider Primary button shows the four Primary variants and Card in the library,
  the four page frames in Acme pages (10 instances), and 12 instances in Acme pages from the library's side; a
  copy of the file compares as "Nothing looks different".

## Later

- ~~**Branching and review**~~ Done where it can be without a backend: in a project, git branches with Propose change and pull requests (Phases 25–26) and design-aware merging; in the browser, **Create branch…** copies a design file that remembers its base, and **Merge into “…”…** merges it back three ways (the main file may have changed too; a page merges layer by layer; on a conflict you choose whose wins), with **Compare…** as the review and a version saved first. Reviews between people in the browser need the backend from "Real sharing".
- **Plugins and automation:** a way to script repetitive work and extend Sigma (*Future is automated*). Large; needs an API design first.
- ~~**Right-to-left layout:**~~ Done: a frame's direction (Auto layout → Direction, `"dir": "rtl"`) applies to everything inside it, like HTML's `dir`: rows start at the right, the counter axis starts at the right edge, padding stays physical, instances follow the frame they're in (their main component stays as it is), dropping into a row and adding auto layout follow the direction, and Inspect writes `direction: rtl`. Language modes on text tokens already cover the strings; text alignment stays as set.


# Part E: Sigma in your codebase

Sigma is **an open design tool for AI-native teams**: teams that already work with agents such as Claude Code or Codex. Sigma installs into any project, whatever its stack. The project's design tokens live in a Sigma Tokens file, its icons in a Sigma Icons file, and its components and pages in Sigma Design files built on those tokens. Agents keep design and code in sync, and design changes reach the codebase as tickets and pull requests that follow the team's own process.

Figma hands designs to developers. Sigma hands them to agents and developers together.

Part E reorders what's left: Part D's Phase 15 (code handoff) and Phase 16 (accessibility) are folded in below, and Part D's other phases follow once Part E's core works.

## Decisions

1. **Audience: AI-native teams.** Sigma is built for teams that use agents in their workflow. Supporting teams that don't use AI is not a goal.
2. **Any codebase, any stack.** Nothing in Sigma is tied to one styling system or framework. Tailwind is one stack among many, not the engine.
3. **Project → Sigma files.** Tokens → a Sigma Tokens file. Icons → a Sigma Icons file. Components → a Sigma Design library file that uses those tokens. Pages and features → Sigma Design files that use library instances, not loose shapes.
4. **The repo is the source of truth.** Sigma files are stored in the project (`.sigma/`) and versioned by git. IndexedDB becomes a local cache. Sharing, review and history come from git, so teams don't need a Sigma backend to collaborate.
5. **Pushing to code is intentional.** Saving stays local and never touches the repo. The designer chooses **Propose change**, picks which edits go in, adds a title and note, and only then does Sigma create the ticket and pull request. Edits can build up over several sessions first.
6. **Sigma follows the team's process.** Branch names, PR templates, labels, reviewers, CODEOWNERS and CI all apply to Sigma's pull requests exactly as to a developer's. Sigma gets no bypass.
7. **Skill-first.** An agent skill is the main way Sigma connects to a project: it reads the codebase, writes Sigma files and writes code back. A CLI or MCP server is optional and built only when teams ask for one (for example, deterministic sync in CI).
8. **AI for translation, saved decisions for consistency.** Agents handle the fuzzy work (understanding a codebase, mapping it to Sigma, writing code patches). Every mapping decision is saved to `sigma.config.json`, so later runs follow it instead of deciding again.
9. **Model-agnostic.** Skill instructions are plain Markdown that Claude Code, Codex or any other agent can follow. Sigma never depends on one AI tool.
10. **Humans approve.** Agents propose; a person reviews and merges. Every agent change says what it did and why, in the PR and in Sigma's version history.
11. **Neutral core.** Sigma's model stays stack-free (DTCG-shaped tokens, plain layer properties). Stack knowledge lives in the skill and in saved mappings, never in the editor.
12. **Open core.** The editor, file format, skills and validator are open source. An optional hosted team service (a GitHub App, sign-in, tracker integrations) can come later for teams that want convenience over self-hosting.
13. **Small teams first, designed for mature teams.** Pilot with two or three small teams. Keep everything config-driven so mature-team needs (permissions, audit, SSO, self-hosted git) can be added without a rewrite.
14. **First integrations: GitHub and Notion.** Other git hosts (GitLab, Bitbucket, Azure DevOps) and trackers (Jira, Linear, GitHub Issues) come after.
15. **The editor stays build-free.** Vanilla ES modules, no build step. Anything that can't run in a browser tab (a future CLI, server or GitHub App) lives in a separate package next to it.
16. **Files link by path; git does the versioning.** In a project, a Sigma Design file points at `.sigma/tokens/core.sigma.json` (and its Sigma Icons and component library files) by path and uses whatever version is checked out. Publish and Accept update are for files kept only in the browser; in a project, a commit is the publish and a pull or checkout is the update.
17. **Derived data stays out of saved files.** What Sigma can rebuild on load isn't written to the repo: instances' children, the values of token-bound properties, positions and sizes set by auto layout and text, and copies of linked files. A token change touches one line in one file.

## Data model

```text
<project>/
  sigma.config.json        # what the skill decided: stack, token sources, paths, naming, integrations
  .sigma/
    tokens/<name>.sigma.json    # Sigma Tokens files
    icons/<name>.sigma.json     # Sigma Icons files
    design/<name>.sigma.json    # Sigma Design files (library and pages)
    changesets/<id>.json        # proposed changes waiting for a PR (local until proposed)
```

```js
// sigma.config.json (written by the skill on first run, edited by people afterwards)
{
  schema: 1,
  stack: { styling: ['css-variables'], framework: 'react' },      // what was detected
  tokens: [{ sigma: '.sigma/tokens/core.sigma.json',
             sources: [{ path: 'src/styles/tokens.css', format: 'css-variables' }],
             naming: 'kebab', modes: { light: ':root', dark: '[data-theme="dark"]' } }],
  icons:  [{ sigma: '.sigma/icons/app.sigma.json', source: 'src/assets/icons', output: 'svg' }],
  components: [{ sigma: '.sigma/design/library.sigma.json', source: 'src/components' }],
  workflow: { git: 'github', tracker: 'notion', branch: 'design/{ticket}-{slug}',
              prTemplate: '.github/pull_request_template.md', labels: ['design'] }
}

// A changeset (Propose change)
{ id, title, note, author, createdAt,
  changes: [{ file: '.sigma/tokens/core.sigma.json', kind: 'token', ids: ['color-primary'] },
            { file: '.sigma/design/library.sigma.json', kind: 'component', ids: ['button'] }],
  status: 'draft' | 'proposed' | 'in-review' | 'changes-requested' | 'merged',
  ticket?: { tracker: 'notion', url }, pr?: { host: 'github', url, number } }
```

Sigma files use stable ids and a diff-friendly layout (sorted keys, one object per line where practical), so pull requests show small, reviewable changes.

## Phases

### Phase 20: File schema

- **Publish the format** of Sigma Tokens, Icons and Design files as a documented JSON schema (`docs/schema/`), generated from or checked against `DOC_VERSION` and the existing migrations.
- **Diff-friendly saving:** stable key order and formatting when a file is written for a repo.
- **Validator:** a dependency-free ES module (`tools/validate.js`) that runs in Node and in the browser. It reuses Sigma's own migrate and normalize code, and reports errors an agent can act on ("token `color-primary` aliases a missing token").
- **Done when:** every sample file validates, a broken file gives clear errors, and the schema docs are enough for an agent to write a valid file without reading Sigma's source.
- **What shipped:** `docs/schema/` (README and JSON Schemas for the three kinds of file and `sigma.config.json`); `src/project-format.js` (save without derived data or defaults, open and rebuild, stable JSON with small objects on one line); `src/validate.js` with `tools/validate.js`; `examples/sample-project/`. Instances keep only their choices; a resized instance keeps its size and `synced`. Saving, opening and saving again gives the same text, and a token change touches one line. SVG is now read without the DOM (`parseXML`), so icons import the same way in Node.

### Phase 21: Project folder storage

- **Open a project:** the files home can open a project's `.sigma/` folder (File System Access API where the browser supports it; import and download otherwise). Files show under the project's name.
- **Save to the folder:** edits autosave to IndexedDB as today. Saving to the project folder writes the diff-friendly format.
- **Reload from disk:** when an agent or a git pull changes a file, Sigma offers to reload it.
- **Done when:** a Sigma file edited by an agent on disk reloads in an open editor, and Sigma's own save produces a minimal git diff.
- **What shipped:** `serve.py --project PATH` (a small project API: list, read, and write with a check that the file didn't change on disk since it was read; localhost only, writes need Sigma's header and are logged) is the main route, and **Open project folder…** (File System Access, Chrome and Edge) the fallback. Project files are kept in the browser like other files (`meta.project`), so autosave, undo and version history work as before; **⌘S** saves to the project. Sigma checks the project every 2 seconds: a changed open file reloads (or asks, if it has unsaved changes), and changed files it uses update in place, keeping its edits. Verified: opening the sample guide, editing one text and saving gives a one-line diff; a token changed on disk shows in the open design file within 2 seconds. The browser-folder route isn't covered by automated tests (it needs a person to pick the folder). (Phase 31 removed the browser-folder route: Sigma runs inside a project rather than opening one.)

### Phase 22: Tokens sync skill (first milestone)

- **The skill** (`skills/sigma-sync/SKILL.md`) with the schema as reference and the validator bundled.
- **Import:** detect the stack, find every token source (CSS variables, Sass, Tailwind config or `@theme`, theme objects, DTCG, hardcoded values), sort them into primitives and semantics, detect modes and brands, turn repeated literals into aliases, and write a Sigma Tokens file. Record every decision in `sigma.config.json`.
- **Write back:** apply token changes from a Sigma Tokens file to the project's own files as minimal edits that keep comments and formatting.
- **Check:** after writing, run the validator, and re-import to confirm the round trip changes nothing.
- **Prove the abstraction** on two very different stacks: plain CSS variables and a JavaScript theme object (MUI or styled-components).
- **Done when:** on a real project, import → edit a token in Sigma → write back gives a correct, minimal diff, and running import again produces no changes.
- **What shipped:** `skills/sigma-sync/SKILL.md` (set up, import, write back, check, report) with `reference/tokens.md` (the DTCG format agents write for other stacks); `tools/sigma.mjs` (`validate`, `check`, `tokens import | diff | write | export`); `src/token-sync.js`. CSS variables are read and written by the tool (modes from selectors, `var()` as references, primitives vs semantic, units and color formats kept); other stacks go through DTCG the agent writes, and write-back is the agent's edit from `tokens diff`, checked by re-importing. Tokens record their code name (`codeSyntax.web`). Proven on two example projects rather than a real one: `examples/css-app` (4 Sigma edits → a 5-line CSS diff, re-import changes nothing) and `examples/mui-app` (3 edits → a 3-line `theme.js` diff, re-import changes nothing). Trying it on a real project is the next check.

### Phase 23: Icons sync

- **Import** the project's icon folder (or icon package) into a Sigma Icons file with groups and names kept.
- **Write back** new and changed icons in the project's format (SVG files, or icon components when that's what the project uses).
- **Done when:** an icon added in Sigma appears in the project in the right format, and one added in the project appears in Sigma on the next sync.
- **What shipped:** `tools/sigma.mjs icons import | diff | write` on `src/icon-sync.js`, and `skills/sigma-sync/reference/icons.md`. SVG folders are read and written by the tool (folders → groups; a changed file is rewritten in its own style, so a stroke-width change is a one-line diff; new files follow the project's style; deleted icons are deleted). Icon components go through SVGs the agent extracts, and the agent writes components from `icons write`. `check` covers icons too. Proven on `examples/css-app` (SVG files, both directions) and `examples/mui-app` (React icon components: an icon added in Sigma became `Plus.jsx` in the project's style).

### Phase 24: Code handoff (Part D, Phase 15)

Unchanged from Phase 15 above: code names per platform for tokens, components and properties, and the **Inspect** panel. Code names are what let agents map Sigma components to code components in Phases 28–30, so this comes before them. The skill fills in code names during import.

- **What shipped:** the **Inspect** tab (CSS with token variables, tokens used with values and per-platform code names, instance usage as JSX, the component API with editable code names, copy buttons); token code names in the token inspector (`codeSyntax` web, iOS, Android, with defaults from the path); `codeName` on components and properties and `codeNames` for variant properties (`src/code-names.js`, `src/inspect.js`). Export CSS uses a token's CSS code name. Code targets beyond CSS and JSX usage (SwiftUI, Compose) are still open; the iOS and Android names are there for them.

### Phase 25: Propose change

- **Changesets in the editor:** a **Propose change** action lists edits since the last proposal, grouped by token, icon, component and page. The designer picks what to include and writes a title and note.
- **Before and after:** each changed component and page is rendered before and after (from `buildSVG` and version history), for the ticket and PR.
- **Done when:** a designer can split a session's edits into two changesets, and each is saved under `.sigma/changesets/` with its renders.
- **What shipped:** `src/changesets.js` (changes as items: tokens, icons, components, pages' own content, file settings; applying any subset onto the base, in place), the **Propose change** dialog (`src/propose.js`; compared with git HEAD through the server's new `GET /api/project/base`, or the disk in a browser-opened folder), renders of components, pages and icons before and after, the proposals list in the Project section, and `tools/sigma.mjs changeset list | show | apply | status`. Verified on `examples/css-app`: one session's three edits became two changesets, and applying each onto HEAD in its own worktree gave exactly its own diff (2 lines for the token; the button label and the new page for the other).

### Phase 26: Team workflow (GitHub and Notion)

- **Ticket:** the skill creates a Notion ticket from the changeset: title, note, renders, and what changed.
- **Branch and PR:** the skill creates a branch named by `workflow.branch`, writes the code changes (tokens and icons from Phases 22–23; components from Phase 30) and the Sigma files, and opens a draft PR using the repo's template, linked to the ticket.
- **Status in Sigma:** each changeset shows Proposed, In review, Changes requested or Merged. On merge the ticket moves to Done.
- **Done when:** on a real repo, a proposed token change becomes a Notion ticket and a GitHub PR that passes the team's CI, and Sigma shows it as merged after merge.
- **What shipped (not yet run for real):** `skills/sigma-sync/reference/workflow.md` and `tools/sigma.mjs changeset branch | prepare | pr-body | ticket | sync`; statuses in the Project section. Dry run on `examples/css-app` (local only): `prepare` into a worktree on `design/darker-hover-for-buttons` gave the token change in the Sigma file and in `tokens.css` (`#2741d9`, plus the dark theme keeping its reference) and passed `check`; the PR body and ticket text read well. **Run for real since:** a design proposal became a GitHub pull request ([#1](https://github.com/liwanagtan/Sigma-Design/pull/1): tighter buttons and a Secondary variant, from `changeset prepare` in a worktree), was merged, and `changeset sync` set it to Merged in Sigma. The repository now has CI (`.github/workflows/ci.yml`: Node tests on Node 20 and 22, the in-browser tests headlessly in Chromium, `sigma-design check` on every example project), and pull requests pass it ([#3](https://github.com/liwanagtan/Sigma-Design/pull/3)). Then the whole flow with GitHub Issues as the tracker: the waiting proposal "Darker hover for buttons" got its ticket ([#4](https://github.com/liwanagtan/Sigma-Design/issues/4), from `changeset ticket --tracker github`), a branch prepared in a worktree (`--accent-hover` `#2741d9` in the light theme; Sigma added the dark theme's own `var(--color-blue-600)`, since the code had relied on the light value), and a draft pull request ([#5](https://github.com/liwanagtan/Sigma-Design/pull/5)) that passed CI, was merged and closed the ticket; `changeset sync` set the proposal to Merged. A Notion ticket works the same way through `changeset ticket` once a Notion connection is available.

### Phase 27: Comments

- **Comments on layers,** stored in the Sigma file, so PR review feedback can point at the exact layer it's about.
- **Done when:** a comment added in Sigma shows in the PR's design diff, and resolving it is saved.
- **What shipped:** the comment tool (C), pins that follow their layer, threads (reply, resolve, delete), the Comments tab; `doc.comments` in the file format; comments as changeset items and a "Comments on the design" section in `changeset pr-body`; `tools/sigma.mjs comment list | add | resolve` so agents bring review feedback onto layers; the validator flags comments whose layer is gone. Verified on `examples/css-app`: a comment made in Sigma and a reviewer's comment added from the command line (which Sigma reloaded) both appeared in a proposal's PR body, and resolving was saved in the file. Sigma also checks the project as soon as its tab is visible again.

### Phase 28: Component library onboarding

- **The skill builds a library file** from the project's components: it renders each one in a headless browser (Storybook stories when the project has them), captures the layout as auto-layout frames, binds values to the Sigma tokens, and turns props into variants and component properties with code names.
- **Check:** render the Sigma component and compare it with the real render; fix differences before handing off.
- **Interactive states** (hover, focus, pressed, disabled) become a standard variant property, so states map the same way in every project.
- **Done when:** a small real library (buttons, inputs, cards) arrives in Sigma as components that look like their code versions and use the project's tokens.
- **What shipped:** `tools/capture/capture.js` (runs in the page rendering the component: boxes, computed and authored CSS with its `var()` references, text, SVG; states applied from the CSS's `:hover`/`:focus-visible`/`:active` rules or `disabled`, transitions off); `.sigma/captures/manifest.json` (variants with a standard `State` property, text/boolean/icon/instance properties, nested components, code names); `tools/sigma.mjs library build` (flex → auto layout, stacked blocks → columns, nesting unevenly spaced ones, hug/fill inferred, borders counted into padding, `var(--x)` bound to tokens by code name, matching SVGs → icon layers, notes for everything approximated; rebuilds in place); `tools/capture/compare.html` (lays the library out in Sigma and compares every layer with its capture). Verified on `examples/css-app`: Button (Primary/Danger × Default/Hover/Focus/Disabled), Input (Default/Hover) and Card (with a Button instance) built from captures, and all 11 matched the code after fixing what the compare found (transitions, text boxes, borders, hug sizing, card margins). The skill's steps are in `skills/sigma-sync/reference/components.md`.

### Phase 29: Page onboarding

- **The skill builds page files** by visiting the app's routes, capturing each page, and rebuilding it from library instances (not loose shapes), one frame per page and breakpoint captured.
- **Done when:** a few real pages arrive in Sigma made mostly of library instances, and the unmatched parts are listed for review.
- **What shipped:** `match` rules in the captures' manifest (a selector per component, selectors per variant value, and where each property's value is: `text`, `has:`, `icon:`); `sigmaCapturePage(route, { width, match })` in `tools/capture/capture.js` (the route in a same-origin frame at the breakpoint's width, each element listing the selectors it matches); `.sigma/captures/pages.json` (routes and breakpoints); `tools/sigma.mjs pages build` (a Sigma page per route, a frame per breakpoint; matched elements become instances with their variant and property values, components inside them set through overrides, sizes kept only where they differ from the main component; `<img>` icons become icon layers; everything not from the library listed per frame); the compare page compares pages too. Fixed on the way: auto layout now re-runs when a text re-wraps after its width changed (a hugging group above it kept the old height). Verified on `examples/css-app`, which now has real pages built from shared components: Projects and Settings at 1280 and 375 wide arrive as 5 and 4 library instances each, with the header and the settings panel listed as not from the library, and all 4 frames match the code. The skill's steps are in `skills/sigma-sync/reference/pages.md`.

### Phase 30: Design to code for components

- **Structured changes** (a token swap, a new variant, a changed property default) are written as exact code edits.
- **Visual changes** (spacing, order, new layers) go to the agent with the component's design diff and its source; it writes a patch, renders the result and compares it with the Sigma design before proposing.
- **Done when:** a padding change and a new variant made in Sigma become a correct PR on a real component.
- **What shipped:** `tools/sigma.mjs components diff` (a library component's design diff since a revision, in CSS terms, with the plan) and `components write`, also run by `changeset prepare`: values on a component's root (background, padding, gap, radius, opacity, shadow, border, inherited text color and font) are set in the CSS rule for exactly the variants that changed (the component's, a variant value's or a state's selector, from the manifest's `match`), as one-value edits that keep the file as it is (`src/css-rules.js`); a new variant value gets a rule named like its siblings' with what the cascade doesn't already give, and the manifest learns its selector and captures; property defaults are edited where the source declares them. The rest is listed for the agent, which recaptures (`sigmaCaptureAll`, from each capture's `element`) and compares; the compare now checks text colors and backgrounds too. Pull request bodies list each component's design diff. Fixed on the way: `library build` and `pages build` write files exactly as Sigma saves them (a Sigma save changes nothing), duplicating a variant adds a variant (it made an instance), and nested instances' overrides are keyed by their component's name. Verified on `examples/css-app`: in Sigma, buttons got 16px side padding and a new Secondary variant (Default, Hover), proposed with Propose change; `changeset prepare` wrote `padding: var(--space-2) 16px` and the `.button--secondary` rules, the agent made `Button` accept `variant: 'secondary'`, and the recaptured code matched the design, 13 of 13. The branch `design/tighter-buttons-and-a-secondary-button` became a real pull request ([liwanagtan/Sigma-Design#1](https://github.com/liwanagtan/Sigma-Design/pull/1)), rebased on `main` after a danger-hover fix to the same library file (keeping both changes, and checked again: 13 of 13), merged, and `changeset sync` set the proposal to Merged. The skill's steps are in `skills/sigma-sync/reference/design-to-code.md`.

### Later

- ~~**Responsive breakpoints:**~~ Done: an auto layout frame's breakpoints (Auto layout → Breakpoints, `layout.breakpoints`) change its direction, gap, padding and alignment at a width or narrower, the narrowest that fits winning; instances copy them, so a component reflows when resized; a breakpoint can also hide some of the frame's layers at that width (the eye button on its row; derived as it lays out, so a layer's own visibility is never changed); Inspect writes them as `@media` (a screen) or `@container` (a frame inside one), and live sync's component diffs include them.
- ~~**Render parity:**~~ Done: `tools/capture/parity.html` captures every component library in `sigma.config.json` from its components page and compares Sigma's layout of each (and its pages) with them; `node tools/test/run-render-parity.mjs <project>` runs it headless, and CI runs it on `examples/css-app`, so drift fails the build.
- ~~**Accessibility checks**~~ Done (Part D, Phase 16), and in the PR: Propose change runs the check, and the pull request body lists what it found.
- **More integrations:** GitHub Issues, GitLab (merge requests with `glab`, and issues), Azure DevOps pull requests (`az repos`), Bitbucket pull requests (its API, with a token from `BITBUCKET_TOKEN`), Linear and Jira are done (`workflow.git`, `workflow.tracker`).
- ~~**CLI and MCP server**~~ Done: the command line (`npx sigma-design …`, Phases 22–35) runs every sync step, CI runs `check` and render parity, and `npx sigma-design mcp` serves the same steps as MCP tools for agents without a terminal (`tools/mcp.mjs`).
- **Hosted team service:** a GitHub App so designers without git can propose changes, plus sign-in, permissions and audit logs for mature teams.
- ~~**Design-aware merging**~~ Done: `npx sigma-design merge-driver install` sets git's merge driver for `*.sigma.json`: their changes go onto ours token by token, icon by icon, component by component, and a page's top-level layers one by one; an item both sides changed differently keeps ours, is listed, and stops the merge for a person to check in Sigma.
- ~~**Monorepos and shared packages**~~ Done: `packages` in `sigma.config.json` names design system packages whose `.sigma/` files the app's files link (`node_modules/<package>/.sigma/…`, through workspace links too), at the version each app has installed; they're listed with their package and version and are read-only (the server, the command line and the editor refuse to write them). Publishing a package's Sigma files is the package's own release.
- ~~**AI data policy:**~~ Done: `docs/data-and-ai.md`. Sigma calls no model; teams choose their model or provider by choosing their coding agent, and the doc says what the agent reads and what leaves through the workflow.

## Open source

- **What's open:** the editor, the file schema, the skills and the validator: anyone can read, use and change them.
- **License (decided):** everyone can use Sigma, change it and build with it, as long as they **don't sell Sigma itself as it is** and they **credit Sigma** (attribution). The fitting license is **Apache 2.0 with the Commons Clause**: Apache 2.0 requires keeping Sigma's `NOTICE` file (the credit) in any copy or derived work, and the Commons Clause forbids selling the software itself. With that restriction it's *source-available* rather than OSI "open source", so say "source-available" (or "free to use") where the difference matters. Done: `LICENSE` (the Commons Clause, then the Apache License 2.0), `NOTICE` (the credit, and the third-party licenses, which the Commons Clause doesn't change: Lucide's icons are ISC), `"license": "SEE LICENSE IN LICENSE"` in `package.json` (the npm package ships both files), and the README and `CONTRIBUTING.md` say so. Worth a lawyer's look before publishing to npm.
- **Figma:** Sigma is its own design tool, inspired by Figma; it isn't reverse-engineered from Figma and uses none of its code, assets or file format. Comparisons to Figma in the docs only help people who know it.
- **Before going public:** ~~a CONTRIBUTING guide~~ (done: `CONTRIBUTING.md`), ~~the schema docs from Phase 20~~ (done: `docs/schema/README.md`), and ~~a check that the name Sigma and the positioning don't lean on Figma's trademarks~~ (done as a project check, not legal advice: the README's opening line called Sigma "a Figma-style design canvas" and the npm keywords had `figma-alternative`; both now describe Sigma on its own terms. What's left are factual comparisons that help people coming from Figma ("Sigma's name for Figma's variables", "works the way it does in Figma") and code comments. No Figma logos, icons or assets are used).

## Risks and open questions

- ~~**Agent consistency:**~~ Addressed: the steps agents repeat are code now (`npx sigma-design` commands, adapters that run without an agent, the MCP server), and CI checks the result (`check`, render parity).
- ~~**Rendering drift:**~~ Addressed: Check against code (Phase 35) and render parity in CI compare Sigma's layout with the code's render.
- **Scope:** Phases 28–30 are each larger than any phase so far. Ship Phases 20–23 on a real project before starting them.
- **Pilot teams:** find two or three after publishing to npm (see "What's next" at the top), and shape the workflow around how they actually work.
- ~~**Derived data in files (Phase 20):**~~ Decided (16 and 17 above): files store a lot that Sigma can rebuild: instances' children, the resolved values of token-bound properties, and copies of the libraries a file links (tokens, components, icons). Written to a repo as-is, one token change rewrites thousands of lines across many files. Diff-friendly saving should leave derived data out and rebuild it on load.
- ~~**Publish vs git (decide before Phase 21):**~~ Decided (16 above): with the repo as the source of truth, a design file could point at `.sigma/tokens/core.sigma.json` by path and use whatever version is checked out, with git doing the versioning. That drops the library copies (most of the point above). Decide what Publish and Accept update mean inside a project.
- ~~**A validator that runs in Node (Phase 20):**~~ Resolved: `src/validate.js` runs in Node and the browser (`npx sigma-design validate | check`). normalizing measures text with a canvas, icon import uses `DOMParser`, and `files.js` needs IndexedDB and BroadcastChannel. The validator needs a DOM-free core (schema, migrations, token resolution); layout and text measurement stay browser-only or are skipped when validating.
- ~~**Project folder access (Phase 21):**~~ Resolved: Sigma's own server reads and writes the project (Phases 21 and 32), in every browser. the File System Access API only works in Chrome and Edge. Sigma already runs from `serve.py` inside a project, so the server could read and write `.sigma/` and tell the editor when an agent or a `git pull` changes a file. That works in every browser and keeps the editor build-free; the browser API becomes the fallback.


# Part F: Sigma inside your project

Sigma installs into an existing project the way Storybook does: one command, a dev dependency, its config in
the repo, and a script that runs it beside the app. It works on the project's real design system: its token
files, its icons and its components. Unlike Storybook, it isn't only a showcase: you design pages and
change components, tokens and icons in the GUI, and the code follows. Sigma doesn't work with Storybook; it
is its own tool of that kind.

Sigma also stays a **standalone design tool**: without a project, it works as it always has, with files in
the browser.

## Decisions

1. **Code is the source of truth for tokens and icons.** While Sigma runs in a project, it watches the code
   and keeps its Sigma Tokens and Sigma Icons files in step by itself (no import step), and saving in Sigma
   writes the code directly, as exact edits. Designs (pages, component layouts) live in `.sigma/` files,
   since code can't hold them. All `.sigma/` files stay committed, so agents and diffs work without Sigma
   running.
2. **Installed as an npm package, `sigma-design`,** with a Node command line: `npx sigma-design init` once, then
   `npm run sigma` (a script `init` adds, running `sigma-design dev`). The project server moves from `serve.py`
   to Node; projects in other languages run it with `npx`. (`sigma` on npm is sigma.js, a graph library, so
   the package and its command are `sigma-design`.) Sigma runs inside the project it was started in; it
   doesn't open projects itself.
3. **No Storybook integration.** Sigma renders the project's components itself.
4. **Standalone stays first-class:** a design tool on its own, with files in the browser.
5. **Two speeds of change:** *direct* (save, and the working copy's code changes; the running app reloads; it
   shows in `git diff`) and *propose* (a ticket and a pull request, for review or for designers who don't use
   git).
6. **Adapters instead of stack support.** Sigma reads and writes CSS variables and SVG icons itself. For any
   other stack (Tailwind, a JS theme, SCSS, icon components…), the agent writes a small adapter once, at
   setup, committed in the project (`.sigma/adapters/tokens.mjs`, `icons.mjs`): `read()` the project's
   tokens (or icons) as DTCG (or SVG), and `write(changes)` to apply Sigma's changes as minimal edits. From
   then on Sigma runs the adapter itself: fast, the same every time, no AI in the loop, and reviewable like
   any code. Every write is checked by reading back: what the adapter reads after writing must be what Sigma
   has. When an adapter can't handle a change (a new token file, a restructured theme), Sigma says so and the
   agent updates the adapter.
7. **Setup teaches the project's agents.** The first setup writes **rules** (a marked Sigma section in the
   repo's agent instructions: `AGENTS.md`, `CLAUDE.md`, Cursor or Copilot rules, whichever it has; `AGENTS.md`
   if none) and **project skills** (`.claude/skills/sigma-*`), so every agent in the repo knows the design
   system has a Sigma side. Project skills hold only this project's facts and point to the general skill
   shipped (and versioned) with the package, so they don't go stale; values stay in `sigma.config.json`, not
   copied into prose; re-running setup replaces only Sigma's marked parts, and shows the change first.

## Phases

### Phase 31: Project mode in the editor

- **The sections are the project's:** in a project, Sigma Tokens, Sigma Design and Sigma Icons list the
  project's files (`.sigma/tokens/`, `.sigma/design/`, `.sigma/icons/`), and new files go into the project.
  The separate Project section goes away.
- **Proposals** get their own section (project mode only): Propose change, and each proposal with its
  status and its pull request and ticket links.
- **The project at the top of the sidebar:** its name and whether it's connected.
- **Browser-only files** are hidden in project mode, with a one-time **Move into project…** for any that
  exist. Recents lists project files; Welcome to Sigma stays (its samples are never saved); the Archive is
  hidden (git is the history of project files).
- **Standalone** is unchanged.
- **Done when:** with `examples/css-app` connected, its tokens, icons, library and pages appear under their
  kinds, proposals under Proposals, and Sigma without a project looks as it does today.
- **What shipped:** in a project (`src/home.js`), the sidebar starts with the project's name and whether it's
  connected; Recents, Sigma Design, Sigma Tokens and Sigma Icons list the project's files (sorted and searched
  like browser files, with "Edited … ago" once opened); new files go into the project (and can't be made while
  it's offline); **Proposals** has Propose change and every proposal with its status and pull request and
  ticket links; Import, drops and the Archive are hidden. Browser-only files get a notice with **Move into
  project…** (a dialog to pick them; token and icon files are moved first, and links between moved files
  point at their new paths; the browser copies go to the Archive) or **Not now** (remembered per project).
  Standalone is unchanged, except that **Open project folder…** (Phase 21's in-browser folder picking, Chrome
  and Edge) is gone: Sigma runs inside a project, it doesn't open one. Verified on
  `examples/css-app`: its four files under their kinds, PR #1's proposal under Proposals as Merged, and a
  browser token file and a design file linked to it moved in with the link kept.

### Phase 32: Install like a dev tool (npm package `sigma-design`)

- **The package:** Sigma's editor, the project server in Node (replacing `serve.py` for projects, with the same
  API and safety rules) and `tools/sigma.mjs`, as `sigma-design` on npm. Nothing else to install.
- **`npx sigma-design init`** in a project: adds the dev dependency and an `npm run sigma` script, creates
  `sigma.config.json` and `.sigma/`, and for CSS variables and SVG icons imports them itself. Anything else
  is handed to the agent (Phase 33).
- **`sigma-design dev`** (`npm run sigma`): starts the server on the project in the current folder and opens
  Sigma on it.
- **Done when:** in a fresh copy of a real project using CSS variables, `npx sigma-design init` then
  `npm run sigma` opens Sigma on its tokens and icons, with nothing else installed. (Publishing to npm needs
  the owner's account: until then, it's installed from the repo or a packed tarball.)
- **What shipped:** `package.json` (`sigma-design` 0.1.0, no dependencies, Node 18+; the package holds the
  editor, `icon-sets/`, the tools, the skill and the schema docs, not tests or examples). `bin/sigma-design.mjs`:
  `init`, `dev` (Sigma on the project in the current folder, on a free port from 6200, opening the browser),
  `standalone`, and every sync command (`check`, `tokens …`, `changeset …`). `tools/server.mjs` replaces
  `serve.py` (deleted): the same API and answers (mtimes in nanoseconds), localhost only, writes only with
  Sigma's header, never over a file changed since it was read, only `.sigma/` files and `sigma.config.json` and
  never through a link leading outside the project, atomic writes, every write logged. `tools/init.mjs`: CSS
  variables on `:root` with their modes (other selectors or media queries that override them; component-scoped
  variables aren't modes), DTCG `tokens.json`, SVG icon folders, the framework and styling, git's base branch;
  Tailwind, JS/TS themes, SCSS, Less and icon components are reported for the agent; `package.json` gets the
  dev dependency and the `sigma` script in its own indentation; nothing that's there is overwritten. In
  projects Sigma opens on the project's files (not the Welcome guide), says when its server stopped and how to
  start it again, and its messages name `npm run sigma`. Node tests for the server and `init`
  (`npm run test:node`, 14). Fixed on the way: `src/store.js` read the browser's storage when loaded, which
  newer Node versions warn about in every command. Verified with `npm pack`: a copy of `examples/css-app`
  without its Sigma files, with a `package.json` and git, installed the tarball; `npx sigma-design init`
  found 27 tokens (Light and Dark) and 7 icons, imported them and passed `check`; `npm run sigma` opened Sigma
  on the project; a token changed in Sigma and saved became a one-line CSS diff with `sigma-design tokens
  write`. A copy of `examples/mui-app` was handed to the agent (its theme and icon components). Not published
  to npm yet (it needs the owner's account).

### Phase 33: Setup by the agent: adapters, rules and project skills

- **Adapters** (decision 6): for a stack Sigma doesn't read itself, the setup skill writes
  `.sigma/adapters/tokens.mjs` (and `icons.mjs` when icons aren't SVG files) and proves it: reading gives the
  tokens Sigma imports, and writing a change then reading back gives the same change, with a minimal diff.
  `tools/sigma.mjs` (and Sigma) use the adapter wherever they'd use the built-in CSS reader and writer.
- **Rules** (decision 7): a marked Sigma section in the repo's agent instructions: where the design system
  lives, code is the truth for tokens and icons, `sigma check` after changing them, never hand-edit `.sigma/`
  files, keep the components page up to date when adding or changing a component, use the project skills.
- **Project skills:** `sigma-tokens` (syncing through this project's adapter, and fixing it), `sigma-components`
  (where components live, how they're styled, how variants map to props, how they're rendered for capture),
  `sigma-propose` (this team's tracker, branch names, PR template and checks), `sigma-design-to-code` (this
  project's conventions for component changes). Each points to the general skill in the package.
- **Done when:** `examples/mui-app` (a JS theme) gets an adapter that round-trips its tokens, a token changed
  in Sigma is written by the adapter (no agent) as a one-line diff, and a fresh agent session in the repo
  follows the rules and skills without being told about Sigma.
- **What shipped:** adapters (`tools/lib/adapters.mjs`, contract in `skills/sigma-sync/reference/adapters.md`):
  an entry's `adapter` module is used by `tokens import`, `tokens write`, `icons import`, `icons write` and
  `check`; it gets a context for file access (so Sigma knows, and can undo, what it changed) and Sigma's own
  value helpers (color formats, CSS values, icon SVG); every write is read back, and one that doesn't read back
  the same, or that the adapter refuses, is put back with the reason. `sigma-design adapter test` proves one
  (reads what Sigma has; one color and one number, or one icon, written, read back, small diff, all put back).
  `sigma-design agents` (`tools/agents.mjs`, also run by `init`): the Sigma section in the repo's agent
  instructions (`AGENTS.md`, `CLAUDE.md`, Copilot, Cursor; `AGENTS.md` and a `CLAUDE.md` including it when
  there are none) and four project skills, regenerated between markers so the team's text and each skill's
  Project notes stay. The skill's setup now writes adapters instead of one-off extractions. Fixed on the way:
  DTCG files without sets kept no code names on import; a project file's header showed Publish until
  something refreshed it. Verified on `examples/mui-app`: adapters for its MUI theme and React icon components
  pass `adapter test`; a color changed in Sigma's editor became a one-line edit in `src/theme.js` (the file's
  lowercase hex) with no agent; and a fresh headless Claude Code session in a copy of the project (Sigma
  installed from the packed tarball, no mention of Sigma in its README or source), asked only to "change the
  light theme's primary blue to #1f4ae0", edited `src/theme.js`, ran `npx sigma-design tokens import` and
  `check` on its own (one line in each file), and pointed out that `primary.dark` was now lighter than `main`.

### Phase 34: Live sync while Sigma runs

- **Code → Sigma:** Sigma watches the token and icon sources; when they change (an edit, a `git pull`), its
  Sigma Tokens and Sigma Icons files update by themselves, keeping ids and order.
- **Sigma → code:** saving a token or icon change writes the code directly, through the built-in writers or
  the project's adapter; saving a library component writes the exact part of its code (Phase 30), and lists
  the rest for an agent or a proposal.
- **Done when:** changing a token in Sigma reloads the running app with the new value, and editing the token
  source updates Sigma, with no command run in between, for both a CSS-variables project and an adapter one.
- **What shipped:** `tools/live-sync.mjs`, started by `sigma-design dev` (`--no-sync` turns it off). Code →
  Sigma: the sources of every tokens and icons entry are checked every 0.8 s (modification times, so it works
  the same on every OS and with editors that replace files) and imported when they change; the open file
  reloads as for any change on disk. Sigma → code: the server's save hook gives live sync the file's previous
  text, and `tokens write` / `icons write --base-file` write only what that save changed (so a code edit Sigma
  hasn't read yet is never written over), through the built-in writers or the adapter; the save's reply
  carries what was written, and the save message says so ("Saved to … · wrote src/styles/tokens.css"), or why
  not. One operation at a time; Sigma's own writes don't trigger a second import. Node tests (3) cover both
  directions, icons, and an unread code edit surviving a save. Verified in the browser: on `examples/css-app`,
  `color/blue/500` changed and saved in the editor became a one-line edit in `tokens.css` and the app's
  buttons turned `rgb(47, 75, 224)` (a dev server like Vite reloads by itself; the example is static, so its
  page was reloaded), and editing `--radius-md` in the CSS showed 12 in the open editor a second later; on
  `examples/mui-app`, a Dark value saved in Sigma became a one-line edit in `src/theme.js` through the
  adapter, and an edit in `theme.js` reached Sigma through it.

### Phase 35: Sigma renders the project's components

- **Sigma's own component pages:** setup creates a page that renders each component in each variant and
  state, built with the project's own tooling, like `examples/css-app/components.html`; Sigma serves the
  app alongside itself (same origin), so it can capture and compare without manual steps.
- **Library onboarding and checks run from the GUI:** capture, build the library, compare, and after a
  component change, recapture and compare to confirm the code matches the design.
- **Done when:** in a project with React components, the library builds from Sigma's component pages, and a
  component change made in Sigma is confirmed against the rendered code from inside Sigma.
- **What shipped:** instead of serving the app through Sigma's origin (its `/`, `/src/` and `/api/` would clash with
  Vite's), the project's components page loads a capture **bridge** (`sigma-design/bridge`, `tools/capture/bridge.js`):
  Sigma opens the page (`components[].page`) in a hidden frame and asks for captures by message, which works across
  origins and with any bundler. In the GUI (`src/code-check.js`): **Build from code…** on the home screen for a library
  `sigma.config.json` lists but that isn't built; **Check against code…** in a library's menu (captures every
  component and page, saves them in the project, compares, shows ✓/✗ with the differences) with **Update the library
  from code** (the server's new action endpoint runs `library build`). Live sync now also writes the exact part of
  a library's components' code when it's saved (`components write --base-file`), and the save message says what it
  wrote and what's left for an agent. Fixed on the way: ⌘S in the design editor showed an old "Autosaved"
  message over the real save's. Verified on `examples/react-app` (Vite 8, React 19): `npx sigma-design init` set up
  its tokens; the library built from `sigma.html` with Build from code (12 of 13 at first: the check showed the
  app wasn't loading Inter and the card's button label wasn't in the manifest; after both fixes, 13 of 13); then
  the Badge's side padding changed in Sigma (`--space-2` → `--space-3`), saved, was written to `components.css` by
  live sync (`padding: var(--space-1) var(--space-3)`), and Check against code confirmed it against the app as
  rendered by Vite: 13 of 13, with the badge captured 24px wider than its text.

## Risks and open questions

- ~~**Bundlers (Phase 35):**~~ Resolved: the components page is the app's own, built with its tooling, and loads the capture bridge (Phase 35). rendering components needs the project's build (Vite, webpack, Next). Serving the
  app's dev server through Sigma's origin (a proxy) may be simpler than building pages ourselves.
- **Writing code on save (Phase 34):** direct edits to a working copy should never surprise a developer.
  Edits stay exact and minimal, and Sigma never writes while the code has a conflicting change it hasn't
  read.
- **Adapters (Phase 33):** code an agent writes runs on every save. It stays in the repo and is reviewed like
  any code; Sigma runs it only from the project it's in, checks every write by reading back, and never
  writes outside the token and icon sources the config names.
- **The package name:** `sigma-design` was free on npm when Phase 32 was planned; claim it when the project is finalized (see "What's next" at the top).

# Part G: A working design system

**Optics**: a real design system made in Sigma, to start from and to show what Sigma does. Four working files
of your own (not samples): **Optics Tokens**, **Optics Icons**, **Optics Foundations** and **Optics Components**. They're working files, not pictures of one: every component is built from the tokens, has its
variants, states and properties, and passes Sigma's own checks.

## Phase 36: Optics, a working design system inspired by Polaris

Inspiration: Shopify's Polaris (https://polaris.shopify.com), a mature, well-documented system for admin
interfaces. Its structure and good ideas, not its brand: Optics has its own name and values, and uses no Polaris
assets (Polaris icons are licensed for use in Shopify apps only). Its icons are **Optics Icons**, a Sigma Icons file
made from **Sigma Icons**, the main sample icon file (the whole Lucide set, outline and filled), so Optics doesn't depend on the sample.

- **Optics Tokens** (a Sigma Tokens file), in the shape Polaris uses:
  - primitives: color scales (gray, plus brand, success, critical, warning, caution, info and magic hues, in
    steps from light to dark), spacing on a 4px grid with Polaris-style step names (`space/100` = 4px,
    `space/400` = 16px), font families, sizes, weights and line heights, border radius and width, shadows
    (elevation 100–600), and motion (durations and easings);
  - semantic tokens that point at them, by role and state: backgrounds and surfaces (`bg/surface`,
    `bg/surface/hover`, `bg/fill/brand`, `bg/fill/critical`…), text (`text`, `text/secondary`, `text/disabled`,
    `text/critical`…), borders, icons, and focus;
  - modes: Light and Dark on the semantic collection;
  - typography tokens for the text styles (heading lg/md/sm, body md/sm, caption), and every token with a code
    name (CSS variables) and a description.
- **Optics Icons** (a Sigma Icons file): every icon of the Sigma Icons sample, with Optics' own ids and Lucide's
  license and credit, published so the Optics design files use it.
- **Optics Foundations** (a Sigma Design file using Optics Tokens and Optics Icons): color (each scale and the
  semantic roles, in both modes, with their contrast), typography (every text style), spacing, radius, elevation,
  motion and icons, each as labelled specimens built from the tokens themselves.
- **Optics Components** (a Sigma Design file using Optics Tokens and Optics Icons, published as a component
  library so other files can link it): Button (primary, secondary, tertiary, critical, plain; sizes; with an
  icon; loading), Text field (with label, help text and error), Select, Checkbox, Radio button, Badge (tones),
  Banner (tones), Card, Avatar, Tabs, Modal, Tooltip and Spinner, as component sets with variants, interactive
  states (hover, focus, pressed, disabled) and properties, using auto layout throughout.
- **Working means it passes Sigma's checks:** valid files (the validator, as `check` runs it) with every
  reference resolved; the token audit finds no one-off values; the use report shows tokens on (nearly) every
  value; the accessibility check finds no errors (contrast AA in both modes, 44px targets, labels); each
  component has docs (purpose, usage, Do and Don't, role and keyboard behavior) and is Ready in Component
  status; and Export documentation page makes a complete docs site from Optics Components.
- **Your own files:** made once with Welcome to Sigma, and listed with your other files (Optics Tokens under
  Sigma Tokens, Optics Icons under Sigma Icons, Optics Foundations and Optics Components under Sigma Design). They're saved like any file, so you
  can change them and build on them; **Sigma Tokens ▾ → Add Optics design system** adds a fresh set. A design
  file can link Optics Tokens and Optics Components to build with them.
- **Tests:** browser tests build the three files and run the checks above on them, so a change to Sigma that
  breaks Optics fails CI.
- **Ships with Sigma:** `examples/optics/` holds the four files as a project (`node tools/build-optics.mjs` writes
  them from the same code), so they're in Sigma's repository and npm package, CI checks them like the other
  examples, and `npx sigma-design dev examples/optics` opens them.
- **Done when:** the four files are in your files and open, a new design file can link Optics Tokens and Optics
  Components and build a screen from them, and the checks above pass in CI.
- **What shipped:** `src/optics-tokens.js` builds **Optics Tokens** (242 tokens: Primitives on numbered steps,
  Semantic roles in Light and Dark, 13 text styles; every token named `--optics-…` in CSS) and `src/optics.js`
  builds **Optics Foundations** (pages Color, Typography, Spacing, Radius, Elevation, Motion and Icons, each a
  sheet of specimens made from the tokens, with Light and Dark panels) and **Optics Components** (15 components:
  Button and Icon button in five states, Text field, Select, Checkbox, Radio button, Badge, Banner, Card, Avatar,
  Tab and Tabs, Modal, Tooltip and Spinner, with properties, nested instances and docs, all Ready; a Usage page
  with a Do and a Don't for each). Welcome to Sigma (version 7) makes them once per browser as your own files
  (saved like any other, so they're yours to change), and
  Sigma Tokens ▾ → Add Optics design system adds a fresh set; Optics Components is published as v1 so other files
  can link it, and the guide's first page says where Optics is. Icons are **Optics Icons**: `opticsIconsDocument` copies Sigma Icons' 1,895 icons (all 1,877 Lucide outline icons and 18 filled shapes) with Optics ids (`optics-plus`) and Lucide's license, published as v1; both Optics design files link it, and Optics Foundations' Icons page shows up to 12 per group with the group's size. Sigma Icons, the Welcome to Sigma sample, is now the whole Lucide set too (the guide's icons keep its groups, Actions, Arrows, Status…, and the rest keep Lucide's categories; the guide is at version 8, and the old 90-icon sample goes to the Archive). `tests/optics.test.js` builds the
  files and checks them: valid in the file format, no one-off values, 99% or more of values from tokens, every
  component Ready, and no accessibility errors in either mode. Also: layouts are placed when the files are built (component sets have fixed
  sizes; the rest are measured, with room to spare, and a test checks nothing overlaps), so they look the same in
  the browser and as project files; `examples/optics/` (built by `tools/build-optics.mjs`) ships them with Sigma and
  passes `check` in CI, and the sample project was rebuilt with the whole Lucide set; and publishing ignores an instance's record of its main's size, so a freshly opened
  Optics Components doesn't show unpublished changes. Verified in the editor: the four files under Sigma Tokens, Sigma Icons and Sigma Design (saved when edited, no sample banner; every icon in both design files resolves from Optics Icons), a new
  file linking Optics Tokens and Optics Components builds a Banner, a Card and a Button that resolve every token
  and icon, and Export documentation page makes a page with all 15 components.

## Phase 37: Optics Components: every Polaris component, a page each

Optics Components grows to every Polaris component: the 50 web components Polaris has today (shopify.dev, App
Home) and the components of the older Polaris React library that aren't web components. Each component gets a
page with the component (every variant and state), its name and purpose, and its usage (a Do and a Don't); an
Overview page lists them all by category.

- **Folded in, as Polaris does:** Icon button into Button (icon only), Radio button into Choice list, Card and
  Legacy card into Section, Tag into Chip (removable), Action list into Menu, Progress bar into Progress, Block,
  Inline and Legacy stack into Stack, Inline grid into Grid, the five Skeletons into one Skeleton.
- **Left out:** App provider and Scrollable (code only: nothing to draw).
- **The 86 components** (the 50 web components, and 36 from the older library):
  - Actions: Button, Button group, Clickable, Clickable chip, Link, Menu, Account connection, Page actions
  - Feedback and status: Badge, Banner, Empty state, Progress, Spinner, Skeleton, Exception list, Inline error
  - Forms: Checkbox, Choice list, Color field, Color picker, Date field, Date picker, Drop zone, Email field,
    Money field, Number field, Password field, Search field, Select, Switch, Text area, Text field, URL field,
    Autocomplete, Combobox, Filters, Index filters, Range slider, Form layout
  - Layout and structure: Box, Divider, Grid, Ordered list, Unordered list, Page, Query container, Section,
    Stack, Table, Bleed, Callout card, Layout, Media card, Description list, Footer help
  - Media and visuals: Avatar, Icon, Image, Thumbnail, Video thumbnail, Keyboard key
  - Overlays: Modal, Popover, Sheet, Tooltip
  - Typography and content: Chip, Heading, Number, Paragraph, Text
  - Lists and tables: Listbox, Option list, Resource item, Resource list, Data table, Index table
  - Navigation: Tabs, Pagination, Navigation, Top bar, Fullscreen bar
  - Utilities: Collapsible, Contextual save bar, App frame (Polaris's Frame), Loading, Toast
- **Same bar as Phase 36:** built from Optics Tokens and Optics Icons, documented and Ready, no one-off values, no
  accessibility errors, nothing overlapping; `examples/optics/` rebuilt.
- **What shipped:** Optics Components has 87 pages: an **Overview** (every component by category, with what it's
  for) and a page per component. Each page is one sheet: the category, name and purpose; the component (a set
  with every variant and state, or a single component, and Tabs also has its Tab); its guidelines (usage, what
  it's not for, keyboard and screen readers); and its usage, a Do and a Don't side by side, picked in its docs.
  The components are built by `src/optics/`, a module per category (content, actions, feedback, forms, layout,
  navigation, lists, overlays and utilities) on shared building blocks (`kit.js`: token-bound layers, variant
  grids, a registry), in dependency order, so the bigger ones are made of the smaller ones' instances: fields
  share one field set (label, input with what goes before and after the value, help text that turns into the
  error), Date picker and Pagination use Button (icon only), Index table uses Index filters, Checkbox, Badge and
  Pagination, and App frame is Top bar, Navigation and Page. Polaris's Frame is **App frame**, since a plain
  “Frame” reads as an unnamed layer. Checkbox gained a Show label property (hidden in tables, where its label
  stays the accessible name), Icon an `iconOf` helper, so examples outside components use Icon instances (icon
  layers belong in main components). The docs editor now offers frames inside an **Examples** frame, and examples
  already picked wherever they are, as Do and Don't examples. `tests/optics.test.js` checks the pages (87, each with its
  component, one Do and one Don't), the Overview's categories, docs, readiness, audit, token share, accessibility
  and that `OPTICS_ICON_NAMES` lists every icon the components use (39). `examples/optics/` was rebuilt (0 errors, 0 warnings);
  files made by an earlier Sigma keep their 15 components, and Sigma Tokens ▾ → Add Optics design system adds the
  new set. Verified in the editor: the Overview, Toast, Tooltip, App frame and Index table pages.

# Part H: Beyond Figma

Features Figma doesn't have, that make Sigma files easier to work in.

## Phase 38: Page groups

A design file's pages can be grouped, so a file with many pages stays easy to find your way around. Optics
Components (87 pages) is the first to use it: its components grouped by category.

- **Model:** a page can belong to a group (`page.group`, the group's name). The pages stay one ordered list, so
  everything that walks `doc.pages` keeps working, and a group's pages stay together: moving a page into a group
  puts it at the group's end. Files without groups are unchanged; the project format and validator carry the field.
- **Pages list:** groups show as headers with their pages under them, collapsible (a chevron and the page
  count); the group of the open page stays open. Ungrouped pages sit between groups, in order. Collapsed groups
  are remembered per person in the browser, not saved in the file.
- **Making and changing groups:** **+** → New page or New group; right-click a page → Move to group ▸ (the groups,
  New group…, Remove from group); right-click a group → Rename, New page in group, Ungroup (keeps the pages),
  Delete group and its pages (asks first). Pages can be dragged to reorder them and into or out of groups, and
  groups can be dragged as a whole. Undo works for all of it.
- **Finding pages:** with more than about a dozen pages, a filter field above the list (matches page and group
  names). Wherever pages are listed by name (the use report's page picker, handoff, comments, the documentation
  export), they read “Group / Page”.
- **Optics:** Optics Components groups its pages by category (the Overview first, ungrouped); `examples/optics/`
  is rebuilt.
- **Guide and docs:** Welcome to Sigma's Canvas basics page shows page groups (the guide's version goes up); the
  README describes them.
- **Done when:** groups can be made, renamed, collapsed, dragged, ungrouped and deleted with undo; they survive
  saving, the project format, branches and merge, and Duplicate; Optics Components opens grouped; tests cover the
  model, the list and the project format.
- **What shipped:** `src/page-groups.js` (pure functions on the pages array: runs of grouped pages, keeping a
  group's pages together, moving pages and groups, renaming, ungrouping, “Group / Page” labels, and the collapsed
  groups per person and file in `localStorage`). Opening a document keeps groups together (`migrateDocument`),
  so a merge or a hand edit can't leave a group split. The pages list (`panels.js`) shows a header per group
  (chevron, name, page count; the group holding the open page reads darker), with its pages indented under it.
  **+** opens New page (in the open page's group, after it) or New group (named in place), a page's menu has
  Move to “…” for each group, Move to new group and Remove from group, and a group's menu has Rename group, New
  page in group, Collapse and Expand all groups, Ungroup and Delete group and its pages. Pages and groups drag
  (a page into a group on its header, or next to a page, joining that page's group; a group never into the
  middle of another), with drop marks, and everything goes through commit, so undo works. More than 12 pages
  show a filter (page and group names; Escape clears it). Pages are listed as “Group / Page” in the Do and
  Don't picker, comments, the audit's toast, visual review and the Assets panel. The validator checks `group`
  (text, or left out) and warns when a group is split; the JSON schema and `docs/schema/README.md` describe it.
  Optics Components groups its 86 component pages by category (the Overview ungrouped, first), and the guide
  (version 9) groups its ten pages into Get started, Design systems and Sample files, with a “Pages and page
  groups” section on Canvas basics; `examples/optics/` and `examples/sample-project/` were rebuilt (0 errors,
  0 warnings). `tests/page-groups.test.js` covers runs, keeping together (on load too), moving pages and groups,
  renaming and ungrouping, the project format, the validator and a branch merge; the Optics test checks its
  groups. Verified in the editor: Optics Components opens grouped; collapsing, Collapse all, the filter, dragging
  a group and a page into a group, Move to new group with naming in place, and undo; the guide's groups and
  Canvas basics page.
