# Projects UI Revamp — Milestone 1 Documentation (Baseline + UX Blueprint)

This document summarizes the outcomes of Task 1 (Baseline Assessment) and Task 2 (UX Blueprint & Interaction Design) from `docs/Plan_Projects_UI_Revamp.md`.

## Scope Covered
- Task 1.1–1.5: Audited current layout, panel behavior, existing table, IPC contracts, and summarized TanStack v8 + ShadCN guidelines.
- Task 2.1–2.2: Finalized columns/data model and defined interaction patterns (search, sort, filters, toolbar, row actions, loading/empty states).

## Key Findings (Task 1)
- Layout mounting: `WorkspacePage` mounts `ProjectsPanel` under managed header/sidebar/footer via `layoutStore` with a scrollable content area.
- Data loading: `ProjectsPanel` calls `listProjects({ limit: 100 })` with 1.5s polling, wizard for create, and guarded delete dialog with verification refetch.
- Notifications: panel uses a local snackbar; a reusable `ToastProvider` exists and can replace ad-hoc snack for consistency.
- Existing table: presentational only (no sort/filter/search), uses `IconTooltipButton` actions, upstream date formatting with `Intl`.
- IPC contract: `ProjectListItem` includes `{ projectId, name, slug, projectType, status, fileCount, createdAt, updatedAt }`. Backend clamps `limit` 1..200, supports `offset`, default order `updated_at DESC`.
- TanStack v8 + ShadCN alignment: adopt `useReactTable`, `ColumnDef`, aria-sort headers, global fuzzy search with `rankItem`, faceted filters via `Select`/`DropdownMenu`, sticky header, accessible Lucide-based actions, and `Intl` date formatting.

## UX Blueprint (Task 2)
- Columns (desktop): Name, Type, Files, Status, Updated (default sort desc), Created, Actions. Responsive priorities hide Created and Type first; collapse Actions to menu on small screens.
- Derived fields: `formatDate(iso) -> { label, detail, relative }`; status badge tone; project type icon + label.
- Global search: toolbar input, 200–300ms debounce, `globalFilterFn` using `rankItem`.
- Filters: Status (All/Active/Archived), Type (All/Translation/RAG), Updated within (24h/7d/30d). Chips to indicate active filters and clear-all.
- Toolbar: left (search + filters), right (Create Project + Refresh). Sticky with subtle border/backdrop.
- Row actions: icon buttons on wide screens; `DropdownMenu` on narrow; all with clear `aria-label`s and tooltips.
- Loading/empty/error: skeleton rows; friendly empty CTA; destructive alert with retry; toasts for transient feedback.

## Implementation Approach (Next Tasks)
1) Scaffold a new `ProjectsDataTable` under `src/components/projects/table/`:
   - ColumnDefs with custom cells (badges, icons, dates), `useReactTable` with core/sorted/filtered row models, controlled state for sort/filter/search.
   - `ProjectsTableToolbar` colocated; optional `useDebouncedValue` hook for search.
   - `toProjectRow` transformer and date/status/type formatting utilities.
2) Integrate into `ProjectsPanel` behind the legacy component:
   - Non-breaking: render new table via a guarded path and keep legacy table until parity is verified.
   - Manage table state within `ProjectsPanel` so polling re-applies filters/search/sort without jitter.
   - Replace local snackbar with `useToast` for consistency, keeping visible behavior unchanged.

## Risks & Considerations
- Polling + controlled state: ensure minimal re-renders; memoize rows; stable handlers.
- Accessibility: verify `aria-sort`, focus rings, keyboard navigation for menu-based actions.
- Performance: target smooth interactions up to ~150–200 rows; test under polling.
- Future pagination: current backend supports `limit/offset`; design keeps room for server paging.

## Acceptance Checklist for This Milestone
- Plan updated with detailed findings and completed statuses for Task 1 and Task 2.
- Columns and interactions defined clearly for implementation.
- No code changes introduced that alter existing behavior.

## Next Steps
- Proceed with Task 3 scaffolding (ProjectsDataTable, ColumnDefs, toolbar, transformers, date helpers).
- After scaffolding, integrate gradually in Task 4, ensuring non-breaking behavior and verifying UX parity.

