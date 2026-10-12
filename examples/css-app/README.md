# Example: plain CSS variables

A tiny app whose design tokens are CSS custom properties (`src/styles/tokens.css`, with a dark theme on
`[data-theme="dark"]`). It's one of the two projects the Sigma sync skill is proven on (Part E, Phase 22);
`sigma.config.json` and `.sigma/` were written by following `skills/sigma-sync/SKILL.md`.

```bash
node ../../tools/sigma.mjs check .          # Sigma files are valid, and the tokens match the code
node ../../tools/sigma.mjs tokens import .  # code → Sigma
node ../../tools/sigma.mjs tokens write .   # Sigma → code
```
