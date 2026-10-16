# Sigma

An open design tool for AI-native teams: a design canvas installed in your project, working on your real design system. It runs in the browser through a local Node server; plain ES modules render documents to SVG without a frontend build step. Runtime dependencies are installed through npm.

Project assessment: [Codebase and product review — 15 October 2026](docs/codebase-review-2026-10-15.md), including evidence, known risks, recommended priorities, and open product questions.

## Install in a project

Sigma installs into an existing project, like a dev tool, and works on that project's real design system: its
token files, icons and components. Node 22 or later; Node 24 LTS is the recommended release target.

```bash
npx sigma-design init      # once: finds the project's tokens and icons, writes sigma.config.json and .sigma/
npm run sigma              # opens Sigma on the project (the script init adds; or npx sigma-design dev)
```

`init` reads CSS variables (with their modes: `[data-theme="dark"]`, `prefers-color-scheme`…), DTCG
`tokens.json` files and folders of SVG icons by itself. For other stacks (Tailwind, a JS theme, SCSS, icon
components) it says what it found and hands over to your coding agent, which finishes setup with the
`sigma-sync` skill (`node_modules/sigma-design/skills/sigma-sync/SKILL.md`). Running it again changes
nothing that's there. The sync tools are commands of the same package: `npx sigma-design check`,
`tokens import | diff | write`, `icons …`, `changeset …` and so on (`npx sigma-design help`).

## Standalone

Sigma is also a design tool on its own, with files saved in the browser:

```bash
npx sigma-design standalone
```

Use **Backup and restore** in the Home sidebar to download the selected browser project (or Drafts), including archived files, linked browser-library dependencies and full saved version history. **Restore project backup…** validates the backup and creates a new editable project without replacing existing work. File links are remapped to the restored copies; unavailable source libraries retain their embedded snapshots and are reported. Backups are limited to 256 MiB and remain local downloads. Browser storage/history alone is not an independent backup.

If saved file data cannot be opened, Sigma keeps the original and offers **Recover saved file**. You can also find this action in a file's Home or Archive menu. Copy a readable saved version into Drafts, check unsaved recovery, or restore an independent project backup. Recovery never replaces the damaged original; versions that are also unreadable cannot be copied.

Design, Tokens and Icons headers show **Unsaved changes**, **Saving…**, **Saved in browser**, or **Save failed**. Built-in Sigma examples show **Temporary edits**, and historical previews show **Viewing history**. Save/recovery options sit beside the status. Failed saves preserve the open edits and offer retry/download; stale tabs cannot silently overwrite newer saved content.

**Recover unsaved edits…** is available under Backup and restore, with a separate Home indicator when recovery entries exist. Each tab/file keeps its own recovery checkpoint; older `sigma.pending` records are still listed. Opening a file never automatically applies recovered edits. Open a recovered copy in Drafts, download it, or explicitly discard the reviewed entry. Recovery is limited by browser storage and does not replace downloaded backups.

## Built-in terminal

Open **Terminal** from the file tools rail in a Design or Tokens file, then choose **New terminal**.
When Sigma runs through `npx sigma-design dev`, the shell starts in that workspace's root. Browser-only
projects (including Sigma/Optics examples and Drafts) require **Connect this workspace** before creating
a shell. In standalone mode, the panel explains how to start the local project server; it cannot run a shell.

The dock resizes from its top edge (or Arrow keys on the resize handle). Sessions are shared across
Design/Tokens files attached to the same workspace. **Hide** keeps commands running; **End session**
terminates the shell and its jobs. Ctrl+C interrupts a command. Shift+Tab leaves terminal input so you can
reach the dock controls. Select output and use **Copy**, or paste using your system shortcut. **Clear**
clears the visible scrollback; reconnect can restore the server's recent output. **Reconnect** recovers
a dropped connection; a server restart ends old sessions and never replays commands.

Commands run with your local user's permissions: the workspace path is the starting directory, not a
filesystem sandbox. The server is loopback-only and requires same-origin capabilities. Four sessions,
12 connections, 256 KiB of recent output per session and 2,000 browser scrollback lines are retained in
memory. Detached sessions expire after 15 minutes. Shell history is not saved by default; startup scripts
are skipped so they cannot silently re-enable history persistence. The inherited environment/PATH remains
available. Supported shell choices are zsh, bash, sh, and dash via the server's `SHELL` environment variable.

Earlier validation covered the macOS arm64 workflow, fresh-package PTY installation, Linux Node 20/22 and macOS terminal lifecycle. The current Node 22/24 release matrix still requires a fresh CI run. Windows execution is explicitly
unavailable pending validation.
If native PTY installation is unavailable, the editor still starts and the panel reports how to rebuild
`node-pty`. The terminal does not belong to the design document, published libraries, or undo history.

## Developing Sigma

ES modules need a web server, so opening `index.html` directly won't work. Sigma's server (`tools/server.mjs`)
turns off browser caching, so code changes show up on reload. Run `npm install` first:

```bash
node bin/sigma-design.mjs standalone --port 5173       # Sigma on its own
node bin/sigma-design.mjs dev examples/css-app         # Sigma in the example project
```

The Sigma project contains **Tokens**, **Icons**, and **Components** for the app's interface.
Design components are derived from the actual code components, tokens, and icons, then verified against browser-rendered controls. The agreed workflow, acceptance criteria, and current coverage are documented in [Sigma source parity](docs/sigma-source-parity.md).
Components’ main specimens inherit the page mode; fixed Dark references remain below for comparison.
Tokens includes shared Foundation values used by the components, plus app-derived Light/Dark roles.

After editing interface sources, run `npm run build:icons` and `npm run build:welcome`.
Bump `SIGMA_SYSTEM_VERSION` in `src/sigma-design-system.js` when shipping changed built-ins.
The former Foundations, Pages and UI, and Guide examples files are permanently removed by a targeted migration,
including their archived copies. User-created files and Optics are not part of that cleanup.

