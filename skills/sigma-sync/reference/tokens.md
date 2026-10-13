# Writing tokens.json for Sigma (DTCG)

For stacks Sigma can't read itself (JS/TS theme objects, Tailwind config, Sass maps…), write the tokens as
a [DTCG](https://www.designtokens.org/) tokens.json and import it with `tokens import --from <file>`.

## Shape

Top-level keys are **token sets**. A set named `Collection` is a collection with one mode; sets named
`Collection/Mode` are that collection's modes (the first one listed is the default). Sigma reads top-level keys
as sets only when at least one is `Collection/Mode` or `$metadata.tokenSetOrder` lists them; otherwise they're
groups of a single `Tokens` collection. So when every set has one mode (`Primitives` alone), list them:
`"$metadata": { "tokenSetOrder": ["Primitives"] }`.

```json
{
  "Primitives": {
    "color": {
      "blue": {
        "700": { "$type": "color", "$value": "#1976D2",
                 "$extensions": { "app.sigma": { "codeSyntax": { "web": "palette.primary.main" } } } }
      }
    },
    "space": { "unit": { "$type": "dimension", "$value": "8px" } }
  },
  "Semantic/Light": {
    "primary": { "main": { "$type": "color", "$value": "{color.blue.700}", "$description": "Main brand color" } }
  },
  "Semantic/Dark": {
    "primary": { "main": { "$type": "color", "$value": "#90CAF9" } }
  }
}
```

- **Groups** are nested objects: `color.blue.700` is the token `color/blue/700` in Sigma.
- **References** are `"{group.token}"` (dots, without the set name). They can point into another set.
- **Every mode set has the same tokens.** If a token is the same in every mode, give it the same value (or
  the same reference) in each.
- **`$extensions["app.sigma"].codeSyntax.web`**: where the token lives in code (`palette.primary.main`,
  `theme.spacing`, `--accent`). Always set it: write-back needs it to find the token in the code.
- `$description`: optional; good for explaining a decision ("MUI's primary.main; 'dark' is its hover").

## Types

| `$type` | `$value` | Becomes in Sigma |
| --- | --- | --- |
| `color` | `"#1976D2"`, `"#1976D2CC"`, `"rgba(0, 0, 0, 0.87)"` | color (opacity kept) |
| `dimension` | `"8px"`, `"1rem"` (×16), `{ "value": 8, "unit": "px" }` | number, in px |
| `number` / `fontWeight` | `400`, `1.5` | number |
| `fontFamily` / `string` | `"\"Roboto\", sans-serif"` | text |
| `duration` | `"200ms"`, `"0.2s"` | duration (ms) |
| `cubicBezier` | `[0.4, 0, 0.2, 1]` | easing |
| `shadow` | `{ "color": "#0000001A", "offsetX": "0px", "offsetY": "2px", "blur": "8px", "spread": "0px" }` | shadow |
| `typography` | `{ "fontFamily", "fontWeight", "fontSize", "lineHeight", "letterSpacing" }` | typography (lineHeight as a %: 150) |
| `boolean` | `true` | boolean |

Values Sigma can't hold (gradients, multiple shadows, functions like `alpha(theme.palette…)`) are skipped:
leave them out and mention them in your report.

## Mapping a theme object

- Theme *values* are tokens; structure (`mode: 'dark'`, component overrides) isn't.
- A light and a dark theme → one collection with modes `Light` and `Dark` (`Semantic/Light`,
  `Semantic/Dark`). Values shared by both (spacing, radius, fonts) → a single-mode `Primitives` set.
- Name tokens by what they are in code, as paths: `palette.primary.main` → `primary/main` (or keep
  `palette/primary/main` if the team talks that way). Be consistent; record the rule in
  `sigma.config.json` under `"naming"`/`"map"` notes.
- Spacing functions (`spacing: 8` in MUI) → one `space/unit` dimension token; say so.
- Values computed at runtime (`theme.palette.augmentColor`, `darken()`) → write the resulting value only
  if it's literally in the source; otherwise skip and report.

## Checking your extraction

Import with `--dry-run` first. A second extraction of unchanged code must import with **0 added, 0
changed**; if not, your extraction isn't deterministic (sort keys the same way, use the same names, the same
value formats) — fix that before relying on it.
