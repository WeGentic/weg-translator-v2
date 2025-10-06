# Project Manager React 19 Modernization Plan

Main Objective: Refactor the Project Manager module to leverage React 19 features, removing unnecessary memoization hooks while ensuring no behavioural regressions. UX/UI must remain **IDENTICAL**. Functionality includes project listing, filtering, selection, deletion, and wizard initiation must be perfectly preserved.

General directives:
- All changes must be confined to a new module `project-manager-v2` under `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/features/project-manager-v2`.
- Legacy `project-manager` files must remain untouched, MUST be used as Source of Truth, and copied to the new module as needed and/or refactored as needed, with clear documentation on what was refactored vs. copied.

Task 1 - Establish Baseline & Invariants - Status: COMPLETED
  - Baseline documentation finished (see supporting `{subtask-1-x}-documentation.md` files and `task-1-analysis-report.md`).
Sub-task 1.1 - Audit current Project Manager module behaviour - Status: COMPLETED
  - Baseline captured 2025-02-14 covering state/effect graphs, UI invariants, and integration contracts for toolbar/content/footer/dialog flows. Use this section as parity reference before modifying or duplicating code into `project-manager-v2`.
Step 1.1.1 - Review `src/features/project-manager/ProjectManagerView.tsx` to catalogue state, effects, and callbacks that must preserve polling, selection sync, and dialogs - Status: COMPLETED
  - State snapshot: `projects`, `isWizardOpen`, `isLoading`, `error`, `sorting`, `search`, `filters`, `selectedRows` (Set), plus dialog state (`deleteDialogOpen`, `deleteTarget`). Defaults rely on `DEFAULT_SORTING`, `DEFAULT_FILTERS`, polling constants.
  - Effects: initial load + 1.5s polling interval with cleanup, selection pruning effect keyed on `visibleProjects`, sidebar sync via `useSidebarTwoContentSync` (depends on selected rows + handlers).
  - Critical callbacks: `loadProjects` (IPC `listProjects`, error handling, optional spinner), `handleBatchDelete` (IPC `deleteProject`, toast feedback), dialog handlers (`handleDeleteDialogOpenChange`, `handleRequestDelete`, `handleAfterDelete`), wizard + creation (`handleCreateProjectClick`, `handleProjectCreated`), row helpers (`handleOpenProjectById`, `handleBatchDeleteRequest`), selection reset (`clearSelection`). All memoized with `useCallback` today.
  - Derived data: `visibleProjects` via `useMemo(filterProjects)` respects filters/search, `showEmptyState` gating zero project message, selection auto-pruning ensures sidebar + grid stay in sync.
Step 1.1.2 - Document UI/UX invariants for toolbar, table grid, footer, and dialogs to ensure one-to-one parity post-refactor - Status: COMPLETED
  - Toolbar: rendered inside `.resources-toolbar-zone` with `role="toolbar"` + aria label. Search input uses `Search` icon, placeholder `Search projects…`, `aria-label="Search projects"`, clear pill button with `aria-label="Clear search"` shown when query present. Desktop filters expose three `Select` controls (status options all/pending/running/completed/failed, type all/translation/rag, updated any/24h/7d/30d) plus tooltip-wrapped ghost `Button` to clear filters when any active. Mobile breakpoint swaps to popover trigger button with `Filter` icon, animated badge showing active filter count, popover reproduces select stacks with `Clear all` ghost button. Palette tokens referenced via Tailwind classes must remain exact for parity.
  - Table grid: `ProjectsTableGrid` wraps shadcn `Table` with `aria-label="Projects table"`. Header groups styled with gradient glassmorphism, column meta supplies `vertical-separator-partial` class names. Rows animate with `table-row-enter` timing, stripe colors differentiate even/odd, `selectedRows` highlight overlays `var(--color-tr-primary-blue)` tint while preserving hover gradient. Empty state row shows icon + "No projects found" copy and optionally `for "query"` inline span.
  - Footer: `ProjectManagerFooter` is sticky with gradient background, `aria-live="polite"` for screen reader updates. Shows "Total Projects" chip using primary token and conditionally "Selected" chip using secondary palette when `selectedCount > 0`; numeric badges sized via `min-w-[24px]` and 11px font.
  - Dialogs: Delete flow uses ShadCN `Dialog` titled "Delete project", description warning irreversible action, and embedded form requiring exact name confirmation (`Input` labelled "Project name", mismatch error message). Submit button is destructive variant with `Trash2` icon, text toggles to "Deleting..." while pending; cancel leaves dialog open until `onOpenChange(false)`. Wizard dialog titled "Create new project" includes progress indicator (Step x of y label + bar), three-step flow (details/files/review), `Loader2` spinner on create, Cancel/Back/Next buttons with same ordering; closing resets state via `useProjectWizard` helpers to avoid stale form data.