Tests: with the server running, open `/tests/` (the in-browser tests); `npm run test:node` runs the Node
tests (the server, the command line, `init`, adapters, live sync, the team workflow). See `CONTRIBUTING.md`
for how to make a change, and `docs/data-and-ai.md` for what Sigma sends where (nothing to AI models).

## Appearance

Use the half-circle icon at the top right of every screen to choose **Auto**, **Light**, or **Dark**.
Auto follows your system appearance, including live changes. The choice is saved locally and synced
between tabs. The editor canvas follows the app appearance too. Interface appearance is independent of a design document’s token modes.

Select fields use a subtle outline and Sigma’s themed dropdown menu, with keyboard navigation and selected-option checks.

## Import Figma files

Use **Import** on the files home or **Σ → Import file…** in the editor, or drop a `.fig` file onto the files home. A single imported file opens directly in the Design Editor and saves as a normal Sigma design file. Parsing happens locally in a browser worker; no Figma login or upload is needed. The input limit is 128 MB. Compressed file size is not a guarantee of successful import: archives are capped at 256 MB expanded, embedded artwork at 64 MB, and the converted design transfer at 256 MB after deduplicating repeated artwork. Large or image-heavy files may need to be exported as smaller sets of pages. Import results use transferable byte chunks and a shared source table: repeated image/vector sources are sent once and reused across layers, so their occurrences do not multiply the transfer budget. The UI does not clone a huge worker object graph. Imported Figma documents use the same shared-source encoding in IndexedDB, version history, and undo snapshots to avoid repeating embedded artwork during saving and opening.

Pages, frames, groups, basic shapes and text become editable Sigma layers. Component definitions are imported; instances are detached into editable frames. Vector paths and image/linear/radial-gradient fills are embedded as SVG artwork. Layout positions are preserved, but Figma auto-layout rules, variable/style links, mixed text formatting, masks, unusual transforms and unsupported effects may be simplified. **Σ → Figma import report…** lists the changes; the report also appears after an import needing review. Fonts must be available in the browser for matching typography.

