---
name: sigma-design-to-code
description: Write a component change made in Sigma into css-app's code: the exact part Sigma writes, the rest by hand, then prove it matches. Use when a proposal or the library changes components.
---

<!-- sigma-design:start -->
# Design changes to components → code (css-app)

`npx sigma-design components diff` shows the design diff and the plan; `npx sigma-design components write` (also
run by `changeset prepare`) writes the exact CSS and code edits and lists the rest. Do the rest in the code's
own conventions, recapture, and compare: every component must match before you commit.

Guide: `../../skills/sigma-sync/reference/design-to-code.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write this project’s conventions for component changes: where variant classes or props are defined, naming, tests to update. -->

- A new Button variant needs only CSS: `components write` adds `.button--{value}` (and its states) after the last
  `.button` rule, and `Button` already turns `variant` into that class. Add it to `components.html` with an
  `#button-{value}` id so it can be captured.
- Root values (background, padding, colors) belong in `.button` rules; layout inside a component (label and icon
  spacing) is the component's `gap`.
