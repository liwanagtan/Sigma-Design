# Sigma

A Figma-style design canvas that runs in the browser. It has no dependencies and no build step: plain ES modules render the document to SVG.

## Run

ES modules need a web server, so opening `index.html` directly won't work. Use the included server, which turns off browser caching so code changes always show up on reload:

```bash
python3 serve.py
```

Automated tests run in the browser: with the server running, open http://localhost:5173/tests/.

Any static server works too (`python3 -m http.server 5173`), but after updating the code you may need a hard reload (⌘⇧R).

Then open http://localhost:5173.

## Features

- **Files home:**
  - two kinds of file: **design files** (a canvas) and **token files** (design tokens only, no canvas)
  - Recents shows both; the **Design files** and **Design tokens** groups show one kind each
  - lists every file saved in this browser, with thumbnails (token files show a palette of their colors) and "Edited … ago"
  - has Recents and All files views, search, sorting, and a grid or list layout
  - lets you rename, duplicate, delete and download files from the card menu, or import `.sigma.json` files by dragging them onto the page
  - gives each file its own link (`#/file/<id>`), so back/forward, bookmarks and "open in new tab" work
- **Infinite canvas:** pan by scrolling or Space-dragging, zoom with ⌘-scroll or pinch, ⇧0 / ⇧1 / ⇧2
- **Tools:** Move (V), Hand (H), Frame (F), Rectangle (R), Ellipse (O), Line (L), Text (T), Place image (⇧⌘K, drag-and-drop or paste)
- **Selection:**
  - click, ⇧-click, marquee, ⌘-click to deep-select
  - double-click or Enter to go inside a group or frame, ⇧Enter for the parent
- **Transform:**
  - resize handles (hold ⇧ to keep proportions, ⌥ to resize from the center)
  - rotate from just outside a corner (hold ⇧ to snap to 15°)
  - smart guides with snapping (hold ⌘ to turn snapping off)
  - pixel-grid snapping
  - hold ⌥ to measure distances
- **Frames** clip their contents. Dragging a layer over a frame moves it inside, and drawing a frame around layers wraps them.
- **Groups:** ⌘G to group, ⇧⌘G to ungroup, ⌥⌘G to frame the selection
- **Auto layout** (⇧A to add, ⌥⇧A to remove):
  - horizontal or vertical flow, a gap (type `Auto` for space-between), padding, and a 3×3 alignment grid
  - ⇧A infers direction, gap and padding from how the layers are already arranged
  - drag children to reorder them (siblings reflow live), or use the arrow keys
  - children can opt out with **Absolute position**
- **Components and instances:**
  - ⌥⌘K turns a frame, or any selection, into a component
  - make instances by duplicating (⌘D), ⌥-dragging or pasting a component, or from the **Assets** tab, where you can click a component or drag it onto the canvas
  - changes to the main component flow to every instance, live
  - an instance can override appearance and text, such as fills, strokes, text and visibility; size and position come from the main component
  - the Instance section in the panel has Go to main component, Reset overrides and Detach (⌥⌘B)
  - a component can never end up containing an instance of itself
  - if a layer in the main component is renamed or removed, its instances show "N overrides no longer apply", with a Clear button
  - **component properties** are defined on the main component: Boolean (show or hide a layer), Text and Instance swap
  - to link a layer, select it inside the main component and use the Component properties section
  - each instance gets a control per property, plus a Swap picker for the component itself
  - **variants:** select components and right-click → **Combine as variants** to make a component set
  - variant names become properties (`Size=Large, State=Hover`); the set's panel renames properties and adds properties or variants
  - instances of a variant get a dropdown per variant property, and overrides carry over when switching
- **Design tokens** (Sigma's name for Figma's variables):
  - **New token file** creates a token file, which opens straight into a full-screen token editor
  - a design file can also keep **local design tokens**; open them from the Σ menu or the panel (with nothing selected)
  - the token editor has search and a type filter
  - click a token to open the inspector: its description, its values per mode, which tokens alias it (click to jump), and how many layers use it
  - color swatches sit on a checkerboard so transparency shows
  - **color tokens carry opacity** (a hex value plus an opacity %); a fill or stroke using the token gets its opacity from it
  - **typography tokens** bundle font family, weight, size, line height and letter spacing, and each part can alias a number or text token
  - a typography token is edited in the inspector, with a live sample
  - in design files, the Text section's **Text style** links a typography token to a text layer; changing any font property by hand detaches it
- **Token libraries:**
  - **Publish…** in a token file creates a numbered version, with optional notes and a summary of what changed
  - in a design file, **Token libraries…** (Σ menu, or the panel with nothing selected) links published token files; the file keeps a copy of the version it accepted
  - when a newer version is published, the design file shows "Token updates available"; **Review** lists added, changed and removed tokens, and you accept when ready
  - **Move to token file…** in the local tokens window sends a file's local tokens to a new or existing token file and links it
  - files from before token libraries move their variables into a linked token file the first time they're opened
