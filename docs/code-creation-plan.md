# Phase 51: Code creation

Status: in progress. The user selected HTML/CSS as the first target.

## First delivery

A Create code action in the Design editor's Code tab opens a workspace for the current selection or page. Source is editable without changing the design. Preview is isolated from the editor and never executes arbitrary code in Sigma's origin. Copy and download are explicit actions.

The generator reuses existing CSS inspection, token code names, resolved component instances, and accessibility annotations. Output must carry its assets and token dependencies, identify unsupported features, and explain any approximations. Code generation is deterministic; an AI provider is not required.

## Sequence

1. Establish a generator interface and first target adapter; test markup escaping, token bindings, sizing/layout, semantics, and unsupported cases.
2. Add the creation workspace with selection/page scope, editable source files, explicit preview, copy/download, and dirty-state protection before regeneration or closing.
3. Verify a component and responsive page from Sigma/Optics, including token modes, icons/assets, and preview fidelity. Expand mapping reuse with declared component source imports for a framework target.
4. Add repository output planning: proposed paths, diff review, explicit Apply, ownership metadata, and regeneration conflict detection. Never overwrite manual edits silently.
5. Complete build/preview validation and document supported scope before closing Phase 51.

## Acceptance boundaries

The first delivery is a usable increment, not completion of the whole milestone. Existing inspection remains available. Generated source edits are independent from design undo and are retained while the workspace is open. Regeneration requires an explicit discard decision when source is edited. Repository application is a later increment and must not be represented by a download button.

No arbitrary user JavaScript runs in the application origin. Previews use a sandboxed frame and a restrictive content policy. Exports must escape markup and style boundaries. Missing library definitions, custom artwork, unsupported layout/effects, and absent fonts are surfaced as fidelity limitations.

## Implemented first increment

The Code tab now opens Create code with selection/page scope, independent HTML/CSS editors, an explicit sandboxed preview, viewport widths, copy/download, and a discard confirmation for edited drafts. The adapter exports base auto layout, breakpoint direction/gap/padding/alignment/hide rules, token code names with resolved current-mode snapshots, accessible labels/headings/buttons, sanitized icon SVG, and embedded raster images. Only referenced tokens are included.

Still open: repository Apply/diff and ownership/conflict tracking; framework import mappings; broader asset/paint/effect fidelity; font packaging; saved code drafts; representative responsive-page visual comparison. A download is a single self-contained HTML file with embedded CSS. Multiple selected roots are stacked as separate examples; they do not preserve their canvas positions relative to each other.