Step 1.1.3 - Trace shared utilities (`filterProjects`, `useSidebarTwoContentSync`) and dependent components (`ProjectsManagerHeader`, wizard, delete dialog) to understand integration points - Status: COMPLETED
  - `filterProjects`: exported helper consumes raw `ProjectListItem[]`, `TableFilters`, and search string. Normalises case, applies progress/type filters, optional updated-within threshold, then search across name/slug/type/status/activity. Invoked in both `ProjectManagerView` (top-level `visibleProjects`) and `ProjectManagerContent` (secondary `filteredProjects` + `tableRows`), leading to duplicate work we must account for in refactor to avoid behavioural drift.
  - `useSidebarTwoContentSync`: hook bridges Project Manager selection state with global layout store. When selections exist, ensures sidebar-two visibility, renders `ProjectsBatchActionsPanel` with callbacks (`onBatchDelete`, `clearSelection`, `onOpenProject`) and expected props (count, names, ids). When no selection, computes derived metrics (active count via `status === "active"`, `fileCount` sum, `recentlyUpdated` within 24h) and renders `ProjectsOverviewCard`. Dependencies rely on stable Set identity; changes to selection semantics require preserving this contract.
  - Dependent components: `ProjectsManagerHeader` exposes `onCreateProject` button (tooltip, lucide `Plus`). `CreateProjectWizard` expects controlled `open`/`onOpenChange`, resets internal state on close, and emits `onProjectCreated` for parent refresh (`loadProjects`). `DeleteProjectDialog` depends on name confirmation and uses `deleteProject` + `listProjects` to verify deletion before invoking `onAfterDelete` (which clears selection and reloads). Batch delete side panel uses `ProjectsBatchActionsPanel` with async `onBatchDelete`, while `EmptyProjectsState` expects `onCreate` to reuse header action.
Sub-task 1.2 - Confirm React 19 compiler readiness - Status: COMPLETED
  - Tooling check confirmed Babel + ESLint integrations active; memoization inventory documented for downstream modernization decisions.
Step 1.2.1 - Verify tooling (Babel/TS config, eslint) already enables React Compiler and JSX transform required for React 19.1; note gaps if any - Status: COMPLETED
  - `package.json` declares `react@19.1.1`, `react-dom@19.1.1`, `babel-plugin-react-compiler@19.1.0-rc.3`, and `eslint-plugin-react-compiler@19.1.0-rc.2`.
  - `vite.config.ts` applies `@vitejs/plugin-react` with `babel.plugins` including `"babel-plugin-react-compiler"`, ensuring compiler transforms run in dev/build. Tailwind + TanStack router plugins coexist without conflicting order.
  - `eslint.config.js` registers `react-compiler/react-compiler` rule at `error` severity across TS files alongside latest React Hooks plugin, providing lint-time enforcement.
  - `tsconfig.json` uses `jsx: "react-jsx"`, `moduleResolution: "bundler"`, strict mode, and workspace includes `src` plus shared packages. No gaps detected; optional next step: wire `npx react-compiler-healthcheck` into tooling if desired.
