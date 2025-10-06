# Plan – Project Manager React 19 Refactor (v2 Migration)

Task 1 - Define Migration Strategy & Directory Layout - Status: COMPLETED
Sub-task 1.1 - Confirm new project-manager-v2 module boundaries and file mapping - Status: COMPLETED
Step 1.1.1 - List all legacy files under src/features/project-manager/ to classify as refactor vs. copy-only, documenting rationale for each decision - Status: COMPLETED
Step 1.1.2 - Specify target paths inside /Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/features/project-manager-v2, ensuring legacy files remain unchanged. Create a document that will be referenced during the migration - Status: COMPLETED
Step 1.1.3 - Produce migration matrix outlining dependencies (shared components, hooks, utils) and note which will be reused or duplicated - Status: COMPLETED

## Step 1.1.3 Migration Matrix (2025-02-14)
| Dependency | Legacy touchpoints | v2 plan | Disposition |
| --- | --- | --- | --- |
| `@/ipc:listProjects` | Polled inside `ProjectManagerView.tsx` with manual intervals | Wrap in `data/useProjectsResource.ts` using Suspense and Tauri event invalidation | Refactor into resource |
| `@/ipc:deleteProject` | Invoked for single and batch deletes (`ProjectManagerView`, `ProjectsBatchActionsPanel`) | Expose `actions/deleteProjectAction.ts` with optimistic cache updates and shared toasts | Refactor into shared action |
| `@/ipc:createProject` | Called via `useProjectWizard` during wizard submit | Add `actions/createProjectAction.ts` consumed by wizard and future quick-create entry points | Refactor into shared action |
| `@/app/layout/layout-context` | `useSidebarTwoContentSync` mutates `sidebarTwo` panel directly | Create `sidebar/SidebarController.tsx` adapter that reads v2 selectors before updating layout store | Reuse through adapter |
| `@tanstack/react-table` | Table instance configured inside `ProjectManagerContent` and `components/datagrid/*` | Move column config to `table/columns.ts` and `tableConfig.ts` with static exports | Reuse (reconfigured) |
| `@/components/projects/table/ProjectsTableSkeleton` | Legacy loading fallback shown during polling | Duplicate into `shell/boundaries/ProjectsSkeleton.tsx` to style for Suspense and keep legacy version untouched | Duplicate for v2 |
| `@/hooks/useMediaQuery` (`useBreakpoint`) | Responsive column logic in `ProjectManagerContent` | Reuse hook within table selectors; extend typings if needed for new breakpoints | Reuse as-is |
| `@/components/ui/use-toast` | Toasts dispatched in view and delete dialog | Centralize inside mutation actions to guarantee uniform UX copy | Refactor into action helpers |
| `@/components/ui/*` (Button, Input, Select, Dialog, Tooltip, Popover, Table, Alert) | All major UI surfaces | Continue importing directly; ensure Tailwind tokens follow WeGentic palette | Reuse as-is |
| `@/components/IconTooltipButton` | Action column shortcut buttons | Keep component but configure imports from `table/columns.ts` static map | Reuse |
| `@/lib/datetime::formatDateParts` | Row transformation for created/updated timestamps | Reuse within `data/projectSelectors.ts` to produce derived row data | Reuse |
| `@/lib/file-formats` & `@/lib/validators` | Wizard validation for files and language codes | Reuse within new wizard store without modification | Reuse |
| `lucide-react` icons | Toolbar, buttons, dialogs | Reuse; centralize icon exports for consistency with the compiler | Reuse |
| `react-icons/tb` icons | Overview card metrics | Maintain for now; revisit during sidebar refactor to possibly swap to lucide equivalents | Reuse (review later) |
| `src/features/project-manager/utils/filterProjects.ts` | Filtering helper shared by view/content | Copy into `project-manager-v2/utils/filterProjects.ts` and expose via selectors | Duplicate (copy-only) |
| `src/features/main-view.css` | Global styles pulled into legacy view | Replace per-need with localized files under `project-manager-v2/styles/` to avoid cross-module bleed | Duplicate essentials only |

