# Contributing to Sigma

Thanks for helping. Sigma is plain ES modules with no build step: what's in `src/` is what runs.

## Set up

You need Node 20 or newer.

```bash
node bin/sigma-design.mjs standalone --port 5173       # Sigma on its own, files in the browser
node bin/sigma-design.mjs dev examples/css-app         # Sigma inside the example project
```

Sigma's server turns off caching, so a reload shows your change. Opening `index.html` from disk won't work:
ES modules need a server.

## Tests

- **In the browser:** with the server running, open `/tests/`. The title shows the result (`✓ 204/204`).
- **In Node:** `npm run test:node` (the server, the command line, `init`, adapters, live sync, workflow).
- **The examples:** `node bin/sigma-design.mjs check examples/<name>` for each project in `examples/`.

CI (`.github/workflows/ci.yml`) runs all three: Node 20 and 22, the browser tests in headless Chromium, and
`check` on every example. It also checks render parity: `node tools/test/run-render-parity.mjs examples/css-app`
captures the example's components as its code renders them and compares Sigma's layout with them. A pull
request needs them green.

Add tests with your change: browser tests in `tests/*.test.js` (registered in `tests/index.html`), Node tests
in `tools/test/*.test.mjs`.

## Making a change

- **Match the code around you:** its naming, comment density and idioms. Modules are small and say what they
  are for in a comment at the top.
- **Words in the interface** are plain and short ("Check accessibility…", "Compare…"), sentence case, and say
  what something does rather than how.
- **The file format** is a contract (`docs/schema/README.md`). A change to it updates the schema docs, the
  validator (`src/validate.js`) and, for an older format, a migration (`migrateDocument` in `src/store.js`).
- **The command line** (`tools/sigma.mjs`) and the editor share pure modules (`src/use-report.js`,
  `src/changesets.js`, `src/a11y-kinds.js`…). Keep logic the command line needs out of modules that touch the
  DOM.
- **Skills** (`skills/sigma-sync/`) are instructions for coding agents. If you change a command they use,
  update them too.
- **The roadmap** (`docs/roadmap.md`) says what's planned. Tick a phase off and write what shipped when you
  finish one.

## Pull requests

Work on a branch, open a draft pull request, and describe what changed and how you checked it (a screenshot
helps for anything visible). Keep one pull request to one piece of work.

## License

Sigma doesn't have a license yet (`package.json` says `UNLICENSED`). The options are in the roadmap under
"Open source". Until one is chosen, please ask before contributing anything substantial.
