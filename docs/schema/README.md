# Sigma file format

How Sigma files are stored in a project, so that a person or an agent can read and write them without
Sigma's source. Format **1**.

- Check files with `node tools/validate.js <project folder>` (Node 18+, no dependencies). It reports every
  problem with where it is and what to do, and exits with 1 when there are errors.
- `examples/sample-project/` holds Sigma's sample files in this format (built by
  `node tools/build-sample-project.mjs`). Copy from them.
- JSON Schemas for editors and tools: [`sigma-tokens.schema.json`](sigma-tokens.schema.json),
  [`sigma-icons.schema.json`](sigma-icons.schema.json), [`sigma-design.schema.json`](sigma-design.schema.json),
  [`sigma-config.schema.json`](sigma-config.schema.json). The validator checks more than they can (links
  between files, references between tokens, types).

## A project

```text
<project>/
  sigma.config.json            what the sync skill decided (see "sigma.config.json" below)
  .sigma/
    tokens/<name>.sigma.json   Sigma Tokens files: design tokens
    icons/<name>.sigma.json    Sigma Icons files: icons
    design/<name>.sigma.json   Sigma Design files: components (a library) and pages
    changesets/<id>.json       proposed changes (Propose change), until they're merged
```

File names are the file's name in lowercase with dashes (`Brand Colors` → `brand-colors.sigma.json`).

## Rules for every file

1. **The repo is the source of truth; git does the versioning.** Files link other files by their path from
   the project root, in `uses`. Whatever version is checked out is the one used. There is no publishing
   inside a project: a commit is the publish, a pull is the update.
2. **Derived data is left out.** Sigma rebuilds it when it opens a file, so it never needs to be written
   (and shouldn't be):
   - an instance's layers and the properties it takes from its main component (only its choices are
     stored: overrides, property values, slots, and its size if it was resized)
   - the value of a property that uses a token (`bindings` says which token; the value comes from it)
   - positions inside an auto layout frame, sizes that hug or fill, and the size of auto-sized text
   - copies of linked files
3. **Defaults are left out.** A layer without `opacity` is fully opaque. See "Defaults" below.
4. **Ids are stable.** Every collection, mode, token, group, icon, page and layer has an `id` (any string
   unique in its file, like `"btn-primary"` or `"k3edz8tk"`). Other things refer to them by id, so never
   change an id to rename something; change its `name`.
5. **Keys are sorted** (`id`, `type`, `name` first; long lists last) and small objects stay on one line, so
   changes show as small diffs. Sigma writes files this way; files written by hand can be in any order.

Every file starts with:

```json
{ "format": 1, "kind": "tokens" | "icons" | "design", "name": "Core", "uses": { … } }
```

`uses` (optional) lists the files this one links, by path:

| Key | In | Lists |
| --- | --- | --- |
| `tokens` | any file | Sigma Tokens files whose tokens it uses (a design file usually has one) |
| `icons` | design files | Sigma Icons files whose icons its components use |
| `components` | design files | Sigma Design files whose components it places (component libraries) |

## Sigma Tokens files

```json
{
  "format": 1, "kind": "tokens", "name": "Core",
  "collections": [
    {
      "id": "primitives", "name": "Primitives",
      "modes": [{ "id": "default", "name": "Default" }], "defaultModeId": "default",
      "variables": [
        { "id": "blue-500", "name": "color/blue/500", "type": "color", "valuesByMode": { "default": "#0D99FF" } },
        { "id": "space-4", "name": "space/4", "type": "number", "valuesByMode": { "default": 16 } }
      ]
    },
    {
      "id": "semantic", "name": "Semantic",
      "modes": [{ "id": "light", "name": "Light" }, { "id": "dark", "name": "Dark" }], "defaultModeId": "light",
      "variables": [
        { "id": "accent", "name": "accent/default", "type": "color", "description": "Links and primary buttons",
          "valuesByMode": { "light": { "alias": "blue-500" }, "dark": "#4DB5FF" } }
      ]
    }
  ]
}
```

