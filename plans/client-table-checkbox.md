# Client Table Checkbox

## Current User Request Analysis
- The client listing view lives in `src/modules/clients/view/`, with the table rendered by `components/ClientsTable.tsx` and column definitions in `components/columns.tsx`.
- Row selection relies on the shared `Checkbox` component (`src/shared/ui/checkbox.tsx`), which currently renders with a thick 2px border and medium rounding.
- The reported issues are that the selection checkboxes inside the table are not responding to clicks, and the checkbox styling should be visually lighter (reduced corner radius and border thickness) to match the desired UI.

## Problem Breakdown
- Confirm the non-interactive behaviour by inspecting how the table wires `onCheckedChange` for both the header and per-row checkboxes; ensure TanStack table row selection state updates correctly.
- Audit the shared checkbox component to understand styling constraints and determine whether adjustments should be scoped (table-only) or global without regressing other areas such as auth/settings forms.
- Evaluate surrounding layout/CSS (`clients-view.css`, shared table styles) in case an overlay or pointer-events side effect blocks pointer interactions.
- Plan incremental updates that keep files cohesive (<300–500 LOC) and avoid over-engineering while staying aligned with React 19 guidelines and project styling conventions.
- Identify any testing gaps and decide how to validate the fix (e.g., targeted React Testing Library test ensuring the checkbox toggles selection).

## User Request
S1: Fix and improve Client table: - Checkbox cannot be clicked - Reduce checkbox rounding and border thickness
Completed: COMPLETED

## Coding implementation
- Replaced TanStack's internal row-selection usage with explicit selection state in `ClientsContent.tsx`, exposing selection helpers to `buildClientColumns` and wiring new callbacks to keep behaviour predictable.
- Updated `ClientsTable.tsx` to accept the selected row set, highlight active rows, and respect the accessibility `aria-selected` attribute.
- Scoped checkbox styling overrides through a dedicated `.clients-table-checkbox` class in `clients-view.css`, reducing radius and border thickness without affecting other checkbox instances.
- Added `ClientsContent` integration test (`__tests__/ClientsContent.test.tsx`) verifying that clicking the row checkbox flips `aria-checked`, preventing regressions on selection behaviour.

## Notes
