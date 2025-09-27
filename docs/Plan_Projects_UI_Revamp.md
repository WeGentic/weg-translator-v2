# Plan — Projects Workspace UI/UX Revamp (TanStack Table v8)

Task 1 - Baseline Assessment for Projects Experience - Status: COMPLETED
Step 1.1 - Audit current Projects navigation and layout touchpoints in `src/features/workspace/WorkspacePage.tsx` to confirm how the panel mounts within MainLayout slots and what chrome expectations exist. - Status: COMPLETED
  - Findings:
    - `WorkspacePage` mounts `ProjectsPanel` when `mainView === "projects"` (src/features/workspace/WorkspacePage.tsx:117).
    - Header, sidemenu, and footer are controlled via `layoutStore` effects; header height 64, footer height 56; sidemenu stays mounted with widths 56/264 and custom header (src/features/workspace/WorkspacePage.tsx:49,74,100,133).
    - Content region is a scrollable column container; `ProjectsPanel` receives `onOpenProject` that routes to overview/editor via `useWorkspaceShell()`.
    - Chrome expectation: visible header, footer, and floating sidebar; background mounted with `BlankBackground`.
Step 1.2 - Inventory `ProjectsPanel` behaviour (`src/components/projects/ProjectsPanel.tsx`) including polling cadence, wizard/dialog flows, and `listProjects` API usage to record constraints before refactoring. - Status: COMPLETED
  - Findings:
    - Data load: `listProjects({ limit: 100 })` with optimistic error handling; initial spinner gated by `showSpinner` flag (src/components/projects/ProjectsPanel.tsx:39,52).
    - Polling: lightweight interval every 1500ms with cleanup; preserves UI state between ticks (src/components/projects/ProjectsPanel.tsx:65-82).
    - Create flow: `CreateProjectWizard` modal toggled by button; refreshes via `onProjectCreated` → reload (src/components/projects/ProjectsPanel.tsx:143,155-157).
    - Delete flow: guarded dialog with name confirmation; uses `deleteProject` then verifies by refetch; snackbar feedback for success/error (src/components/projects/ProjectsPanel.tsx:159-215).
    - Notifications: local `snack` state with 3s auto-dismiss overlay; note coexistence with global `ToastProvider` utilities present under `src/components/ui/toast.tsx`.
Step 1.3 - Evaluate existing `ProjectsTable` markup (`src/components/projects/components/ProjectsTable.tsx`) and supporting helpers (`IconTooltipButton`, alert/snackbar patterns) to catalogue gaps against the desired TanStack feature set. - Status: COMPLETED
  - Findings:
    - Presentational table only: columns = Project | Dates | Status | Actions; no sorting, filtering, or search; static widths (src/components/projects/components/ProjectsTable.tsx:15-24).
    - Actions: `IconTooltipButton` with `aria-label` and hover/focus tooltip; uses Lucide icons; accessible and consistent (src/components/IconTooltipButton.tsx:14-24).
    - Dates: formatted upstream in panel using `Intl.DateTimeFormat`; “Created/Updated” stacked in a single column with title tooltips.
    - Status: chip-like badge; binary mapping Active/Archived from upstream formatter.
    - Gaps vs. TanStack target: no column defs, no `useReactTable`, no `aria-sort` states, no global search, no faceted filters, no sticky header, no controlled state.
    - Alerts/snackbar: panel uses local overlay; repository includes a reusable toast system (`ToastProvider`, `useToast`) that could replace ad-hoc snack.
Step 1.4 - Document data contract from `ProjectListItem` (`src/ipc/types.ts`) and confirm backend pagination/limits so table interactions stay consistent with capabilities. - Status: COMPLETED
  - Findings:
    - `ProjectListItem`: `{ projectId, name, slug, projectType, status, activityStatus, fileCount, createdAt, updatedAt }` (src/ipc/types.ts:56-70). New `activityStatus` is an aggregated conversion status: `pending|running|completed|failed`.
    - IPC: `listProjects({ limit?, offset? })` (src/ipc/client.ts:99-117). Backend clamps `limit` 1..200, defaults to 50; `offset` >= 0; ordered by `updated_at DESC` (src-tauri/src/ipc/commands.rs:911-925, src-tauri/src/db/mod.rs:1066-1092).
    - No server-side filtering/sorting; client can implement sort/filter/search locally over the fetched page. For larger lists, future pagination can leverage `offset`.
    - Actions: `deleteProject(projectId)` returns affected count and is followed by refetch to validate deletion (src/ipc/client.ts:119-123).
