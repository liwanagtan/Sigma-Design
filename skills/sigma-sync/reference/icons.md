# Icons

A project's icons map to an icons file: each icon is named after its file (or component), in a group
named after its folder relative to the icon folder (`src/assets/icons/arrows/arrow-right.svg` → group
`arrows`, name `arrow-right`).

Record them in `sigma.config.json`:

```json
"icons": [{ "sigma": ".sigma/icons/app-icons.sigma.json", "name": "App icons",
            "source": "src/assets/icons", "output": "svg" }]
```

`output` is how the project keeps icons: `svg` (files), `react`, `vue`, `svelte` (components), `sprite`
(one SVG with symbols) or `other`. An icon package (`lucide-react`, `@heroicons/react`) isn't the
project's own: link its set instead (Sigma's **Add Lucide icons**, on the Icons page when there are none yet, makes a Lucide file) and only sync icons the
project adds itself.

## SVG files (`output: "svg"`)

Sigma reads and writes them itself:

```bash
npx sigma-design icons import <project>     # files → Sigma (groups from folders)
npx sigma-design icons diff <project>       # what changed in Sigma since HEAD
npx sigma-design icons write <project>      # Sigma → files
```

- Import keeps ids and keywords, so importing twice changes nothing. Colors become `currentColor`; only
  plain shapes are kept (it lists files it couldn't read).
- Write only rewrites files whose shapes changed, in that file's own style (attributes on one line or one
  per line, `/>` or ` />`, attribute order); new files follow the style of the project's other icons.
  Icons deleted in Sigma are deleted.

## Icon components (`react`, `vue`, `svelte`, `other`)

Write an adapter (`reference/adapters.md`): `.sigma/adapters/icons.mjs` reads each component as an SVG file
and writes Sigma's changes as components exactly like the project's own (and keeps an index file in step).
Name it in the entry (`"adapter": ".sigma/adapters/icons.mjs"`), run `npx sigma-design adapter test`, and from
then on `icons import`, `icons write` and `check` use it. Without an adapter, by hand:

1. **Import:** for each icon component, write its SVG to a temporary folder (outside the repo), in a
   subfolder for its group if the project groups them, named in kebab case (`ArrowRight.jsx` →
   `arrow-right.svg`). Use the component's own markup: same `viewBox`, shapes and stroke width; the
   root's `fill`/`stroke` say whether it's outline (`fill="none" stroke="currentColor"`) or filled. Then:

   ```bash
   npx sigma-design icons import <project> --from /tmp/icons
   ```

2. **Write back:** `icons write <project>` lists each added or changed icon with its SVG. Write each as a
   component file exactly like the project's existing ones (copy one and change the name and shapes; keep
   its props, `aria` handling and export style). Delete components for icons removed in Sigma, and update
   any index file that lists them.
3. **Check:** extract again (step 1) and import with `--dry-run`: it must say **0 added, 0 changed**.
