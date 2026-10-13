---
name: sigma-sync
description: Keep a codebase's design tokens, icons, components and pages in sync with Sigma files in its .sigma/ folder. Use when asked to set a project up with Sigma, import its tokens, icons, components or pages into Sigma, write Sigma changes back to the code, or check that Sigma and the code agree.
---

# Sigma sync

Sigma is a design tool whose files live in the project's repo (`.sigma/`). This skill connects the two:
it reads the codebase and writes Sigma files, and writes Sigma changes back into the code. Any agent can
follow it (it's plain instructions plus a small command-line tool).

You do the fuzzy work: understanding the codebase and deciding how it maps to Sigma. The tool does the
exact work: reading CSS variables, merging into Sigma files without disturbing them, diffing, writing CSS,
validating. Every decision you make goes in `sigma.config.json`, so the next run follows it instead of
deciding again.

**Sigma tools:** Sigma is installed in the project as the `sigma-design` package; the commands below are
`npx sigma-design …`, and `<sigma>` is where it's installed (`node_modules/sigma-design`). Node 18 or later;
nothing else to install.

**Rules**

- Never hand-edit a `.sigma/*.sigma.json` file when a command can do it: commands keep ids, order and
  formatting stable, so diffs stay small. If you must write one, follow `<sigma>/docs/schema/README.md`
  and run `validate` afterwards.
- Make the smallest code change that does the job. Keep the code's formatting, comments, units and color
  format.
- Don't commit, push or open pull requests unless the person asked (Propose change does that, Phase 25+).
- Say what you did and why: list the decisions you made and anything you skipped.

## 1. Set up (first run: no sigma.config.json yet)

Start with `npx sigma-design init` in the project. It installs nothing by itself (if `sigma-design` isn't a
dev dependency yet, it adds it to `package.json`, and the person installs), adds the `npm run sigma` script,
and sets up what Sigma reads by itself: CSS variables (with their modes), a DTCG `tokens.json`, a folder of
SVG icons. It writes `sigma.config.json`, imports, and runs `check`. Read what it prints:

- If it set everything up and `check` passes, review its choices (the token source, the modes and their
  names, the icon folder) against the code, fix `sigma.config.json` if needed, and go to step 5.
- What it lists **For your coding agent** is yours: for each source Sigma doesn't read itself (a JS theme,
  Tailwind, SCSS, icon components), **write an adapter** (`reference/adapters.md`): add the entry to
  `sigma.config.json` with its `adapter`, write `.sigma/adapters/tokens.mjs` (or `icons.mjs`), run
  `npx sigma-design adapter test` until it passes, then `tokens import` (or `icons import`) and `check`.
  Never do a one-off extraction instead: with an adapter, every later sync runs without you.

