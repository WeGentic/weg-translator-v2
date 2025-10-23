# Plan: refactor-project-manager-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Refactor the `src/modules/project-manager` module to improve maintainability without regressing existing behaviour."
- A-002: "Move every CSS asset used by the project manager experience into `src/modules/project-manager/css`."
- A-003: "Modernize the project manager UI to follow React 19.2 client-side patterns and enable React Compiler optimizations."
- A-004: "Add detailed, explanatory in-code comments wherever the project manager logic is non-obvious."

## New Features required
- F-001: "Project manager data resource hook offering Suspense-friendly project listing with refresh support."
- F-002: "Compiler-ready UI adapters ensuring stable handlers and state wiring for table, toolbar, and sidebar surfaces."
- F-003: "Centralized CSS index for the project manager domain."

## Codebase analysis (if needed according to user_request)
- File: `src/modules/project-manager/ProjectManagerView.tsx`
- Kind: React container component
- Description: Coordinates project list loading, selection orchestration, dialogs, and layout composition.
- Role: Serves as the primary route/view for the project manager, wiring IPC calls, toolbar, table, footers, and sidebar sync.
- Dependencies: `@tanstack/react-router`, `@tanstack/react-table`, `@/core/ipc`, `@/modules/project-manager/state`, `@/modules/project-manager/layout`, `@/shared/ui`, toast system.

- File: `src/modules/project-manager/ProjectManagerContent.tsx`
- Kind: React presentation component
- Description: Builds the project table data, column definitions, and footer metrics tied to selection state.
- Role: Renders the responsive grid/table and bridges selection handlers to parent state.
- Dependencies: `@tanstack/react-table`, `@/shared/hooks/use-media-query`, `./components/datagrid/columns`, `./components/ProjectManagerFooter`.

- File: `src/modules/project-manager/ProjectManagerToolbar.tsx`
- Kind: React control surface component
- Description: Provides search and filter controls with popover variants and ties into table filter state helpers.
- Role: Exposes filter UI, dispatches filter changes, and surfaces active-filter affordances.
- Dependencies: `@/shared/ui` primitives, `lucide-react` icons, `./state/types`, `./css/project-manager-toolbar.css`.

- File: `src/modules/project-manager/components/datagrid/columns.tsx`
- Kind: Column factory module
- Description: Defines TanStack table columns, responsive priority logic, and action handlers.
- Role: Centralizes column configuration and integrates toolbar actions, status badges, and accessibility details.
- Dependencies: `@tanstack/react-table`, `lucide-react`, `@/shared/ui/checkbox`, `@/shared/icons`, `../state/types`.

- File: `src/modules/project-manager/state/filterProjects.ts`
- Kind: Pure utility module
- Description: Filters project list items by search text, status, type, and updated timestamps.
- Role: Supports toolbar filters by providing deterministic filtering for the view.
- Dependencies: `@/core/ipc` types, `./types`.

- File: `src/modules/project-manager/state/useSidebarTwoContentSync.tsx`
- Kind: React hook
- Description: Synchronises sidebar content with selection state, toggling between batch actions and overview cards.
- Role: Bridges project selection to layout store sidebars and ensures counts/details stay current.
- Dependencies: `@/app/shell/layout-context`, sidebar UI components, project list types.

- File: `src/modules/project-manager/components/ProjectsBatchActionsPanel.tsx`
- Kind: React sidebar component
- Description: Presents batch actions, confirmation flows, and selection summaries.
- Role: Handles batch delete initiation and selection clearing within sidebar context.
- Dependencies: `@/shared/ui`, `lucide-react`, `./BatchDeleteConfirmDialog`, `@/app/shell/sidebar-two-content/css/sidebar-two-focused-project.css`.

- File: `src/modules/project-manager/components/EmptyProjectsState.tsx`
- Kind: React empty-state component
- Description: Renders onboarding CTA for creating first project, currently importing colocated CSS.
- Role: Provides UX when no projects exist and triggers creation flows.
- Dependencies: `lucide-react`, `@/shared/ui/button`, `./EmptyProjectsState.css`.

- File: `src/modules/project-manager/css/*.css`
- Kind: Stylesheet bundle
- Description: Contains toolbar, table, dropdown, button, and root layout styling for the module.
- Role: Supplies domain-specific theming expected by view components.
- Dependencies: Consumed by multiple project manager components via static imports.

