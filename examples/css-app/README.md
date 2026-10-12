# Example: plain CSS variables

A tiny app whose design tokens are CSS custom properties (`src/styles/tokens.css`, with a dark theme on
`[data-theme="dark"]`). It's one of the two projects the Sigma sync skill is proven on (Part E, Phase 22);
`sigma.config.json` and `.sigma/` were written by following `skills/sigma-sync/SKILL.md`.

Its pages (`index.html`, `settings.html`) are built from the components in `src/components/`;
`components.html` renders each component by itself for capturing (Phases 28 and 29): the library is in
`.sigma/design/acme-library.sigma.json` and the pages in `.sigma/design/acme-pages.sigma.json`, from the
captures described in `.sigma/captures/manifest.json` and `pages.json`.

```bash
node ../../tools/sigma.mjs check .          # Sigma files are valid, and the tokens match the code
node ../../tools/sigma.mjs tokens import .  # code → Sigma
node ../../tools/sigma.mjs tokens write .   # Sigma → code
node ../../tools/sigma.mjs library build . --from .sigma/captures   # components from captures
node ../../tools/sigma.mjs pages build . --from .sigma/captures     # pages from captures
```
