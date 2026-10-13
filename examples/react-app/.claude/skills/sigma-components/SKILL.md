---
name: sigma-components
description: acme-react's components in Sigma: how they're rendered for capture, how variants map to props, and how to keep the library in step. Use when adding or changing a component, or bringing components or pages into Sigma.
---

<!-- sigma-design:start -->
# Components in Sigma (acme-react)

- **.sigma/design/acme-react-library.sigma.json**: from `src/components`; captures described in `.sigma/captures/manifest.json`; styles in `src/styles/components.css`; components page `http://localhost:5190/sigma.html` (it loads `sigma-design/bridge`).

**Adding or changing a component:** render it on the components page (every variant and state, each with the
id its manifest entry names as `element`), add it to the manifest (with its `match` rule), then in Sigma open the
library and use **Check against code…** (it captures, compares, and can update the library from the code).
Saving a library in Sigma writes the exact part of the code itself; finish what it lists, then check again.

Guide: `../../skills/sigma-sync/reference/components.md`, `pages.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write where components live, how they’re styled, how variants and states map to props, and how the components page renders them. -->

- Components are React function components in `src/components/` (`Button`, `Badge`, `Card`), styled with BEM classes
  in `src/styles/components.css` (`.button`, `.button--secondary`, `.badge--success`).
- Variants are props that become modifier classes: `variant` → `button--{variant}` (not for `primary`), `tone` →
  `badge--{tone}` (not for `neutral`). States are CSS pseudo-classes (`:hover`, `:disabled`).
- `sigma.html` + `src/sigma.jsx` render every variant once (ids `#button-primary`, `#badge-success`, `#card`); Vite
  builds it like the app (`npm run dev`, port 5190). Add a new component or variant there and to the manifest.
- The app loads Inter from Google Fonts in both HTML files; without it text renders in the system font and won’t
  match Sigma.