Step 1.5 - Summarize findings from latest TanStack Table v8 + ShadCN guidelines (global search, sort indicators, faceted filters, Lucide icon usage, date formatting) to anchor design decisions. - Status: COMPLETED
  - Summary (validated via web search):
    - Column defs: use `createColumnHelper<ProjectRow>()`; custom `header`/`cell` with `flexRender`; group headers supported.
    - Sorting: enable per-column; bind header `onClick={column.getToggleSortingHandler()}`; reflect `aria-sort` = `ascending|descending|none`.
    - Global fuzzy search: implement `globalFilterFn` using `rankItem` from `@tanstack/match-sorter-utils`; control `state.globalFilter` with debounced input.
    - Faceted filters: use `table.getColumn(id).getFacetedUniqueValues()` to power ShadCN `Select`/`DropdownMenu`; set via `column.setFilterValue`.
    - Toolbar: compose search input, filter controls, create/refresh buttons, and reset; responsive stacking for narrow widths.
    - Sticky header: Tailwind `sticky top-0 z-10 bg-background` on header row.
    - Accessible actions: Lucide icons inside ghost buttons; each with clear `aria-label`; keep hit areas 32–40px; maintain focus-ring visibility.
    - Date formatting: prefer `Intl.DateTimeFormat` for compact label + detailed tooltip; consider `Intl.RelativeTimeFormat` for “x minutes ago”.

Task 2 - UX Blueprint & Interaction Design - Status: COMPLETED
Sub-task 2.1 - Column & data model specification - Status: COMPLETED
Step 2.1.1 - Decide final column set (name, type, file count, status, created, updated, actions) and define width, alignment, and responsive priorities. - Status: COMPLETED
  - Columns (Desktop >1024px):
    - Name (flex-1, left, min-w 220, trunc): project name; tooltip with full name; primary sort key optional.
    - Type (w-28, center): icon + label from `projectType` (translation/rag).
    - Files (w-24, right): `fileCount` as chip.
    - Status (w-28, center): badge (Active/Archived) with color tokens.
    - Updated (w-40, right): relative label, tooltip absolute date; default sort desc.
    - Created (w-40, right): compact date; hidden on narrow screens.
    - Actions (w-40, right): open/delete; overflow `DropdownMenu` on <640px.
  - Responsive priorities:
    - Hide Created first; then Type; collapse Actions into menu on small screens; Name and Updated remain visible.
Step 2.1.2 - Define derived display fields (relative date labels with tooltip detail, status badges, project type icons) using `Intl.DateTimeFormat`/`Intl.RelativeTimeFormat`. - Status: COMPLETED
  - Dates: `formatDate(iso) -> { label: short, detail: full, relative: "x ago" }` via `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat`.
  - Status: map to `{ label, tone }` where tone drives badge styles; archived uses subdued/destructive tone.
  - Type: map to `{ label, icon }` using Lucide (e.g., Translate, Database icons) with `aria-label`.
Step 2.1.3 - Map row-level metadata required for quick actions (slug, file count, last activity) and ensure transformer exposes these values. - Status: COMPLETED
  - `ProjectRow`: `{ id, name, slug, projectType, status, fileCount, created, updated }` where `created/updated` are formatted structs.
  - Transformer `toProjectRow(item: ProjectListItem)` returns normalized structure consumed by ColumnDefs.
Sub-task 2.2 - Interaction patterns & controls - Status: COMPLETED
Step 2.2.1 - Specify global search behaviour (input placement, debounce rules, TanStack global filter integration with `@tanstack/match-sorter-utils`). - Status: COMPLETED
  - Toolbar left: global search input with placeholder “Search projects…”.
  - Debounce 200–300ms; hook `useDebouncedValue` to avoid keystroke churn.
  - Integration: `useReactTable({ globalFilterFn: fuzzy, state: { globalFilter }, onGlobalFilterChange })` with `rankItem`.
Step 2.2.2 - Define sorting defaults (updated desc) and header toggle patterns with Lucide chevrons reflecting `aria-sort` states. - Status: COMPLETED
  - Default sorting: `updated` desc.
  - Header buttons: clickable area includes label + chevron; `aria-sort` reflects `column.getIsSorted()`.
  - Reset behavior: shift-click clears sort; provide “Reset” in toolbar.
Step 2.2.3 - Plan filter widgets (status, project type, date presets) using ShadCN `Select`/`DropdownMenu` and outline empty-state messaging when filters active. - Status: COMPLETED
  - Filters:
    - Status: All | Active | Archived.
    - Type: All | Translation | RAG.
    - Date preset: Updated in {24h, 7d, 30d} — client-side predicate on `updatedAt`.
  - ShadCN components: `Select` for single-choice; `DropdownMenu` for multi-select if needed.
  - Empty state: message includes active filter chips with quick “Clear all”.