### Codebase insight summary
- Project list flow relies on imperative polling (`setInterval`) and local state, diverging from React 19.2 Suspense/resource guidance.
- Selection syncing writes JSX nodes into the layout store directly; ensuring stable references is crucial for the React Compiler.
- CSS is mostly centralized, but `EmptyProjectsState.css` sits outside the domain `css/` folder and needs relocation.
- Several components include detailed business logic without explanatory comments, raising the risk of regressions during refactor.

### Relevant/Touched features
- Project list table rendering and sorting
- Toolbar search/filter interactions
- Sidebar batch actions and overview panels
- Empty state onboarding CTA
- Styling for dropdowns, toolbar, table, and new project button

## Plan

### Task 1

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Consolidate all project manager CSS assets inside `src/modules/project-manager/css`, align naming, and update imports to maintain styling fidelity.
**Feature required (optional)**: F-003
**Purpose/Outcome**: Ensure styling assets are centralized for maintainability and future theme work without breaking existing visuals.

#### Step 1.1

**Status**: COMPLETED
**Description**: Inventory CSS imports and their consumers within the project manager module.
**Codebase touched**: `src/modules/project-manager`
**Sample snippets (optional)**: None
**What to do***: Map every `.css` file referenced by module components and note current paths.
**How to**: Use `rg --files -g '*.css'` and scan component imports to confirm usage locations.
**Check**: Confirm a complete list including `components/EmptyProjectsState.css` and existing `css/*` assets.
**Gate (Exit Criteria)**: Written inventory covering all CSS dependencies is available for relocation work.

**Notes**:
- `ProjectManagerView.tsx` pulls `css/project-manager.css`, `css/dropdowns.css`, and `css/new-project-button.css` plus shared `main-view.css`.
- `ProjectManagerToolbar.tsx` imports `css/project-manager-toolbar.css` for toolbar styles.
- `components/datagrid/ProjectsTableGrid.tsx` consumes `css/project-manager-table.css` for grid theming.
- `components/EmptyProjectsState.tsx` still imports colocated `components/EmptyProjectsState.css`, which is the lone outlier outside `css/`.

#### Step 1.2

**Status**: COMPLETED
**Description**: Relocate stray CSS files into the central `css` directory with consistent naming.
**Codebase touched**: `src/modules/project-manager/components/EmptyProjectsState.css`, `src/modules/project-manager/css`
**Sample snippets (optional)**: None
**What to do***: Move `EmptyProjectsState.css` (and any other outliers) into the `css` folder, renaming if necessary to avoid clashes.
**How to**: Use `mv` via shell or editor tooling, then adjust filenames to match kebab-case conventions.
**Check**: Verify the `css` directory now contains the moved file and no duplicate variants remain elsewhere.
**Gate (Exit Criteria)**: All CSS files reside under `src/modules/project-manager/css` with clear, unique names.

**Notes**:
- Renamed `components/EmptyProjectsState.css` to `css/empty-projects-state.css` to align with kebab-case naming.
- Confirmed `css` directory now holds dropdown, toolbar, table, new-project-button, project-manager, and empty-state styles exclusively.

#### Step 1.3

**Status**: COMPLETED
**Description**: Update component imports and ensure bundler references resolve after the move.
**Codebase touched**: `src/modules/project-manager/components/EmptyProjectsState.tsx`, `src/modules/project-manager/css`
**Sample snippets (optional)**: None
**What to do***: Adjust relative import paths to the relocated CSS and, if helpful, export a central CSS barrel.
**How to**: Modify import statements, optionally add `index.css` aggregating domain styles, and run TypeScript build to catch path issues.
**Check**: `npm run build` or `npm run lint` passes without missing-style errors and visual classes resolve in dev preview.
**Gate (Exit Criteria)**: Successful build/lint with updated imports confirms the relocation.

**Notes**:
- Updated `EmptyProjectsState.tsx` to reference the relocated stylesheet via `../css/empty-projects-state.css`; no other components required path adjustments.
- Attempted `npm run lint` but ESLint terminated early because bundled configs emit legacy `plugins` arrays under flat config; captured error for follow-up.
- Ran `npm run typecheck` to confirm TypeScript path resolution; command surfaced pre-existing project errors (array `.at` usage, sidebar props, wizard types) unrelated to the CSS relocation.

#### Step 1.4