## Step 1.1.2 Directory Layout Summary (2025-02-14)
- Documented new structure in `docs/ProjectManagerV2_DirectoryLayout.md`.
- Established `project-manager-v2` tree with shell, content, data, state, actions, table, sidebar, wizard, utils, types, and styles folders.
- Anchor entrypoints set to `index.ts` and `ProjectManagerRoute.tsx` so routing can toggle between legacy and v2 without edits to the old module.
- Copy-only assets (CSS, filters helper) relocate under `styles/` and `utils/` to avoid touching the legacy tree.
- Mapping table in the doc assigns every legacy file to its v2 target path, guiding future refactor vs. copy work.

## Step 1.1.1 Classification Record (2025-02-14)

| File | Classification | Rationale |
| --- | --- | --- |
| `src/features/project-manager/ProjectManagerView.tsx` | Refactor | Manual polling, local `useState` orchestration, and toast plumbing must be replaced by Suspense resources and centralized actions outlined in Task 2. |
| `src/features/project-manager/ProjectManagerHeader.tsx` | Copy-only | Presentational header that only raises `onCreateProject`; compatible with the v2 shell without behavioural changes. |
| `src/features/project-manager/ProjectManagerContent.tsx` | Refactor | Ties filtering, sorting, and selection to component-local state and `useMemo`; Task 3.2 moves this logic into shared selectors. |
| `src/features/project-manager/ProjectManagerToolbar.tsx` | Refactor | Relies on `Dispatch<SetStateAction>` props and memoized counters that conflict with the unified filter store required by Task 3.3. |
| `src/features/project-manager/hooks/useSidebarTwoContentSync.tsx` | Refactor | Imperatively mutates layout store from raw `Set` state; Step 4.1 mandates selector-driven, Suspense-safe updates. |
| `src/features/project-manager/components/ProjectsBatchActionsPanel.tsx` | Refactor | Manages delete dialog state from `Set` selections; Step 4.1.2 calls for memo-friendly sidebar presenters backed by the new selection store. |
| `src/features/project-manager/components/DeleteProjectDialog.tsx` | Refactor | Performs redundant `listProjects` verification and bespoke toasts; Step 2.2.1 requires a shared `useActionState` mutation pipeline. |
| `src/features/project-manager/components/ProjectManagerFooter.tsx` | Copy-only | Purely renders total and selected counts; v2 can provide the same props without code changes. |
| `src/features/project-manager/components/BatchDeleteConfirmDialog.tsx` | Copy-only | Self-contained confirmation dialog with no dependency on legacy state management. |
| `src/features/project-manager/components/EmptyProjectsState.tsx` | Copy-only | Stateless empty state that only needs `onCreate`; safe to reuse while v2 wiring evolves. |
| `src/features/project-manager/components/ProjectsOverviewCard.tsx` | Refactor | Computes aggregates from raw arrays; Step 4.1.2 shifts this work to memoized selectors feeding a lean presenter. |
| `src/features/project-manager/components/datagrid/presentation.tsx` | Refactor | Exposes presentation mappings built per render; Task 4.2 externalizes column metadata for compiler optimization. |
| `src/features/project-manager/components/datagrid/ProjectsTableGrid.tsx` | Refactor | Reads mutable `Set` selection and recreates callbacks; Task 4.2.2 centralizes selection handling. |
| `src/features/project-manager/components/datagrid/columns.tsx` | Refactor | Builds column definitions inside the render path and mutates shared `Set` state; Step 4.2.* moves these definitions to static modules. |
| `src/features/project-manager/components/wizard/CreateProjectWizard.tsx` | Refactor | Manages wizard state manually; Step 2.2.2 migrates the flow to action-state primitives with suspense-aware modals. |
| `src/features/project-manager/components/wizard/steps/ProjectDetailsStep.tsx` | Refactor | Depends on direct form mutation and inline validations; new wizard store will provide derived state and error selectors. |
| `src/features/project-manager/components/wizard/steps/ProjectFilesStep.tsx` | Refactor | Handles file lists through props; upcoming action pipeline will centralize file state and event handling. |
| `src/features/project-manager/components/wizard/steps/ProjectReviewStep.tsx` | Refactor | Displays raw form fields; Step 2.2.2 introduces derived summaries sourced from the shared wizard store. |
| `src/features/project-manager/components/wizard/types.ts` | Refactor | Encodes wizard state with ad-hoc enums; needs to expand for action-state statuses and exported defaults per Task 3.1.3. |
| `src/features/project-manager/components/wizard/state/useProjectWizard.ts` | Refactor | Implements bespoke mutation handling; will be rewritten to share optimistic updates and toast contracts per Task 2.2. |
| `src/features/project-manager/components/wizard/utils/file-descriptor.ts` | Copy-only | Pure data helper converting paths; unaffected by architectural changes. |
| `src/features/project-manager/components/wizard/utils/languages.ts` | Copy-only | Static locale catalogue and formatter reusable as-is in v2. |
| `src/features/project-manager/components/wizard/utils/validation.ts` | Copy-only | Pure validation utilities already aligned with new flow requirements. |
| `src/features/project-manager/utils/filterProjects.ts` | Copy-only | Stateless filtering helper the new selectors can reuse without modification. |
| `src/features/project-manager/css/new-project-button.css` | Copy-only | Styling token file tied to WeGentic palette; remains valid for the v2 header button. |
| `src/features/project-manager/css/data-table.css` | Copy-only | Table surface styling still applicable after refactoring logic. |
| `src/features/project-manager/css/dropdowns.css` | Copy-only | Dropdown embellishments referencing existing CSS variables; no logic dependencies. |
| `src/features/project-manager/types/types.ts` | Refactor | Defines props based on local `Set` state; new architecture introduces normalized resource/selection types and exported defaults. |

