# Standalone architecture decision record

16 October 2026. S3 is in progress. This is evidence for incremental adoption, not a completed migration or a renderer selection.

## Ownership boundaries

- **UI:** read immutable snapshots and dispatch typed commands. React owns only its mounted DOM region; legacy handlers own surrounding regions until migrated.
- **Commands/history:** one source of mutations, undo/redo, selection and conflict/save state. Keep `store.js` behavior and document identities while introducing explicit contracts; React component state contains input drafts, not a parallel document.
- **Model/layout:** components, tokens, modes, variants, slots and authored sizing remain Sigma semantics. Layout returns derived geometry. Text measurement is a separate platform boundary.
- **Renderer:** consumes derived geometry; renderer object IDs are mapped from stable Sigma IDs. Library serialization must not become Sigma's persisted format.
- **Storage:** file/revision/history/recovery operations are explicit services. Mounting a component must not load or save user data implicitly. Existing database and backup compatibility remain acceptance requirements.

## First prototype and provisional decision

The [private experiment](../experiments/standalone-architecture/README.md) uses React + TypeScript + Vite over the actual Sigma store/layout/history. One width edit updates both the React panel and a legacy subscriber; existing undo/redo, Hug layout and serializer/reopen work. This supports an incremental UI approach without replacing the document store. It does not certify the complete inspector, accessibility, typing of legacy JS or production build compatibility. The current adapter intentionally exposes its unchecked JS boundary.

Proceed with a small production slice after defining disposable adapter and command/snapshot contracts. Keep current SVG while evaluating rendering separately. Production integration must preserve CSP, source parity, generated assets/package installation, file switching, pending edits and recovery. Existing tests must still run against the shipped entry point; the prototype cannot replace them.

Yoga matched Sigma on four rectangular sizing fixtures, including Fill sharing after a maximum clamp and intrinsic Fill inside a Hug parent. Both the basic flex mapping and a parent-aware mapping matched. This is compatibility evidence, not sufficient benefit to justify replacement. Keep Yoga experimental until nested sizing, text measurement/wrapping, breakpoints, RTL, min/max conflicts and existing component fixtures pass, with measured benefit over current layout.

## Remaining prototype gates

1. Complete Fabric/Konva/current-SVG comparisons using identical resolved Sigma scenes: nested transforms/clipping, text/IME, icon/artwork, hit testing, selection, export, memory and interaction latency.
2. Measure repeatable cold/warm timings and representative complexity; record hardware, browser, device-pixel ratio and sample counts. Small-scene build time is not editor performance.
3. Test typed UI lifecycles with file/selection changes, read-only history, failed saves, keyboard navigation and both themes; update Sigma reference components for adopted controls.
4. Document build/runtime/bundle and migration costs, transitive notices and rollback. Do not adopt a library because its small prototype looks correct.
5. Record final adopt/defer decisions and exact supported boundaries. S4 remains planned until a production slice lands.

Sources used for API boundaries: [React external-store integration](https://react.dev/reference/react/useSyncExternalStore), [Vite guide](https://vite.dev/guide/), [Yoga](https://www.yogalayout.dev/), [Fabric core concepts](https://www.fabricjs.com/docs/core-concepts/), [Konva overview](https://konvajs.org/docs/overview.html). Those libraries provide infrastructure; their documentation does not establish compatibility with Sigma's model.

## Renderer probe evidence — 16 October 2026

A second isolated entry point compares native rectangular objects in Fabric 7.4.0 and Konva 10.9.0 with Sigma's actual SVG render/hit code. Both candidate packages declare MIT; Fabric's optional Node canvas/jsdom tree also introduces install weight and deprecated dependencies, so adoption needs a full transitive review.

At 1,000 and 5,000 rectangles, all three returned the expected Sigma identity for a test hit, produced a nonempty export, and left the shared source fixture unchanged. They use independent disposable renderer objects, not independent persisted documents. Before each measured SVG setup, the existing global scene cache is cleared outside timing to avoid accidentally comparing reused SVG objects to fresh candidate objects. Each run records one setup and 20 update/pick samples, browser UA, DPR and surface dimensions. Raw evidence is kept with the experiment.

This does not prove rendering fidelity or practical capacity. These are synchronous API-call measurements: SVG schedules browser painting while canvas work has different boundaries. One scene, one browser, no memory data and no interaction-to-paint measurements cannot justify a speed ranking. The candidate adapters intentionally cover rectangles only; neither is a complete replacement for the Design editor. Keep SVG for the release while completing the remaining feature/latency/memory gates, and only adopt a candidate with a demonstrated benefit that pays for migration and regression risk.
