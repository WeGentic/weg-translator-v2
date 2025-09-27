# Projects Table — Contributor Guide

Add a column
- Update `src/components/projects/table/types.ts` if row type needs new data.
- Add ColumnDef in `columns.tsx` with `header`/`cell`; include `aria-sort` and size.
- Update `toProjectRow` in `ProjectsDataTable.tsx` to populate derived fields.

Add a filter
- Extend `TableFilters` in `types.ts`.
- Wire control in `ProjectsTableToolbar.tsx`.
- Apply predicate in `ProjectsDataTable.tsx` filteredData memo.

Action buttons
- Add to the `actions` display column; ensure `aria-label` and tooltips.

Status mapping
- For project status, use `PROGRESS_PRESENTATION` for activity; `STATUS_PRESENTATION` remains for active/archived if needed.

