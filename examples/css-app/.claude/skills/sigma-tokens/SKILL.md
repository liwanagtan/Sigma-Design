---
name: sigma-tokens
description: css-app's design tokens and icons in Sigma: where they are, how they sync, and what to do when they don't. Use when changing design tokens or icons (in code or in Sigma), or when sigma-design check reports drift.
---

<!-- sigma-design:start -->
# Tokens and icons in Sigma (css-app)

- **.sigma/tokens/acme.sigma.json**: from `src/styles/tokens.css` (css-variables); modes Light, Dark (read and written by Sigma itself).
- **.sigma/icons/acme-icons.sigma.json**: from `src/assets/icons` (svg).

- **Code → Sigma:** `npx sigma-design tokens import` (and `icons import`), then `npx sigma-design check`.
- **Sigma → code:** `npx sigma-design tokens diff` shows what designers changed; `npx sigma-design tokens write` (and `icons write`) writes it.

Guide: `../../skills/sigma-sync/SKILL.md` (sections 2–4), `../../skills/sigma-sync/reference/tokens.md`, `icons.md`, `adapters.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write what an agent needs that sigma.config.json doesn’t say: naming rules, which theme values aren’t tokens, anything the adapter can’t do. -->

- All tokens are CSS variables in `src/styles/tokens.css`: Light on `:root`, Dark on `[data-theme="dark"]` (only the
  semantic tokens change by mode). Sigma writes them itself, keeping each value's unit and color format.
- Icons are SVG files in `src/assets/icons/<group>/`, one per icon, written by Sigma in the files' own style.
