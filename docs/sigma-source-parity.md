# Sigma source parity

The Sigma project must describe the actual app. Internal token coverage alone is not a parity guarantee.

## Code-derived Icons

Build the Icons file from the actual assets and icon mappings used by the application. For Sigma, use its pinned Lucide provider and semantic UI mappings; keep the Sigma logo as a separate brand asset. The availability of an icon in the upstream catalogue does not establish that the app uses it.

### Derivation and verification

1. Inventory source assets, provider/version, semantic names, aliases, and application usages. Distinguish app-used icons from optional catalogue choices and intentional brand exceptions.
2. Preserve editable vector artwork, view boxes, paths, strokes, fills, and supported color behavior. Retain stable IDs and resolvable compatibility aliases so regeneration does not break component references.
3. Compare the file's artwork with the app renderer at the sizes the app uses. Verify stroke width, alignment, clipping, and inherited or explicit colors in Light and Dark modes. Document any unsupported SVG features or intentional differences.
4. Regenerate and recheck affected icons and consuming components after asset, mapping, or provider changes. Preserve custom icons and user edits or report conflicts explicitly.

### Acceptance boundary

An app-used icon is covered when its source mapping resolves, its artwork matches the actual renderer, and its size/color behavior has been checked in representative app contexts. Every app-used icon must resolve to an Icons-file entry or a documented exception. Canonical insertion choices must avoid duplicate compatibility aliases while existing references continue to resolve. Catalogue coverage alone does not prove application coverage.

## Code-derived Tokens

Build the Tokens file from the codebase's actual token definitions and supported styles. Preserve the distinction between source-defined tokens and literal values extracted from component CSS. Extraction can describe today's implementation; it does not turn a hardcoded declaration into a shared source token.

### Derivation and verification

1. Inventory token sources, names, types, units, scopes, aliases, modes, and code mappings. Include first-party styles that affect covered controls; explicitly identify excluded third-party or runtime/user-controlled values.
2. Preserve primitive, semantic, and component aliases where they exist. Retain Light/Dark overrides and scoped roles instead of flattening everything to resolved values. Mode-independent values should stay shared. Auto appearance selects the system's Light or Dark mode; it is not an additional token palette.
3. Check types, units, missing references, alias cycles, and mode resolution. Keep stable token identities and source locations so component bindings and future source changes remain traceable.
4. Compare resolved token values against browser-computed styles in the relevant scope, state, and appearance mode. Account for inheritance, overrides, and conditional styles. A matching root variable does not prove that every consuming control uses it correctly.
5. Record hardcoded component values as normalization gaps. If extraction represents them as derived tokens, retain their literal-source provenance and do not claim the app consumes a shared token. Introducing an alias requires updating the real source usage and verifying the resulting component bindings.
6. Regenerate and recheck affected tokens and consumers when source definitions change. Preserve edits or report conflicts; Design-side changes do not become source changes merely because a code name is present.

### Acceptance boundary

A token is covered when its source/provenance is known, its type and alias graph are valid, and its resolved value matches the supported app contexts in both modes where applicable. A component binding is covered only when it references the intended token and the real implementation consumes the corresponding source definition. Track extracted literals, missing mappings, unsupported scopes, and unverified consumers as explicit gaps. No sample-only values should be presented as tokens used by the Sigma app.

## Code-derived Design components

The agreed approach is to build Design-file components from the real codebase, then render the code components and compare them with the canvas representation. Code supplies the specification; browser rendering verifies the result. A hand-drawn approximation or a passing token-use report alone does not establish parity.

For Sigma itself, the Sigma project's Tokens, Icons, and Components files are the definitive example of this workflow. Components should represent controls the app actually uses. Demonstration-only components must not be presented as app components. The same approach should work for a team's connected repository using its own tokens, icons, and component mappings.

### Derivation and verification