- **Collections** hold tokens with the same **modes** (columns: Light and Dark; or just one). Every token
  has a value for each mode in `valuesByMode`, keyed by mode id. `defaultModeId` is used when nothing picks
  a mode.
- **Token names** are paths: `color/blue/500` is the token `500` in the group `blue` in the group `color`.
  Groups are made from the paths, so `groups` can be left out. (Sigma writes `groups` with ids, and each
  token's `groupId`; if both are there, `groupId` wins. A group can have a `description`.)
- **References**: a value can be `{ "alias": "<token id>" }`, pointing at another token of the same type, in
  this file or in a file it `uses`. The validator reports missing targets, wrong types and loops.
- Optional on a token: `description`, `deprecated: true` (kept working but not offered),
  `contrastWith: ["<token id>"]` (color tokens used together, checked for contrast), and
  `codeSyntax: { "web": "--color-blue-500" }`: the token's name in code (a CSS variable, or a theme path
  like `palette.primary.main`), written by the sync skill and used to write changes back. `ios` and
  `android` can hold the names on those platforms.

| `type` | Value | Example |
| --- | --- | --- |
| `color` | `#RRGGBB`, or `#RRGGBBAA` with opacity | `"#0D99FF"`, `"#00000033"` |
| `number` | a number (px for sizes; `opacity` tokens are 0–100) | `16` |
| `string` | text | `"Inter"` |
| `boolean` | `true` or `false` | `true` |
| `typography` | `{ fontFamily, fontWeight, fontSize, lineHeight, letterSpacing }`; lineHeight is a % or `null` (auto) | `{ "fontFamily": "Inter", "fontWeight": 600, "fontSize": { "alias": "size-lg" }, "lineHeight": 140, "letterSpacing": 0 }` |
| `shadow` | `{ color, x, y, blur, spread }` | `{ "color": "#0000001A", "x": 0, "y": 2, "blur": 8, "spread": 0 }` |
| `duration` | milliseconds | `200` |
| `easing` | cubic Bézier `[x1, y1, x2, y2]` | `[0.2, 0, 0, 1]` |

Each field of a typography or shadow value can itself be `{ "alias": "<token id>" }` of the field's type.

**Extensions** re-skin a collection (a second brand). They have no tokens of their own, only the values
they change, by token id and their own mode ids:

```json
{ "id": "brand-b", "name": "Brand B", "extends": "semantic",
  "modes": [{ "id": "b-light", "name": "Light", "parentModeId": "light" }, { "id": "b-dark", "name": "Dark", "parentModeId": "dark" }],
  "defaultModeId": "b-light",
  "overrides": { "accent": { "b-light": "#7C3AED", "b-dark": "#A78BFA" } } }
```

## Sigma Icons files

```json
{
  "format": 1, "kind": "icons", "name": "App icons",
  "source": { "name": "Lucide", "version": "1.55.0", "url": "https://lucide.dev", "license": "ISC" },
  "icons": [
    { "id": "arrow-right", "name": "arrow-right", "group": "Arrows", "keywords": "next, forward",
      "style": "outline", "viewBox": "0 0 24 24", "strokeWidth": 2, "cap": "round", "join": "round",
      "body": "<path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/>" }
  ]
}
```

- `style` is `outline` (drawn with strokes) or `filled` (drawn with fills; a `strokeWidth` above 0 outlines
  it too, so a filled version of an outline icon keeps its size).
- `body` is the icon's shapes as SVG markup, without the `<svg>` element. Only plain shapes and their
  geometry: `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon` and `g`, with `transform`,
  `fill-rule`, `clip-rule` and opacities. Colors are `currentColor` (or `none`): an icon takes the color of
  the layer that shows it. Anything else (styles, scripts, images, links, gradients) is removed on load, and
  the validator warns about it.
- `group` and `keywords` (comma-separated) are for finding icons; `source` credits an icon set and can hold
  its `licenseText`.

## Sigma Design files