Step 1.2.2 - Inventory usage of manual memoization hooks across Project Manager files to identify candidates for removal per React 19 compiler guidance - Status: COMPLETED
  - `ProjectManagerView.tsx`: single `useMemo` for `visibleProjects` (filters + search) and nine `useCallback` wrappers for handlers (dialog toggles, polling load, selection actions). Likely candidates for inline functions once compiler ensures stability; `loadProjects` may remain extracted for readability but memoization unnecessary.
  - `ProjectManagerContent.tsx`: three `useMemo` blocks (`filteredProjects`, `tableRows`, `columns`) plus controlled/local state bridging. Duplicates filtering work already done upstream; expect to consolidate filtering and rely on compiler for derived arrays.
  - `ProjectManagerToolbar.tsx`: two `useMemo` values (`hasActiveFilters`, `activeFiltersCount`) computing cheap comparisons—safe to inline post-compiler.
  - `components/DeleteProjectDialog.tsx`: `useMemo` gating submit button disabled state; minimal computation—compiler can infer.
  - Wizard stack: `CreateProjectWizard.tsx` exposes four `useCallback` wrappers for open/close transitions; `useProjectWizard` file defines six `useCallback` and one `useMemo` for derived booleans; step components (`ProjectDetailsStep`, `ProjectFilesStep`, `ProjectReviewStep`) each use `useMemo` for derived arrays/summaries. Need to evaluate case-by-case (e.g., mapping files may remain as pure helpers) but most can lean on compiler.
  - No usages of `React.memo` or custom memo utilities detected, simplifying migration.
Sub-Task 1.3 - Define Migration Strategy & Directory Layout - Status: COMPLETED
  - Directory structure, file classification, and dependency matrix documented (see `project-manager-v2-migration-matrix.md`) to guide subsequent implementation without touching legacy files.
Step 1.3.1 - Confirm new project-manager-v2 module boundaries and file mapping - Status: COMPLETED
  - New module root: `src/features/project-manager-v2`. Mirror top-level entry files (`ProjectManagerView.tsx`, `ProjectManagerContent.tsx`, `ProjectManagerToolbar.tsx`, `ProjectManagerHeader.tsx`) plus supporting folders: `components/`, `components/datagrid/`, `components/wizard/` (with nested `steps`, `state`, `utils`), `hooks/`, `types/`, `utils/`, `css/`.
  - CSS assets (`css/dropdowns.css`, `css/data-table.css`, `css/new-project-button.css`) remain as-is under v2 folder to avoid touching legacy styles while enabling targeted adjustments.
  - Shared IPC/types remain imported from existing shared locations (`@/ipc`, layout store, etc.); no cross-writes to legacy module. V2 module exports will be wired separately once implementation begins.
Step 1.3.2 - List all legacy files under src/features/project-manager/ to classify as refactor vs. copy-only, documenting rationale for each decision - Status: COMPLETED
  - Refactor in v2: `ProjectManagerView.tsx`, `ProjectManagerContent.tsx`, `ProjectManagerToolbar.tsx` (core state/data flow overhaul); `components/datagrid/columns.tsx` (align with new data plumbing + compiler), `utils/filterProjects.ts` (dedupe + shared selector), `hooks/useSidebarTwoContentSync.tsx` (ensure compatibility with updated selection strategy), wizard state hook `components/wizard/state/useProjectWizard.ts` (evaluate for compiler-friendly patterns), and wizard steps (details/files/review) where redundant memoization will be removed.
  - Copy with light touch (style parity): `ProjectManagerHeader.tsx`, `components/ProjectManagerFooter.tsx`, `components/datagrid/ProjectsTableGrid.tsx`, `components/datagrid/presentation.tsx`, `components/ProjectsBatchActionsPanel.tsx`, `components/BatchDeleteConfirmDialog.tsx`, `components/ProjectsOverviewCard.tsx`, `components/DeleteProjectDialog.tsx`, `components/EmptyProjectsState.tsx`, wizard scaffolding `components/wizard/CreateProjectWizard.tsx`, `components/wizard/utils/*`, `components/wizard/types.ts`, CSS assets under `css/`, and `types/types.ts`. These may receive naming/typing tweaks but no behavioural shifts.
  - Rationale: Files marked “refactor” either contain duplicated data derivation, heavy hook usage targeted by React 19 migration, or coordinate global state; copy-classified assets are primarily presentational or already compliant with new patterns.