Sub-task 1.2 - Preserve legacy implementation alongside v2 - Status: COMPLETED
Step 1.2.1 - Establish build import paths or feature flagging to keep legacy ProjectManager operational during v2 development - Status: COMPLETED
Step 1.2.2 - Plan copy process for files requiring no refactor (1:1 duplication without edits) into project-manager-v2 while keeping originals intact - Status: COMPLETED
Step 1.2.3 - Document rollback strategy in case v2 integration needs to be reversed - Status: COMPLETED

## Step 1.2.1 Feature Flag Integration (2025-02-15)
- Added `src/lib/feature-flags.ts` to surface compile-time flags sourced from `VITE_FEATURE_PROJECT_MANAGER_V2`, enabling deterministic toggles during build-time and tests.
- Created `src/features/project-manager-v2/ProjectManagerRoute.tsx` placeholder and `index.ts` re-export so TanStack route loaders can target the v2 entrypoint without breaking the build while migration continues.
- Updated `src/features/workspace/WorkspacePage.tsx` to branch on the new flag, defaulting to the legacy view and reserving the Suspense-friendly v2 route for when the flag is flipped.

## Step 1.2.2 Copy-Only Migration Plan (2025-02-15)
- Documented a copy workflow in `docs/ProjectManagerV2_DirectoryLayout.md` outlining deterministic duplication steps (pre-creating folders, checksum-verified copy commands, CSS isolation guidance).
- Listed the full copy-only checklist to ensure each asset migrates into a namespaced location under `project-manager-v2` with imports adjusted away from the legacy tree.
- Captured guardrails for post-copy validation (Storybook smoke checks, no back-propagation to legacy) to prevent cross-module drift during the parallel build.

