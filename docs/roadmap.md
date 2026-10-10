# Sigma roadmap

Status: **Phases 1–5 done**; next up is Phase 6. Each phase below should fit in one working session. Finish a phase, test it in the browser, commit, then move to the next. Work through the phases in order. **Phase 1 (Files home) is the priority** and doesn't depend on anything else.

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
- **Snapshot undo size.** Every commit snapshots the whole document, and materialized instances make it bigger. Phase 1 moves storage to IndexedDB, which removes the storage limit. The in-memory undo stack can still grow, so cap it by total size, not just by count. Fallback: store instances without children and rebuild them on load, since they're derivable.
- **Cycles.** These can come from nested instances or variable aliases. Both need hard guards in the pipeline, not just in the UI.

## How to resume in a new session

> "Read `docs/roadmap.md` and implement Phase N. Follow the ground rules, test in the browser pane, then commit."

Update the **Status** line at the top and tick the phase off below as you go:

- [x] Phase 1: Files home (priority)
- [x] Phase 2: Foundations
- [x] Phase 3: Components and instances
- [x] Phase 4: Component properties
- [x] Phase 5: Variants
- [ ] Phase 6: Variables (core)
- [ ] Phase 7: Modes
- [ ] Phase 8: Extended collections
- [ ] Phase 9: Integration and polish
