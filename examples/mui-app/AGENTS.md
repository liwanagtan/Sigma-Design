# Agent instructions

<!-- sigma-design:start -->
## Sigma (design system)

This project's design system is also in [Sigma](https://www.npmjs.com/package/sigma-design): `.sigma/` holds its Sigma
files and `sigma.config.json` says how they map to the code. Designers change tokens, icons and components
in Sigma (`npm run sigma`); the code follows.

- **Code is the truth for design tokens and icons** (`src/theme.js` (js-theme); `src/icons`). After changing them, run `npx sigma-design tokens import` / `icons import` and `npx sigma-design check` (it must pass).
- **Never edit `.sigma/**/*.sigma.json` by hand:** use the `sigma-design` commands, which keep ids and diffs small.
- **Adapters** (`.sigma/adapters/tokens.mjs`, `.sigma/adapters/icons.mjs`) are how Sigma reads and writes this project's code. If you change how that code is written, update the adapter and run `npx sigma-design adapter test`.
- **Components** aren't in Sigma yet: the `sigma-components` skill says how to bring them in.
- **Proposals** from designers are in `.sigma/changesets/`: turn one into a ticket and a pull request with the `sigma-propose` skill, and write component changes with `sigma-design-to-code`.
- Skills: `sigma-tokens`, `sigma-components`, `sigma-propose`, `sigma-design-to-code` (`.claude/skills/`). The full guide: `../../skills/sigma-sync/SKILL.md`.
<!-- sigma-design:end -->