Step 2.2.4 - Design toolbar composition (search, filters, create button, refresh) with responsive stacking and sticky behaviour. - Status: COMPLETED
  - Layout: left = search + filters; right = Create Project + Refresh.
  - Responsive: stack rows on <640px; move Refresh into overflow on xs.
  - Sticky: toolbar wrapper `sticky top-0 z-10 bg-background/95 backdrop-blur border-b`.
Step 2.2.5 - Determine row action layout (icon buttons vs `DropdownMenu`) ensuring keyboard support and tooltip clarity. - Status: COMPLETED
  - Desktop: two icon buttons (Open, Delete) with tooltips.
  - Mobile/narrow: single `More` menu (DropdownMenu) containing the same actions; all actions labeled and tabbable.
Step 2.2.6 - Define loading/empty/error visuals (skeleton rows, CTA cards) aligned with app aesthetic. - Status: COMPLETED
  - Loading: 6–8 skeleton rows with shimmer.
  - Empty: card with CTA “Create project” and help copy.
  - Error: destructive Alert with retry button; toast on subsequent failures.

Task 3 - Component Architecture & Utilities - Status: COMPLETED
Sub-task 3.1 - TanStack table scaffolding - Status: COMPLETED
Step 3.1.1 - Create `ProjectsDataTable` module under `src/components/projects/table/` encapsulating TanStack setup and UI rendering. - Status: COMPLETED
  - Implemented files:
    - `src/components/projects/table/ProjectsDataTable.tsx` (table instance + rendering + toolbar)
    - `src/components/projects/table/columns.tsx` (ColumnDefs)
    - `src/components/projects/table/ProjectsTableToolbar.tsx` (search, filters, create, refresh)
    - `src/components/projects/table/presentation.tsx` (status/type maps and badges)
    - `src/components/projects/table/types.ts` (row and props types)
    - `src/components/projects/table/index.ts` (barrel exports)
Step 3.1.2 - Author `ColumnDef<ProjectRow>` definitions with custom header/cell renderers (badges, stacked dates, action cells). - Status: COMPLETED
  - Columns: name, projectType, fileCount, status, updated (relative), created (label), actions; headers provide sort toggles and `aria-sort`; action cells use `IconTooltipButton` and Lucide icons.
Step 3.1.3 - Implement `useReactTable` instance wiring (core/sorted/filtered row models) with controlled state to preserve user selections through polling. - Status: COMPLETED
  - Wiring: `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`; default sorting on `updated` desc; global fuzzy filter; state stored locally (prepared for external control in integration phase).
Step 3.1.4 - Build `ProjectsTableToolbar` component (search input, filter controls, create/refresh buttons) colocated with the table module. - Status: COMPLETED
  - Components: ShadCN `Input` + `Select` + `Button`; non-sticky toolbar (per feedback) with responsive layout; clear-filters action when active.
Step 3.1.5 - Add optional utilities (e.g., `useDebouncedValue`) in `src/hooks/` if search requires debouncing or remote integration. - Status: COMPLETED
  - Added `src/hooks/useDebouncedValue.ts` (default 250ms) and used in table for global search.
Sub-task 3.2 - Data transformation & formatting - Status: COMPLETED
Step 3.2.1 - Introduce `toProjectRow` transformer producing normalized row objects (id, name, status meta, formatted dates) for the table. - Status: COMPLETED
  - Implemented inside `ProjectsDataTable.tsx` for now; returns formatted `created/updated` plus raw timestamps for stable sorting.
Step 3.2.2 - Create date formatting helpers (e.g., `src/lib/datetime.ts`) returning `{ label, detail, relative }` with `Intl` APIs for localization readiness. - Status: COMPLETED
  - Added `formatDateParts()` with `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`.
Step 3.2.3 - Define status/type presentation config (color tokens, icon refs, tooltip copy) in a central map to keep markup declarative. - Status: COMPLETED
  - Added `PROGRESS_PRESENTATION` (pending/running/completed/failed), `STATUS_PRESENTATION` (active/archived), and `TYPE_PRESENTATION`; helper `StatusBadge` for consistent styling.
Step 3.2.4 - Evaluate need for auxiliary libs (e.g., `date-fns`) and document decision, ensuring bundle impact is acceptable. - Status: COMPLETED
  - Decision: no external date library required; `Intl` covers formatting/relative labels; `@tanstack/match-sorter-utils` already present for fuzzy search.

Task 4 - ProjectsPanel Integration & State Management - Status: IN PROGRESS
Sub-task 4.1 - Wiring table into panel flow - Status: IN PROGRESS
Step 4.1.1 - Replace legacy `<ProjectsTable>` with new data table, passing raw `ProjectListItem[]` and action handlers (`onOpenProject`, `onRequestDelete`). - Status: COMPLETED
  - `ProjectsPanel` now renders `<ProjectsDataTable items={projects} ... />`; legacy row mapping removed; status column now uses backend-aggregated `activityStatus` (Pending/Running/Completed).