`init` also wrote the **rules** (a Sigma section in `AGENTS.md` / `CLAUDE.md`…) and the **project skills**
(`.claude/skills/sigma-*`). After you change the setup (an adapter, components), run `npx sigma-design agents`
to update them, then fill each skill's **Project notes** with what an agent needs that the config doesn't say
(naming rules, what the adapter can't do, where components live and how variants map to props). Re-running
`agents` keeps those notes, and the team's own text around the Sigma section.

The steps below are also how to set a project up by hand.

1. **Find the stack.** Look at `package.json`, build config and styles: CSS or Sass variables, Tailwind
   (`tailwind.config.*` or `@theme` in CSS), a JS/TS theme object (MUI, Chakra, styled-components,
   vanilla-extract), DTCG `tokens.json` (Style Dictionary, Tokens Studio), or values hard-coded in components.
2. **Find the token sources**: the files that define colors, spacing, radii, type, shadows and motion. Note
   how modes are expressed (`:root` / `[data-theme="dark"]`, `prefers-color-scheme`, a light and a dark theme
   object, brand files).
3. **Write `sigma.config.json`** at the project root (format in `<sigma>/docs/schema/README.md`):

   ```json
   {
     "schema": 1,
     "stack": { "styling": ["css-variables"], "framework": "react" },
     "tokens": [{ "sigma": ".sigma/tokens/<name>.sigma.json", "name": "<Product> tokens",
                  "sources": [{ "path": "src/styles/tokens.css", "format": "css-variables" }],
                  "naming": "kebab", "modes": { "Light": ":root", "Dark": "[data-theme=\"dark\"]" } }]
   }
   ```

   - `format`: `css-variables` (Sigma reads these itself), `dtcg` (a tokens.json Sigma reads itself), or
     what the code is (`scss-variables`, `tailwind-config`, `tailwind-theme`, `js-theme`, `ts-theme`,
     `other`): for those, add `"adapter": ".sigma/adapters/tokens.mjs"` and write it (`reference/adapters.md`).
   - `modes` (CSS): each mode's selector; the first is the default. A token set only in the default block is
     a primitive; tokens that point at others (`var(--x)`) or change by mode are semantic.
   - `naming` and `map`: how token names become code names (`color/blue/500` ↔ `--color-blue-500` with
     `kebab`); `map` lists exceptions. `prefix` drops a prefix (`--acme-`). `remBase` (default 16) for rem.
4. Run `validate` once the first import is done.

## 2. Import tokens (code → Sigma)

```bash
npx sigma-design tokens import <project>
```

Sigma reads CSS variables and DTCG sources itself, and any other stack through the project's adapter
(`reference/adapters.md`). Without an adapter (a one-time import, or while writing one), read the sources
yourself, write them as a DTCG tokens.json in a temporary file (outside the repo), following
`reference/tokens.md`, and pass `--from /tmp/<name>.tokens.json`.

Either way the tool merges into the Sigma Tokens file: values come from the code; ids, descriptions,
groups and order stay; new tokens get ids from their names; tokens only in Sigma are kept (listed as
`only in Sigma`) unless you pass `--prune` (only do that if the person wants Sigma to match the code
exactly). It prints what was added, changed and skipped. Look at the skipped list and say why each was
skipped (an unsupported value, a selector that isn't a mode).

**Classify carefully** (step b, or when reviewing a): primitives are raw values (`color/blue/500`);
semantic tokens say what a value is for (`surface/default`, `text/secondary`) and point at primitives;
component tokens (`button/primary/background`) point at semantic tokens. Turn repeated literals into
references when the code clearly means the same thing (the same hex used as "primary" everywhere).
Record any judgement call (a renamed token, a value you treated as a primitive) in the token's
`$description` or in your summary.

## 3. Write back (Sigma → code)

When the designer changed tokens in Sigma (the Sigma file differs from the last commit):

```bash
npx sigma-design tokens diff <project>      # what changed since HEAD (--base REV to compare with another)
npx sigma-design tokens write <project>     # CSS sources: applies minimal edits itself
```

- **CSS variables:** `tokens write` edits only the values that differ, keeps each value's unit (rem stays
  rem) and color format (hex, rgb(), hsl(), case), adds new tokens next to their closest relative, and
  removes tokens deleted in Sigma. Use `--dry-run` first if the change is large.
- **With an adapter:** `tokens write` writes through it and reads the code back; if the code doesn't then
  hold what Sigma has, it puts the files back and says why (fix the adapter, `adapter test`, write again).
  A change the adapter refuses (a new token that needs a place in the theme) says what to do by hand.
- **Other stacks without an adapter:** `tokens write` prints the changes with each token's code name
  (`codeSyntax.web`, like `palette.primary.main`) and its values per mode. Make those edits in the source
  yourself, in its own style, then re-extract and import with `--dry-run`: it must say **0 added, 0
  changed**. Better: write the adapter, so the next change needs no one.

## 4. Check

```bash
npx sigma-design check <project>
```

It validates every Sigma file and, for CSS sources, confirms that importing would change nothing (no drift
between code and Sigma). For other stacks, the step-3 dry run is the drift check. Fix every error it
reports; its messages say where and what to do.

## 5. Report

Tell the person, briefly: what you set up or changed (files), the decisions you made and recorded, what
was skipped and why, and the result of `check`. If Sigma is running with the project
(`npm run sigma`, or `npx sigma-design dev`), open files reload by themselves.

## Icons

See `reference/icons.md`.

## Components

To bring the project's components into a Sigma library file (after tokens and icons): `reference/components.md`.
In short: render each component by itself, capture every variant and state with
`<sigma>/tools/capture/capture.js`, describe them in `.sigma/captures/manifest.json`, `library build`, then
open `tools/capture/compare.html` and fix differences until every component matches its code.

## Pages

To bring the app's pages in (after the library): `reference/pages.md`. In short: a `match` rule per
component in the manifest, the routes and breakpoints in `.sigma/captures/pages.json`, `sigmaCapturePage`
for each, `pages build` (pages made of library instances, with what isn't from the library listed for
review), then compare.

## Design changes to components → code

When library components changed in Sigma: `reference/design-to-code.md`. `components diff` shows the design
diff and the plan; `components write` (also run by `changeset prepare`) writes the exact CSS and code edits;
you do what it lists "For you", then recapture (`sigmaCaptureAll`) and compare until everything matches.

## Proposals → tickets and pull requests

When a designer uses **Propose change** in Sigma, a changeset waits in `.sigma/changesets/`. To send it (only
when asked): `reference/workflow.md`. In short: a ticket, a branch in a worktree, `changeset prepare` (Sigma
files and code), the project's own checks, a draft pull request in the repo's template, then
`changeset sync` keeps Sigma's statuses current.