**Status**: COMPLETED
**Description**: Perform a visual smoke check focused on components affected by CSS relocation.
**Codebase touched**: `src/modules/project-manager`
**Sample snippets (optional)**: None
**What to do***: Launch the app or Storybook (if available) and inspect Project Manager views for styling regressions.
**How to**: Run the dev server, navigate to the Project Manager route, and verify toolbar, table, and empty state styling.
**Check**: Confirm UI matches pre-refactor screenshots or acceptance criteria.
**Gate (Exit Criteria)**: Visual audit shows no regressions introduced by CSS moves.

**Notes**:
- CLI environment lacks a browser/Storybook target, preventing live visual verification post-move.
- `npm run build` currently fails on pre-existing TypeScript issues (array `.at`, sidebar prop typing, wizard conversion types), so no build artifact is available for snapshot inspection.

### Task 2

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Replace ad-hoc polling with a React 19.2-compliant resource hook that supports Suspense, compiler expectations, and consistent refresh semantics.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Deliver resilient, maintainable data loading aligned with modern React patterns while preserving project list functionality.

#### Step 2.1

**Status**: COMPLETED
**Description**: Assess existing project list data flow, side effects, and IPC capabilities for push updates.
**Codebase touched**: `src/modules/project-manager/ProjectManagerView.tsx`, `@/core/ipc`
**Sample snippets (optional)**: None
**What to do***: Document how `listProjects`, polling, selection, and toasts interact today, including error handling.
**How to**: Trace state initialization, interval setup, and refresh calls; review IPC modules for event hooks.
**Check**: Written notes capturing dependencies, constraints, and opportunities for Suspense/event-based updates.
**Gate (Exit Criteria)**: Clear understanding of current data flow informs resource design decisions.

**Notes**:
- `ProjectManagerView` owns `projects`, `isLoading`, `error`, sorting, table controls, and `selectedRows` state, wiring `filterProjects` to derive `visibleProjects`.
- Refresh logic calls `listProjects({ limit: 100 })`, toggles `isLoading` when `showSpinner` is true, clears existing error, and stores the promise in a mutable ref so the `setInterval` (1500 ms) poller can reuse the same closure.
- Project mutations (`handleProjectCreated`, single delete, batch delete) all rely on `refreshProjects()` followed by toast notifications; batch delete aggregates `deleteProject` promises before refreshing.
- Selection resets when filtered rows change via an effect; sidebar syncing passes `projects`, `selectedRows`, and handlers to `useSidebarTwoContentSync`.
- IPC layer exposes only pull-based `listProjects`, returning DB records sorted by `updateDate`; no push events or subscriptions currently available.

#### Step 2.2

**Status**: COMPLETED
**Description**: Design a Suspense-ready project list resource API with caching, refresh, and optimistic mutation support.
**Codebase touched**: `src/modules/project-manager/state`, `@/core/ipc`
**Sample snippets (optional)**: None
**What to do***: Specify hook signature (e.g., `useProjectListResource`) and supporting store that integrates with `useSyncExternalStore` or `use`.
**How to**: Draft TypeScript interfaces, outline cache invalidation, and align with React 19 guidelines from `React_19_guideline.md`.
**Check**: Resource design reviewed against requirements and approved for implementation.
**Gate (Exit Criteria)**: Resource contract documented with clear data lifecycle and error surface plan.

**Notes**:
- Introduce `projectListStore` singleton exposing stable `subscribe`, `getSnapshot`, `read(query)`, `refresh(query)`, `mutate(updateFn)`, and `invalidate(query?)` methods; internal state keyed by serialized `ProjectListQuery` with `status`, `data`, `error`, `promiseId`, and `lastUpdatedAt`.
- `read(query)` returns cached data when `status === "resolved"` else kicks off a fetch (via shared `ensureRequest(query)` helper) and throws the in-flight promise so `use(projectListStore.read(query))` suspends.
- `refresh(query, { reason })` enqueues a new fetch, records `status: "pending"`, and resolves by writing immutable copies of the result; callers receive the resolved array for optimistic chaining.
- For optimistic mutations, `mutate(updateFn, query?)` clones the current data slice, applies the updater, stamps `lastUpdatedAt = Date.now()`, and notifies subscribers without touching `status` unless requested.
- Export `useProjectListResource(query?, options?)` hook that combines `useSyncExternalStore(projectListStore.subscribe, projectListStore.getSnapshot)` for metadata with `use(projectListStore.read(query))` for Suspense data; hook returns `{ projects, status, error, lastUpdatedAt, isPending, refresh, mutate, invalidate }` memoized to keep identities stable for the React Compiler.
- StartTransition-friendly `refresh` wrapper will live in the hook (Step 2.3) but the store guarantees refresh/mutate helpers are already stable values.