## Step 1.2.3 Rollback Strategy Documentation (2025-02-15)
- Authored `docs/Subtask1_2_Rollback_Strategy_documentation.md` capturing dual-layer rollback procedures: feature-flag kill switch and Tauri updater-driven binary rollback.
- Defined data protection steps (dual-write artefacts, reversible migrations) to keep legacy compatibility intact during toggles.
- Added verification checklist covering flag toggling, CSS isolation, updater downgrade rehearsal, and migration reversibility.

Task 2 - Modernize Data Lifecycle with React 19 Patterns - Status: COMPLETED (2025-10-06)
Sub-task 2.1 - Rework project listing data access - Status: COMPLETED
Step 2.1.1 - Design a `useProjectsResource` hook leveraging Suspense/`use` or TanStack Query with suspense to replace manual polling and loading flags - Status: COMPLETED
Step 2.1.2 - Introduce resource-aware error boundaries and skeleton fallbacks colocated with v2 ProjectManagerContent - Status: COMPLETED
Step 2.1.3 - Evaluate event-driven refresh (Tauri events) vs. interval polling and implement compiler-safe effect logic with proper cancellation - Status: COMPLETED

## Step 2.1.1 Suspense Resource Implementation (2025-10-05)
- Added `src/features/project-manager-v2/data/projectsResource.ts` to manage cached project listings with Suspense-friendly status tracking (`idle`/`pending`/`refreshing`/`resolved`/`rejected`).
- Implemented background-safe invalidation helpers (`refreshProjectsResource`, `invalidateProjectsResource`, `mutateProjectsResource`) and listener fan-out for future sidebar/table consumers.
- Created `src/features/project-manager-v2/data/useProjectsResource.ts` to expose a compiler-ready hook returning projects data, refresh controls, and metadata (`isRefreshing`, `lastUpdatedAt`, `lastError`) while suspending on initial load via React 19 `use`.
- Exported a data index barrel so upcoming v2 modules can consume the resource without touching legacy project manager files.

## Step 2.1.2 Suspense Boundaries & Fallbacks (2025-10-05)
- Created `src/features/project-manager-v2/shell/boundaries/ProjectsBoundary.tsx` to wrap v2 content with `AppErrorBoundary` + Suspense, keyed by query arguments for safe retries.
- Added `ProjectsSkeleton` loading surface tailored to the future v2 layout (header metrics + table placeholder) to act as the Suspense fallback.
- Implemented `ProjectsError` fallback with retry logic that invalidates and revalidates the projects resource before resetting the boundary.
- Wired `ProjectManagerRoute` to the new boundary so future shell/content components inherit the error handling and loading UX out of the box.

## Step 2.1.3 Event-Driven Refresh Strategy (2025-10-05)
- Introduced `projects://updated` IPC events in Rust (`src-tauri/src/ipc/events.rs`) with structured payloads emitted from create/delete/file mutation commands.
- Added typed listeners in the frontend IPC layer (`src/ipc/events.ts`, `src/ipc/types.ts`) so React modules can subscribe without duplicating event names.
- Enhanced `projectsResource.ts` with a reference-counted event bridge that refreshes cached queries when backend notifications arrive, including StrictMode-safe teardown.
- Updated `useProjectsResource` to retain/release the event listener via `useEffect`, ensuring Suspense consumers stay synchronized without resuming interval polling.

## Step 2.2.1 Mutation Actions (2025-10-05)
- Added `useDeleteProjectAction` and `useBatchDeleteProjectsAction` under `src/features/project-manager-v2/actions/`, centralizing optimistic deletion flows on top of the Suspense resource cache.
- Unified toast messaging and success/failure handling through the new hooks while exposing both imperative and form-compatible payload interfaces.
- Implemented safe rollback logic using `mutateProjectsResource` so failed or partial batch deletions restore the previous cache before showing destructive toasts.
- Triggered post-mutation refreshes (`refreshProjectsResource`) and success callbacks, preparing the toolbar/sidebar consumers planned for later tasks.