The pinned browser parser is [openfig-core](https://github.com/OpenFig-org/openfig-core). Rebuild its vendored modules with `npm ci` then `npm run build:figma`; license notices are in `src/vendor/figma-parser.NOTICE.txt`.

## Features

- **Files home:**
  - three kinds of file: **design** files (a canvas), **tokens** files (design tokens only, no canvas) and **icons** files
  - Recents shows all kinds; the **Design**, **Tokens** and **Icons** sections show one kind each, and the **Welcome to Sigma** folder holds Sigma's sample files, with a note on what the folder is for and a description on each file
  - lists every file saved in this browser, with thumbnails (Tokens files show a palette of their colors) and "Edited … ago"
  - has Recents and All files views, search, sorting, and a grid or list layout
  - lets you rename, duplicate, download and archive files from the card menu, or import `.fig`, `.sigma.json` and `tokens.json` files by dragging them onto the page
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
  - **+ Tokens file** creates a tokens file, which opens straight into a full-screen token editor
  - **Sample tokens** in the Welcome to Sigma folder is the sample tokens file: a complete example with Primitives (a palette with transparent colors, spacing, radii, type scales, text and a boolean), Semantic colors in Light and Dark, Brand B (an extension that only changes the accent), Typography styles built from the type primitives, and Components tokens that point at semantic tokens (button → accent → blue). It's published, so design files can link it right away
  - **Browse design tokens…** (Σ menu, or the file tools rail) opens the **Design tokens** window, with two tabs: the tokens file the file uses (named after it: its version, read-only collections and an **Open** link to edit them there) and **Local**, the file's own **local design tokens** (most files have none; **+ New collection** adds some just for this file). It opens on the tab of the selected collection, so on the tokens file when there are no local tokens. A tokens file that links others gets the same tabs (**This file** and **Linked**)
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
  - **deprecated tokens:** tick **Deprecated** in a token's inspector. It's struck through and hidden from token pickers, while layers and tokens that use it keep working (their chips are flagged). tokens.json writes `$deprecated` and CSS adds a `/* deprecated */` comment; both import back
  - **contrast pairs:** a color token's inspector has **Contrast**: **+ Check contrast with…** pairs it with the colors it's used with (text on a surface), and every pair shows its WCAG ratio and level (AA 4.5:1, AAA 7:1) in each mode, from either token. The sample pairs its text colors with the surfaces, and the on-accent text with the accent
  - **shadow tokens** hold a color (with opacity), X, Y, blur and spread; like typography, each part can point at a token (the color at an alpha color, say), and they're edited in the inspector with a live preview. A layer's effect uses one with **Shadow token**
  - **motion tokens:** **Duration** tokens are milliseconds and **Easing** tokens are cubic Bézier curves (`0.4, 0, 0.2, 1`, like CSS `cubic-bezier()`), with a small curve preview. Layers don't use them (Sigma has no prototyping); they're there for code, through tokens.json and CSS
- **Token audit:** **Audit design tokens…** (Σ menu, or the file tools rail) lists every color, text style, spacing (auto layout gap and padding), corner radius and shadow in the file that doesn't use a token, grouped by value with how many layers use it:
  - each value shows the token that matches it exactly (=) or comes closest (≈), compared in the layer's own modes (a layer in a Dark frame is matched against Dark values). Equally good matches prefer semantic tokens (surface/default) over primitives (color/gray/0) and component tokens (card/radius); +N says how many others match
  - **Use** binds the layers to it, **Choose…** picks another token, **Select** shows the layers, and **Use all exact matches** does every exact one at once
  - it also lists layers using deprecated tokens (**Replace with…**) and instances of deprecated components (**Swap to…**)
  - layers inside instances aren't listed (their values come from the main component), and a gap only counts when two or more layers are in the flow
- **Design tokens in design files:**
  - a design file uses **one tokens file** for its design tokens, chosen in **Design tokens…** (Σ menu, or the file tools rail), plus any local tokens it keeps. Its tokens show up everywhere a value can use a token
  - **Switch to this** changes the tokens file: layers move to the tokens with the same names in the new file (so tokens files with the same structure, like two brands, are interchangeable); tokens with no match keep their current values
  - **Publish…** in a tokens file creates a numbered version, with optional notes and a summary of what changed; the design file keeps a copy of the version it uses, and when a newer one is published it shows "Design token updates available" so you can review and accept
  - **Move to tokens file…** in the Design tokens window sends a file's local tokens to a new or existing tokens file, which the design file then uses
  - files from before tokens files move their variables into a tokens file the first time they're opened
- **Tokens files linking tokens files:**
  - a tokens file can link other tokens files (**Linked tokens files…**), so its tokens can point at theirs (a "Brand" file whose colors point at a "Core" file). Linked collections show read-only in the token editor
  - publishing a tokens file includes copies of the tokens files it points at, so a design file that uses "Brand" still resolves the "Core" values
  - unlinking a tokens file turns references to it into plain values
- **Icons files** (icons are a library of their own, not components):
  - **+ Icons file** creates an icons file: a grid of icons by style (Outline, Filled) and, within each style, by group, with a search. The sidebar lists the styles and their groups to show just one. It has no canvas
  - **Add Lucide icons** (on the Icons page when there are no icons files yet; in a project, the way to get Lucide as a project file) creates an icons file with the whole [Lucide](https://lucide.dev) set (1,877 outline icons, ISC License), grouped by Lucide's categories, with its tags as search keywords. It's published, so design files can link it right away; the file credits Lucide and shows its license. The set is built from a pinned Lucide version by `python3 tools/build-lucide.py [version]` into `icon-sets/lucide.json`
  - **Import SVGs** (or drop .svg files on it, or paste SVG code) adds icons from any free icon set (Lucide, Tabler, Heroicons, Phosphor, Material Symbols…). Icons go into the group you have open; importing an icon with the same name, group and style updates it (an outline and a filled icon can share a name)
  - import keeps only plain shapes (paths, circles, rects, lines, polygons, groups) and their geometry: scripts, styles, images, links and references are dropped. Colors become the layer's color, so an icon takes the color of the layer that shows it
  - each icon is **Outline** (drawn with strokes, keeping its stroke width) or **Filled**, detected on import and changeable. A filled icon can also have a stroke width, which outlines it too (filled versions of outline icons keep their size that way); 0 is fill only. More styles can come later
  - select icons (⌘-click adds, ⇧-click selects a range, ⌘A all) to edit their name, group, keywords (for search), style and stroke width, download or copy one as SVG, or delete them (⌫). Double-click a group to rename it (within its style)
  - **Publish…** creates a numbered version with notes and a list of what changed
- **Icons in components:**
  - a design file links icons files from **Icon libraries…**. It keeps copies of only the icons it uses, so linking a big set like Lucide keeps the file small; the picker reads the whole set from the icons file (Σ menu, or the file tools rail). Updates arrive like other libraries: a banner, **Review**, accept. Icons a new version removed stay where they're used (but aren't offered any more) until you swap them; an icons file can't be unlinked while its icons are in use
  - icons go inside main components (not loose on the canvas, for now): select a component or a layer in one, then **+** in the panel's Icon section, or **Insert icon…** on right-click. The picker has the icons by style and group, and a search that lists the best matches first
  - an icon layer has a size (W, H), a **Color** (its fill, which can use a color token) and, for outline icons, a stroke width (which can use a number token). **Swap icon…** changes the icon
  - instances show the main component's icon, at its size, color and stroke: none of these can be overridden in an instance
  - publishing components includes the icons they use, so files that link the component library show them, and records their icons files: linking the component library links those too, so instances can choose other icons
- **Version history** (Σ menu → **Show version history**, in design, tokens and icons files):
  - Sigma keeps an autosave version before each editing session and every 10 minutes while you work (the newest 50), plus one for every publish
  - **Save to version history…** (⌥⌘S) adds a named version with a description; named and published versions are kept until you delete them
  - click a version to view it read-only in place; **Restore this version** makes it current (the state it replaces is kept as a version first), and the ⋯ menu can copy it to a new file, name it or delete it
  - restoring never rolls back publish numbers, so linked files still see a consistent version sequence
  - versions are stored in this browser with the file and are deleted with it
- **Component libraries:**
  - **Publish components…** (Σ menu, or the panel with nothing selected) publishes a design file's components as a numbered version, with notes and a list of what changed
  - another design file links it from **Component libraries…**; its components appear in Assets under the library's name, ready to insert or drag
  - publishing records the tokens file the components use and the names of their tokens. A file that links the library and has no tokens file starts using that one. A file with a different tokens file (another brand with the same token names) gets the library's components matched to its own tokens by name, so they follow its values and modes. Tokens with no match are counted in **Component libraries…**, and those layers keep their colors
  - the publish dialog warns when components use the file's local tokens, which other files won't have
  - a library update shows a banner in files that use it; after **Review** and accept, instances update and keep their overrides
  - **Go to main component** on a library instance offers to open the library file
  - unlinking keeps instances as they look, marked "main component missing"
- **Export and import:**
  - in a tokens file's Σ menu, **Export tokens.json** writes the W3C Design Tokens format (DTCG):
    - groups come from `/` in names, and aliases are written `{group.token}`
    - colors use the DTCG color object with alpha, sizes are `{ value, unit: "px" }`, durations `{ value, unit: "ms" }`, easings `cubicBezier` arrays, and typography and shadow are composite types (CSS gets a `box-shadow` value)
    - each collection × mode is a token set, such as `Color/Dark`, the multi-set layout Tokens Studio and Style Dictionary setups use
    - re-importing a Sigma export rebuilds it exactly, including modes and extended collections
  - **Export CSS variables** writes custom properties: default modes go on `:root`, and each other mode or brand gets a selector such as `[data-color="dark"]` that swaps values on any element
  - **Import tokens.json…** merges tokens into the open tokens file, matching by name; dropping a `tokens.json` on the home page creates a new tokens file
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
- **Sigma project:** built-in **Tokens**, **Icons**, and **Components** describe Sigma’s actual interface. Foundations, Pages and UI, and Guide examples are retired from this project; existing built-in copies are permanently removed. The Foundations token collection remains in Tokens because components depend on it. Tokens provide Light/Dark modes; Icons contains the Lucide subset used by Sigma, with compatible IDs and searchable semantic aliases. Changes to these playground files reset on leaving or refreshing; **Make an editable copy** keeps a saved copy. New reference versions move old files to Archive. **Documentation** is a separate sidebar destination;
- **Constraints:** layers placed freely in a frame have horizontal (Left, Right, Left & right, Center, Scale) and vertical (Top, Bottom, Top & bottom, Center, Scale) rules
  - the rules apply when the frame is resized by its handles or its W/H fields; hold ⌘ while dragging to ignore them
  - they also apply when an instance is sized differently from its main component
- **Resizing:** each layer can be **Fixed**, **Hug** contents (auto-layout frames and text) or **Fill** container (children of auto-layout frames), separately for width and height
- **Min / max size:** **+ Min / max size** under the resizing options limits a layer's width and height (W≥, W≤, H≥, H≤). Hug and Fill sizes stay within them, and when a Fill layer reaches its limit, the space it leaves goes to the other Fill layers. Auto-width text wraps once it reaches its max width. Empty means no limit, the values can use number tokens, and instances follow their main component's limits
- **Corners:** the button next to the corner radius sets each corner separately (top-left, top-right, bottom-right, bottom-left), for tabs and other shapes rounded on some corners only. Each corner can use a number token; the shared field shows "Mixed", and typing a value there, or the button again, gives all four one radius
- **Stroke sides:** in the Stroke section, **Sides** turns the stroke on or off for each side of a rectangle, frame or image (an input with only a bottom border, a divider). Both corners and sides can be overridden in instances
- **Lock aspect ratio:** the link button next to W/H. It applies to typed sizes and to resize handles (hold ⇧ to override).
- **Layers panel:** tree view, rename (double-click or ⌘R), hide, lock, drag to reorder or nest
- **Resizable columns:** drag the edge of the layers panel or the properties panel (and the files home's sidebar, and the side columns of the tokens and icons screens) to the width you like; double-click an edge to reset it. The canvas keeps at least 320px. Widths are remembered per person in this browser (`src/columns.js`); a focused edge also moves with the arrow keys
- **File tools rail:** a thin column of icon buttons at the left edge of every file. In a **tokens** file: the Σ menu, Home, **Linked tokens files** (with how many are linked), **Import tokens.json**, **Export tokens.json** and **Export CSS variables**; in an **icons** file: the Σ menu, Home and **Import SVGs**. Hovering a button (or focusing it with the keyboard) shows its name and, under it, what's linked or what it does. In a design file: the **Σ menu** (it opens beside the rail) and **Home** (back to the files home) at the top, then **Change tokens file**, **Browse design tokens**, **Audit design tokens**, **Component libraries** and **Icon libraries**. Each opens its dialog; the tokens button has a red dot when the file has no tokens file (or several), the library buttons show how many are linked, and each button's tooltip says what's linked. They used to be in the Design panel with nothing selected, which now shows only the frame presets, Components, Page and Export (`src/rail.js`)
- **Pages:** add, rename, reorder (drag) and delete pages
- **Page groups** (Figma doesn't have them): pages can be grouped, so a file with many pages stays easy to find your way around. **+** in Pages → New page or New group; right-click a page → Move to group or Remove from group; right-click a group → Rename, New page in group, Collapse or Expand all groups, Ungroup (keeps the pages) or Delete group and its pages. Click a group to fold it away (remembered per person and file in this browser, not saved); the open page's group opens. Drag pages to reorder them and into or out of groups, and drag a group to move it with its pages. Files with more than 12 pages get a filter field. A page's group is saved as `"group"` on the page (a group's pages are kept together); elsewhere pages read “Group / Page”. Optics Components groups its pages by category, and the guide's pages are grouped too (`src/page-groups.js`)
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
  - the Σ menu has Back to files, New design file, Import file… and Download a copy
  - if the same file is open in two tabs, the other tab shows a reload banner
  - the first time you open this version, a document saved by an earlier version is moved in as a file

Press `?` in the app to see every keyboard shortcut.

## Comments

- **Comment tool** (C, or the speech bubble in the toolbar): click a layer to comment on it; the pin stays on the layer as it moves. Click a pin to read the thread, reply, resolve or delete. The **Comments** tab (left panel) lists them (open ones, or all), and jumps to one.
- Comments are stored in the file, so in a project they travel through git: **Propose change** includes them, and the pull request's description lists them with the layer each is on. An agent can bring pull request review feedback onto the exact layer with `node tools/sigma.mjs comment add --file … --layer "Card / Title" --text …` (and `comment list`, `comment resolve`); Sigma reloads and shows it.

## Code handoff

- **Code** (the tab next to Design in the right panel) shows, for the selected layer: its CSS (size, auto layout, padding, radius, fills, borders, shadows, type), with every value that comes from a token written as the token's variable (`var(--surface-default)`, the same names as **Export CSS variables**); the tokens it uses with their values in its modes and their code names on Web, iOS and Android; and for an instance, how it's written in code (`<Button variant="primary" label="Save" />`: variant properties always, other properties when they differ from the default). Each block has a copy button.
- **Code names:** a token's name in code per platform is in the token inspector (**Code names**: Web, iOS, Android; empty means the default from its path, like `--color-blue-500`, `colorBlue500`, `color_blue_500`). The sync skill fills Web in on import. A selected main component or set shows its **Component** API in Code: its code name and each property's (variant properties with their values), editable; defaults come from the names (`Show icon` → `showIcon`). Export CSS uses tokens' CSS code names.

## Sigma in a project

Sigma files can live in a project's repo, in `.sigma/` (see [docs/schema/README.md](docs/schema/README.md) for the format, and [repository workflow history](docs/roadmap-history.md#part-e-sigma-in-your-codebase)):

- **Files link by path, and git does the versioning.** A design file lists the tokens, icons and component library files it uses by their paths; whatever is checked out is what it uses.
- **Derived data is left out:** instances' layers, the values of token-bound properties, positions and sizes set by auto layout and text, and copies of linked files are rebuilt when a file opens. So is anything at its default value. A token change touches one line of one file.
- **In a project** (`npm run sigma`, or `npx sigma-design dev`), Sigma works on that project: the sidebar shows its name, **Design**, **Tokens**, **Icons** and **Recents** list the project's files (its `.sigma/` folder), new files go into the project, and a **Proposals** section lists changes proposed from Sigma. Files kept only in this browser are hidden there, with a one-time **Move into project…** (links between moved files are kept); the Archive is hidden too (git is the history of project files). Without a project, Sigma is a standalone design tool with files in the browser, as before. Sigma doesn't open projects itself: it runs inside the one it was started in. When its server stops, the home screen says so and how to start it again.
- **Save to project (⌘S):** Sigma saves your edits in the browser as you work, as always; ⌘S (or **Save to project** in the file's menu, or the status chip by the file name) writes the file to the project, checked by the validator. The chip says **In project** or **Save to project** (changes not saved yet). In a project file, Publish is hidden: saving is publishing.
- **Changes on disk:** Sigma checks the project every 2 seconds. When an agent or git changes the open file, it reloads (or asks, if it has changes not saved to the project); when a file it uses changes (new tokens or icons), it updates its copies and keeps your edits. Writes never overwrite a file that changed on disk since Sigma read it; Sigma asks instead.
- **Safety:** the server (`tools/server.mjs`) listens on 127.0.0.1, answers only requests addressed to localhost, reads and writes only `.sigma/` files and `sigma.config.json` (never through a link leading outside the project), and writes only for requests from Sigma (they carry a header other websites can't send). Writes are logged.
- **Propose change** (a file's menu, or the Proposals section): Sigma lists the edits since the last commit (it asks the server for the committed versions) as tokens, icons, components, pages and file settings, leaving out ones already proposed. Pick those that belong together, add a title and a note, and Sigma saves a changeset in `.sigma/changesets/` with before and after pictures of each changed component, page and icon. The rest can go in another proposal. The Proposals section lists them with their status. `node tools/sigma.mjs changeset list | show | apply | status` work with them; `apply --to <folder>` writes a pull request's files: the base with only that changeset's changes.
- **Proposals become pull requests** through the sync skill (`skills/sigma-sync/reference/workflow.md`): a ticket (Notion or GitHub Issues), a branch named by `workflow.branch` in a worktree, `changeset prepare` (the changeset applied to the Sigma files, the code written for tokens and icons, the changeset and pictures copied in, checked), the project's own checks, then a draft pull request in the repo's template with `changeset pr-body` (what changed, before and after pictures). `changeset sync` reads pull requests with `gh` and sets each proposal's status (In review, Changes requested, Merged, Closed), which the Proposals section shows.
- **Check files** with `node tools/validate.js <project folder>` (Node 22+, no additional validator dependencies): it reports each problem with where it is and what to do, and exits with 1 when there are errors.
- **Sync tokens with the code** (`skills/sigma-sync/SKILL.md`, a skill any agent can follow, with `node tools/sigma.mjs`): the agent works out the stack and records its decisions in `sigma.config.json`. CSS variables are read and written by the tool itself: `tokens import` (code → Sigma, merging so ids, descriptions and order stay and importing twice changes nothing), `tokens diff` (what changed since a git revision), `tokens write` (Sigma → CSS as minimal edits that keep each value's unit and color format), `check` (valid, and no drift). Other stacks (theme objects, Tailwind config…) go through a DTCG tokens.json the agent writes (`tokens import --from`), and the agent applies write-backs from `tokens diff`. Proven on `examples/css-app` (CSS variables) and `examples/mui-app` (an MUI theme).
- **Sync icons** the same way (`skills/sigma-sync/reference/icons.md`): an icon folder becomes an icons file (folders are groups, file names are icon names). `icons import`, `icons diff` and `icons write` handle SVG files themselves; writing only rewrites files whose shapes changed, in each file's own style, and deletes icons deleted in Sigma. Icon components (React, Vue…) go through SVGs the agent extracts (`icons import --from`), and the agent writes components from `icons write`.
- **Bring components in** (`skills/sigma-sync/reference/components.md`): `tools/capture/capture.js` captures a rendered component in each variant and state (hover, focus, pressed, disabled applied from the CSS); a manifest says what each capture is (variants, properties, nested components, code names); `node tools/sigma.mjs library build` turns captures into a library file with auto layout, token bindings and icon layers; `tools/capture/compare.html` lays the library out in Sigma and compares every layer with the real render. Proven on `examples/css-app` (Button, Input and Card: 11 of 11 match).
- **Bring pages in** (`skills/sigma-sync/reference/pages.md`): `match` rules in the manifest say how to recognize each component in a page's markup and read its variant and property values; `sigmaCapturePage(route, { width })` captures a route at a breakpoint; `node tools/sigma.mjs pages build` makes a Sigma page per route and a frame per breakpoint, out of library instances (nested ones set through overrides), and lists what isn't from the library for review. The compare page checks pages too. Proven on `examples/css-app` (Projects and Settings, desktop and mobile: all 4 match).
- **Design changes to components become code** (`skills/sigma-sync/reference/design-to-code.md`): `node tools/sigma.mjs components diff` shows what a designer changed in library components, in CSS terms, and the plan; `components write` (also part of `changeset prepare`) writes the exact part: values on a component's root set in the rule for exactly the variants that changed, a new variant value's rule named like its siblings', property defaults where the code declares them, and the manifest's new selectors and captures. The rest (markup, layers) is listed for the agent, which recaptures (`sigmaCaptureAll`) and compares, now including colors, before proposing. Pull request bodies show each component's design diff. Proven on `examples/css-app`: a padding change and a new Secondary button variant made in Sigma became a branch whose code matches the design (13 of 13).
- **Design system report** (project top bar **Report**, or `npx sigma-design report`): project-scoped component reuse, resolved token coverage, file breakdowns, and actionable findings. Filter by file, edit date, handoff pages, hidden layers and reference files. Search the details, filter library items by usage, and open the affected layer/component/token; **Back to Report** retains the report scope. Component instances distinguish linked/local/unresolved references. Typography is measured per field; component properties, images/gradients and expanded instance internals are excluded from direct token coverage. Missing/wrong-type token references are explicit findings. No-data is shown as —; very small percentages use <1% or >99% rather than false zero/full coverage. “No measured uses” applies only to the chosen scope, never an instruction to delete. Repository reports read files on disk (save pending editor changes before refreshing); browser reports use saved documents and their library snapshots. Resolved coverage validates token identity/type, not every computed mode value. GUI and CLI use the same model (`src/use-report.js`); **How these metrics are measured** explains denominators and exclusions.
- **Running the design system:** a status (Draft, In review, Ready) and docs for each component (purpose, what it's not for, usage, Do and Don't frames, a code link: **Docs…** in its menu); **Component status…** (main menu) shows every component with its readiness checklist and what's next; **Changelog…** lists what changed in the library (proposals and their pull requests in a project, publishes in the browser) as Markdown, also `npx sigma-design changelog`; **Export documentation page** saves one HTML page with the components' previews, docs and properties and the tokens per mode.
- **Visual change review:** before and after, side by side, with the changed pixels marked: **Compare…** when reviewing a library update (this file with the update accepted: the library's components and the frames that use them), when publishing components (the last publish against now, and the files with instances of what changed), and **Compare with current…** in the version history. Moving a frame isn't a change; only what renders differently is listed.
- **Optics project:** a saved, editable sample design system inspired by Polaris, with Tokens, Icons, Foundations, and Components. Its Icons file contains the full pinned Lucide outline catalogue plus 18 legacy filled derivatives, identified separately from upstream outlines. Existing uses keep their IDs. The browser and repository example use the same full-catalogue factory. Rebuild `examples/optics/` with `node tools/build-optics.mjs`; output is validated before writing.
- **Design system packages:** in a monorepo or with a shared package, `"packages": ["@acme/design-system"]` in `sigma.config.json` lets the app's Sigma files use the package's (from `node_modules/<package>/.sigma/`, through a workspace link too), at the version the app has installed. They show in the project with the package's name and version, and they're read-only: Sigma, the command line and live sync never write them.
- **Branches (in the browser):** main menu → **Create branch…** copies a design file to try a change on; **Merge into “…”…** merges it back three ways (your changes go in even if the main file changed meanwhile; on a conflict you choose whose wins), with **Compare…** to review the result and a version of the main file saved first.
- **Design-aware merging:** `npx sigma-design merge-driver install` makes git merge Sigma files item by item (tokens, icons, components, a page's top-level layers, comments) instead of line by line, so two branches that change different tokens or components merge cleanly; an item both changed differently keeps your side and is listed, with no conflict markers in the JSON.
- **MCP server:** `npx sigma-design mcp [project]` serves the sync steps as MCP tools over stdio, for agents without a terminal: checking, tokens and icons both ways, component diffs, proposals (list, show, PR body, ticket, status, sync), comments, the report and the changelog. Each tool runs the command of the same name. Add it to Claude Code with `claude mcp add sigma -- npx sigma-design mcp .`, or to any client as `{ "command": "npx", "args": ["sigma-design", "mcp", "."] }`.
- **Breakpoints:** Auto layout → Breakpoints lays a frame out differently at a width or narrower (a column under 600px, a smaller gap, a sidebar hidden), like max-width media queries; instances reflow when resized, and Code writes `@media` or `@container` CSS.
- **Right to left:** Auto layout → Direction sets a frame (and everything in it, instances included) right to left, like HTML's `dir`: rows start at the right and the alignment grid mirrors; Code writes `direction: rtl`.
- **Accessibility:** annotate layers in Code → Accessibility (alt text or decorative, an accessible label, a role, heading levels, focus order), with the HTML they mean; instances use their component's annotations, which they can override. **Check accessibility…** lists contrast below AA, tap targets under 24×24 or 44/48, text under 12px, images without alt text, controls without a name, skipped heading levels and repeated focus numbers, each with its WCAG reason. Component docs hold a role and keyboard guidance, and in a project a design pull request lists the check's results.
- **Sigma renders the project's components** (`skills/sigma-sync/reference/components.md`): the project has a components page built with its own tooling (`sigma.html` with Vite, say) that renders every component in every variant and loads `sigma-design/bridge`; `sigma.config.json` names it (`components[].page`). Sigma opens it in a hidden frame and asks the bridge for the captures, across origins, so it works with any bundler or framework. On the home screen, **Build from code…** builds a library that isn't built yet; a library's **Check against code…** captures, compares every component (and page) with it, and offers **Update the library from code**. Saving a library writes the exact part of its components' code (live sync). Proven on `examples/react-app` (Vite and React): the library built from its components page, and a padding change saved in Sigma was written to `components.css` and confirmed by the check, 13 of 13.
- **Live sync** (`npm run sigma`, on unless `--no-sync`): while Sigma runs in a project, the code and Sigma follow each other. When a token or icon source changes (an edit, a `git pull`), it's imported within a second and the open file reloads; when a token or icon file is saved in Sigma, what that save changed is written to the code at once (CSS and SVG by Sigma, other stacks through the project's adapter, checked by reading back), and the save message says which files were written. Only the save's own changes are written, so an edit in the code that Sigma hasn't read yet is never overwritten (`tools/live-sync.mjs`).
- **Adapters** (`skills/sigma-sync/reference/adapters.md`): for stacks Sigma doesn't read itself (a JS theme, Tailwind, SCSS, icon components), the agent writes `.sigma/adapters/tokens.mjs` (or `icons.mjs`) once, at setup: `read()` the code as DTCG (or SVG files) and `write(changes)` as minimal edits, with Sigma's helpers for keeping the file's own formats. Sigma then runs it on every `tokens import`, `tokens write` and `check`, with no agent in the loop, and checks every write by reading back (a write that doesn't read back the same is put back, with the reason). `sigma-design adapter test` proves an adapter: it reads what Sigma has, and a change written through it reads back the same as a small diff. Proven on `examples/mui-app` (an MUI theme and React icon components): a color changed in Sigma became a one-line edit in `src/theme.js`.
- **Rules and project skills** (`sigma-design agents`, also run by `init`): a marked Sigma section in the repo's agent instructions (`AGENTS.md`, `CLAUDE.md`, Copilot or Cursor rules; `AGENTS.md` and a `CLAUDE.md` including it when there are none) and four thin skills in `.claude/skills/` (`sigma-tokens`, `sigma-components`, `sigma-propose`, `sigma-design-to-code`) with the project's facts from `sigma.config.json`, pointing to the guide in the package. Running it again replaces only Sigma's marked parts: the team's own instructions and each skill's Project notes (the agent's) stay.
- `examples/react-app/` is a Vite and React app with Sigma installed (its library built and checked from its components page).
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
| `src/variables-ui.js` | The design token editor (a modal in design files, full-screen in tokens files) |
| `src/tokens-screen.js` | The tokens file screen |
| `src/icon-library.js` | Icons: SVG import and cleaning, drawing, groups, search, version changes |
| `src/icons-screen.js` | The icons file screen |
| `src/icon-ui.js` | The icon picker and icon layers in components |
| `src/libraries.js` | Token and component libraries: publishing, linking, updates, migration |
| `src/token-builders.js` | Shared construction helpers for real design-system tokens |
| `src/sample.js` | The blank design file |
| `tests/fixtures/welcome.js`, `tests/fixtures/sample-tokens.js` | Legacy teaching fixtures used by format and token regression tests; not app files |
| `src/sample-icons.js` | Separate Sigma UI subset and full Lucide catalogue factories; stable compatibility IDs |
| `src/project-format.js` | Sigma files in a project: saving without derived data, opening (rebuilding it), stable JSON |
| `src/validate.js` | Checks project files and says what's wrong (used by `tools/validate.js`) |
| `src/project.js` | Projects: reaching one (the server or a picked folder), bringing files in, saving to the project, watching for changes on disk |
| `src/project-ui.js` | The project status chip and menu items |
| `src/project-config.js` | `sigma.config.json`: what the sync skill decided about a project |
| `src/token-sync.js` | Tokens between code and Sigma: CSS variables in and out, merging, diffs |
| `src/icon-sync.js` | Icons between code and Sigma: SVG folders in and out, merging, diffs, writing in the project's style |
| `bin/sigma-design.mjs` | The `sigma-design` command (the npm package's): `init`, `dev`, `standalone`, and the sync tools |
| `tools/server.mjs` | Sigma's local server: the editor, optional project API, and terminal transport (Node and packaged dependencies) |
| `tools/init.mjs` | `sigma-design init`: finds a project's tokens and icons and sets Sigma up |
| `src/use-report.js` | The design system use report: component and token shares, most-used and unused components and tokens |
| `src/component-docs.js` | Component status, docs and the readiness checklist; the component status matrix and docs editor |
| `src/changelog.js` | A library's changelog from proposals or publishes, as Markdown |
| `src/doc-site.js` | The exported documentation page: components with previews and docs, tokens per mode |
| `src/a11y.js` | Accessibility annotations, roles and the accessibility check (`a11y-kinds.js`: issue kinds and their Markdown; `a11y-ui.js`: the dialog) |
| `src/visual-review.js` | Visual change review: before and after renders in a copy of the file, pixel differences, what a change reaches |
| `src/code-check.js` | Check against code and Build from code: the components page in a frame, captures through its bridge, compare, rebuild |
| `tools/capture/bridge.js` | The capture bridge a project's components page loads (`sigma-design/bridge`) |
| `tools/live-sync.mjs` | Live sync while Sigma runs: watching the token and icon sources, and writing the code after a save |
| `tools/agents.mjs` | `sigma-design agents`: the rules and project skills for the repo's coding agents |
| `tools/lib/adapters.mjs` | Project adapters: loading them, their context (files and Sigma's helpers), undoing a write |
| `src/changesets.js` → `mergeFiles` | Design-aware three-way merge of a Sigma file (`merge-file`, git's merge driver) |
| `src/optics-tokens.js`, `src/optics.js`, `src/optics/` | Optics tokens, full Lucide library and token-bound Foundations/Components; `optics/kit.js` supplies shared building blocks |
| `src/branches.js` | Branches of a browser design file: create, merge back three ways, compare |
| `tools/mcp.mjs` | The MCP server (`npx sigma-design mcp`): the sync commands as tools over stdio |
| `tools/capture/parity.html` | Render parity: captures every library from its components page and compares Sigma's layout with the code (`tools/test/run-render-parity.mjs` runs it in CI) |
| `tools/test/` | Node tests for the server, `init`, adapters, `agents`, live sync, accessibility in pull requests and the team workflow (`npm run test:node`) |
| `tools/sigma.mjs` | The command line the sync skill uses (validate, check, tokens and icons import / diff / write, changesets, library and pages build, components diff / write, comments) |
| `src/capture-to-sigma.js` | Captured components → Sigma components (auto layout, token bindings, icons, variants), captured pages → frames of library instances, and comparing them with the capture |
| `src/capture-compare.js` | Lays a built library and pages out and compares them with their captures (`tools/capture/compare.html`) |
| `src/component-diff.js` | Design to code: a component's design diff, and the CSS and code edits it needs |
| `src/css-rules.js` | CSS rules as text: finding a rule by selector and editing one declaration, keeping the rest of the file |
| `tools/capture/` | `capture.js` (runs in the page that renders a component) and the compare page |
| `skills/sigma-sync/` | The sync skill: instructions for agents, with references |
| `src/code-names.js` | Code names for tokens (per platform), components and properties |
| `src/inspect.js` | The Code panel: CSS with token variables, tokens used, instance usage, component API |
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
| `src/dialogs.js` | Sigma's own confirm and prompt dialogs (`ask`, `askText`): the browser's don't show in every embedded browser, where they answer Cancel at once |
| `src/columns.js` | Resizable columns: the drag handles at side columns' edges, their limits, and the widths remembered in this browser |
| `src/rail.js` | The file tools rail: icon buttons for the file's tokens file, its tokens and their audit, and its component and icon libraries |
| `src/page-groups.js` | Page groups: runs of grouped pages, keeping a group's pages together, moving pages and groups |
| `src/io.js` | Clipboard, images, export, download |
| `src/db.js` | Small IndexedDB wrapper: `files` store (metadata and thumbnails) and `docs` store (documents) |
| `src/files.js` | File records, autosave of the open file, thumbnails, cross-tab messages, migration |
| `src/home.js` | The files home page |

Every node stores `x, y, w, h, rotation` relative to its parent and rotates about its center. All transforms go through `setWorldMatrix`, which turns a desired on-canvas matrix back into local properties. This is what lets moving, rotating and reparenting work at any nesting depth.

## License

Free to use, change and build with, as long as you don't sell Sigma itself and you credit it: the Apache
License 2.0 with the Commons Clause (`LICENSE`). Keep the `NOTICE` file with any copy or derived work. Because
selling it isn't allowed, Sigma is *source-available* rather than OSI "open source". Third-party parts keep
their own licenses (Lucide's icons: ISC; see `NOTICE`).

### Welcome system synchronization

Welcome Tokens now publish Foundation aliases for spacing, dimensions, radii, typography, and elevation, including CSS shorthand zero values. Components bind their layouts to those tokens and show explicit control states. Dropdown menus and segmented controls compose reusable item instances. Components retain labelled Light/Dark references while the editor follows global appearance. Icons includes a Lucide · Sigma UI group generated from the app’s shared Lucide registry, showing canonical Lucide names with searchable Sigma aliases; the multicolor brand mark remains separate from the monochrome icon library. Regeneration versions refresh existing Welcome files, and library reuse validates token values and Sigma icon content.

### Projects, Drafts, and Documentation

Choose a project from the Home sidebar Projects group. Its top bar has an editable title and project icon, with a saved editable description underneath and files grouped into Design, Tokens, and Icons. Empty file sections are hidden. Click the sidebar or page icon to choose an emoji or Lucide glyph. The top-bar Report button opens the selected project’s design-system report and offers **Go back to Files** to return. Repository projects also have a **Proposals** button; offline repositories explain how to reconnect without showing another project’s changes. Sort and grid/list controls in the top bar share the Home view preference.

Sidebar search finds files across projects and Drafts and labels their source. **Create New** offers Design file, Tokens file, Icons file, and Import. New files belong to the open project; from Recents, Drafts, Documentation, or global search they belong to Drafts. Recents shows files across projects and Drafts, ordered by opening time (falling back to editing time for older files). Drafts lists all unowned files and supports moving them into projects. Sigma’s examples live in Sigma; Optics contains the Polaris-inspired sample design system.

Documentation sits at the bottom of the sidebar; its contents will be prepared before Sigma ships. Sigma example edits remain temporary; editable copies are saved to Drafts. Library pickers start in the current scope, with **Other projects and Drafts** for external libraries. Connected repositories remain selectable and use the existing `.sigma/` storage adapter.

Design canvas backgrounds follow the app’s Auto/Light/Dark appearance. Page settings keep token mode controls and no longer offer a canvas background color picker.

Component documentation is collapsed by default in Design and Code. Code separates variant values and property defaults from editable code names, shows resolved accessibility labels, and highlights code snippets and token references for Light/Dark appearance.

The Design editor’s **Code → Create code…** workspace generates an editable HTML/CSS draft from a selection or the current page. Update its sandboxed preview, choose a preview width, and copy or download a self-contained HTML file. Output includes referenced tokens resolved in the design’s current modes; scripts and external asset links are removed. Source edits last while the workspace is open, with confirmation before regeneration or closing. This first increment expands component instances into HTML; repository Apply and framework component imports remain planned.

### Interface icon provider

Sigma’s interface uses pinned Lucide artwork through `src/lucide.js` and stable semantic aliases in `src/ui-icon-map.js`. Run `npm run build:icons` after adding an icon. The generated UI subset avoids loading the full catalogue at startup. Sigma’s brand logo remains separate. Existing Optics icon files and embedded component snapshots refresh in place, retaining IDs, custom icons and design edits. See `NOTICE` for attribution.

Reference maintenance: run `npm run build:icons` and `npm run build:welcome` after changing interface sources. The retired screen-capture pipeline is removed. Teaching generators live under `tests/fixtures/`, used by regression tests and the schema sample-project builder.

Sigma project source parity follows icons → tokens → components. The shared control inventory, first-party stylesheet extraction, scoped Code colors, motion tokens and browser parity fixtures are documented in `docs/sigma-source-parity.md`; remaining composite coverage is explicit rather than implied by token coverage.