Step 4.1.2 - Manage table state in `ProjectsPanel` (sorting, filters, search text) so polling refreshes reapply without jitter; leverage React Compiler-friendly patterns. - Status: COMPLETED
  - `ProjectsPanel` now owns `tableSorting`, `tableSearch`, and `tableFilters` and passes them to `ProjectsDataTable` as controlled props. State persists across polling without jitter/remount.
Step 4.1.3 - Ensure delete/open callbacks tie into refreshed row context, including optimistic feedback and refresh triggers post-mutation. - Status: COMPLETED
  - Open uses id lookup → `onOpenProject(project)`; Delete triggers IPC, refetch, and snack feedback; DataTable action handlers bound to panel callbacks.
Step 4.1.4 - Add explicit refresh mechanism (button or toast prompt) to complement background polling. - Status: COMPLETED
  - Toolbar `Refresh` wired to `loadProjects({ showSpinner: true })` in `ProjectsPanel`.
Sub-task 4.2 - Panel layout updates - Status: IN PROGRESS
Step 4.2.1 - Recompose panel header area with title, project count badge, and placement of create button aligned with toolbar controls. - Status: COMPLETED
  - Header shows just "Projects" (count badge removed based on feedback). Create/Refresh live in toolbar.
Step 4.2.2 - Replace loading placeholder with table skeleton rows using ShadCN `Skeleton` or Tailwind utilities for continuity. - Status: COMPLETED
Step 4.2.3 - Enrich empty/error states with illustrations or iconography, contextual messaging, and CTA buttons. - Status: COMPLETED
  - Added EmptyProjectsState with icon and CTA; Alert retains error copy + retry via toolbar Refresh.
Step 4.2.4 - Upgrade notification pattern (use ShadCN toast if available or refine existing snack) for success/error feedback on create/delete. - Status: COMPLETED
Step 4.2.5 - Validate responsive behaviour (narrow widths -> stacked toolbar, horizontal scroll for table) and document breakpoints. - Status: COMPLETED
  - Documented breakpoints and alignment decisions in `docs/Projects_Table_Responsive.md`. Toolbar made non-sticky per feedback to improve spacing.

Task 5 - Visual Design & Accessibility Polish - Status: IN PROGRESS
Step 5.1 - Implement status/type badges using Tailwind tokens and Lucide icons, verifying contrast meets WCAG AA in light/dark themes. - Status: COMPLETED
Step 5.2 - Add inline metadata cues (file count chip, last activity pill) to improve scanability without clutter. - Status: COMPLETED
Step 5.3 - Apply sticky header/footer rows and subtle row hover/focus states for long lists, respecting scroll container styles. - Status: PARTIAL
  - Hover/focus states applied; header remains non-sticky per feedback.
Step 5.4 - Conduct accessibility audit (keyboard navigation, `aria-sort`, focus outlines, announceable updates) and log remediation items. - Status: COMPLETED
Step 5.5 - Tune micro-interactions (hover transitions, icon motion) for responsiveness without performance penalties. - Status: COMPLETED

Task 6 - Quality Assurance & Testing - Status: IN PROGRESS
Step 6.1 - Write unit tests for date/status formatter utilities covering invalid data and archived projects. - Status: COMPLETED
Step 6.2 - Add component tests (Testing Library) for search/sort/filter flows, stubbing `listProjects` results. - Status: COMPLETED
Step 6.3 - Verify row actions trigger callbacks via interaction tests, including delete confirmation flow edge cases. - Status: COMPLETED
Step 6.4 - Compile manual QA checklist (accessibility, responsive layouts, lifecycle scenarios) and execute prior to merge. - Status: NOT COMPLETED
Step 6.5 - Record performance metrics (render time under 150 rows) ensuring polling + controlled state introduce no regressions. - Status: NOT COMPLETED

Task 7 - Documentation & Handoff - Status: COMPLETED
Step 7.1 - Update project documentation (README section or `docs/`) to highlight new Projects table capabilities and usage tips. - Status: COMPLETED
  - Added `docs/Projects_Table_Overview.md`.
Step 7.2 - Document implementation decisions, open questions, and future enhancements (pagination, saved views, export) for stakeholders. - Status: COMPLETED
  - Added `docs/Projects_Table_Implementation_Decisions.md`.
Step 7.3 - Outline rollout considerations (feature flag vs immediate enablement) and communication plan for QA/PM teams. - Status: COMPLETED
  - Added `docs/Projects_Table_Rollout.md` and `docs/Projects_Table_QA_Checklist.md`.
Step 7.4 - Provide guidance for future contributors on extending the table (adding columns/filters) while preserving UX consistency. - Status: COMPLETED
  - Added `docs/Projects_Table_Contributor_Guide.md`.