## Step 2.2.2 Wizard Submission Actions (2025-10-05)
- Introduced `useCreateProjectAction` to power the v2 wizard with `useActionState`, optimistic cache insertion, and consistent toast feedback.
- Copied legacy validation/language utilities into `project-manager-v2/wizard` with a new `useProjectWizard` hook that coordinates step transitions, validation, and action dispatching.
- Ensured optimistic rows are replaced with real project metadata once the backend responds, while failures roll back the cache before surfacing errors.
- Exposed typed payloads so future quick-create entry points can reuse the same action helper without duplicating request shaping or toast copy.

## Step 2.2.3 Sidebar & Toolbar Integration (2025-02-19)
- Built the first-pass v2 shell (`ProjectManagerShell`) together with header, toolbar, and sidebar panels so both single and batch flows share the mutation hooks completed in Step 2.2.1.
- Updated `ProjectsBatchActionsPanel` to a presentational surface that receives `onBatchDelete`/`isDeleting`, letting the shell orchestrate selection cleanup and preventing stale IDs after successful deletes.
- Added `ProjectManagerToolbar` with search + batch delete controls that call the same `useBatchDeleteProjectsAction` instance while offering a manual clear action.
- Introduced `DeleteProjectDialog` backed by `useDeleteProjectAction`, aligning singular deletes with optimistic cache rollback and toast copy.

Sub-task 2.2 - Adopt async actions for mutations - Status: COMPLETED
Step 2.2.1 - Wrap single and batch delete commands in `useActionState` with optimistic UI updates and unified toast handling - Status: COMPLETED
Step 2.2.2 - Move create-project wizard flow to action-state pattern, ensuring modal state responds to pending/error outcomes - Status: COMPLETED
Step 2.2.3 - Harmonize sidebar batch actions with new mutation hooks to avoid stale selections - Status: COMPLETED

Task 3 - Restructure Components for React Compiler Compliance - Status: COMPLETED (2025-10-06)
Sub-task 3.1 - Refactor ProjectManagerView into composable v2 shell - Status: COMPLETED
Step 3.1.1 - Split data loader, header/toolbar shell, and content presenter components to minimize prop churn - Status: COMPLETED
Step 3.1.2 - Remove redundant `useMemo`/`useCallback` by relocating helpers outside component scope or using pure utilities - Status: COMPLETED
Step 3.1.3 - Export static configuration (sorting defaults, filter presets) at module level for compiler analysis - Status: COMPLETED

## Step 3.1.1 Shell Decomposition (2025-02-20)
- Wrapped the v2 shell with `ProjectManagerStoreProvider`, shifting all selection/search coordination into scoped Zustand selectors and reducing prop churn across header, toolbar, and content.
- Pulled batch deletion orchestration into `ProjectManagerShellBody`, wiring toolbar and sidebar actions through shared handlers that respect the new store contracts.

## Step 3.1.2 Compiler-Friendly Hooks (2025-02-20)
- Removed legacy `useMemo` dependencies inside the shell by delegating filtering and selection math to exported selector helpers, ensuring React Compiler can analyze the static functions.
- Replaced prop-based callbacks with store-aware closures so React 19 optimizes event handlers without manual memoization.

## Step 3.1.3 Shared Defaults (2025-02-21)
- Added `config/defaults.ts` and `data/projectFilters.ts` to expose canonical search, sorting, and filter presets for the project manager module.
- Extended the Zustand store snapshot to track `filters` and `sorting`, normalizing incoming overrides while keeping selection/search unchanged.
- Provided helper creators so downstream surfaces (toolbar, sidebar, table) can request cloned defaults without duplicating literal values.

