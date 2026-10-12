# Example: an MUI theme object

The design tokens are a JavaScript theme (`src/theme.js`, with light and dark themes). Sigma can't read
JavaScript by itself, so the sync skill's agent reads the theme, writes the tokens as DTCG
(`tokens.json`), and the tools merge them into `.sigma/tokens/mui.sigma.json`. Writing back, the agent edits
`src/theme.js` from `tokens diff`, then re-reads it and checks that importing changes nothing.
It's the second of the two projects the sync skill is proven on (Part E, Phase 22). The dependencies are
listed for realism; nothing here needs to be installed.
