# Sub-task 3.2 Documentation — Table Configuration Updates

Date: 2025-02-15

## Scope
Sub-task 3.2 addressed the TanStack React Table configuration for the v2 module, ensuring compatibility with React 19 while keeping visual and behavioural parity with the legacy grid.

## Implementation Notes
- Ported the legacy datagrid helpers into `src/features/project-manager-v2/components/datagrid/`, including `columns.tsx`, `ProjectsTableGrid.tsx`, and `presentation.tsx`. The markup/styling remain unchanged to preserve UX.
- Added the `"use no memo";` directive to both the columns module and the new `ProjectManagerContent` to disable the React Compiler for TanStack-specific code paths. This follows the TanStack guidance that v8 is not compiler-safe yet (see TanStack/table#5567, Oct 2025).
- `buildColumns` now receives the raw `items` array directly, reducing per-render allocations while keeping column-level access to `createdAt`/`updatedAt` timestamps for compact date rendering.
- Retained targeted `useMemo` blocks for `tableRows` and column definitions to ensure stable references, aligning with TanStack’s recommendation to memoise `data` and `columns` for v8.

## Behavioural Parity
- Selection toggles, sorting callbacks, and action buttons behave identically. Date columns continue to show compact timestamps with hover tooltips.
- Responsive column priorities (`COLUMN_PRIORITIES`) and breakpoint filtering mirror the legacy implementation.

## Risks & Follow-ups
- Once TanStack Table v9 lands with compiler support, revisit the `"use no memo";` directives and tighten dependency arrays accordingly.
- Monitor column render performance; additional memoisation of heavy cell renderers can be considered if profiling reveals hotspots.

## Validation
- `npx eslint` on the migrated datagrid modules and `ProjectManagerContent`.

## Next Steps
Execute Sub-task 3.3 to verify rendering parity and document QA guidance.