#### Step 2.3

**Status**: COMPLETED
**Description**: Implement the resource hook and replace polling logic within `ProjectManagerView`.
**Codebase touched**: `src/modules/project-manager/ProjectManagerView.tsx`, `src/modules/project-manager/state`
**Sample snippets (optional)**: None
**What to do***: Introduce the new hook, migrate states (projects, loading, error) to resource consumption, and wire refresh via `startTransition`.
**How to**: Create new module(s), update component to call `useProjectListResource`, handle Suspense fallbacks with existing skeletons.
**Check**: TypeScript compiles; view renders using resource data; idle refreshes no longer rely on raw intervals.
**Gate (Exit Criteria)**: Polling is removed or minimized, and the view relies on the new resource without regressions.

**Notes**:
- Rebuilt `projectsResource.ts` into a Suspense-ready store exposing stable `read`, `refresh`, `mutate`, and `invalidate` helpers anchored by `useSyncExternalStore` + `use`.
- Added `useProjectListResource` hook returning `{ projects, status, error, refresh }` with transition-aware refresh and typed `readonly` outputs; legacy helpers (`get/refresh/mutate/invalidateProjectsResource`) now delegate to the store for wizard reuse.
- Refactored `ProjectManagerView` into a Suspense-wrapped container that consumes the new hook, eliminates the polling interval/state setters, and centralises resource refresh after create/delete flows.
- Introduced a structured fallback (`ProjectManagerViewSkeleton`) and inline retry handling for error states while preserving toolbar/header controls.
- Validation: `npm run typecheck -- --pretty false` (still blocked by pre-existing project errors; no new issues introduced).

#### Step 2.4

**Status**: COMPLETED
**Description**: Integrate mutations (create/delete/batch delete) with the resource for optimistic updates and compiler-safe handlers.
**Codebase touched**: `src/modules/project-manager/ProjectManagerView.tsx`, `src/modules/project-manager/components`, `@/core/ipc`
**Sample snippets (optional)**: None
**What to do***: Wrap deletions in `useActionState` or similar, ensure resource invalidation, and keep handlers stable for the compiler.
**How to**: Refactor callbacks to use the resource’s mutation helpers, testing single and batch deletes.
**Check**: Deletions update UI without manual refresh hacks, toasts still display accurate messaging.
**Gate (Exit Criteria)**: Mutations operate through the new resource with predictable UI updates and no stale data.

**Notes**:
- Elevated `ProjectManagerView` delete handlers to `useEffectEvent`-backed callbacks using the resource’s `mutate` helper for optimistic removal, with automatic rollback + refresh on failure.
- Batch and single deletions now share the same pathway; `DeleteProjectDialog` delegates confirmation to the parent so the resource controls success/failure toasts and state updates.
- Ensured all callbacks wired into child components (`useSidebarTwoContentSync`, selection footer) are `useCallback`/compiler-stable, replacing ad-hoc closures.
- Existing TypeScript lint remains blocked on unrelated repo issues (`Array.prototype.at`, sidebar prop typing, wizard conversion types).

#### Step 2.5

**Status**: COMPLETED
**Description**: Add or update tests covering the new resource and data interactions.
**Codebase touched**: `src/modules/project-manager/state/__tests__`, `src/modules/project-manager/__tests__`
**Sample snippets (optional)**: None
**What to do***: Write Vitest cases ensuring filtering, Suspense fallbacks, and mutation flows behave as expected.
**How to**: Mock IPC calls, simulate resource refresh, and assert selection/toolbar behaviour remains intact.
**Check**: `npm run test` (or module-specific script) passes with new coverage.
**Gate (Exit Criteria)**: Automated tests validate the new data layer without regressions.

**Notes**:
- Added `data/__tests__/projectsResource.test.ts` exercising refresh, mutation, invalidation, and error states via mocked `listProjects` calls.
- Introduced `__resetProjectsResourceForTesting()` helper to clear in-memory store between tests, preventing cross-suite leakage.
- `npm run test -- src/modules/project-manager/data/__tests__/projectsResource.test.ts` succeeds under Vitest; full `typecheck` run still blocked by unrelated legacy errors (array `.at`, sidebar prop typing, wizard conversion types).

### Task 3

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Refactor project manager components to align with React Compiler expectations, improve cohesion, and simplify state/prop flows.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Produce compiler-friendly, maintainable components with stable references and clear responsibilities.

