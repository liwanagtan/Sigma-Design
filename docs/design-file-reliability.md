# Design File reliability

Implemented 15 October 2026 following the Design File audit. User review remains for the inspector and spacing feedback. Code creation remains Phase 51; editor reliability takes priority.

## Sizing contract

- **Fixed:** authored geometry, constrained by defined min/max sizes. Explicit resize switches that axis to Fixed.
- **Hug:** measures visible, in-flow content plus padding and packed gaps. Absolute and breakpoint-hidden children do not contribute. Auto spacing contributes no intrinsic gap.
- **Fill:** receives final inner space after the parent has been measured. A content-bearing Fill frame contributes its intrinsic content size when its parent hugs. Cross-axis non-Fill siblings anchor that axis; Fill children stretch to the resulting space while their minimums still contribute.
- Empty or non-text leaf Fill nodes retain a preferred size in `layoutBasis.w/h`. This is authored fallback data, not an allocated size. Older documents initialize it from their current size on first layout. New Fill choices capture a fresh fallback. Existing old files whose preferred dimension was already discarded cannot recover that historical intent; their loaded size is the compatibility fallback.
- Text intrinsic width is measured independently of its allocated Fill width. Width changes remeasure wrapping; geometry convergence propagates dependent heights through nested frames.
- The Fill allocator solves an equal-share budget with lower/upper bounds. Feasible budgets are conserved before pixel rounding; unavoidable minimum overflow is deterministic. UI edits reject contradictory min/max pairs; legacy contradictory limits give minimum precedence and a diagnostic.
- Editor and headless rendering use `layOutDocument()`. Layout and component synchronization repeat until geometry is stable, with explicit cycle/budget diagnostics instead of silently stopping after a few text-only passes. A deliberately cyclic Hug/breakpoint combination cannot satisfy both rules; adjust its breakpoint or make that axis Fixed.

Geometry is still materialized in `w/h` for renderer/hit-test compatibility. Intrinsic measurement no longer uses the previous allocated Fill width as a content measurement. A full replacement of the document geometry representation is not required for these fixes.

## Components and inspector

- Component sets own shared property definitions. A variant shows its values, an explicit link to edit shared properties, and its own eligible nested controls. Layer-level bindings remain authorable on variant children.
- “Expose nested controls” exposes existing nested component APIs on outer instances. Choices are scoped to the selected variant (or explicitly the whole selected set) and named by layer/variant path. An empty state explains when nested components have no editable properties.
- Main-component navigation resolves the selected nested instance or nearest containing instance, respects slots, and deep-links linked library components. Canvas, Layers, Assets and inspector use the appropriate source/set actions.
- A shared component-context resolver colors component-owned names/icons, hover, selection boxes, handles and size badges. Slot-inserted user content retains its ownership boundary.
- Size limits are collapsed by default, including configured limits; an Active hint preserves discoverability. Users can expand or collapse them. Limits have explicit Width/Height and Min/Max labels, None placeholders and per-limit reset. Aspect locking and corner radius use Lucide lock/open-lock and square-round-corner glyphs and accessible names.
- Constraints have toggleable edge pins, a center action and labeled axis selectors. Constraints govern free/absolute children; auto-layout flow uses Fill/Hug.

## Spatial feedback

Hover empty space inside a selected auto-layout frame, hover its spacing fields, or toggle **Preview padding and gaps**. Padding bands and actual sibling gaps come from final computed boxes, respect RTL/rotation/zoom, and exclude hidden/absolute children. Numeric badges keep small frames readable; region descriptions include bound token names. Overlays are editor-only and never exported. There is no CSS-style child margin property: Alt distance measurements remain separate from frame padding and sibling gap.

## Validation

Regression fixtures cover the three original failures, both axes, nested intrinsic measurement, mixed min/max limits, conservation/permutation invariants over 150 allocations, deep text wrapping, explicit cycle detection, undo/redo, browser/project-format reopening, nested exposure overrides/reopening, nearest-main targeting, component context, and spacing geometry. An actual app iframe tests size-limit editing/reset, pin toggles, source navigation menus, component colors and pinned spacing previews.

The Sigma style source and all four Pages and UI reference captures were regenerated. Existing token, component, constraint, RTL, breakpoint, code-creation and repository suites remain part of the validation gate. These checks do not promise zero defects for every imported design; follow-up reports should add reproductions to the same suite.

Validation result: **275 browser tests and 92 Node tests passed**. The browser suite includes an actual Design editor iframe; live Optics verification also confirmed automatic padding previews with pinning disabled and no console errors. Changes remain uncommitted for review.