1. **Inventory the real controls.** Identify their source modules, renderers, styles, supported properties, variants, and states. Record gaps explicitly rather than claiming complete coverage.
2. **Resolve dependencies first.** Derive Icons and Tokens from the app's sources before building Components. Preserve semantic aliases and Light/Dark modes; bind component decisions to the corresponding tokens instead of copying resolved colors or sizes where a token exists.
3. **Build editable structure.** Translate the actual component anatomy into native Design layers, text, icon references, auto layout, sizing rules, variants, and instance properties. Preserve supported structure and behavior of layout rather than embedding screenshots. Expose only properties that map meaningfully to the code component.
4. **Render the real implementation.** Use the actual renderer and styles in a browser fixture. Inspect computed styles and measured bounds, including inherited and conditional styles that static extraction can miss.
5. **Compare with the canvas.** Check anatomy, text, icons, token bindings, dimensions, Hug/Fill/Fixed sizing, spacing, typography, borders, radii, and supported states. Cover both appearance modes, representative content lengths, and relevant viewport sizes. Use visual comparisons alongside structural and computed-style assertions; record unsupported features or deliberate differences.
6. **Maintain the relationship.** Keep stable source mappings and file/component identities where possible. Regenerate and rerun the relevant parity checks when code, tokens, or icons change. Future synchronization must preserve user edits or report conflicts rather than silently overwrite them.

### Acceptance boundary

A component is covered only when its declared properties, variants, states, token bindings, and layout have been checked against the real implementation. Registry membership or generated content alone does not mean the component has passed verification. Complete composite controls need their own checks even when their primitives are covered.

The Design file represents appearance, editable anatomy, and supported layout/state choices. Runtime interactions such as dropdown keyboard navigation, application events, data fetching, and business logic remain in code. Accessibility semantics should be retained in mappings or documentation where supported, and verified in the running implementation.

This is the agreed direction, not a claim that arbitrary codebases can already be converted automatically or that every Sigma control is covered. Code-to-Design derivation and parity checking are also distinct from applying Design edits back to source: source updates require supported mappings, a reviewable diff, validation, and an explicit Apply action through the repository workflow.

## Current implementation and coverage

Work proceeds in dependency order:

1. **Icons:** the app and Icons file share the pinned Lucide provider. Compatibility IDs remain resolvable; insertion lists present canonical choices. App icon sizes are shared through `UI_ICON_SIZES`.
2. **Tokens:** `build:welcome` reads all four first-party stylesheets listed in `UI_STYLESHEETS`. Root semantic variables have CSS code names; scoped Code syntax roles retain their actual Light/Dark pairing. Motion durations and timing functions come from app declarations. Runtime/user-resizable dimensions and third-party terminal internals are separate from the first-party design contract.
3. **Components:** `UI_COMPONENTS` is the tracked inventory used by extraction, specimens and parity fixtures. Menu item and switch fixtures use the same renderers as the app; numeric-field fixtures use the app's shared label renderer. CSS inheritance, focus states, sizes and anatomy are verified against browser-computed styles before a control is considered covered.

The first parity gate covers root/scoped colors, inherited typography, dimensions, icon sizing and the corrected Select/Input/Menu/Rail/Toolbar/Appearance controls in both modes. The switch and appearance primitives are represented in the registry. Fields expose prefix/value, menu items expose label/checked/shortcut, and keyboard focus is represented explicitly.

This is not yet a blanket claim that all application composites are represented. `UI_COMPOSITE_BACKLOG` tracks dialogs, token picker, project navigation/icon picker, file cards, Reports, Terminal and Code creation. Their complete anatomy/state/property parity needs dedicated fixtures. The retired Pages and UI screen references are not part of the current parity workflow.

Run `npm run build:icons`, `npm run build:welcome`, browser tests in `/tests/`, and `npm run test:node`. Bump the built-in regeneration versions when generated content changes. A passing token-use report proves binding coverage; the source-parity browser tests prove the specifically asserted app relationships.

Project scope: Sigma now ships only Tokens, Icons, and Components. Retired built-in Foundations, Pages and UI, and Guide examples are permanently removed, including archived copies. The Foundations collection remains part of Tokens; it is not a separate project file. The retired screen-capture pipeline and Foundations specimen builder are removed. Legacy teaching data used by regression tests lives under `tests/fixtures/`.
