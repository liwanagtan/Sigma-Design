# Adapters

Sigma reads and writes CSS variables, DTCG `tokens.json` files and folders of SVG icons by itself. For any
other stack (a JS/TS theme object, a Tailwind config, Sass or Less variables, icon components…), you write a
small **adapter** once, at setup, committed in the project. From then on Sigma runs it itself on every
import, write and check: fast, the same every time, no AI in the loop, and reviewable like any code.

## Where it goes

`.sigma/adapters/tokens.mjs` (and `icons.mjs` when icons aren't SVG files), named by the entry in
`sigma.config.json`:

```json
"tokens": [{ "sigma": ".sigma/tokens/app.sigma.json", "name": "App tokens",
             "sources": [{ "path": "src/theme.js", "format": "js-theme" }],
             "naming": "path", "modes": { "Light": "lightTheme", "Dark": "darkTheme" },
             "adapter": ".sigma/adapters/tokens.mjs" }]
```

Keep `sources` and `modes`: they record what the adapter reads, for people and for the rules and skills.

## The contract

An ES module with two functions (they may be async):

```js
export function read(ctx) { /* … */ }            // tokens: DTCG (reference/tokens.md); icons: [{ path, text }]
export function write(ctx, changes) { /* … */ }  // apply Sigma's changes to the code
```

`ctx` gives you the project and Sigma's helpers. Use it for every file access, so Sigma knows (and can undo)
what you changed:

| | |
| --- | --- |
| `ctx.read(path)`, `ctx.exists(path)` | read a project file (paths relative to the project root) |
| `ctx.write(path, text)`, `ctx.remove(path)` | change one (only inside the project) |
| `ctx.entry` | the entry in `sigma.config.json` (its `sources`, `modes`…) |
| `ctx.sigma.parseColorValue(text)` | `'#2e5bff'`, `'rgba(0, 0, 0, 0.87)'` → `{ hex, format, … }` (the format to keep) |
| `ctx.sigma.formatColor(hex, like)` | Sigma's `#RRGGBB(AA)` written like `like` (same format, case, spacing) |
| `ctx.sigma.parseCSSValue`, `formatCSSValue` | dimensions, durations, shadows… as CSS text and back |
| `ctx.sigma.iconSVG(icon, { style })` | an icon as SVG text |

**Tokens.** `read` returns the project's tokens as DTCG, in the shape `reference/tokens.md` describes: sets
(`Primitives`, `Semantic/Light`, `Semantic/Dark`), each token with `$type`, `$value` and its code name in
`$extensions["app.sigma"].codeSyntax.web` (`palette.primary.main`, `--color-blue-500`): that's how `write`
finds it again. It must be deterministic: reading unchanged code twice gives the same thing.

`write` gets the changes since the last commit (the same list `tokens diff` prints):

```js
[{ name: 'primary/main', type: 'color', code: 'palette.primary.main', change: 'changed',
   codeBefore /* when the code name changed */, renamedFrom /* when the name changed */,
   modes: { Light: { before: '#2E5BFF', after: '#1F4AE0' } } }]
```

Values are Sigma's: colors `#RRGGBB` or `#RRGGBBAA`; numbers in px; typography
`{ fontFamily, fontSize, fontWeight, lineHeight (a %), letterSpacing }`; a reference is `{ alias: 'color/blue/700' }`.
`change` is also `'added'` (no `before`) or `'removed'` (no modes).

**Icons.** `read` returns SVG files, `[{ path: 'group/name.svg', text }]` (a group is a folder). `write` gets
`[{ id, name, group, change: 'added' | 'changed' | 'removed', icon /* Sigma's icon: viewBox, body, style,
strokeWidth */, before }]`.

## Writing well

- **Minimal edits.** Find each value where it's written and replace only it. Never re-serialize a whole file:
  the diff must show exactly what the designer changed.
- **The file's own style.** Keep quotes, units (`'6rem'` stays rem), color formats (`ctx.sigma.formatColor` with
  the old value's format), case and indentation.
- **Refuse what you can't do.** Throw an `Error` with a message saying what to do by hand (a token added in
  Sigma that needs a new place in the theme, a reference the code can't hold). Sigma puts back every file you
  changed and shows the message.
- No dependencies beyond Node: the project's own packages may not be installed where Sigma runs.

## Proving it

```bash
npx sigma-design adapter test
```

It checks that `read` gives what Sigma has, then writes one color and one number change (for icons, one
icon), reads them back, checks that only those values changed and the diff is small, and puts every file
back. Fix the adapter until every line passes. After that, `tokens import`, `tokens write` (and `icons …`)
and `check` use it.

Every real write is checked the same way: after `write`, Sigma reads the code back, and if it doesn't hold
what Sigma has, the files are put back and the command says why. When that happens (the theme was
restructured, a new token file appeared), update the adapter and test again.

Example: `examples/mui-app/.sigma/adapters/` in Sigma's repository (an MUI theme and React icon components).