Sub-task 3.2 - Update ProjectManagerContent rendering pipeline - Status: COMPLETED
Step 3.2.1 - Normalize selection/filter/sorting state via reducer or dedicated store shared with toolbar and sidebar sync - Status: COMPLETED
Step 3.2.2 - Convert table row mapping and formatting into pure selectors to leverage compiler memoization automatically - Status: COMPLETED
Step 3.2.3 - Ensure TanStack table callbacks meet accessibility and compiler-friendly constraints (no inline recreations) - Status: COMPLETED

## Step 3.2.1 Centralized View State (2025-02-20)
- Added `state/projectManagerStore.tsx` to expose a scoped Zustand store plus provider/hooks so the shell, toolbar, and sidebar can subscribe to shared selection/search state without prop drilling.
- Captured reusable filtering helpers in `data/projectSelectors.ts`, enabling compiler-friendly derived data (tokenized search, selection summaries) for downstream table and sidebar components.

## Step 3.2.2 Selector-Driven Content (2025-02-20)
- Updated `ProjectManagerContent` to source filtered rows from `filterProjectsBySearch` and rely on store-driven selection toggles, ensuring render math lives in pure utilities ready for the compiler.
- Extended toolbar/sidebar consumers to accept `SelectionSummary`, preparing richer metrics without recomputing inside React memo hooks.

## Step 3.2.3 Controlled TanStack Table (2025-02-21)
- Introduced `table/columns.tsx` and `table/useProjectsTable.ts` to export static column definitions plus a controlled `useReactTable` hook driven by the project manager store.
- Replaced manual table markup in `ProjectManagerContent` with TanStack rendering, mapping header/cell classes through column meta to preserve layout while avoiding inline handler churn.
- Synced TanStack `rowSelection` with the shared store so panel, toolbar, and header selection remain controlled without local `Set` mutations.

Sub-task 3.3 - Modernize ProjectsManagerToolbar interactions - Status: COMPLETED
Step 3.3.1 - Replace `useMemo` badges with direct expressions or selectors powered by centralized state - Status: COMPLETED
Step 3.3.2 - Align search and mobile popover controls with the unified state model to eliminate prop drilling - Status: COMPLETED
Step 3.3.3 - Audit ARIA roles/labels against latest ShadCN & React 19 guidelines, updating as needed - Status: COMPLETED

## Step 3.3 Toolbar Modernization (2025-02-22)
- Rebuilt the v2 toolbar to source search, filters, and selection actions directly from the project manager store, exposing a `Filters` trigger with live badge counts while eliminating derivative `useMemo` badges.
- Added selector-driven filtering to `ProjectManagerContent`, combining preset + search pipelines and wiring responsive filter controls that reuse the same store actions across desktop and mobile popovers.
- Updated the toolbar layout to honor accessibility guidance (`role="toolbar"`, `aria-live` summaries, tooltip labelling) and introduced a dedicated clear-search control with React 19-friendly deferred input buffering.
- Extended integration tests to cover the new filter flow and badge counts, adapting existing assertions to the refined selection copy to prevent regressions.

Task 4 - Synchronize Supporting Hooks and Shared Components - Status: COMPLETED (2025-10-06)
Sub-task 4.1 - Refactor `useSidebarTwoContentSync` for v2 - Status: COMPLETED
Step 4.1.1 - Adapt hook to consume new selectors/stores instead of raw Sets, using compiler-safe effect dependencies - Status: COMPLETED
Step 4.1.2 - Extract sidebar content presenters (batch actions, overview card) into lightweight memo-friendly components within project-manager-v2 - Status: COMPLETED
Step 4.1.3 - Implement cleanup/visibility logic compatible with Suspense-driven rendering - Status: COMPLETED

Sub-task 4.2 - Align datagrid utilities with v2 architecture - Status: COMPLETED
Step 4.2.1 - Externalize column definitions and handlers to avoid per-render allocation, relying on compiler optimization - Status: COMPLETED
Step 4.2.2 - Integrate selection logic with centralized store, removing inline Set mutations - Status: COMPLETED
Step 4.2.3 - Validate presentation layer (badges, icons) adheres to design tokens and theming in v2 - Status: COMPLETED

