---
name: sigma-tokens
description: acme-react's design tokens and icons in Sigma: where they are, how they sync, and what to do when they don't. Use when changing design tokens or icons (in code or in Sigma), or when sigma-design check reports drift.
---

<!-- sigma-design:start -->
# Tokens and icons in Sigma (acme-react)

- **.sigma/tokens/acme-react.sigma.json**: from `src/styles/tokens.css` (css-variables); modes Default (read and written by Sigma itself).

- **While Sigma runs** (`npm run sigma`), live sync does both directions: code edits are imported within a second, and a save in Sigma writes the code.
- **Code → Sigma** (Sigma not running): `npx sigma-design tokens import` (and `icons import`), then `npx sigma-design check`.
- **Sigma → code:** `npx sigma-design tokens diff` shows what designers changed; `npx sigma-design tokens write` (and `icons write`) writes it.

Guide: `../../skills/sigma-sync/SKILL.md` (sections 2–4), `../../skills/sigma-sync/reference/tokens.md`, `icons.md`, `adapters.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write what an agent needs that sigma.config.json doesn’t say: naming rules, which theme values aren’t tokens, anything the adapter can’t do. -->

- All tokens are CSS variables on `:root` in `src/styles/tokens.css` (one mode). Primitives are `--color-*`,
  `--space-*`, `--radius-*`, `--font-*`; semantic ones (`--surface`, `--accent`…) point at them with `var()`.
