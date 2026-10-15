# Sigma source parity

The Sigma project must describe the actual app. Internal token coverage alone is not a parity guarantee.

Work proceeds in dependency order:

1. **Icons:** the app and Icons file share the pinned Lucide provider. Compatibility IDs remain resolvable; insertion lists present canonical choices. App icon sizes are shared through `UI_ICON_SIZES`.
2. **Tokens:** `build:welcome` reads all four first-party stylesheets listed in `UI_STYLESHEETS`. Root semantic variables have CSS code names; scoped Code syntax roles retain their actual Light/Dark pairing. Motion durations and timing functions come from app declarations. Runtime/user-resizable dimensions and third-party terminal internals are separate from the first-party design contract.
3. **Components:** `UI_COMPONENTS` is the tracked inventory used by extraction, specimens and parity fixtures. Menu item and switch fixtures use the same renderers as the app; numeric-field fixtures use the app's shared label renderer. CSS inheritance, focus states, sizes and anatomy are verified against browser-computed styles before a control is considered covered.

The first parity gate covers root/scoped colors, inherited typography, dimensions, icon sizing and the corrected Select/Input/Menu/Rail/Toolbar/Appearance controls in both modes. The switch and appearance primitives are represented in the registry. Fields expose prefix/value, menu items expose label/checked/shortcut, and keyboard focus is represented explicitly.

This is not yet a blanket claim that all application composites are represented. `UI_COMPOSITE_BACKLOG` tracks dialogs, token picker, project navigation/icon picker, file cards, Reports, Terminal and Code creation. Their complete anatomy/state/property parity needs dedicated fixtures. Screenshots in Pages and UI remain captured screen references, not a substitute for this work.

Run `npm run build:icons`, `npm run build:welcome`, browser tests in `/tests/`, and `npm run test:node`. After changing a source included in the capture fingerprint, recapture the four screens and run `npm run build:pages`. Bump the built-in regeneration versions when generated content changes. A passing token-use report proves binding coverage; the source-parity browser tests prove the specifically asserted app relationships.