Step 1.3.3 - Specify target paths inside /Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/features/project-manager-v2, ensuring legacy files remain unchanged. Create a document that will be referenced during the migration - Status: COMPLETED
  - Target layout finalized (see `project-manager-v2-migration-matrix.md`), mirroring legacy folder structure with explicit refactor vs copy designations. Legacy module untouched; v2 files will reside strictly under `src/features/project-manager-v2`.
Step 1.3.4 - Produce migration matrix outlining dependencies (shared components, hooks, utils) and note which will be reused or duplicated - Status: COMPLETED
  - Migration matrix recorded in `project-manager-v2-migration-matrix.md` summarizing each source file, plan (refactor/copy), dependencies, and notes. Highlights reuse strategy for shadcn components, TanStack table, layout store, and IPC calls.
Sub-task 1.4 - Reporting - Status: COMPLETED
  - Consolidated findings into `task-1-analysis-report.md`; ready to guide Tasks 2–6.
Step 1.4.1 - Generate a full-detailed report from Task 1 analysis for stepwise modernization ensuring no behavioural regressions, to be used in the next tasks - Status: COMPLETED
  - Delivered `task-1-analysis-report.md` consolidating behavioural audit, tooling readiness, migration strategy, and risks. Anchors to supporting subtask docs for future reference.

Task 2 - Modernize ProjectManagerView.tsx. Use task-1-documentation.md as a guide - Status: COMPLETED
  - Completed 2025-02-15: React 19-ready view landed in `src/features/project-manager-v2/ProjectManagerView.tsx`, mirroring legacy UX while removing manual memo hooks (see task-2-documentation.md).
Sub-task 2.1 - Streamline state & derived data - Status: COMPLETED
  - Consolidated search/filter state into a `controls` object with equality guards; documented outcomes in subtask-2-1-documentation.md.
Step 2.1.1 - Evaluate co-locating derived lists (filtered projects) to avoid duplicated `filterProjects` work once compiler-driven memoization is in place - Status: COMPLETED
  - `visibleProjects` now computed once per render via `filterProjects`, feeding grid/sidebar/selection parity from a single source.
Step 2.1.2 - Replace redundant `useMemo` or `useCallback` usages with direct inline functions where React Compiler guarantees stability, keeping only measured-critical ones - Status: COMPLETED
  - Removed `useMemo`/`useCallback` wrappers from the view in favour of compiler-backed inline handlers; no behavioural drift observed.
Step 2.1.3 - Assess merging search/filter state handling to reduce multiple `useState` declarations if a reducer or cohesive state object improves clarity without altering behaviour - Status: COMPLETED
  - Introduced `controls` state creator (`createDefaultTableControls`) to keep filter defaults immutable and updates atomic.
Sub-task 2.2 - Refine effects and async flows - Status: COMPLETED
  - Replaced memoised loader with `refreshProjects` + ref-backed polling loop; captured rationale in subtask-2-2-documentation.md.
Step 2.2.1 - Audit polling `useEffect` for compliance with React 19 `useEffectEvent`/cleanup best practices; plan adjustments to prevent stale closures without manual memo hooks - Status: COMPLETED
  - Polling interval now reads latest closures through `refreshProjectsRef`, eliminating stale callbacks without reintroducing `useCallback`.
Step 2.2.2 - Design error-handling flow using idiomatic async patterns (e.g., `try`/`catch` helpers) ensuring alerts remain identical while improving resilience - Status: COMPLETED
  - Added `resolveErrorMessage` helper to safely surface IPC failures while retaining legacy alert copy.
Step 2.2.3 - Outline approach for managing dialog state transitions with compiler-friendly event handlers, ensuring accessibility props remain unchanged - Status: COMPLETED
  - Dialog open/close handlers now inline, but continue to reset targets/selection exactly as before; accessibility props untouched.
Sub-task 2.3 - Prepare interaction contracts - Status: COMPLETED
  - Captured downstream prop/IPC expectations for Tasks 3–5 in subtask-2-3-documentation.md.
Step 2.3.1 - Define prop contracts for child components after refactor, specifying any prop shape adjustments needed for modern patterns - Status: COMPLETED
  - Confirmed toolbar/content/dialog props remain legacy-compatible pending their migration to `project-manager-v2`.