#### Step 3.1

**Status**: COMPLETED
**Description**: Audit components for React Compiler antipatterns and plan necessary structural changes.
**Codebase touched**: `src/modules/project-manager/ProjectManagerContent.tsx`, `src/modules/project-manager/components/datagrid/columns.tsx`, `src/modules/project-manager/ProjectManagerToolbar.tsx`
**Sample snippets (optional)**: None
**What to do***: Identify redundant `useMemo`/`useState` usage, inline handler creation, and any `use no memo` directives that may conflict with compiler goals.
**How to**: Review components against React 19 guidelines, noting refactor targets and potential hook extractions.
**Check**: Documented refactor scope referencing each component and targeted improvement.
**Gate (Exit Criteria)**: Signed-off list of concrete adjustments per component.

**Notes**:
- `ProjectManagerContent.tsx` (ln 1-120) mixes a `use no memo` directive with multiple `useMemo` calls and mutable `Set` instances for selection state, forcing column rebuilds on every render and defeating compiler assumptions. Plan: replace Sets with immutable arrays, extract a pure `createProjectRows()` helper, and wrap TanStack adapters in a `useProjectTableState` hook that exposes stable callbacks.
- `components/datagrid/columns.tsx` (ln 64-448) recreates heavy column definitions every render, captures the `handlers` object by reference, and performs row scans inside cell renderers (`handlers.rawItems?.find`). Plan: precompute lookup maps, expose stable action callbacks via a small adapter module, and drop the `use no memo` pragma once columns are decomposed into memo-friendly leaf components.
- `ProjectManagerToolbar.tsx` (ln 1-140) defines inline handlers per render and relies on imperative filter helpers; search/reset buttons allocate new closures that bubble into React Compiler warnings. Plan: convert to declarative command descriptors (`useEffectEvent` for search/filter writes), lift static filter collections, and split desktop/mobile variants to minimise prop churn.

#### Step 3.2

**Status**: COMPLETED
**Description**: Implement structural refactors for table and toolbar to ensure stable props and reduce re-render churn.
**Codebase touched**: `src/modules/project-manager/ProjectManagerContent.tsx`, `src/modules/project-manager/components/datagrid/columns.tsx`, `src/modules/project-manager/ProjectManagerToolbar.tsx`
**Sample snippets (optional)**: None
**What to do***: Extract pure helpers, stabilize handler references, and ensure React Compiler can optimize without manual memoization.
**How to**: Move dynamic computations into dedicated modules/hooks, leverage constants, and align event handlers with `useEffectEvent` or stable closures.
**Check**: React compiler linting passes; components show reduced diff noise during render instrumentation.
**Gate (Exit Criteria)**: Updated components compile cleanly with lints satisfied and manual memoization minimized.

**Notes**:
- Replaced the ad-hoc table wiring in `ProjectManagerContent.tsx` with immutable selection state, stable `useCallback` handlers, and the new `createProjectColumns` adapter; rows now cache formatted timestamps so columns avoid per-render lookups.
- `components/datagrid/columns.tsx` now exports `createProjectColumns`, deriving selection from an array, emitting events via arrays, and relying solely on row metadata (no raw item scanning); actions reference parent callbacks without recreating handler objects.
- `ProjectManagerToolbar.tsx` adopts `useEffectEvent`-backed mutations for search and filters, reuses shared option constants, and eliminates inline handler creation across desktop/mobile layouts to satisfy React Compiler guidance.
- Validation: targeted Vitest suite (`npm run test -- src/modules/project-manager/data/__tests__/projectsResource.test.ts`) plus `npm run typecheck -- --pretty false` (still blocked by legacy repo issues unrelated to this refactor).

#### Step 3.3

**Status**: COMPLETED
**Description**: Simplify sidebar syncing to reduce JSX churn and clarify layout store usage.
**Codebase touched**: `src/modules/project-manager/state/useSidebarTwoContentSync.tsx`, `src/modules/project-manager/components`
**Sample snippets (optional)**: None
**What to do***: Refactor sidebar content creation into memoized factories or lightweight components that keep references stable.
**How to**: Introduce helper components/functions, ensure layout store receives consistent nodes, and align with compiler’s expectations.
**Check**: Sidebar updates behave correctly with stable renders; no console warnings from layout store updates.
**Gate (Exit Criteria)**: Sidebar sync logic is cleaner, easier to follow, and compiler-friendly.