- **Export and import:**
  - in a token file's Σ menu, **Export tokens.json** writes the W3C Design Tokens format (DTCG):
    - groups come from `/` in names, and aliases are written `{group.token}`
    - colors use the DTCG color object with alpha, sizes are `{ value, unit: "px" }`, and typography is the composite type
    - each collection × mode is a token set, such as `Color/Dark`, the multi-set layout Tokens Studio and Style Dictionary setups use
    - re-importing a Sigma export rebuilds it exactly, including modes and extended collections
  - **Export CSS variables** writes custom properties: default modes go on `:root`, and each other mode or brand gets a selector such as `[data-color="dark"]` that swaps values on any element
  - **Import tokens.json…** merges tokens into the open token file, matching by name; dropping a `tokens.json` on the home page creates a new token file
  - token types Sigma doesn't support yet, like shadows, are skipped with a note
  - organise color, number, string and boolean variables into collections; use `/` in names to group them
  - each collection has modes (columns), and a cell can alias another variable
  - the ◈ button on a fill, stroke, number field, visibility or text content binds a variable; a bound field shows a purple chip
  - typing a value over a bound field detaches the variable
  - **modes:** for any collection with several modes, the Layer section (or the Page section, with nothing selected) has a mode picker
  - "Auto" inherits the mode from the parent; children follow unless they pin their own mode
  - instances inherit a mode pinned on their main component and can pin a different one
  - **extended collections:** **Extend** in the token editor creates a collection that inherits all variables and modes and stores only the values you override
  - in an extension, inherited values are greyed and ↺ resets an override
  - apply an extension with the mode picker on a frame, page or instance to re-skin it (for example, a second brand); extensions can be extended again
  - copied layers remember their variables' names, so pasting into another file reconnects them to same-named variables there
  - a binding to a variable the other file doesn't have is dropped, and the layer keeps its value
- **Sample file:** **Open sample file** includes a **Design system** page: Light/Dark color variables, a "Brand B" extension, spacing variables, a Button component set with a Label property, and a Card shown in all three contexts
- **Constraints:** layers placed freely in a frame have horizontal (Left, Right, Left & right, Center, Scale) and vertical (Top, Bottom, Top & bottom, Center, Scale) rules
  - the rules apply when the frame is resized by its handles or its W/H fields; hold ⌘ while dragging to ignore them
  - they also apply when an instance is sized differently from its main component
- **Resizing:** each layer can be **Fixed**, **Hug** contents (auto-layout frames and text) or **Fill** container (children of auto-layout frames), separately for width and height
- **Lock aspect ratio:** the link button next to W/H. It applies to typed sizes and to resize handles (hold ⇧ to override).
- **Layers panel:** tree view, rename (double-click or ⌘R), hide, lock, drag to reorder or nest
- **Pages:** add, rename and delete pages
- **Fills and strokes:** a layer can have any number of each. They stack bottom to top, and each has its own color, opacity and show/hide toggle. Strokes share one weight and one position: **Inside**, **Center** or **Outside**.
- **Properties:** position, size, rotation, corner radius, opacity, typography, align and distribute. Number fields accept math like `100/2`, and you can drag a field's label to scrub its value.
- **Editing:** undo/redo, copy/paste (also between tabs), duplicate (⌘D or ⌥-drag), arrow-key nudging, z-order (⌘[ / ⌘])
- **Export:** PNG, JPG or SVG at 0.5x–4x, for the selection or the whole page
- **Saving:**
  - files autosave to IndexedDB, in this browser only
  - the Σ menu has Back to files, New design file, Import file… and Download a copy
  - if the same file is open in two tabs, the other tab shows a reload banner
  - the first time you open this version, a document saved by an earlier version is moved in as a file

Press `?` in the app to see every keyboard shortcut.

## Code layout

| File | Purpose |
| --- | --- |
| `src/store.js` | Document model, tree index, transforms (`worldMatrix` / `setWorldMatrix`), selection, undo history, persistence |
| `src/geom.js` | 2D affine matrix and box helpers |
| `src/render.js` | SVG scene renderer and the screen-space overlay (selection, handles, guides, labels) |
| `src/interact.js` | Pointer state machine (move, resize, rotate, draw, marquee), snapping, keyboard shortcuts |
| `src/hit.js` | Hit testing and Figma-style selection depth |
| `src/commands.js` | Editing commands (group, align, reorder, zoom, …) |
| `src/layout.js` | Auto layout engine: hug/fill sizing, flow positioning, layout inference for ⇧A |
| `src/components.js` | Components and instances (normalize step `syncInstances`) |
| `src/variables.js` | Variables, aliases, modes and binding (normalize step `resolveVariables`) |
| `src/variables-ui.js` | The design token editor (a modal in design files, full-screen in token files) |
| `src/tokens-screen.js` | The token file screen |
| `src/libraries.js` | Linking token files to design files: publish snapshots, updates, migration |
| `src/tokens-io.js` | Token export (DTCG `tokens.json`, CSS) and import |
| `tests/` | In-browser test runner (`tests/index.html`) and tests |
| `src/text.js` | Text measurement and the in-place text editor |
| `src/panels.js` | Toolbar, layers, pages and properties panels |
| `src/io.js` | Clipboard, images, export, download |
| `src/db.js` | Small IndexedDB wrapper: `files` store (metadata and thumbnails) and `docs` store (documents) |
| `src/files.js` | File records, autosave of the open file, thumbnails, cross-tab messages, migration |
| `src/home.js` | The files home page |

Every node stores `x, y, w, h, rotation` relative to its parent and rotates about its center. All transforms go through `setWorldMatrix`, which turns a desired on-canvas matrix back into local properties. This is what lets moving, rotating and reparenting work at any nesting depth.
