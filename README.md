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
  - two kinds of file: **Sigma Design** files (a canvas) and **Sigma Tokens** files (design tokens only, no canvas)
  - Recents shows all kinds; the **Sigma Design**, **Sigma Tokens** and **Sigma Icons** sections show one kind each, and the **Welcome to Sigma** folder holds Sigma's sample files, with a note on what the folder is for and a description on each file
  - lists every file saved in this browser, with thumbnails (Sigma Tokens files show a palette of their colors) and "Edited … ago"
  - has Recents and All files views, search, sorting, and a grid or list layout
  - lets you rename, duplicate, download and archive files from the card menu, or import `.sigma.json` files by dragging them onto the page
  - **Archive:** deleting a file (**Move to Archive**) is a soft delete. The file leaves Recents, the file lists and library pickers but keeps everything, version history included. The **Archive** section lists archived files with **Restore**, **Download** and **Delete forever…**, and **Empty Archive…** clears it; only those two erase files, after asking. Opening an archived file's link shows it in the Archive, and a tab that has it open stops saving
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
  - **deprecate** a component or component set from its ⋯ menu: it's hidden from Assets (**Show N deprecated** brings it back) and the swap picker, and its instances keep working with a note saying what to use instead (from its description). **Mark as not deprecated** undoes it
  - **search** in Assets and in the swap picker matches component names and the words in their descriptions (and a variant's set), so keywords like "timer, speed" in a stopwatch icon's description find it
  - **component playground:** in Assets, the ⓘ on a component (or right-click → **Open in playground…**) previews it with all its properties (variants, toggles, text, swaps) to try out, then **Insert instance** places it with those choices
  - changes to the main component flow to every instance, live; an instance can change appearance and text, and size and position come from the main component
  - a component can never end up containing an instance of itself
- **Component properties:** select a main component or component set; its **Properties** section lists variant properties first, then the others, each with its type and value
  - **+** creates a property: **Variant**, **Boolean**, **Instance swap**, **Text**, **Icon** or **Slot**. A window asks for its **Name** and **Value** (True/False for a boolean, the default text, the default component plus **Preferred values** for an instance swap, or the default icon plus the icon groups instances can choose from for an icon: **All icons** by default)
  - click a property (or its settings icon) to edit it in the same window; double-click its name to rename it; drag it to reorder; − , right-click → **Delete property**, or select it and press Delete. Hovering a property outlines the layers it controls
  - **Apply variable** in the window lets a Boolean or Text default come from a design token (boolean or string); instances that keep the default follow the token in every mode, and a value set on an instance still wins
  - **apply a property to a layer** in the main component: the apply variable/property button next to **Visibility** (boolean) or **Text content** (text) lists the component's properties and **Create … property…**; a nested instance has **Apply instance swap property** in its header, and an icon layer has **Apply icon property** next to **Swap icon…**. A bound layer shows a purple pill; click it to switch, edit or detach
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
  - an **on/off toggle** for each boolean property, a text field for each text property, a component picker for each instance swap property, and an icon picker for each icon property (only the groups the property allows). An instance chooses only the icon: its size, color and stroke come from the main component
  - exposed nested instances follow, each with its own controls; changing properties or switching variants keeps your overrides
  - if a layer in the main component is renamed or removed, its instances show "N overrides no longer apply", with a Clear button
- **Design tokens** (Sigma's name for Figma's variables):
  - **+ Sigma Tokens** creates a Sigma Tokens file, which opens straight into a full-screen token editor
  - **Sigma Tokens ▾ → Open sample tokens** (or **Open the sample tokens** under Sigma Tokens) opens the sample tokens (**Sigma Tokens** in the Welcome to Sigma folder), creating it the first time: a complete example with Primitives (a palette with transparent colors, spacing, radii, type scales, text and a boolean), Semantic colors in Light and Dark, Brand B (an extension that only changes the accent), Typography styles built from the type primitives, and Components tokens that point at semantic tokens (button → accent → blue). It's published, so Sigma Design files can link it right away
  - **Browse design tokens…** (Σ menu, or **Browse design tokens** in the panel with nothing selected) opens the **Design tokens** window, with two tabs: the Sigma Tokens file the file uses (named after it: its version, read-only collections and an **Open** link to edit them there) and **Local**, the file's own **local design tokens** (most files have none; **+ New collection** adds some just for this file). It opens on the tab of the selected collection, so on the Sigma Tokens file when there are no local tokens. A Sigma Tokens file that links others gets the same tabs (**This file** and **Linked**)
  - the token editor has search and a type filter
  - **structure:** a collection holds tokens and groups, and groups hold tokens and other groups (Collection → Group → Tokens). The sidebar shows the whole tree: every collection with its groups, nested and collapsible, with token counts
  - **groups** are their own objects, with a name, an optional description and an order. Click a group to show its tokens, with its description above them; **+ New group**, and ⋯ or right-click to add a token or a group inside, rename, describe, ungroup or delete. **+ Create token** always adds the token at the top level of the collection; grouping is up to you. Drag a token by its type icon onto a group, a collection (top level) or between other tokens; drag a group into another group, or above or below one to reorder. Typing `a/b` as a token's name puts it in group `a`. A token's full path (`color/blue/500`) comes from its groups, and that's the name used in references and in `tokens.json` (where groups become nested groups, with `$description`). Files from before groups were objects convert automatically
  - **references:** a value can point to another token. Type `{` in a value (or click the link icon) for a searchable list of tokens of the same type, with their values; you can also paste `{color/blue/500}` or `{color.blue.500}`. The cell shows the token it points to and the value it ends up as, and the inspector shows the whole chain (`button/bg → brand/primary → blue/500 → #0D99FF`). Loops are refused
  - click a token to open the inspector: its description, its values per mode, which tokens alias it (click to jump), and how many layers use it
  - color swatches sit on a checkerboard so transparency shows
  - **color tokens carry opacity** (a hex value plus an opacity %); a fill or stroke using the token gets its opacity from it
  - **typography tokens** bundle font family, weight, size, line height and letter spacing, and each part can alias a number or text token
  - a typography token is edited in the inspector, with a live sample
  - in Sigma Design files, the Text section's **Text style** links a typography token to a text layer; changing any font property by hand detaches it
  - **deprecated tokens:** tick **Deprecated** in a token's inspector. It's struck through and hidden from token pickers, while layers and tokens that use it keep working (their chips are flagged). tokens.json writes `$deprecated` and CSS adds a `/* deprecated */` comment; both import back
  - **contrast pairs:** a color token's inspector has **Contrast**: **+ Check contrast with…** pairs it with the colors it's used with (text on a surface), and every pair shows its WCAG ratio and level (AA 4.5:1, AAA 7:1) in each mode, from either token. The sample pairs its text colors with the surfaces, and the on-accent text with the accent
  - **shadow tokens** hold a color (with opacity), X, Y, blur and spread; like typography, each part can point at a token (the color at an alpha color, say), and they're edited in the inspector with a live preview. A layer's effect uses one with **Shadow token**
  - **motion tokens:** **Duration** tokens are milliseconds and **Easing** tokens are cubic Bézier curves (`0.4, 0, 0.2, 1`, like CSS `cubic-bezier()`), with a small curve preview. Layers don't use them (Sigma has no prototyping); they're there for code, through tokens.json and CSS
- **Token audit:** **Audit design tokens…** (Σ menu, or the panel with nothing selected) lists every color, text style, spacing (auto layout gap and padding), corner radius and shadow in the file that doesn't use a token, grouped by value with how many layers use it:
  - each value shows the token that matches it exactly (=) or comes closest (≈), compared in the layer's own modes (a layer in a Dark frame is matched against Dark values). Equally good matches prefer semantic tokens (surface/default) over primitives (color/gray/0) and component tokens (card/radius); +N says how many others match
  - **Use** binds the layers to it, **Choose…** picks another token, **Select** shows the layers, and **Use all exact matches** does every exact one at once
  - it also lists layers using deprecated tokens (**Replace with…**) and instances of deprecated components (**Swap to…**)
  - layers inside instances aren't listed (their values come from the main component), and a gap only counts when two or more layers are in the flow
- **Design tokens in Sigma Design files:**
  - a Sigma Design file uses **one Sigma Tokens file** for its design tokens, chosen in **Design tokens…** (Σ menu, or the panel with nothing selected), plus any local tokens it keeps. Its tokens show up everywhere a value can use a token
  - **Switch to this** changes the Sigma Tokens file: layers move to the tokens with the same names in the new file (so Sigma Tokens files with the same structure, like two brands, are interchangeable); tokens with no match keep their current values
  - **Publish…** in a Sigma Tokens file creates a numbered version, with optional notes and a summary of what changed; the Sigma Design file keeps a copy of the version it uses, and when a newer one is published it shows "Design token updates available" so you can review and accept
  - **Move to Sigma Tokens…** in the Design tokens window sends a file's local tokens to a new or existing Sigma Tokens file, which the Sigma Design file then uses
  - files from before Sigma Tokens files move their variables into a Sigma Tokens file the first time they're opened
- **Sigma Tokens files linking Sigma Tokens files:**
  - a Sigma Tokens file can link other Sigma Tokens files (**Linked Sigma Tokens files…**), so its tokens can point at theirs (a "Brand" file whose colors point at a "Core" file). Linked collections show read-only in the token editor
  - publishing a Sigma Tokens file includes copies of the Sigma Tokens files it points at, so a Sigma Design file that uses "Brand" still resolves the "Core" values
  - unlinking a Sigma Tokens file turns references to it into plain values
- **Sigma Icons files** (icons are a library of their own, not components):
  - **+ Sigma Icons** creates a Sigma Icons file: a grid of icons by style (Outline, Filled) and, within each style, by group, with a search. The sidebar lists the styles and their groups to show just one. It has no canvas
  - **+ Sigma Icons ▾ → Lucide** creates a Sigma Icons file with the whole [Lucide](https://lucide.dev) set (1,877 outline icons, ISC License), grouped by Lucide's categories, with its tags as search keywords. It's published, so Sigma Design files can link it right away; the file credits Lucide and shows its license. The set is built from a pinned Lucide version by `python3 tools/build-lucide.py [version]` into `icon-sets/lucide.json`
  - **Import SVGs** (or drop .svg files on it, or paste SVG code) adds icons from any free icon set (Lucide, Tabler, Heroicons, Phosphor, Material Symbols…). Icons go into the group you have open; importing an icon with the same name, group and style updates it (an outline and a filled icon can share a name)
  - import keeps only plain shapes (paths, circles, rects, lines, polygons, groups) and their geometry: scripts, styles, images, links and references are dropped. Colors become the layer's color, so an icon takes the color of the layer that shows it
  - each icon is **Outline** (drawn with strokes, keeping its stroke width) or **Filled**, detected on import and changeable. A filled icon can also have a stroke width, which outlines it too (filled versions of outline icons keep their size that way); 0 is fill only. More styles can come later
  - select icons (⌘-click adds, ⇧-click selects a range, ⌘A all) to edit their name, group, keywords (for search), style and stroke width, download or copy one as SVG, or delete them (⌫). Double-click a group to rename it (within its style)
  - **Publish…** creates a numbered version with notes and a list of what changed
- **Icons in components:**
  - a Sigma Design file links Sigma Icons files from **Icon libraries…**. It keeps copies of only the icons it uses, so linking a big set like Lucide keeps the file small; the picker reads the whole set from the Sigma Icons file (Σ menu, or the panel with nothing selected). Updates arrive like other libraries: a banner, **Review**, accept. Icons a new version removed stay where they're used (but aren't offered any more) until you swap them; a Sigma Icons file can't be unlinked while its icons are in use
  - icons go inside main components (not loose on the canvas, for now): select a component or a layer in one, then **+** in the panel's Icon section, or **Insert icon…** on right-click. The picker has the icons by style and group, and a search that lists the best matches first
  - an icon layer has a size (W, H), a **Color** (its fill, which can use a color token) and, for outline icons, a stroke width (which can use a number token). **Swap icon…** changes the icon
  - instances show the main component's icon, at its size, color and stroke: none of these can be overridden in an instance
  - publishing components includes the icons they use, so files that link the component library show them, and records their Sigma Icons files: linking the component library links those too, so instances can choose other icons
- **Version history** (Σ menu → **Show version history**, in Sigma Design, Sigma Tokens and Sigma Icons files):
  - Sigma keeps an autosave version before each editing session and every 10 minutes while you work (the newest 50), plus one for every publish
  - **Save to version history…** (⌥⌘S) adds a named version with a description; named and published versions are kept until you delete them
  - click a version to view it read-only in place; **Restore this version** makes it current (the state it replaces is kept as a version first), and the ⋯ menu can copy it to a new file, name it or delete it
  - restoring never rolls back publish numbers, so linked files still see a consistent version sequence
  - versions are stored in this browser with the file and are deleted with it
- **Component libraries:**
  - **Publish components…** (Σ menu, or the panel with nothing selected) publishes a Sigma Design file's components as a numbered version, with notes and a list of what changed
  - another Sigma Design file links it from **Component libraries…**; its components appear in Assets under the library's name, ready to insert or drag
  - publishing records the Sigma Tokens file the components use and the names of their tokens. A file that links the library and has no Sigma Tokens file starts using that one. A file with a different Sigma Tokens file (another brand with the same token names) gets the library's components matched to its own tokens by name, so they follow its values and modes. Tokens with no match are counted in **Component libraries…**, and those layers keep their colors
  - the publish dialog warns when components use the file's local tokens, which other files won't have
  - a library update shows a banner in files that use it; after **Review** and accept, instances update and keep their overrides
  - **Go to main component** on a library instance offers to open the library file
  - unlinking keeps instances as they look, marked "main component missing"
- **Export and import:**
  - in a Sigma Tokens file's Σ menu, **Export tokens.json** writes the W3C Design Tokens format (DTCG):
    - groups come from `/` in names, and aliases are written `{group.token}`
    - colors use the DTCG color object with alpha, sizes are `{ value, unit: "px" }`, durations `{ value, unit: "ms" }`, easings `cubicBezier` arrays, and typography and shadow are composite types (CSS gets a `box-shadow` value)
    - each collection × mode is a token set, such as `Color/Dark`, the multi-set layout Tokens Studio and Style Dictionary setups use
    - re-importing a Sigma export rebuilds it exactly, including modes and extended collections
  - **Export CSS variables** writes custom properties: default modes go on `:root`, and each other mode or brand gets a selector such as `[data-color="dark"]` that swaps values on any element
  - **Import tokens.json…** merges tokens into the open Sigma Tokens file, matching by name; dropping a `tokens.json` on the home page creates a new Sigma Tokens file
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
- **Welcome to Sigma:** a folder on the files home with Sigma's sample files, kept apart from your own: **Sigma Design** (the guide), **Sigma Tokens** (the sample design tokens it uses) and **Sigma Icons** (the sample icons its components use: 72 Lucide icons in 9 groups, plus 18 filled versions of Lucide shapes, made from `icon-sets/lucide.json` by `src/sample-icons.js`). The first visit to Sigma in a browser (no files yet) creates them and opens the guide; after that, **Open Welcome to Sigma** (Σ menu, or an empty files page) opens it. The guide's ten pages (Start here, Canvas basics, Layout, Components, Tokens in designs, Style, Quality checks, Libraries and versions, Sigma Tokens, Sigma Icons) each pair a short guide with live examples, all built from Sigma Tokens; the Sigma Icons page has components with icons and an Icon property, and instances choosing their icons. It reopens your copy, and makes a fresh one when the guide is newer (`WELCOME_VERSION` in `src/welcome.js`; bump it whenever the guide changes, and add new features to it). Both are playgrounds: anything can be changed while they're open (undo works too), but nothing is saved (no autosave, version history, rename or publish), so they're back to the original after a refresh or whenever they're opened again. A banner says so, and **Duplicate to keep changes** saves your edits as a file of your own. Only the current three stay in the folder: when a newer guide is made, the previous sample files move to the Archive (never deleted, since they may hold your edits, and files that used old sample tokens keep working). Sample files from older versions of Sigma were moved there once the same way
- **Constraints:** layers placed freely in a frame have horizontal (Left, Right, Left & right, Center, Scale) and vertical (Top, Bottom, Top & bottom, Center, Scale) rules
  - the rules apply when the frame is resized by its handles or its W/H fields; hold ⌘ while dragging to ignore them
  - they also apply when an instance is sized differently from its main component
- **Resizing:** each layer can be **Fixed**, **Hug** contents (auto-layout frames and text) or **Fill** container (children of auto-layout frames), separately for width and height
- **Min / max size:** **+ Min / max size** under the resizing options limits a layer's width and height (W≥, W≤, H≥, H≤). Hug and Fill sizes stay within them, and when a Fill layer reaches its limit, the space it leaves goes to the other Fill layers. Auto-width text wraps once it reaches its max width. Empty means no limit, the values can use number tokens, and instances follow their main component's limits
- **Corners:** the button next to the corner radius sets each corner separately (top-left, top-right, bottom-right, bottom-left), for tabs and other shapes rounded on some corners only. Each corner can use a number token; the shared field shows "Mixed", and typing a value there, or the button again, gives all four one radius
- **Stroke sides:** in the Stroke section, **Sides** turns the stroke on or off for each side of a rectangle, frame or image (an input with only a bottom border, a divider). Both corners and sides can be overridden in instances
- **Lock aspect ratio:** the link button next to W/H. It applies to typed sizes and to resize handles (hold ⇧ to override).
- **Layers panel:** tree view, rename (double-click or ⌘R), hide, lock, drag to reorder or nest
- **Pages:** add, rename and delete pages
- **Fills and strokes:** a layer can have any number of each. They stack bottom to top, and each has its own color, opacity and show/hide toggle. Strokes share one weight and one position: **Inside**, **Center** or **Outside**.
- **Properties:** position, size, rotation, corner radius, opacity, typography, align and distribute. Number fields accept math like `100/2`, and you can drag a field's label to scrub its value.
- **Contrast:** with one text layer selected, the Fill section shows its contrast with what's behind it (the layers and page under the middle of the text, with their opacity) and the WCAG level: AA needs 4.5:1, AAA 7:1, and large text (24px, or 18.66px bold) 3:1 and 4.5:1. Over an image it can't be measured.
- **Layout grids:** frames, components and instances can have layout grids (**Layout grid** +): **Columns** or **Rows** (count, gutter, and Stretch with a margin, or Left / Center / Right with a fixed width and offset) or a square **Grid**, each with a color. They're drawn over the frame on the canvas only (never exported), layers snap to column and row edges while you move or resize them, and ⌃G (or the zoom menu) shows or hides them. Count, size, gutter and margin can use number tokens, so a grid follows the spacing scale. Instances follow the main component's grids.
- **Text truncation:** **Truncate** in the Text section ends text that doesn't fit with "…". **Max lines** sets after how many lines; empty means one line, or the lines that fit for fixed-size text. An auto-height text box stops growing at its max lines, and instances can override both
- **Effects:** drop shadow, inner shadow and layer blur, as many as you like per layer (**Effects** +). Each has X, Y, blur, spread, color and opacity, and can use a shadow token. Exports include them and make room for them. Instances follow the main component's effects and can override them.
- **Text case:** the Text section's **Case** buttons show text as typed, UPPERCASE, lowercase or Title Case. The text keeps what you typed; only how it shows (and exports) changes, and instances can override it. Use it to keep one capitalization rule per component (title case for buttons and table headings, sentence case for longer strings).
- **Editing:** undo/redo, copy/paste (also between tabs), duplicate (⌘D or ⌥-drag), arrow-key nudging, z-order (⌘[ / ⌘])
- **Export:** PNG, JPG or SVG at 0.5x–4x, for the selection or the whole page
- **Saving:**
  - files autosave to IndexedDB, in this browser only
  - the Σ menu has Back to files, New Sigma Design file, Import file… and Download a copy
  - if the same file is open in two tabs, the other tab shows a reload banner
  - the first time you open this version, a document saved by an earlier version is moved in as a file

Press `?` in the app to see every keyboard shortcut.

## Comments

- **Comment tool** (C, or the speech bubble in the toolbar): click a layer to comment on it; the pin stays on the layer as it moves. Click a pin to read the thread, reply, resolve or delete. The **Comments** tab (left panel) lists them (open ones, or all), and jumps to one.
- Comments are stored in the file, so in a project they travel through git: **Propose change** includes them, and the pull request's description lists them with the layer each is on. An agent can bring pull request review feedback onto the exact layer with `node tools/sigma.mjs comment add --file … --layer "Card / Title" --text …` (and `comment list`, `comment resolve`); Sigma reloads and shows it.

## Code handoff

- **Inspect** (the tab next to Design in the right panel) shows, for the selected layer: its CSS (size, auto layout, padding, radius, fills, borders, shadows, type), with every value that comes from a token written as the token's variable (`var(--surface-default)`, the same names as **Export CSS variables**); the tokens it uses with their values in its modes and their code names on Web, iOS and Android; and for an instance, how it's written in code (`<Button variant="primary" label="Save" />`: variant properties always, other properties when they differ from the default). Each block has a copy button.
- **Code names:** a token's name in code per platform is in the token inspector (**Code names**: Web, iOS, Android; empty means the default from its path, like `--color-blue-500`, `colorBlue500`, `color_blue_500`). The sync skill fills Web in on import. A selected main component or set shows its **Component** API in Inspect: its code name and each property's (variant properties with their values), editable; defaults come from the names (`Show icon` → `showIcon`). Export CSS uses tokens' CSS code names.

## Sigma in a project

Sigma files can live in a project's repo, in `.sigma/` (see [docs/schema/README.md](docs/schema/README.md) for the format, and [docs/roadmap.md](docs/roadmap.md), Part E):

- **Files link by path, and git does the versioning.** A Sigma Design file lists the Sigma Tokens, Sigma Icons and component library files it uses by their paths; whatever is checked out is what it uses.
- **Derived data is left out:** instances' layers, the values of token-bound properties, positions and sizes set by auto layout and text, and copies of linked files are rebuilt when a file opens. So is anything at its default value. A token change touches one line of one file.
- **Open a project:** `python3 serve.py 5173 --project ../my-app` (or `SIGMA_PROJECT=../my-app`). The files home gets a **Project** section with the project's Sigma files; new files made there go in the project. In Chrome and Edge, **Open project folder…** in the sidebar opens one without the server (the folder has to be picked again after a reload).
- **Save to project (⌘S):** Sigma saves your edits in the browser as you work, as always; ⌘S (or **Save to project** in the file's menu, or the status chip by the file name) writes the file to the project, checked by the validator. The chip says **In project** or **Save to project** (changes not saved yet). In a project file, Publish is hidden: saving is publishing.
- **Changes on disk:** Sigma checks the project every 2 seconds. When an agent or git changes the open file, it reloads (or asks, if it has changes not saved to the project); when a file it uses changes (new tokens or icons), it updates its copies and keeps your edits. Writes never overwrite a file that changed on disk since Sigma read it; Sigma asks instead.
- **Safety:** the server listens on 127.0.0.1, answers only requests addressed to localhost, writes only `.sigma/` files and `sigma.config.json`, and only for requests from Sigma (they carry a header other websites can't send). Writes are logged.
- **Propose change** (a file's menu, or the Project section): Sigma lists the edits since the last commit (it asks the server for the committed versions) as tokens, icons, components, pages and file settings, leaving out ones already proposed. Pick those that belong together, add a title and a note, and Sigma saves a changeset in `.sigma/changesets/` with before and after pictures of each changed component, page and icon. The rest can go in another proposal. The Project section lists proposals and their status. `node tools/sigma.mjs changeset list | show | apply | status` work with them; `apply --to <folder>` writes a pull request's files: the base with only that changeset's changes.
- **Proposals become pull requests** through the sync skill (`skills/sigma-sync/reference/workflow.md`): a ticket (Notion or GitHub Issues), a branch named by `workflow.branch` in a worktree, `changeset prepare` (the changeset applied to the Sigma files, the code written for tokens and icons, the changeset and pictures copied in, checked), the project's own checks, then a draft pull request in the repo's template with `changeset pr-body` (what changed, before and after pictures). `changeset sync` reads pull requests with `gh` and sets each proposal's status (In review, Changes requested, Merged, Closed), which the Project section shows.
- **Check files** with `node tools/validate.js <project folder>` (Node 18+, no dependencies): it reports each problem with where it is and what to do, and exits with 1 when there are errors.
- **Sync tokens with the code** (`skills/sigma-sync/SKILL.md`, a skill any agent can follow, with `node tools/sigma.mjs`): the agent works out the stack and records its decisions in `sigma.config.json`. CSS variables are read and written by the tool itself: `tokens import` (code → Sigma, merging so ids, descriptions and order stay and importing twice changes nothing), `tokens diff` (what changed since a git revision), `tokens write` (Sigma → CSS as minimal edits that keep each value's unit and color format), `check` (valid, and no drift). Other stacks (theme objects, Tailwind config…) go through a DTCG tokens.json the agent writes (`tokens import --from`), and the agent applies write-backs from `tokens diff`. Proven on `examples/css-app` (CSS variables) and `examples/mui-app` (an MUI theme).
- **Sync icons** the same way (`skills/sigma-sync/reference/icons.md`): an icon folder becomes a Sigma Icons file (folders are groups, file names are icon names). `icons import`, `icons diff` and `icons write` handle SVG files themselves; writing only rewrites files whose shapes changed, in each file's own style, and deletes icons deleted in Sigma. Icon components (React, Vue…) go through SVGs the agent extracts (`icons import --from`), and the agent writes components from `icons write`.
- **Bring components in** (`skills/sigma-sync/reference/components.md`): `tools/capture/capture.js` captures a rendered component in each variant and state (hover, focus, pressed, disabled applied from the CSS); a manifest says what each capture is (variants, properties, nested components, code names); `node tools/sigma.mjs library build` turns captures into a library file with auto layout, token bindings and icon layers; `tools/capture/compare.html` lays the library out in Sigma and compares every layer with the real render. Proven on `examples/css-app` (Button, Input and Card: 11 of 11 match).
- `examples/sample-project/` holds Sigma's sample files in this format (`node tools/build-sample-project.mjs` rebuilds them).

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
| `src/variables-ui.js` | The design token editor (a modal in Sigma Design files, full-screen in Sigma Tokens files) |
| `src/tokens-screen.js` | The Sigma Tokens file screen |
| `src/icon-library.js` | Icons: SVG import and cleaning, drawing, groups, search, version changes |
| `src/icons-screen.js` | The Sigma Icons file screen |
| `src/icon-ui.js` | The icon picker and icon layers in components |
| `src/libraries.js` | Token and component libraries: publishing, linking, updates, migration |
| `src/sample-tokens.js` | The sample token file (a complete small design system) |
| `src/sample.js` | The blank Sigma Design file |
| `src/welcome.js` | Welcome to Sigma: the guide file a new user starts with, built on the sample tokens and icons |
| `src/sample-icons.js` | The sample Sigma Icons file (a selection of Lucide icons, outline and filled) |
| `src/project-format.js` | Sigma files in a project: saving without derived data, opening (rebuilding it), stable JSON |
| `src/validate.js` | Checks project files and says what's wrong (used by `tools/validate.js`) |
| `src/project.js` | Projects: reaching one (the server or a picked folder), bringing files in, saving to the project, watching for changes on disk |
| `src/project-ui.js` | The project status chip and menu items |
| `src/project-config.js` | `sigma.config.json`: what the sync skill decided about a project |
| `src/token-sync.js` | Tokens between code and Sigma: CSS variables in and out, merging, diffs |
| `src/icon-sync.js` | Icons between code and Sigma: SVG folders in and out, merging, diffs, writing in the project's style |
| `tools/sigma.mjs` | The command line the sync skill uses (validate, check, tokens and icons import / diff / write, changesets, library build, comments) |
| `src/capture-to-sigma.js` | Captured components → Sigma components (auto layout, token bindings, icons, variants) and comparing them with the capture |
| `src/capture-compare.js` | Lays a built library out and compares it with its captures (`tools/capture/compare.html`) |
| `tools/capture/` | `capture.js` (runs in the page that renders a component) and the compare page |
| `skills/sigma-sync/` | The sync skill: instructions for agents, with references |
| `src/code-names.js` | Code names for tokens (per platform), components and properties |
| `src/inspect.js` | The Inspect panel: CSS with token variables, tokens used, instance usage, component API |
| `src/changesets.js` | Changesets: what changed (by token, icon, component, page), applying some of it onto the base |
| `src/propose.js` | The Propose change dialog, with before and after renders |
| `src/comments.js` | Comments on layers: pins, threads, the Comments list |
| `tools/validate.js` | Command-line check for a project's Sigma files |
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
