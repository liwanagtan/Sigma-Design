# Example: React components (Vite)

A small React app whose components (`src/components/`) are styled with CSS variables (`src/styles/tokens.css`)
and plain classes (`src/styles/components.css`). Sigma is installed in it like a dev tool (`sigma-design` as a
dev dependency; in this repository it links to the repository itself) and was set up with
`npx sigma-design init`.

```bash
npm install
npm run dev      # the app on http://localhost:5190, and Sigma's components page: /sigma.html
npm run sigma    # Sigma on this project (http://localhost:5178), with live sync
```

`sigma.html` renders every component in every variant with the app's own code and Vite, and loads
`sigma-design/bridge`, so Sigma captures them itself (`"page"` in `sigma.config.json`). The library
(`.sigma/design/acme-react-library.sigma.json`) was built from it with **Build from code…** on Sigma's home
screen, and a library's **Check against code…** compares it with the running app. A design change saved in Sigma
(the Badge's side padding, `--space-2` → `--space-3`) was written to `components.css` by live sync and confirmed
by that check: 13 of 13 match.