## Step 4.1 Sidebar Synchronization Update (2025-02-22)
- Extended `useSidebarContentSync` to surface project launch affordances alongside batch deletion, wiring calls through the v2 store while preserving Suspense cleanup via the sidebar controller.
- Rebuilt `ProjectsBatchActionsPanel` with palette-compliant tokens, focus-visible ring support, and click targets that bubble `ProjectListItem` payloads to the shell for direct navigation.
- Aligned `ProjectManagerShell` to memoize `handleOpenProject`, ensuring toolbar/table/sidebar consumers share a stable callback and keeping layout state resets predictable during resource retries.

## Step 4.2.3 Presentation Layer Alignment (2025-02-22)
- Applied WeGentic theme variables across table headers, cells, and row states, adding explicit selection/hover contracts that respect the React 19 renderer.
- Tuned sidebar metrics surfaces to unify typography contrast and border treatments with the v2 palette, eliminating mixed Tailwind defaults.
- Captured coverage in `ProjectManagerShell.test.tsx` for the sidebar open-project path while revalidating existing multi-select, error-boundary, and Suspense scenarios.

## Step 4.2.1 Column Architecture (2025-02-21)
- Added the `table` module with reusable column meta aimed at ShadCN table primitives, ensuring header/body cells share alignment and width contracts without recomputation.
- Routed row and header selection through TanStack callbacks exported from the table module, eliminating inline checkbox handlers while retaining accessible labelling.
- Centralized action handlers in table meta so row buttons surface delete/open behaviour without reconstructing closures inside the render loop.

## Step 4.2.2 Shared Selection Infrastructure (2025-02-20)
- Established the project manager store as the single source of truth for selected project IDs, paving the way for table row components and sidebar presenters to consume selection updates without local Set mutations.
- Migrated `ProjectsBatchActionsPanel` to consume selection summaries instead of ad-hoc arrays, consolidating batch metrics for future toolbar/sidebar instrumentation.

Task 5 - Quality Assurance & Documentation - Status: COMPLETED (2025-10-06)
Sub-task 5.1 - Expand automated test coverage - Status: COMPLETED
Step 5.1.1 - Add React Testing Library suites for Suspense fallbacks, filter interactions, and sidebar updates in v2 - Status: COMPLETED
## Step 5.1.2 Mutation Action Tests (2025-02-19)
- Added `mutationActions.test.tsx` covering optimistic create/delete/batch flows using hoisted Vitest mocks for `@/ipc` and the Suspense resource helpers.
- Simulated success, failure, and partial failure paths to assert rollback behaviour and toast dispatch, preventing regressions in cache mutation logic.
- Leveraged `startTransition` and `act` synchronization to mirror production usage of `useActionState` hooks under React 19.
Step 5.1.2 - Mock Tauri IPC within tests to validate new hooks across success/failure cases - Status: COMPLETED
Step 5.1.3 - Plan end-to-end scenarios ensuring create/delete operations succeed post-migration - Status: COMPLETED (2025-02-23)
Step 5.1.4 - Extend project-manager-v2 integration tests to multi-select and error-boundary states - Status: COMPLETED

## Step 5.1.1 Suspense & Sidebar UI Tests (2025-02-20)
- Introduced `ProjectManagerShell.test.tsx` verifying that `ProjectsBoundary` surfaces the skeleton fallback during Suspense and that selection state flows through the shared store into the toolbar and batch panel.
- Asserted sidebar metrics (`5 files · 1 Active`) and batch-delete wiring using mocked actions, giving confidence that optimistic updates clear selection without race conditions.

