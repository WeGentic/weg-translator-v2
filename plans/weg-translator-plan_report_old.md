# weg-translator-plan Report

## Step 1.1 — Project detail route scaffolding (2025-10-19)

- Added `ProjectOverviewRoute` placeholder component to host the upcoming project workspace experience.
- Registered `/projects/$projectId` dynamic route file and bound it to the new component.
- Regenerated `src/router/routeTree.gen.ts` via `@tanstack/router-generator` to expose the route in the tree.
- Full TypeScript build is currently blocked by pre-existing `ProjectListItem.subjects` typing errors; route generation executed through direct generator invocation to avoid build dependency.

## Step 1.2 — Navigation wiring for project openings (2025-10-19)

- `ProjectManagerView` now leverages `useNavigate` to push `/projects/$projectId` whenever a project is opened from the table, sidebar actions, or batch selections.
- Legacy `onOpenProject` callbacks still receive the resolved `ProjectListItem`, ensuring workspace shell state remains in sync during the transition.
- Navigation errors are guarded with a console log to aid debugging without interrupting the user flow.

## Step 1.3 — Loader and context for project overview route (2025-10-19)

- Added a typed TanStack Router loader that resolves the project bundle via `getProjectBundle`, derives a normalized summary, and redirects back to the workspace when a project is missing.
- Introduced `ProjectOverviewProvider`/`useProjectOverviewContext` so nested UI elements can access the loaded summary and bundle without prop threading.
- Updated the `/projects/$projectId` route to surface loading and error fallbacks and to wrap the overview shell in the shared context.
- Extended `ProjectListItem` with `subjects` to align type definitions with existing usage; TypeScript build succeeds after these changes.

## Step 2.1 — Shared project workspace layout (2025-10-19)

- Added `ProjectWorkspaceLayout`, a slot-based shell that standardises header, toolbar, alerts, and content scaffolding for project surfaces.
- Refactored `ProjectManagerView` to compose the new layout without touching existing business logic or table behaviours.
- Wrapped `ProjectOverviewRoute` with the shared shell to guarantee parity before broader page build-out.

## Step 2.2 — Project overview shell page (2025-10-19)

- Introduced `ProjectOverviewPage`, a layout-aware component that renders the hero metadata, stats grid, and placeholder sections while pulling palette-aware styles from `ProjectOverviewPage.css`.
- Route-level logic now delegates to the page component, passing file counts, reference/instruction totals, and language pair information sourced from the bundle loader.
- Added graceful fallback state so the shared layout can present loading copy before IPC data arrives.

## Step 3.1 — XLIFF files grid (2025-10-19)

- Added `ProjectOverviewFilesSection`, a TanStack Table-powered grid with searchable, sortable, and filterable project file rows mapped from the project bundle.
- Wired the overview route to surface editor navigation alongside placeholder regeneration/removal handlers so upcoming workflows can hook in without changing the UI contract.
- Extended the overview page styling to accommodate the new controls while staying aligned with the base palette and layout rhythm.

## Step 3.2 — References & instructions (2025-10-19)

- Implemented `ProjectOverviewResourcesSection` to present reference and instruction assets as responsive cards with metadata, language badges, and action affordances.
- Calculated role-specific bundles in the overview route so counts stay accurate and the page can render distinct resource lists.
- Updated the overview styles to support the dual-column layout and integrated the new sections into the refreshed project workspace.

## Step 3.3 — Shared asset filters (2025-10-19)

- Added `ProjectOverviewAssetFilters` with shared search, role, status, and grouping controls that drive both the XLIFF grid and resource cards.
- Refactored `ProjectOverviewFilesSection` to consume global filters, support “group by role” view, and keep actions intact.
- Applied the same filter state to reference/instruction sections so the entire asset workspace responds consistently to user input.

## Step 4.1 — File add/remove actions (2025-10-19)

- Hooked the overview page into the Tauri dialog + `addFilesToProject`/`removeProjectFile` IPC pipeline, refreshing the project bundle after each mutation.
- Shared toast notifications and busy state across the workspace so buttons disable while operations run and messaging stays consistent.
- Added an “Add files” affordance to the unified filter bar and ensured resource sections honour the same filters and disabled state.

## Step 4.2 — Backend role update IPC (2025-10-20)

- Added `update_project_file_role_v2` Tauri command that validates role input, updates `project_files`/`file_info` rows, and reconciles language pairs or artifacts within a single transaction.
- Registered the command in the invoke handler and IPC module exports so the renderer can call it.
- Extended the database operations layer with a dedicated helper that syncs processable roles with project language pairs and purges stale artifacts for non-processable types.
- ProjectOverview route now invokes the command when the role dropdown changes, refreshes the bundle, and provides success/error toasts while controls are temporarily disabled.
- Front-end `ProjectOverviewFilesSection` now normalizes role values, binds the select control to the backend enum, and surfaces accessible labels; role changes persist and reflect immediately after bundle refresh.

## Step 4.3 — Regenerate XLIFF workflow (2025-10-20)

- Implemented `ensure_project_conversions_plan_v2`, `update_conversion_status_v2`, and `convert_xliff_to_jliff_v2` Tauri commands to plan conversions, reset artifact/job status, and emit JLIFF artefact paths.
- Added filesystem discovery helpers to locate existing project roots, derive absolute input/output paths, and guard against missing source files with integrity alerts.
- Updated the front-end IPC layer to expose typed helpers; ProjectOverview route now streams OpenXLIFF conversions, pushes status updates, runs validation/JLIFF transformation, and surfaces toast feedback while refreshing bundle data on completion.
- Project overview tables now offer inline multi-select with bulk regeneration controls, reusing the conversion pipeline for all selected files while surfacing busy state, integrity alerts, and success/partial failure summaries via shared toasts.

## Step 5.1 — Project statistics dataset (2025-10-21)

- Added `ProjectStatistics` aggregate in the database layer with role counts, conversion/job status tallies, progress percentages, and warning totals derived from the existing project bundle.
- Exposed `get_project_statistics_v2` IPC command and DTO mappings so the renderer can request the snapshot without recomputing at the edge.
- Introduced TypeScript models (`src/shared/types/statistics.ts`) plus a dedicated IPC helper returning typed data, enabling the upcoming UI to hydrate the statistics widgets.

## Step 5.2 — Project statistics UI (2025-10-21)

- Expanded the overview context/route to hydrate and refresh statistics alongside the bundle, ensuring every file action keeps the snapshot in sync.
- Added `ProjectOverviewStatsSection` with progress bars, conversion throughput metrics, warnings, and role breakdown chips styled against the WeGentic palette.
- Updated hero stats to surface ready/issue counts from the new dataset and wired responsive CSS for analytics cards with accessible progress semantics.
- Project overview tables now offer inline multi-select with bulk regeneration controls, reusing the conversion pipeline for all selected files while surfacing busy state, integrity alerts, and success/partial failure summaries via shared toasts.
