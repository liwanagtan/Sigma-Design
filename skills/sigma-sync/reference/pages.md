# Pages

A project's pages become a design file (`.sigma/design/<name>.sigma.json`): one Sigma page per app
route, with one frame per breakpoint, built from instances of the library's components wherever the
page uses them. Build the library first (`reference/components.md`): pages are made of its components.

## 1. Teach the manifest to find components

In `.sigma/captures/manifest.json`, give each component a `match`: how to recognize it in any page's
markup, and how to read its variant and property values from that markup.

```json
{
  "name": "Button",
  "match": {
    "selector": ".button",
    "variants": {
      "Variant": { "Danger": ".button--danger", "Primary": "*" },
      "State": { "Disabled": ":disabled", "Default": "*" }
    },
    "props": { "Label": "text", "Show icon": "has:img, svg", "Icon": "icon:img, svg" }
  }
}
```

- `selector`: any CSS selector that the component's root element, and only that, matches. Read the
  component's code to choose it (its class, a `data-` attribute it sets, its tag and role).
- `variants`: for each variant property, the selector for each value; the first that matches wins, and `*`
  is the value when none does. A value the page can't show (Hover, Focus) needs no entry.
- `props`, by property name:
  - `text` (the element's text, or an input's value or placeholder) or `text:SELECTOR` (the text of the
    first element inside that matches),
  - `has:SELECTOR` (a boolean: whether something inside matches),
  - `icon` or `icon:SELECTOR` (the icon an `<svg>` or `<img>` inside shows, when it's one of the
    project's icons).

  Values equal to the property's default aren't set. Components inside a component (a card's button) get
  their own values from their own `match`, as overrides on the outer instance.

## 2. List the pages

`.sigma/captures/pages.json` (commit it):

```json
{
  "file": ".sigma/design/acme-pages.sigma.json",
  "name": "Acme pages",
  "breakpoints": [{ "name": "Desktop", "width": 1280 }, { "name": "Mobile", "width": 375 }],
  "pages": [{ "name": "Projects", "route": "/" }, { "name": "Settings", "route": "/settings" }]
}
```

Take the breakpoints from the CSS (its media queries), and the routes from the router. Choose pages that
show different layouts and as many components as possible; give each route the data it needs to look real
(a signed-in test user, seed data), never production accounts.

## 3. Capture

Open any page of the running app in a browser you can script, load `<sigma>/tools/capture/capture.js`
into it, and for each page and breakpoint:

```js
const manifest = /* .sigma/captures/manifest.json */;
const capture = await sigmaCapturePage('/settings', { width: 375, match: manifest, name: 'Settings' });
```

It loads the route in a frame of that width (same origin as the page you're on), waits for it to load and
settle, and captures the whole page: each element lists the `match` selectors it matches. Save each as
`.sigma/captures/page-<page>-<breakpoint>.json` (`page-settings-mobile.json`: names in lowercase, with
dashes).

## 4. Build

```bash
npx sigma-design pages build <project> --from <project>/.sigma/captures [--dry-run]
```

It writes the file (rebuilding frames by name, keeping other pages and frames) and lists, per frame, how
many library instances it has and what isn't from the library:

```
Settings — Desktop: 4 library instances; not from the library: 2 boxes and icons, 6 texts
  box: Settings — Desktop / App-header
  box: Settings — Desktop / Page / Panel
  texts: “Acme”, “Projects”, “Settings”, “Settings”, “Name”, “Email”
```

Review that list. A box that is really a component (it has its own file or function in the code) means a
`match` is missing or wrong: fix it and build again. Repeated boxes that aren't components yet are
candidates for the library: say so, don't make them components yourself. Headings and labels as plain
text are normal.

## 5. Compare

Open `http://localhost:<port>/tools/capture/compare.html` (Sigma's server, with the project): after the
components it compares every page frame with its capture. Fix differences as for components, and build
again until every frame matches. If one can't match (something Sigma can't express, like `margin: auto`
in a flex row), say which, and suggest the code change that would make it expressible if it's small.

## 6. Report

The pages and breakpoints built, the instances in each, the parts not from the library (and what you
suggest for them), and the compare result.