## Step 5.1.3 End-to-End Scenario Blueprint (2025-02-23)
- Authored `docs/Subtask5_1_EndToEndPlan_documentation.md` describing Playwright-driven coverage for the project creation wizard, single/batch deletion, and feature-flag toggles across both v1/v2 shells.
- Defined six high-priority scenarios (PM-E2E-01 → PM-E2E-06) including failure-handling cases, deterministic fixtures, and CI gating strategy to ensure optimistic cache updates remain stable under real IPC.
- Outlined environment requirements (temp SQLite base dir, log capture, page objects) alongside next steps to surface the plan in QA automation and release pipelines.

## Step 5.1.4 Multi-Select & Error Fallback Coverage (2025-02-21)
- Expanded `ProjectManagerShell.test.tsx` to cover multi-row selection, header toggles, and sidebar metrics powered by the shared TanStack-controlled store.
- Added error-boundary regression coverage to confirm `ProjectsError` renders actionable retry messaging and dispatches resource invalidation before resetting the boundary.
- Stubbed projects resource helpers (`refreshProjectsResource`, `invalidateProjectsResource`) to assert retry flows without invoking real IPC, improving determinism in Vitest runs.

## Step 5.2.1 Contributor Notes (2025-02-23)
- Added `docs/Subtask5_2_ContributorNotes_documentation.md` capturing React 19 conventions (Suspense resources, `useActionState` mutations, compiler requirements) and reiterating the v2 directory taxonomy so new contributors avoid touching the legacy module.
- Documented contribution guardrails around provider usage, TanStack table configuration, palette compliance, and required test suites to keep the v2 shell stable.
- Highlighted pending items such as remote feature-flag wiring and wizard helper consolidation to align onboarding expectations.

## Step 5.2.2 Deployment & Toggle Checklist (2025-02-23)
- Authored `docs/Subtask5_2_DeploymentChecklist_documentation.md` outlining pre-flight validation (flag flip, targeted tests), staged rollout steps, and remote-config driven enable/disable procedures.
- Integrated Step 5.1.3 E2E scenarios as release gates and codified communication/observability tasks (settings banner, tauri-plugin-log tracing) for support teams.
- Reinforced binary rollback requirements (tauri updater manifests, reversible migrations) to complement the feature-flag kill switch.

## Step 5.2.3 Performance Benchmarks (2025-02-23)
- Introduced `src/test/benchmarks/projectsTable.benchmark.test.tsx`, gated behind `PROJECT_MANAGER_TABLE_BENCHMARK`, to measure initial render times for legacy vs. v2 tables using 250-row fixtures.
- Logged benchmark results (~438ms legacy vs. ~150ms v2 on M2 Max) in `docs/Projects_Table_Performance.md`, showing a ~2.9× improvement from the Suspense-first architecture.
- Noted the innocuous TanStack `updated` column warning observed under jsdom and queued a follow-up to silence/resolve it when bringing the benchmark into CI.

Sub-task 5.2 - Document migration and rollout safeguards - Status: COMPLETED (2025-02-23)
Step 5.2.1 - Produce contributor notes summarizing React 19 decisions and directory strategy (legacy vs. v2) - Status: COMPLETED (2025-02-23)
Step 5.2.2 - Define deployment checklist including toggle between legacy and v2 implementations for safe rollout - Status: COMPLETED (2025-02-23)
Step 5.2.3 - Capture performance benchmarks comparing legacy and v2 table rendering - Status: COMPLETED (2025-02-23)

## Final Verification Audit (2025-10-06)
- Audited `useProjectsResource`, action hooks, and Suspense boundaries to confirm Task 2 deliverables align with optimistic mutation best practices reviewed on 2025-10-06.
- Exercised `ProjectManagerShell`, table, and sidebar modules to ensure React Compiler-friendly structures (Task 3) and shared selection wiring (Task 4) remain intact.
- Reviewed Vitest suites (`ProjectManagerShell.test.tsx`, `mutationActions.test.tsx`) and supporting docs to validate Task 5 coverage before marking QA effort complete.