```json
{
  "format": 1, "kind": "design", "name": "Library",
  "uses": { "tokens": [".sigma/tokens/core.sigma.json"], "icons": [".sigma/icons/app-icons.sigma.json"] },
  "pages": [
    { "id": "components", "name": "Components", "background": "#F5F5F5", "children": [ …layers… ] }
  ]
}
```

A page marked for handoff has `"handoff": true` (the design system use report can count only those).

A design file can also have `collections` (local tokens, like a tokens file's), but tokens belong in a
Sigma Tokens file.

### Layers

Every layer has `id`, `type` and `name`, and is positioned by `x`, `y` (relative to its parent) and sized by
`w`, `h`, in px.

| `type` | What it is | Has `children` |
| --- | --- | --- |
| `frame` | a box that can clip, have auto layout and hold layers | yes |
| `group` | layers moved together; its box fits them | yes |
| `rect`, `ellipse` | shapes | no |
| `line` | a line of length `w` (use `strokes`) | no |
| `text` | text: `text`, `fontFamily`, `fontSize`, `fontWeight`, `lineHeight` (% or null), `letterSpacing`, `textAlign`, `autoResize` (`width`, `height` or `fixed`), `textCase` (`upper`, `lower`, `title`), `truncate` and `maxLines` | no |
| `image` | an image (`src`, a URL or data URL) | no |
| `icon` | an icon from a Sigma Icons file: `iconId`; its color is its first fill; `iconStroke` sets an outline icon's stroke width | no |
| `component` | a main component (a frame others can place) | yes |
| `componentSet` | variants: components named `Prop=Value, Prop2=Value` | yes (only components) |
| `instance` | a placed component: `componentId` | no (see below) |

Common properties (all optional):

- **Paint:** `fills` and `strokes` are lists of `{ "color": "#RRGGBB", "opacity": 1, "visible": true }`
  (top last). `strokeWidth`, `strokeAlign` (`inside`, `center`, `outside`), `strokeSides`
  (`{ "top": false }` hides a side). No `fills` means no fill.
- **Shape:** `radius`, or `radii: [tl, tr, br, bl]`; `rotation` in degrees; `opacity` 0–1; `visible`;
  `locked`; `clip` (frames clip their contents by default).
- **Effects:** `effects: [{ "type": "drop-shadow" | "inner-shadow" | "layer-blur", "color", "opacity", "x", "y", "blur", "spread" }]`.
- **Auto layout** (frames and components): `layout: { "mode": "horizontal" | "vertical", "gap", "spacing": "packed" | "auto", "pt", "pr", "pb", "pl", "alignP", "alignC" }`
  (alignments are `start`, `center` or `end`). Children are placed in order; leave out their `x` and `y`.
  A child with `absolute: true` is placed freely.
- **Resizing:** `sizingH` and `sizingV` are `fixed`, `hug` (fits its contents; auto layout frames and text)
  or `fill` (takes the space left in an auto layout parent). Leave out a size that hugs or fills.
  `minW`, `maxW`, `minH`, `maxH` limit them.
- **Constraints** (in a frame without auto layout): `constraints: { "h": "left" | "right" | "leftRight" | "center" | "scale", "v": "top" | "bottom" | "topBottom" | "center" | "scale" }`.
- **Layout grids:** `layoutGrids: [{ "type": "columns" | "rows" | "grid", "count", "gutter", "margin", "size", "align", "color", "opacity", "visible" }]`.

### Tokens on layers

`bindings` maps a property to the token that sets it, and the property's value is left out:

```json
{ "id": "card", "type": "frame", "name": "Card",
  "fills": [{}], "bindings": { "fills.0.color": "surface-raised", "radius": "radius-lg", "layout.gap": "space-3" } }
```

| Property | Token type |
| --- | --- |
| `fills.N.color`, `strokes.N.color` | color (its opacity becomes the paint's) |
| `w`, `h`, `radius`, `radii.N`, `opacity`, `strokeWidth`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `minW`, `maxW`, `minH`, `maxH`, `iconStroke`, `layout.gap`, `layout.pt`, `layout.pr`, `layout.pb`, `layout.pl`, `layoutGrids.N.count` / `.size` / `.gutter` / `.margin` | number |
| `text`, `fontFamily` | string |
| `visible` | boolean |
| `typography` | typography (sets the five text properties) |
| `effects.N` | shadow |

**Modes:** `modes: { "<collection id>": "<mode id>" }` on a layer or a page picks a mode (Dark) or an
extension (Brand B) for everything inside it.

### Components and instances

A component defines **properties** in `props` (on the component, or on its component set for variants),
listed in order. A layer inside the component uses one through `propRefs`:

```json
{ "id": "button", "type": "component", "name": "Button",
  "props": {
    "label": { "type": "text", "name": "Label", "default": "Button" },
    "show-icon": { "type": "boolean", "name": "Show icon", "default": true },
    "icon": { "type": "icon", "name": "Icon", "default": "arrow-right", "groups": ["Arrows"] }
  },
  "children": [
    { "id": "button-label", "type": "text", "name": "Label", "text": "Button", "propRefs": { "text": "label" } },
    { "id": "button-icon", "type": "icon", "name": "Icon", "iconId": "arrow-right", "propRefs": { "iconId": "icon", "visible": "show-icon" } }
  ] }
```

| Property `type` | Sets on the layer (`propRefs` key) | Value |
| --- | --- | --- |
| `boolean` | `visible` | true or false |
| `text` | `text` | text |
| `instance` | `componentId` (of a nested instance) | a component id (`preferred` lists suggestions) |
| `icon` | `iconId` | an icon id (`groups` limits the choice; all icons if left out) |
| `slot` | `slot` (on a frame) | layers an instance adds (`min`, `max`, `preferred`, `description`) |

**Code names** (optional) say what a component and its properties are called in code, for handoff and
for agents mapping Sigma to the code library: `codeName` on a component (or its component set: `"Button"`),
`codeName` on a property (`"label"`), and `codeNames` on a component set for its variant properties
(`{ "Style": "variant" }`). Without them, names come from Sigma's (`Show icon` → `showIcon`).

**Status and docs** (optional, Part D) are on a component, or on its component set for its variants:
`"status"` is `"review"` or `"ready"` (left out: draft); `"docs"` holds `purpose`, `notFor`, `usage`, `dos` and
`donts` (ids of example frames in the file), `code` (a path or link), and for accessibility `role` (as in
`a11y.role` below) and `keyboard` (how it works with a keyboard and screen readers); `"checks"` records what a
person confirmed for its readiness: `{ "variants": true, "breakpoints": true, "accessibility": true }`.

**Breakpoints** (optional): an auto layout frame can lay out differently by its width.
`"layout": { "mode": "horizontal", "gap": 24, "breakpoints": [{ "maxW": 600, "mode": "vertical", "gap": 12 }] }`:
at 600px wide or narrower, the breakpoint's values (`mode`, `gap`, `spacing`, `pt`, `pr`, `pb`, `pl`, `alignP`,
`alignC`) replace the frame's; the narrowest that fits wins, like `max-width` media queries. They make sense on
frames with a fixed or fill width. Instances copy them, so a component reflows when an instance is resized.

**Direction** (optional): `"dir": "rtl"` on a frame lays out right to left, like HTML's `dir`: auto layout
rows start at the right and the counter-axis start is the right edge, for this frame and everything inside it
until a frame sets its own (`"ltr"`). Padding stays physical (`pl` is the left padding). An instance follows its
main component's `dir`, or its own.

**Accessibility annotations** (optional) on any layer, in `"a11y"`:

```json
{ "a11y": { "alt": "A team around a whiteboard", "label": "Close", "role": "button", "heading": 2, "focus": 3, "decorative": true } }
```

- `alt`: an image's text alternative. `decorative: true`: an image or icon screen readers skip.
- `label`: an accessible name, for a control with no text (an icon-only button).
- `role`: `button`, `link`, `checkbox`, `radio`, `switch`, `tab`, `textbox`, `combobox`, `slider`, `menuitem`,
  `img`, `heading`, `navigation`, `dialog`, `list` or `none`. Left out, an instance takes its component's
  `docs.role`, or one from the component's name ("Icon button" is a button).
- `heading`: a text layer's heading level, 1 to 6. `focus`: its place in its frame's focus order, from 1.

An instance uses its main component's annotations unless it sets its own; layers inside an instance can be
annotated per instance through `overrides` (`"overrides": { "Photo": { "a11y": { "alt": "…" } } }`).

An **instance** stores only what it changes from its main component:

```json
{ "id": "save", "type": "instance", "componentId": "button", "x": 40, "y": 120,
  "propValues": { "label": "Save", "icon": "check" },
  "overrides": { "Label": { "fills": [{ "color": "#FF0000" }] } } }
```

- `propValues`: property values, by property id.
- `overrides`: other changes, keyed by the layer's name path from the instance (`"Content/Label"`;
  `"Label#2"` for the second layer of that name; `""` for the instance itself). Instances can change
  paint, effects, radius, visibility, text and text properties, a nested instance's `componentId` and
  `propValues`, and token bindings. Icons in instances can't be changed except through properties.