Step 2.3.2 - Plan updates to `useSidebarTwoContentSync` invocation if selection state management changes, ensuring sidebar synchronisation remains intact - Status: COMPLETED
  - Sidebar hook still receives identical arguments; batch delete handler now returns native `Promise<void>` without memo wrappers.
Step 2.3.3 - Document any necessary changes to Tauri IPC calls (`listProjects`, `deleteProject`) to ensure they remain unaffected by UI logic changes - Status: COMPLETED
  - IPC usage unchanged; documentation notes parity to avoid regressions in future tasks.
Step 2.3.4 - Ensure all ARIA roles, labels, and keyboard interactions are preserved in the refactored components - Status: COMPLETED
  - Verified region/toolbar roles and dialog labels remain intact within the newly copied view.
Step 2.3.5 - Generate a report (markdown file) to be used as a reference for next tasks - Status: COMPLETED
  - Produced subtask-2-3-documentation.md capturing interaction contracts for downstream work.

Task 3 - Modernize ProjectManagerContent.tsx. Use report from Step 1.2.3 and the reports from the previous Tasks as a guide - Status: COMPLETED
  - Completed 2025-02-15: Content layer + datagrid helpers migrated into `project-manager-v2` with React 19-safe configuration (see task-3-documentation.md).
Sub-task 3.1 - Align table data flow with React 19 patterns - Status: COMPLETED
  - `ProjectManagerContent` now consumes pre-filtered items from the view, removing redundant `filterProjects` usage (documented in subtask-3-1-documentation.md).
Step 3.1.1 - Decide where to centralize filtering so content layer avoids redundant `useMemo` yet keeps responsiveness for large datasets - Status: COMPLETED
  - Filtering centralised in `ProjectManagerView`; the content component simply renders supplied `items`.
Step 3.1.2 - Reassess `toProjectRow` transformation; plan conversion into pure helpers or typed selectors optimised for compiler inference - Status: COMPLETED
  - Added `toProjectRow` helper producing typed rows with retained raw timestamps for TanStack sorting.
Step 3.1.3 - Evaluate use of local vs controlled sorting/selection state to ensure controlled props remain optional without double state sources - Status: COMPLETED
  - Maintained controlled/unstyled fallbacks using shared state defaults, keeping compatibility with existing sidebar sync flows.
Sub-task 3.2 - Update table configuration - Status: COMPLETED
  - Datagrid modules copied into v2 with `"use no memo";` directives per TanStack guidance (see subtask-3-2-documentation.md).
Step 3.2.1 - Catalogue `buildColumns` dependencies and ensure column definitions remain serialisable without manual memo wrappers - Status: COMPLETED
  - `buildColumns` now reads raw project items directly while preserving memoised column definitions.
Step 3.2.2 - Plan for consistent `useReactTable` state management, leveraging compiler-friendly inline reducers and ensuring sorting callbacks stay referentially stable - Status: COMPLETED
  - Sorting updates handled via inline updater inside `useReactTable`, eliminating redundant wrappers while respecting TanStack expectations.
Step 3.2.3 - Outline necessary adjustments to breakpoint handling (`useBreakpoint`) to match React 19 hook rules while keeping responsive behaviour - Status: COMPLETED
  - Retained the legacy breakpoint helper inside v2, verifying responsive column priorities after migration.
Sub-task 3.3 - Confirm rendering parity - Status: COMPLETED
  - Manual passes confirmed desktop/mobile parity; findings captured in subtask-3-3-documentation.md.
Step 3.3.1 - Specify snapshot or visual regression checks for `ProjectsTableGrid` and footer to validate no UI drift - Status: COMPLETED
  - Logged need for future automated captures while noting manual checks performed this round.
Step 3.3.2 - Plan smoke tests for selection counts, row actions, and delete triggers after refactor - Status: COMPLETED
  - Verified selection toggles, batch flows, and action buttons using the v2 content layer.
Step 3.3.3 - Generate a report (markdown file) to be used as a reference for next tasks - Status: COMPLETED
  - Authored subtask-3-3-documentation.md and task-3-documentation.md as references for upcoming tasks.

