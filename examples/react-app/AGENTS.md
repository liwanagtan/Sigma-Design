# Agent instructions

<!-- sigma-design:start -->
## Sigma (design system)

This project's design system is also in [Sigma](https://www.npmjs.com/package/sigma-design): `.sigma/` holds its Sigma
files and `sigma.config.json` says how they map to the code. Designers change tokens, icons and components
in Sigma (`npm run sigma`); the code follows.

- **Code is the truth for design tokens** (`src/styles/tokens.css` (css-variables)). While Sigma runs (`npm run sigma`) it follows them by itself; otherwise, after changing them, run `npx sigma-design tokens import`. Either way, `npx sigma-design check` must pass.
- **Never edit `.sigma/**/*.sigma.json` by hand:** use the `sigma-design` commands, which keep ids and diffs small.
- **Components:** when you add or change one, keep the components page and `.sigma/captures/manifest.json` up to date (the `sigma-components` skill).
- **Proposals** from designers are in `.sigma/changesets/`: turn one into a ticket and a pull request with the `sigma-propose` skill, and write component changes with `sigma-design-to-code`.
- Skills: `sigma-tokens`, `sigma-components`, `sigma-propose`, `sigma-design-to-code` (`.claude/skills/`). The full guide: `../../skills/sigma-sync/SKILL.md`.
<!-- sigma-design:end -->
