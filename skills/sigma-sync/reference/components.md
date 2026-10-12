# Components

A project's components become a Sigma library file (`.sigma/design/<name>.sigma.json`): one component (or
component set, for variants) per code component, laid out with auto layout, bound to the project's Sigma
tokens and icons, with code names so Inspect writes them as the code does.

You capture each component as the browser renders it; the tool turns captures into components; a compare
page checks the result against the captures. Tokens (and icons) must be imported first: bindings point at
them.

## 1. Render each component by itself

Use what the project has: Storybook stories, a test page, a component playground. If there is none, write
one page (outside the app's routes, or deleted after) that renders each component once per variant, the
way `examples/css-app/components.html` does. Give layers useful names where the markup doesn't:
`data-sigma-name="Label"` on an element (otherwise its `aria-label`, its first class or its tag is used).
Names matter: properties and nested components find their layers by name.

## 2. Capture

Open the page in a browser you can script (Playwright, a browser tool) and load
`<sigma>/tools/capture/capture.js` into it (as a module, or paste its text). Then, for each component and
each variant and state:

```js
sigmaCapture(element, { state: 'default', name: 'Button' })   // 'hover' | 'focus' | 'pressed' | 'disabled'
```

Save each result as JSON in `.sigma/captures/` (`button-primary-hover.json`). States are applied by the
capture itself (`:hover`, `:focus-visible`, `:active` rules, or `disabled`), with transitions turned off,
so you don't need to hover anything. Capture variants the code can render (props like `variant="danger"`)
by rendering them; capture states with `state`.

Captures are regenerated, not edited: add `.sigma/captures/*.json` to `.gitignore`, but keep the manifest.

## 3. Write the manifest

`.sigma/captures/manifest.json` says what each capture is. It's your decisions about the library, so
commit it, and the next run follows it:

```json
{
  "library": ".sigma/design/acme-library.sigma.json",
  "components": [
    {
      "name": "Button", "codeName": "Button",
      "description": "src/components/button.js: Button({ label, variant, icon })",
      "props": [
        { "name": "Label", "type": "text", "codeName": "label", "layer": "Label" },
        { "name": "Show icon", "type": "boolean", "codeName": "icon", "layer": "Icon" },
        { "name": "Icon", "type": "icon", "codeName": "icon", "layer": "Icon" }
      ],
      "variantCodeNames": { "Variant": "variant", "State": "state" },
      "captures": [
        { "variant": { "Variant": "Primary", "State": "Default" }, "file": "button-primary-default.json" },
        { "variant": { "Variant": "Primary", "State": "Hover" }, "file": "button-primary-hover.json" }
      ]
    },
    {
      "name": "Card",
      "instances": [{ "layer": "Button", "component": "Button", "variant": { "Variant": "Primary", "State": "Default" }, "props": { "Show icon": false } }],
      "captures": [{ "file": "card.json" }]
    }
  ]
}
```

- **Variants** are the code's enum props (`variant`, `size`) plus **`State`**: always that name, with values
  `Default`, `Hover`, `Focus`, `Pressed`, `Disabled` (only the ones the component has), so states map the
  same way in every project. `variantCodeNames` maps each to its prop in code.
- **Properties** are the code's other props: `text` (a label), `boolean` (shows or hides `layer`), `icon`
  (which icon `layer` shows), `instance` (which nested component). `codeName` is the prop's name in code.
- **Nested components** (`instances`): a layer that is another component in the code becomes an instance of
  it. List components before the ones that use them. `props` sets the instance's property values (by name).
- One capture with no `variant` makes a plain component.

## 4. Build

```bash
node <sigma>/tools/sigma.mjs library build <project> --from <project>/.sigma/captures [--dry-run]
```

It creates the library file, or rebuilds the components named in the manifest in place (others are kept;
components that grew move what's below them down). Flex containers become auto layout; stacked blocks
become columns (unevenly spaced ones nest, so each spacing is kept); values written with `var(--x)` are
bound to the token whose code name is `--x`; SVGs that match an icon in the project's Sigma Icons file
become icon layers. It prints notes for everything it approximated. Read each note and either fix the
cause (an icon not imported, a token missing) or say why it's fine.

## 5. Compare

With the project open in Sigma's server (`python3 <sigma>/serve.py <port> --project <project>`), open
`http://localhost:<port>/tools/capture/compare.html`. It lays out every component in Sigma and compares
each layer's size and position with its capture:

```
✓ Button / Variant=Primary, State=Default
✗ Card
    Card / Button: width 99 in Sigma, 77 in code
10 of 11 match the code; fix the 1 that don't …
```

Fix every ✗ before handing off: usually the manifest (a boolean the code version has off, a missing
`data-sigma-name`), sometimes the capture page (a component rendered in a wrapper that stretches it). Build
and compare again until all match. If one can't match (something Sigma can't hold), say which and why.

## 6. Report

The components built, their variants and properties, the notes and what you did about them, and the
compare result.
