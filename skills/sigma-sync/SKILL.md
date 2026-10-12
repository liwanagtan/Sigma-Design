---
name: sigma-sync
description: Keep a codebase's design tokens (and icons) in sync with Sigma files in its .sigma/ folder. Use when asked to set a project up with Sigma, import its tokens or icons into Sigma, write Sigma changes back to the code, or check that Sigma and the code agree.
---

# Sigma sync

Sigma is a design tool whose files live in the project's repo (`.sigma/`). This skill connects the two:
it reads the codebase and writes Sigma files, and writes Sigma changes back into the code. Any agent can
follow it (it's plain instructions plus a small command-line tool).

You do the fuzzy work: understanding the codebase and deciding how it maps to Sigma. The tool does the
exact work: reading CSS variables, merging into Sigma files without disturbing them, diffing, writing CSS,
validating. Every decision you make goes in `sigma.config.json`, so the next run follows it instead of
deciding again.

**Sigma tools:** the commands below are `node <sigma>/tools/sigma.mjs …`, where `<sigma>` is where Sigma
is installed (its repo). Node 18 or later; nothing to install.

**Rules**

- Never hand-edit a `.sigma/*.sigma.json` file when a command can do it: commands keep ids, order and
  formatting stable, so diffs stay small. If you must write one, follow `<sigma>/docs/schema/README.md`
  and run `validate` afterwards.
- Make the smallest code change that does the job. Keep the code's formatting, comments, units and color
  format.
- Don't commit, push or open pull requests unless the person asked (Propose change does that, Phase 25+).
- Say what you did and why: list the decisions you made and anything you skipped.

## 1. Set up (first run: no sigma.config.json yet)

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
     `other`): for those you extract the tokens (step 2b below).
   - `modes` (CSS): each mode's selector; the first is the default. A token set only in the default block is
     a primitive; tokens that point at others (`var(--x)`) or change by mode are semantic.
   - `naming` and `map`: how token names become code names (`color/blue/500` ↔ `--color-blue-500` with
     `kebab`); `map` lists exceptions. `prefix` drops a prefix (`--acme-`). `remBase` (default 16) for rem.
4. Run `validate` once the first import is done.

## 2. Import tokens (code → Sigma)

**a. CSS variables (and dtcg sources):** Sigma reads them directly.

```bash
node <sigma>/tools/sigma.mjs tokens import <project>
```

**b. Any other stack:** read the token sources yourself and write them as a DTCG tokens.json in a temporary
file (outside the repo, or delete it after), following `reference/tokens.md`, then:

```bash
node <sigma>/tools/sigma.mjs tokens import <project> --from /tmp/<name>.tokens.json
```

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
node <sigma>/tools/sigma.mjs tokens diff <project>      # what changed since HEAD (--base REV to compare with another)
node <sigma>/tools/sigma.mjs tokens write <project>     # CSS sources: applies minimal edits itself
```

- **CSS variables:** `tokens write` edits only the values that differ, keeps each value's unit (rem stays
  rem) and color format (hex, rgb(), hsl(), case), adds new tokens next to their closest relative, and
  removes tokens deleted in Sigma. Use `--dry-run` first if the change is large.
- **Other stacks:** `tokens write` prints the changes with each token's code name (`codeSyntax.web`, like
  `palette.primary.main`) and its values per mode. Make those edits in the source yourself, in its own
  style, then re-extract (step 2b) and import with `--dry-run`: it must say **0 added, 0 changed**. If it
  doesn't, fix the code (or, if the code was right, say so) until it does.

## 4. Check

```bash
node <sigma>/tools/sigma.mjs check <project>
```

It validates every Sigma file and, for CSS sources, confirms that importing would change nothing (no drift
between code and Sigma). For other stacks, the step-3 dry run is the drift check. Fix every error it
reports; its messages say where and what to do.

## 5. Report

Tell the person, briefly: what you set up or changed (files), the decisions you made and recorded, what
was skipped and why, and the result of `check`. If Sigma is running with the project
(`python3 <sigma>/serve.py --project <project>`), open files reload by themselves.

## Icons

See `reference/icons.md`.
