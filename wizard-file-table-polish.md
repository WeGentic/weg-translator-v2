# wizard-file-table-polish

## Current User Request Analysis
- File manager table presents stacked visual layers: rounded outer container plus inner table background, leading to superimposed look.
- Need to unify appearance so only a single clean surface is perceived.

## Problem Breakdown
- Table markup uses shared `<Table>` component that applies default background and borders (e.g., `bg-muted/70`, `border-b`).
- Outer container `.wizard-v2-file-table` adds gradient background and rounding; inner table retains its own solid background and spacing, causing overlap along edges.
- Objective: collapse inner table visuals (background, spacing, extra borders) so they blend with container while preserving row striping and scroll behavior.
- Must avoid regressions to dropzone or other wizard steps; changes should stay scoped via CSS overrides.

## User Request
S1: Eliminate the superimposed table effect so only one rounded panel is visible.
Completed: COMPLETED

## Coding implementation
- Scoped CSS overrides under `.wizard-v2-file-table` and scroll area to clip overflow, clear default backgrounds, and collapse table borders so the inner surface follows the rounded container.
- Left shared `Table` component untouched; adjustments apply only within the wizard to avoid broader regressions.

## Notes
- Will override shared table styles locally instead of altering global component to keep other consumers unaffected.
- Styling-only change; no additional lint command required.
