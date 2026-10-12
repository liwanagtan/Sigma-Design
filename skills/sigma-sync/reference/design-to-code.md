# Design to code: components

When a designer changes library components in Sigma, the code has to follow. The tool writes what it can
write exactly; you write the rest, then prove the result matches the design before it goes in a pull
request.

Needs: the library built from the code (`components.md`), with a `match` rule per component (`pages.md`),
and the library listed in `sigma.config.json`:

```json
"components": [{ "sigma": ".sigma/design/acme-library.sigma.json", "source": "src/components",
                 "manifest": ".sigma/captures/manifest.json", "styles": ["src/styles/app.css"] }]
```

`styles`: the CSS files the components' styles are in (default: every `.css` file in the project). In the
manifest, give each component its `source` (the file that defines it) and each capture its `element` (the
selector of the element to capture on the components page), so captures can be redone in one call.

## 1. See what changed

```bash
node <sigma>/tools/sigma.mjs components diff <project> [--base REV]      # since HEAD by default
```

For each changed component: the **design diff** (what the designer changed, in CSS terms where it has
them), the **CSS** the tool will write, **code** edits, **manifest** additions, and what's left **for
you**. Components that only moved on the canvas aren't listed.

## 2. Write the exact part

In a pull request's worktree this runs as part of `changeset prepare` (`workflow.md`); by itself:

```bash
node <sigma>/tools/sigma.mjs components write <project> [--base REV] [--dry-run]
```

- **Structured changes are written exactly.** A value the component's root is styled with (background,
  padding, gap, radius, opacity, shadow, border, and the text color and font its layers inherit), token or
  literal, is set in the rule for exactly the variants it changed in: the component's selector when all
  changed, a variant value's or state's selector (`.button--danger`, `.button:hover`) when only those did.
  Only that declaration's value changes; the rest of the file stays as it is.
- **A new variant value** (Variant=Secondary) gets a rule named like its siblings' (`.button--secondary`),
  with what differs from what the cascade already gives, its states too (`.button--secondary:hover`). The
  manifest learns its selector and captures.
- **A property's default** is edited where the component's source declares it (`label = 'Continue'`), when
  it's found exactly once.

## 3. Write the rest

What's listed "For you" needs judgement in the code:

- **A new variant value:** make the component accept it (the prop's code name and value are given) and give
  the element its class. Render it on the components page (with the `element` id the manifest expects).
- **Visual changes** (layers added, removed or reordered, a child layer's size, spacing between children
  set in its own rule): read the design diff and the component's source, and change the markup or CSS to
  match. Keep the code's conventions; make the smallest change.
- **New, removed or renamed properties:** change the component's props, and its callers if they must.

## 4. Prove it

Render the components page from the branch (with Sigma's server running on that checkout:
`python3 <checkout>/serve.py <port> --project <checkout>/<project>`), recapture everything:

```js
const manifest = /* .sigma/captures/manifest.json */;
const captures = sigmaCaptureAll(manifest);    // { file: capture }, and $missing if an element isn't there
```

save each to `.sigma/captures/<file>`, and open `tools/capture/compare.html`. Every component must match
the design: sizes, positions, text colors and backgrounds. If one doesn't, fix the code (not the design)
and capture again. Only then commit.

Also run the project's own checks (tests, lint, build), and pages that use the component if the change can
move things around them (`pages.md`).

## 5. Report

In the pull request: the design diff (`changeset pr-body` includes it), the code you wrote by hand and why,
and the compare result.
