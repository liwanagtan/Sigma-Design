# Sigma

A Figma-style design canvas that runs in the browser. It has no dependencies and no build step: plain ES modules render the document to SVG.

## Run

ES modules need a web server, so opening `index.html` directly won't work. Use the included server, which turns off browser caching so code changes always show up on reload:

```bash
python3 serve.py
```

Any static server works too (`python3 -m http.server 5173`), but after updating the code you may need a hard reload (⌘⇧R).

Then open http://localhost:5173.

## Features

- **Files home:**
  - lists every file saved in this browser, with thumbnails and "Edited … ago"
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
| `src/text.js` | Text measurement and the in-place text editor |
| `src/panels.js` | Toolbar, layers, pages and properties panels |
| `src/io.js` | Clipboard, images, export, download |
| `src/db.js` | Small IndexedDB wrapper: `files` store (metadata and thumbnails) and `docs` store (documents) |
| `src/files.js` | File records, autosave of the open file, thumbnails, cross-tab messages, migration |
| `src/home.js` | The files home page |

Every node stores `x, y, w, h, rotation` relative to its parent and rotates about its center. All transforms go through `setWorldMatrix`, which turns a desired on-canvas matrix back into local properties. This is what lets moving, rotating and reparenting work at any nesting depth.
