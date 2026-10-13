---
name: sigma-tokens
description: acme-mui-example's design tokens and icons in Sigma: where they are, how they sync, and what to do when they don't. Use when changing design tokens or icons (in code or in Sigma), or when sigma-design check reports drift.
---

<!-- sigma-design:start -->
# Tokens and icons in Sigma (acme-mui-example)

- **.sigma/tokens/mui.sigma.json**: from `src/theme.js` (js-theme); modes Light, Dark; through `.sigma/adapters/tokens.mjs`.
- **.sigma/icons/mui-icons.sigma.json**: from `src/icons` (react); through `.sigma/adapters/icons.mjs`.

- **While Sigma runs** (`npm run sigma`), live sync does both directions: code edits are imported within a second, and a save in Sigma writes the code.
- **Code → Sigma** (Sigma not running): `npx sigma-design tokens import` (and `icons import`), then `npx sigma-design check`.
- **Sigma → code:** `npx sigma-design tokens diff` shows what designers changed; `npx sigma-design tokens write` (and `icons write`) writes it, through the adapter, checking every write by reading it back.
- **When an adapter fails** (a write is put back, or `check` can't read the code): fix the adapter, run `npx sigma-design adapter test` until it passes, then write again.

Guide: `../../skills/sigma-sync/SKILL.md` (sections 2–4), `../../skills/sigma-sync/reference/tokens.md`, `icons.md`, `adapters.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write what an agent needs that sigma.config.json doesn’t say: naming rules, which theme values aren’t tokens, anything the adapter can’t do. -->

- Primitives come from `shared` in `src/theme.js` (spacing, shape.borderRadius, typography); Semantic from
  each theme's `palette` (Light = `lightTheme`, Dark = `darkTheme`). Token names are the theme paths in kebab
  case (`palette.primary.contrastText` → `primary/contrast-text`).
- `typography/h1` and `typography/body1` are composite: the adapter writes `fontSize` in rem (as the file does)
  and `lineHeight` as a ratio.
- The adapter only changes values. Adding or removing a token, renaming one, or making one a reference must be
  done in `src/theme.js` by hand (then `npx sigma-design tokens import`); the adapter says so when it refuses.
- Values MUI computes at runtime (`augmentColor`, `alpha()`) aren't tokens.