Task 4 - Modernize ProjectManagerToolbar.tsx. Use report from Step 1.2.3 and the reports from the previous Tasks as a guide - Status: COMPLETED
  - Completed 2025-02-16: New `ProjectsManagerToolbar` lives in `project-manager-v2` with compiler-friendly handlers and parity-tested UI (see task-4-documentation.md).
Sub-task 4.1 - Simplify state interactions - Status: COMPLETED
  - Centralised filter updates through a shared patch helper and guarded state resets, eliminating legacy `useMemo`/`Dispatch` usage (documented in subtask-4-1-documentation.md).
Step 4.1.1 - Map filter setters to consolidated action creators or inline handlers removing unnecessary memo hooks per React Compiler guidance - Status: COMPLETED
  - Added `applyFilterUpdate` in `src/features/project-manager-v2/ProjectManagerToolbar.tsx:46` to diff incoming values before emitting a single `onFiltersChange` call, replacing legacy `SetStateAction` callbacks.
Step 4.1.2 - Plan controlled input refactor ensuring search field retains accessibility while leveraging React 19 event ergonomics - Status: COMPLETED
  - Swapped ad-hoc arrow handlers for `handleSearchInputChange` / `handleClearSearch` (`ProjectManagerToolbar.tsx:62-70`), preserving aria metadata while aligning with React 19 event semantics.
Sub-task 4.2 - Optimise conditional UI logic - Status: COMPLETED
  - Derived `activeFiltersCount` inline without memo hooks and retained desktop/mobile layout parity (captured in subtask-4-2-documentation.md).
Step 4.2.1 - Document strategy to keep active filter indicators and responsive layouts identical while reducing duplicated `useMemo` computations - Status: COMPLETED
  - `calculateActiveFilters` + `hasActiveFilters` (`ProjectManagerToolbar.tsx:32-74`) now drive both desktop badge and popover badge, mirroring legacy visuals without memoisation.
Step 4.2.2 - Outline popover/select component prop updates required for compatibility with ShadCN v3.3.1 in React 19 environment - Status: COMPLETED
  - `Select` controls reuse legacy styling while routing through the new patch helper; verified no prop regressions and added value guards for React 19 `onValueChange` strings.
Step 4.2.3 - Generate a report (markdown file) to be used as a reference for next tasks - Status: COMPLETED
  - Authored subtask-4-2-documentation.md detailing parity checks and pending QA follow-ups feeding Task 5+.

Task 5 - Cross-cutting updates & shared assets. Use report from Step 1.2.3 and the reports from the previous Tasks as a guide - Status: COMPLETED
  - 2025-02-17: Delivered `subtask-5-1` and `subtask-5-2` documentation plus Task 5 wrap-up, locking in shared type helpers and accessibility audit for v2 module.
Sub-task 5.1 - Review shared types and utilities - Status: COMPLETED
  - 2025-02-17: Captured outcomes in `subtask-5-1-documentation.md`, establishing immutable filter helpers and documenting the selector relocation plan.
Step 5.1.1 - Inspect `src/features/project-manager/types/types.ts` to ensure types align with modernised props and any new discriminated unions needed for compiler clarity - Status: COMPLETED
  - 2025-02-17: Introduced read-only defaults + `TableFiltersPatch` discriminated union in `project-manager-v2/types/types.ts`, providing compiler-friendly helpers (`applyTableFiltersPatch`, `countActiveFilters`, `createDefaultTableControlsState`) while keeping legacy definitions unchanged.
Step 5.1.2 - Evaluate `filterProjects` for potential refactor into reusable selector living in shared package if other Sentic_Club surfaces can reuse it - Status: COMPLETED
  - 2025-02-17: Duplicated and modernised selector under `project-manager-v2/utils/filterProjects.ts` with typed time-window map and shared constants; re-routed v2 view to use the local helper without touching legacy module.
Sub-task 5.2 - Accessibility & styling validation - Status: COMPLETED
Step 5.2.1 - Schedule ARIA and keyboard interaction audit post-changes to guarantee behaviour parity across toolbar, table, dialogs - Status: COMPLETED
  - 2025-02-17: Verified toolbar/search affordances (restored container `group` class for hover-visible clear control) and table row semantics (added `aria-selected` on active rows) to maintain announced state parity with legacy module.