- `slots`: `{ "<slot path>": { "nodes": [ …layers… ] } }`, what the instance put in a slot.
- A resized instance has its `w`/`h` and `synced` (the main component's size it was resized from).
- `componentId` can be a component in this file or in a file listed in `uses.components`.

### Defaults

Left out when a layer has them: `x: 0`, `y: 0`, `rotation: 0`, `opacity: 1`, `visible: true`,
`locked: false`, `strokeWidth: 1`, `strokeAlign: "inside"`, `radius: 0`, `clip: true` (frames, components
and sets), paints' `opacity: 1` and `visible: true`; for text `text: ""`, `fontFamily: "Inter"`,
`fontSize: 16`, `fontWeight: 400`, `lineHeight: null`, `letterSpacing: 0`, `textAlign: "left"`,
`autoResize: "width"`; for auto layout the values of an unset layout (`gap: 10`, padding 0, `spacing:
"packed"`, alignments `start`). No `fills` or `strokes` means none.

## Comments

A design file can have `comments`, pinned to layers (made with Sigma's comment tool, or added by an agent with
`node tools/sigma.mjs comment add`):

```json
"comments": [{ "id": "kx8mkqa2", "pageId": "components", "nodeId": "card-title", "at": { "x": 10, "y": 10 },
               "layer": "Card / Title", "text": "Use the heading token here.", "author": "Ana",
               "createdAt": "2026-10-13T09:00:00.000Z", "resolved": true, "resolvedBy": "Ben",
               "replies": [{ "id": "r1", "text": "Done", "author": "Ben", "createdAt": "…" }] }]
```

`at` is in the layer's own coordinates (so the pin moves with it), or the page's when `nodeId` is null;
`layer` is its name path when the comment was made, for reading it outside Sigma.

## Changesets (`.sigma/changesets/<id>.json`)

What a designer proposes with **Propose change**: some of the edits made since the last commit, to become a
ticket and a pull request (the sync skill does that; Sigma doesn't touch git).

```json
{ "id": "2026-10-12-darker-hover-for-buttons-tmu6zq", "title": "Darker hover for buttons", "note": "…",
  "author": "", "createdAt": "2026-10-12T09:30:00.000Z", "status": "proposed", "base": "HEAD",
  "changes": [
    { "key": ".sigma/tokens/acme.sigma.json#token:accent-hover", "file": ".sigma/tokens/acme.sigma.json",
      "kind": "token", "id": "accent-hover", "name": "accent/hover", "change": "changed",
      "before": { …the token as in the base… }, "after": { …the token in Sigma… }, "where": { "index": 1 } }
  ],
  "renders": { "<change key>": { "before": ".sigma/changesets/<id>/1-component-before.svg", "after": "…" } },
  "branch": "design/darker-hover", "ticket": { "tracker": "notion", "url": "…" }, "pr": { "host": "github", "url": "…", "number": 42 } }
```

- A change (`kind`) is one token, icon, component (or component set), a page's own content (its layers other
  than components, which appear as `{ "$component": "<id>" }`), or a file's other settings (`file`: name,
  links, collections and modes). `before` / `after` are in the project format; `null` when added / removed.
