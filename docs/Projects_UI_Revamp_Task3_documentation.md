# Projects UI Revamp — Task 3 Documentation (Component Architecture & Utilities)

This document summarizes the scaffolding of the new Projects data table and related utilities implemented under Task 3.

## Implemented Components & Files
- src/components/projects/table/ProjectsDataTable.tsx — TanStack Table instance, rendering, toolbar wiring.
- src/components/projects/table/columns.tsx — ColumnDef<ProjectRow> with custom headers/cells and action column.
- src/components/projects/table/ProjectsTableToolbar.tsx — Search input, status/type/date filters, Create/Refresh actions.
- src/components/projects/table/presentation.tsx — Status/type presentation maps and StatusBadge component.
- src/components/projects/table/types.ts — ProjectRow, filter types, and props.
- src/components/projects/table/index.ts — Barrel exports for table module.
- src/hooks/useDebouncedValue.ts — Debounce hook for global search input.
- src/lib/datetime.ts — `formatDateParts()` producing { label, detail, relative } via Intl APIs.

Backend support (Option A)
- Added aggregated `activityStatus` (pending|running|completed) to `list_projects` SQL and IPC DTO.

## Behavior Notes
- Default sorting: Updated desc, with `aria-sort` reflected on sortable headers.
- Global fuzzy search: `rankItem` from `@tanstack/match-sorter-utils`, debounced by 250ms.
- Filters: Status (All/Active/Archived), Type (All/Translation/RAG), Updated within (Any/24h/7d/30d).
- Toolbar: sticky at top of the card, responsive layout, Clear Filters button when active.
- Cells: Accessible action buttons with Lucide icons and tooltips; dates show relative text and full tooltip detail.

## Integration Plan (Task 4)
- Replace legacy `ProjectsTable` usage in `ProjectsPanel` with `ProjectsDataTable`, passing raw `ProjectListItem[]` and action handlers.
- Preserve user state across polling by lifting sorting/search/filter state into `ProjectsPanel` and passing as controlled props (table module is ready to adapt to controlled inputs).
- Swap local snackbar for `useToast` to align notification patterns without altering visible behavior.
- Add explicit Refresh button wiring to existing `loadProjects()` and keep background polling as-is.

## Non-Breaking Guarantee
- New code is additive and not referenced by current panels; no changes to existing components or behavior.
- Next steps will be introduced behind the existing UI until parity is confirmed.

## Next Steps
- Proceed to Task 4 (integration + state management in `ProjectsPanel`).
- After integration, validate responsive behavior and polish visuals (Task 5), then add tests (Task 6).
