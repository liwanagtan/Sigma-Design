---
name: sigma-design-to-code
description: Write a component change made in Sigma into acme-mui-example's code: the exact part Sigma writes, the rest by hand, then prove it matches. Use when a proposal or the library changes components.
---

<!-- sigma-design:start -->
# Design changes to components → code (acme-mui-example)

`npx sigma-design components diff` shows the design diff and the plan; `npx sigma-design components write` (also
run by `changeset prepare`) writes the exact CSS and code edits and lists the rest. Do the rest in the code's
own conventions, recapture, and compare: every component must match before you commit.

Guide: `../../skills/sigma-sync/reference/design-to-code.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write this project’s conventions for component changes: where variant classes or props are defined, naming, tests to update. -->
