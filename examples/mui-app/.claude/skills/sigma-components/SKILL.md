---
name: sigma-components
description: acme-mui-example's components in Sigma: how they're rendered for capture, how variants map to props, and how to keep the library in step. Use when adding or changing a component, or bringing components or pages into Sigma.
---

<!-- sigma-design:start -->
# Components in Sigma (acme-mui-example)

- Not set up yet: bring the components in with the guide (`reference/components.md`), then run `npx sigma-design agents` to update this skill.

**Adding or changing a component:** render it on the components page (every variant and state), add it to the
manifest (with its `match` rule), capture, `npx sigma-design library build`, and compare until it matches.

Guide: `../../skills/sigma-sync/reference/components.md`, `pages.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write where components live, how they’re styled, how variants and states map to props, and how the components page renders them. -->

- The app uses MUI's own components (`@mui/material`), styled by the theme: there are no project components
  to bring into Sigma yet. Icons are project components (`src/icons/`), synced through the icons adapter.
