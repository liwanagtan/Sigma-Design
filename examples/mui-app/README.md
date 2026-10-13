# Example: an MUI theme object

The design tokens are a JavaScript theme (`src/theme.js`, with light and dark themes) and the icons are React
components (`src/icons/`). Sigma doesn't read either by itself, so at setup the agent wrote two **adapters**
(`.sigma/adapters/tokens.mjs`, `icons.mjs`, named in `sigma.config.json`): Sigma runs them on every import,
write and check, with no agent in the loop. A token changed in Sigma becomes a one-line edit in
`src/theme.js`, in the file's own style, checked by reading it back.

```bash
node ../../bin/sigma-design.mjs adapter test .    # prove the adapters
node ../../bin/sigma-design.mjs tokens write .    # write Sigma's changes through them
node ../../bin/sigma-design.mjs check .           # Sigma and the code agree
```

`AGENTS.md` (with `CLAUDE.md` including it) and `.claude/skills/sigma-*` were written by `sigma-design agents`
and completed by the agent (each skill's Project notes), so any coding agent here knows about Sigma.
It's the second of the two projects the sync skill is proven on (Part E, Phase 22). The dependencies are
listed for realism; nothing here needs to be installed.