- `accessibility` (optional): Sigma's accessibility check on the changed components and pages, as proposed:
  `{ "checked": ["page Projects"], "issues": [{ "kind": "contrast", "severity": "error", "name": "Label in Button",
  "frame": "Projects — Mobile", "message": "2.8:1 against #FFFFFF; needs 4.5:1", "group": "…" }] }`. The pull
  request body lists them.
- `status`: `draft`, `proposed` (saved by Sigma), `in-review` (pull request open), `changes-requested`,
  `merged` or `closed`.
- `node tools/sigma.mjs changeset apply <id> --to <folder>` writes the files of the pull request: the base
  (git) with only this changeset's changes, so one session's edits can become separate pull requests.

## sigma.config.json

What the sync skill decided about the project, so later runs follow it (people can edit it too):

```json
{
  "schema": 1,
  "stack": { "styling": ["css-variables"], "framework": "react" },
  "tokens": [{ "sigma": ".sigma/tokens/core.sigma.json",
               "sources": [{ "path": "src/styles/tokens.css", "format": "css-variables" }],
               "naming": "kebab", "modes": { "Light": ":root", "Dark": "[data-theme=\"dark\"]" } }],
  "icons": [{ "sigma": ".sigma/icons/app.sigma.json", "source": "src/assets/icons", "output": "svg" }],
  "components": [{ "sigma": ".sigma/design/library.sigma.json", "source": "src/components",
                  "manifest": ".sigma/captures/manifest.json", "styles": ["src/styles/app.css"] }],
  "pages": [{ "sigma": ".sigma/design/pages.sigma.json" }],
  "workflow": { "git": "github", "tracker": "notion", "branch": "design/{ticket}-{slug}", "base": "main",
                "prTemplate": ".github/pull_request_template.md", "labels": ["design"] }
}
```

