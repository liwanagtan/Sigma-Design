# Standalone architecture prototype

Isolated S3 experiment, not Sigma's production UI. This package is private, has its own pinned dependencies/lockfile and is excluded from the distributed Sigma package. It never connects to IndexedDB, imports user files or changes repository workflows.

```sh
cd experiments/standalone-architecture
npm ci
npm run build
npm run test:layout
npm run dev
```

For the repeatable browser check, build first, install Chromium with `npx playwright install chromium`, then run `npm run test:browser`. CI installs the browser plus Linux system dependencies. The browser check serves the production build through Vite preview and closes it afterward.

## What is real

`src/editor-port.ts` calls the actual `src/store.js`, `src/layout.js`, arithmetic parser and document serializer. React reads an immutable cached view with `useSyncExternalStore`; it does not own a second document/history. Width edits use `editNode` and `commit`. Undo/redo use Sigma's actual history. Serialize/reopen uses Sigma's actual format. A separate legacy DOM subscriber demonstrates coexistence outside the React root.

The TypeScript boundary casts the legacy JS module to a narrow port. That is an explicit unchecked boundary, not proof that the existing model is type-safe. Inspector unmount removes its subscriptions; the fixture/store adapter lasts for the prototype page lifetime. Production adoption needs a disposable adapter, selection/file-change handling and broader typed contracts. This fixture is a panel experiment, not the production inspector's full behavior.

`yoga-check.mjs` compares Yoga 3.2.1 with Sigma's actual rectangle layout engine. Four fixtures cover fixed children in a Hug row, equal Fill sharing, clamped Fill sharing and a Hug parent with intrinsic Fill preference. Both evaluated mappings match all four. `evidence/yoga-rows.json` records the output. This establishes basic compatibility only: text measurement, wrapping, nesting, components, variants, RTL, breakpoints, overflow, exports and performance remain unproven.

## Evidence on 16 October 2026

- Strict TypeScript check and Vite production build passed on Node 24.19.0/macOS arm64. Output: 247.13 kB JavaScript (79.12 kB gzip), 85.96 kB CSS (16.73 kB gzip). This includes React plus the imported store/serializer and the app stylesheet; it is not an isolated React cost or a comparable production bundle benchmark.
- In-app browser interaction verified width `60 * 2` → 120, Hug parent 152 → 192, Undo → 152, Redo → 192, unmount/remount, serialize/reopen and dark appearance. A legacy DOM subscriber updated alongside React. Invalid `1/0` retained width 120 and displayed an error. This is manual automation evidence for these steps, not the entire browser test matrix.
- All four Yoga comparisons passed on Node 24.19.0. No timing/performance conclusion follows from four small rows.
- The scripted Playwright check is added and configured in CI, but did not run locally because its matching Chromium executable is absent. No fresh CI run is claimed.

## Decisions so far

Proceed toward a bounded production React/TypeScript slice with Vite build/package integration, preserving the existing model, history and SVG. First define typed command/snapshot contracts and lifecycle tests; don't copy this fixture adapter into production unchanged. Native controls here are not the final shared-control design or an accessibility audit.

Do not adopt Yoga from this evidence alone. Continue the full sizing corpus and text measurement contract. The first inspector/Yoga experiment did not test a renderer. The second probe below adds rectangular Fabric/Konva comparisons; complete editor compatibility remains open and neither candidate is selected. The decision record is in `docs/standalone-architecture.md` at the repository root.

Dependencies are pinned: React/React DOM 19.3.1 (MIT), Yoga 3.2.1 (MIT), Vite 8.3.4 (MIT), TypeScript 7.0.2 (Apache-2.0), Playwright 1.64.0 (Apache-2.0), React type packages 19.3.0 (MIT), as declared by installed package metadata. Shipping a production bundle still requires the complete transitive notice/license inventory. Yoga's npm package declares MIT but does not contain a root LICENSE file; retain the upstream license before any distribution.

## Renderer probe (second experiment)

Open `/renderers.html` on the experiment server. Fabric 7.4.0 and Konva 10.9.0 are pinned here only (both declare MIT). The page uses the actual Sigma `renderScene` and `hitPath`, Fabric native Rect objects, and Konva native Rect objects over copies of one resolved Sigma rectangle fixture. Library objects are disposable views; the source fixture stays unchanged.

The probe resets Sigma's module-level scene cache outside the measured setup before each run, so repeated runs don't reuse SVG nodes while rebuilding candidate objects. It records one fresh-scene setup/draw call and 20 single-object update/pick calls per renderer. Exports are checked for presence, not visual or semantic fidelity. Sigma/Fabric use SVG; the Konva adapter exports PNG. Geometry is deliberately simple and doesn't test Sigma's components or layout.

Results for 1,000 and 5,000 rectangles are saved in `evidence/renderer-1000.json` and `evidence/renderer-5000.json`: in-app browser Chrome 155, DPR 2, macOS host, 640×460 surface. A zero-millisecond median is below timer precision, not free work. SVG browser paint is deferred; canvas draw calls do different synchronous work. These numbers are **not end-to-end latency or a renderer ranking**. No memory or multi-browser evidence is available. The production-build browser script now includes the 1,000-rectangle correctness probe; local scripted execution still needs its matching Chromium install.

Fabric's optional Node canvas/jsdom dependencies add development-install weight and deprecated transitive-package warnings. The browser experiment builds without using those Node backends. Do not add them to Sigma runtime without a dependency/license/security review. Neither candidate is selected. Text/IME, nested transforms/clipping, icons/artwork, selection/editing semantics, export fidelity and complete scene-to-model command mapping remain open.