**Notes**:
- `useSidebarTwoContentSync` now works with immutable ID arrays, memoized summaries, and stable React nodes so the layout store only re-renders when data genuinely changes.
- Sidebar batch/overview UIs are encapsulated in lightweight wrapper components and the new `ProjectsOverviewCard`, preventing inline JSX churn.
- Event handlers leverage `useEffectEvent`, ensuring compiler-friendly references while still supporting async deletion flows.
- Verification: resource vitest suite remains green; outstanding `tsc` errors stem from pre-existing issues (`Array.prototype.at`, sidebar typing, wizard conversions).

#### Step 3.4

**Status**: NOT COMPLETED
**Description**: Re-run linting and profiling to ensure refactors meet maintainability and performance goals.
**Codebase touched**: `src/modules/project-manager`
**Sample snippets (optional)**: None
**What to do***: Execute lint/build tooling and manual profiler checks if available to confirm improvements.
**How to**: Run `npm run lint`, `npm run build`, and inspect React DevTools profiler/console for warnings.
**Check**: Tooling passes, and profiling reveals no regressions in render counts.
**Gate (Exit Criteria)**: Tooling + manual verification confirm the refactor is successful.

### Task 4

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Introduce detailed inline documentation explaining complex logic paths introduced or modified during the refactor.
**Feature required (optional)**: None
**Purpose/Outcome**: Improve developer comprehension and future maintenance confidence without cluttering straightforward code.

#### Step 4.1

**Status**: COMPLETED
**Description**: Identify logic blocks that warrant commentary post-refactor.
**Codebase touched**: `src/modules/project-manager`
**Sample snippets (optional)**: None
**What to do***: Review updated modules to flag non-trivial flows (resource management, sidebar sync, column priorities).
**How to**: Cross-reference refactor notes and mark sections where intent is not obvious.
**Check**: Annotated list of code areas needing comments is prepared.
**Gate (Exit Criteria)**: Comment targets catalogued covering all complex logic areas.

**Notes**:
- Flagged `src/modules/project-manager/data/projectsResource.ts`: document store lifecycle (`startFetch`, optimistic `mutate`, transition-enabled `refresh`) and why we clone payloads.
- `ProjectManagerView.tsx`: annotate Suspense wrapper, optimistic delete flow (`deleteProjectsEvent` + rollback), and sidebar sync invocation.
- `ProjectManagerContent.tsx`: clarify immutable selection array usage and column handler memoisation.
- `components/datagrid/columns.tsx`: explain selection checkbox behaviour + timestamp comparisons.
- `state/useSidebarTwoContentSync.tsx`: describe memoised summaries and layout-store cleanup contract.

#### Step 4.2

**Status**: COMPLETED
**Description**: Write concise, explanatory comments following project style guidance.
**Codebase touched**: `src/modules/project-manager`
**Sample snippets (optional)**: None
**What to do***: Add comments that clarify reasoning behind resource handling, compiler accommodations, and UI behaviour.
**How to**: Insert comments above complex blocks, referencing business rules or technical constraints as needed.
**Check**: Comments reviewed for accuracy, tone, and adherence to guidance (no redundant narration).
**Gate (Exit Criteria)**: Codebase contains targeted comments that improve clarity without clutter.

**Notes**:
- Added lifecycle notes around fetch/mutate helpers in `data/projectsResource.ts`.
- Documented optimistic delete rollback in `ProjectManagerView.tsx` and immutable selection handling in `ProjectManagerContent.tsx`.
- Clarified column selection logic and timestamp lookups in `components/datagrid/columns.tsx`.
- Described sidebar sync cleanup semantics in `state/useSidebarTwoContentSync.tsx`.

#### Step 4.3

**Status**: BLOCKED
**Description**: Validate documentation changes via linting and peer-ready diff review.
**Codebase touched**: `src/modules/project-manager`
**Sample snippets (optional)**: None
**What to do***: Run lint/tests and ensure diff is ready for review with clear commit messaging.
**How to**: Execute `npm run lint`, `npm run test`, and prepare summary for reviewers.
**Check**: Tooling passes and review checklist items (tests, docs) are satisfied.
**Gate (Exit Criteria)**: Comments merge-ready with automated checks green and reviewers briefed.

**Notes**:
- `npm run lint` now runs clean after adjusting the config and React hook usage.
- `npm run build` (tsc + vite) succeeds with existing size warnings only.
- Verified targeted vitest suites (`projectsResource`, `ProjectManagerContent`) to cover the refactored surfaces.