- `tokens[].sources[].format`: `css-variables`, `scss-variables`, `less-variables`, `tailwind-config`,
  `tailwind-theme`, `js-theme`, `ts-theme`, `dtcg`, `json` or `other`.
- `tokens[].naming`: how token names become code names: `kebab` (`color/blue/500` → `--color-blue-500`),
  `camel`, `snake`, `path` or `as-is`. `tokens[].map` lists exceptions: `{ "<token name>": "<code name>" }`.
- `icons[].output`: `svg`, `react`, `vue`, `svelte`, `sprite` or `other`.
- `components[].manifest`: the captures' manifest the library was built from (default
  `.sigma/captures/manifest.json`; `skills/sigma-sync/reference/components.md`); `components[].styles`: the CSS
  files its components' styles are in, where `components write` edits them (default: every `.css` file).
- `workflow` (how a proposal becomes a ticket and a pull request; `skills/sigma-sync/reference/workflow.md`):
  `git` is `github`, `gitlab`, `azure` (Azure DevOps) or `bitbucket`; `tracker` is `notion`, `github`, `gitlab`, `linear`, `jira` or `none`, with
  `notion: { database, status, done }`, `linear: { team, done }` or `jira: { project, issueType, done }`;
  `branch` is a pattern with `{slug}`, `{ticket}` (a Linear or Jira key, an issue number, or the start of a
  Notion page id) and `{id}`.

## Versions

`format` is this file format's version. Sigma reads older formats and upgrades them when it saves; a file
from a newer Sigma opens with a warning. Inside Sigma, documents also carry the editor's own schema version
(`DOC_VERSION` in `src/store.js`, with its migrations in `migrateDocument`), which the project format doesn't
need: the format is the contract.