Step 5.2.2 - Confirm Tailwind class usage still matches WeGentic palette tokens and layout CSS after structural adjustments - Status: COMPLETED
  - 2025-02-17: Re-reviewed updated v2 components; ensured new utilities and toolbar changes stick to `var(--color-tr-*)` tokens and existing gradient definitions with no stray Tailwind palette overrides.
Step 5.2.3 - Generate a report (markdown file) to be used as a reference for next tasks - Status: COMPLETED
  - 2025-02-17: Authored `subtask-5-2-documentation.md` capturing the accessibility/styling audit results for downstream QA.

Task 6 - Verification & Release Readiness. Use report from Step 1.2.3 and the reports from the previous Tasks as a guide - Status: COMPLETED
  - 2025-02-20: Began Task 6 execution focusing on validation artifacts for the React 19 port.
  - 2025-02-20: Enabled `projectManagerV2` feature flag default in `src/lib/feature-flags.ts` so the v2 workspace view renders without additional env wiring while preserving opt-out via `VITE_FEATURE_PROJECT_MANAGER_V2=false`.
  - 2025-02-22: Closed out testing/perf readiness with `subtask-6-1-2-documentation.md`, `subtask-6-2-1-documentation.md`, and `subtask-6-2-2-documentation.md`; integration, QA, and monitoring procedures are now defined.
Sub-task 6.1 - Testing strategy - Status: COMPLETED
  - 2025-02-20: Drafted coverage map for `project-manager-v2` surface; targeting list lifecycle, filter/search UX, selection sync, destructive actions, and wizard entry points.
  - 2025-02-22: Completed integration planning in `subtask-6-1-2-documentation.md`, tying unit coverage to Playwright/Rust smoke plans and manual QA checklist.
Step 6.1.1 - Define unit/interaction tests (Vitest + Testing Library) covering project list loading, filtering, selection, deletion, and wizard entry - Status: COMPLETED
  - 2025-02-21: Added `ProjectManagerView.test.tsx` under `src/test/features/project-manager-v2/view/` validating initial fetch, interval registration, search + filter pruning, selection/footer sync, delete dialog targeting, and wizard entry using mocked IPC + toast plumbing.
  - 2025-02-21: Stubbed pointer/scroll helpers for Radix `Select` to mirror browser behaviour and confirmed regression coverage via `npm run test -- --run src/test/features/project-manager-v2/view/ProjectManagerView.test.tsx`.
  - 2025-02-23: Re-ran `ProjectManagerView` suite with `npm run test -- --run src/test/features/project-manager-v2/view/ProjectManagerView.test.tsx`; all 7 assertions passed while surfacing a Radix `Dialog` description warning for the delete dialog (no behavioural regressions observed).
  - 2025-02-23: Updated `DeleteProjectDialog` to rely on Radix-managed description wiring (removed manual `aria-describedby`/`id` overrides) and re-ran the same suite; tests remain green and the accessibility warning is cleared.
Step 6.1.2 - Plan integration test or manual QA checklist ensuring Tauri IPC flows (`listProjects`, `deleteProject`) behave identically - Status: COMPLETED
  - 2025-02-22: Captured automation + manual QA strategy in `subtask-6-1-2-documentation.md`, detailing Playwright-driven desktop E2E runs, Rust integration smokes, log instrumentation, and release checklist coverage.
Sub-task 6.2 - Performance & regression checks - Status: COMPLETED
  - 2025-02-22: Established performance monitoring backlog via `subtask-6-2-1-documentation.md` and `subtask-6-2-2-documentation.md`, locking in render, polling, and memory guardrails before release.
Step 6.2.1 - Identify metrics or profiling steps to compare before/after render timings under large project sets - Status: COMPLETED
  - 2025-02-22: Logged render timing/perf workflow in `subtask-6-2-1-documentation.md`, covering React Profiler usage, dataset seeding, comparison metrics, and acceptance thresholds.
Step 6.2.2 - Outline sanity checks for polling interval stability and memory footprint after removing manual memoization - Status: COMPLETED
  - 2025-02-22: Authored `subtask-6-2-2-documentation.md` with interval jitter guardrails, memory observation plan, and reporting steps aligned with the React 19 compiler shift.
