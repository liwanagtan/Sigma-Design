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
- **Components and instances** (they work like Figma's):
  - ⌥⌘K turns a frame, or any selection, into a component; with several layers selected, right-click → **Create multiple components** makes one component each
  - make instances by duplicating (⌘D), ⌥-dragging or pasting a component, or from the **Assets** tab (a component set inserts its default variant: the top-left one)
  - **search** in Assets and in the swap picker matches component names and the words in their descriptions (and a variant's set), so keywords like "timer, speed" in a stopwatch icon's description find it
  - **component playground:** in Assets, the ⓘ on a component (or right-click → **Open in playground…**) previews it with all its properties (variants, toggles, text, swaps) to try out, then **Insert instance** places it with those choices
  - changes to the main component flow to every instance, live; an instance can change appearance and text, and size and position come from the main component
  - a component can never end up containing an instance of itself
- **Component properties:** select a main component or component set; its **Properties** section lists variant properties first, then the others, each with its type and value
  - **+** creates a property: **Variant**, **Boolean**, **Instance swap** or **Text**. A window asks for its **Name** and **Value** (True/False for a boolean, the default text, or the default component plus **Preferred values** for an instance swap)
  - click a property (or its settings icon) to edit it in the same window; double-click its name to rename it; drag it to reorder; − , right-click → **Delete property**, or select it and press Delete. Hovering a property outlines the layers it controls
  - **Apply variable** in the window lets a Boolean or Text default come from a design token (boolean or string); instances that keep the default follow the token in every mode, and a value set on an instance still wins
  - **apply a property to a layer** in the main component: the apply variable/property button next to **Visibility** (boolean) or **Text content** (text) lists the component's properties and **Create … property…**; a nested instance has **Apply instance swap property** in its header. A bound layer shows a purple pill; click it to switch, edit or detach
  - a property's default is what the main component shows: changing the default updates the bound layers, and editing a bound layer in the main component updates the default
  - **Nested instances:** "Show properties of nested instances…" lists nested instances that have properties; the chosen ones show their controls on instances of the outer component
- **Slots** (Figma's flexible areas in components):
  - in a main component, select a nested frame and press ⇧⌘S (or right-click → **Convert to slot**, or the panel's **Convert to slot**); other layers can be wrapped with right-click → **Wrap in new slot**. **+ → Slot** creates a slot property to assign later. A slot can't be the component itself, and layers inside a slot can't use component properties
  - the slot property's settings: name, description, **Minimum / Maximum layers**, **Preferred instances**, **Only allow preferred instances**, **Display empty slots by default** and **Fill items on counter-axis by default**
  - the frame's layers are the slot's default content. In an instance, draw or drop layers into the slot, paste them, or use **Add instances** (preferred ones first); they're ordinary layers you can edit, move and delete. Until an instance changes a slot, it follows the main's default content
  - the instance panel shows each slot with **Modified**, its layer count against the limits (a warning when outside them), **Add instances**, and ⋯ → **Reset slot** / **Delete contents**. Going past the maximum warns. Slots show a pink outline when their component or instance is hovered or selected
  - deleting a slot property resets that slot in every instance (their added layers go), like Figma
- **Variants:**
  - **+ → Variant** on a main component turns it into a component set (`Property 1=Default`); on a set it adds a variant property. Right-click → **Add variant** works too, and selecting a set or one of its variants shows a **+** below the set on the canvas to add one (`Variant2`, `Variant3`…)
  - select components and right-click → **Combine as variants** to make a set from existing components
  - editing a variant property shows its **Values**: rename one and every variant using it follows; drag to reorder
  - select a variant to set its own values (pick one, or type a new value); variants with the same values are flagged as a conflict
- **Instances:** the panel shows the component name (click it to swap with a searchable picker with thumbnails, preferred components first) and ⋯ with **Go to main component**, **Reset all changes**, **Push changes to main component** and **Detach instance** (⌥⌘B); ↺ appears when the instance has changes
  - select several instances of the same component to change their properties together (differing values show as Mixed)
  - a dropdown for each variant property, or an **on/off toggle** when its values are true/false (or yes/no, on/off)
  - an **on/off toggle** for each boolean property, a text field for each text property, and a component picker for each instance swap property
  - exposed nested instances follow, each with its own controls; changing properties or switching variants keeps your overrides
  - if a layer in the main component is renamed or removed, its instances show "N overrides no longer apply", with a Clear button
- **Design tokens** (Sigma's name for Figma's variables):
  - **New token file** creates a token file, which opens straight into a full-screen token editor
  - **New token file ▾ → Open sample token file** (or **Open the sample token file** under Design tokens) opens the sample token file, creating it the first time: a complete example with Primitives (a palette with transparent colors, spacing, radii, type scales, text and a boolean), Semantic colors in Light and Dark, Brand B (an extension that only changes the accent), Typography styles built from the type primitives, and Components tokens that point at semantic tokens (button → accent → blue). It's published, so design files can link it right away
  - a design file can also keep **local design tokens**; open them from the Σ menu or the panel (with nothing selected)
  - the token editor has search and a type filter
  - **structure:** a collection holds tokens and groups, and groups hold tokens and other groups (Collection → Group → Tokens). The sidebar shows the whole tree: every collection with its groups, nested and collapsible, with token counts
  - **groups** are their own objects, with a name, an optional description and an order. Click a group to show its tokens, with its description above them; **+ New group**, and ⋯ or right-click to add a token or a group inside, rename, describe, ungroup or delete. **+ Create token** always adds the token at the top level of the collection; grouping is up to you. Drag a token by its type icon onto a group, a collection (top level) or between other tokens; drag a group into another group, or above or below one to reorder. Typing `a/b` as a token's name puts it in group `a`. A token's full path (`color/blue/500`) comes from its groups, and that's the name used in references and in `tokens.json` (where groups become nested groups, with `$description`). Files from before groups were objects convert automatically
  - **references:** a value can point to another token. Type `{` in a value (or click the link icon) for a searchable list of tokens of the same type, with their values; you can also paste `{color/blue/500}` or `{color.blue.500}`. The cell shows the token it points to and the value it ends up as, and the inspector shows the whole chain (`button/bg → brand/primary → blue/500 → #0D99FF`). Loops are refused
  - click a token to open the inspector: its description, its values per mode, which tokens alias it (click to jump), and how many layers use it
  - color swatches sit on a checkerboard so transparency shows
  - **color tokens carry opacity** (a hex value plus an opacity %); a fill or stroke using the token gets its opacity from it
  - **typography tokens** bundle font family, weight, size, line height and letter spacing, and each part can alias a number or text token
  - a typography token is edited in the inspector, with a live sample
  - in design files, the Text section's **Text style** links a typography token to a text layer; changing any font property by hand detaches it
  - **shadow tokens** hold a color (with opacity), X, Y, blur and spread; like typography, each part can point at a token (the color at an alpha color, say), and they're edited in the inspector with a live preview. A layer's effect uses one with **Shadow token**
  - **motion tokens:** **Duration** tokens are milliseconds and **Easing** tokens are cubic Bézier curves (`0.4, 0, 0.2, 1`, like CSS `cubic-bezier()`), with a small curve preview. Layers don't use them (Sigma has no prototyping); they're there for code, through tokens.json and CSS
- **Design tokens in design files:**
  - a design file uses **one token file** for its design tokens, chosen in **Design tokens…** (Σ menu, or the panel with nothing selected), plus any local tokens it keeps. Its tokens show up everywhere a value can use a token
  - **Switch to this** changes the token file: layers move to the tokens with the same names in the new file (so token files with the same structure, like two brands, are interchangeable); tokens with no match keep their current values
  - **Publish…** in a token file creates a numbered version, with optional notes and a summary of what changed; the design file keeps a copy of the version it uses, and when a newer one is published it shows "Design token updates available" so you can review and accept
  - **Move to token file…** in the local tokens window sends a file's local tokens to a new or existing token file, which the design file then uses
  - files from before token files move their variables into a token file the first time they're opened
- **Token files linking token files:**
  - a token file can link other token files (**Linked token files…**), so its tokens can point at theirs (a "Brand" file whose colors point at a "Core" file). Linked collections show read-only in the token editor
  - publishing a token file includes copies of the token files it points at, so a design file that uses "Brand" still resolves the "Core" values
  - unlinking a token file turns references to it into plain values
- **Version history** (Σ menu → **Show version history**, in design and token files):
  - Sigma keeps an autosave version before each editing session and every 10 minutes while you work (the newest 50), plus one for every publish
  - **Save to version history…** (⌥⌘S) adds a named version with a description; named and published versions are kept until you delete them
  - click a version to view it read-only in place; **Restore this version** makes it current (the state it replaces is kept as a version first), and the ⋯ menu can copy it to a new file, name it or delete it
  - restoring never rolls back publish numbers, so linked files still see a consistent version sequence
  - versions are stored in this browser with the file and are deleted with it
- **Component libraries:**
  - **Publish components…** (Σ menu, or the panel with nothing selected) publishes a design file's components as a numbered version, with notes and a list of what changed
  - another design file links it from **Component libraries…**; its components appear in Assets under the library's name, ready to insert or drag
  - a library update shows a banner in files that use it; after **Review** and accept, instances update and keep their overrides
  - **Go to main component** on a library instance offers to open the library file
  - unlinking keeps instances as they look, marked "main component missing"
- **Export and import:**
  - in a token file's Σ menu, **Export tokens.json** writes the W3C Design Tokens format (DTCG):
    - groups come from `/` in names, and aliases are written `{group.token}`
    - colors use the DTCG color object with alpha, sizes are `{ value, unit: "px" }`, durations `{ value, unit: "ms" }`, easings `cubicBezier` arrays, and typography and shadow are composite types (CSS gets a `box-shadow` value)
    - each collection × mode is a token set, such as `Color/Dark`, the multi-set layout Tokens Studio and Style Dictionary setups use
    - re-importing a Sigma export rebuilds it exactly, including modes and extended collections
  - **Export CSS variables** writes custom properties: default modes go on `:root`, and each other mode or brand gets a selector such as `[data-color="dark"]` that swaps values on any element
  - **Import tokens.json…** merges tokens into the open token file, matching by name; dropping a `tokens.json` on the home page creates a new token file
  - token types Sigma doesn't support yet, like gradients, are skipped with a note; a list of layered shadows keeps its first shadow
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
- **Sample file:** **Open sample file** (Σ menu, or **Open the sample file** on an empty files page) creates a **Sample design file** that links the **Sample design tokens** token file. It reuses the most recently edited sample token file, and creates one only if there is none (or the existing ones no longer have the tokens the sample uses). **Open sample token file** opens that same file. Its **Design system** page has a Button component set with a Label property and a Card that uses it, built entirely from the sample tokens (component tokens for color, radius, padding and the card's shadow; text styles), with the Card shown in Light, Dark and Brand B
- **Constraints:** layers placed freely in a frame have horizontal (Left, Right, Left & right, Center, Scale) and vertical (Top, Bottom, Top & bottom, Center, Scale) rules
  - the rules apply when the frame is resized by its handles or its W/H fields; hold ⌘ while dragging to ignore them
  - they also apply when an instance is sized differently from its main component
- **Resizing:** each layer can be **Fixed**, **Hug** contents (auto-layout frames and text) or **Fill** container (children of auto-layout frames), separately for width and height
- **Lock aspect ratio:** the link button next to W/H. It applies to typed sizes and to resize handles (hold ⇧ to override).
- **Layers panel:** tree view, rename (double-click or ⌘R), hide, lock, drag to reorder or nest
- **Pages:** add, rename and delete pages
- **Fills and strokes:** a layer can have any number of each. They stack bottom to top, and each has its own color, opacity and show/hide toggle. Strokes share one weight and one position: **Inside**, **Center** or **Outside**.
- **Properties:** position, size, rotation, corner radius, opacity, typography, align and distribute. Number fields accept math like `100/2`, and you can drag a field's label to scrub its value.
- **Effects:** drop shadow, inner shadow and layer blur, as many as you like per layer (**Effects** +). Each has X, Y, blur, spread, color and opacity, and can use a shadow token. Exports include them and make room for them. Instances follow the main component's effects and can override them.
- **Text case:** the Text section's **Case** buttons show text as typed, UPPERCASE, lowercase or Title Case. The text keeps what you typed; only how it shows (and exports) changes, and instances can override it. Use it to keep one capitalization rule per component (title case for buttons and table headings, sentence case for longer strings).
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
| `src/libraries.js` | Token and component libraries: publishing, linking, updates, migration |
| `src/sample-tokens.js` | The sample token file (a complete small design system) |
| `src/sample.js` | The blank design file, and the sample design file built on the sample tokens |
| `src/component-ui.js` | Figma-style component, component set, variant and instance panels; the property window; the component picker |
| `src/history.js` | Version history panel: viewing a version read-only, restore, duplicate, named versions |
| `src/tokens-io.js` | Token export (DTCG `tokens.json`, CSS) and import |
| `tests/` | In-browser test runner (`tests/index.html`) and tests |
| `src/text.js` | Text measurement and the in-place text editor |
| `src/panels.js` | Toolbar, layers, pages and properties panels |
| `src/io.js` | Clipboard, images, export, download |
| `src/db.js` | Small IndexedDB wrapper: `files` store (metadata and thumbnails) and `docs` store (documents) |
| `src/files.js` | File records, autosave of the open file, thumbnails, cross-tab messages, migration |
| `src/home.js` | The files home page |

Every node stores `x, y, w, h, rotation` relative to its parent and rotates about its center. All transforms go through `setWorldMatrix`, which turns a desired on-canvas matrix back into local properties. This is what lets moving, rotating and reparenting work at any nesting depth.
