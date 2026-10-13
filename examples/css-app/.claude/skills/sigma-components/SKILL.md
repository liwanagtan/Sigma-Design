---
name: sigma-components
description: css-app's components in Sigma: how they're rendered for capture, how variants map to props, and how to keep the library in step. Use when adding or changing a component, or bringing components or pages into Sigma.
---

<!-- sigma-design:start -->
# Components in Sigma (css-app)

- **.sigma/design/acme-library.sigma.json**: from `src/components`; captures described in `.sigma/captures/manifest.json`; styles in `src/styles/app.css`.

**Adding or changing a component:** render it on the components page (every variant and state), add it to the
manifest (with its `match` rule), capture, `npx sigma-design library build`, and compare until it matches.

Guide: `../../skills/sigma-sync/reference/components.md`, `pages.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write where components live, how they’re styled, how variants and states map to props, and how the components page renders them. -->

- Components are plain DOM functions in `src/components/` (`Button`, `Input`, `Card`, `AppHeader`), styled with
  BEM classes in `src/styles/app.css` (`.button`, `.button--danger`, `.card__title`).
- Variants map to props: `Button({ variant })` adds `button--{variant}` (any value but `primary`); states are CSS
  pseudo-classes (`:hover`, `:focus-visible`, `:disabled`), captured with the capture script's `state`.
- `components.html` renders every component and variant (ids `#button-primary`, `#button-secondary`, …) for
  capturing; `index.html` and `settings.html` are the pages (`.sigma/captures/pages.json`).
