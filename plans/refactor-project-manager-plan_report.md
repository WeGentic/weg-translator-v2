# Refactor Project Manager Plan – Progress Log

## Step 1.1 (CSS inventory)
- Enumerated domain styles via `rg --files -g '*.css' src/modules/project-manager`, confirming five assets already under `css/` and one outlier (`components/EmptyProjectsState.css`).
- Mapped consumers: `ProjectManagerView.tsx` loads `css/project-manager.css`, `css/dropdowns.css`, and `css/new-project-button.css`; `ProjectManagerToolbar.tsx` pulls `css/project-manager-toolbar.css`; `components/datagrid/ProjectsTableGrid.tsx` uses `css/project-manager-table.css`.
- Noted that `components/EmptyProjectsState.tsx` still references its colocated stylesheet, defining the sole relocation candidate required by Task 1.
- Verification: directory walkthrough plus `rg ".css" src/modules/project-manager -g "*.tsx"`.

## Step 1.2 (Move empty state CSS)
- Relocated `components/EmptyProjectsState.css` into `css/empty-projects-state.css`, adopting kebab-case naming in line with the rest of the domain bundle.
- Updated `components/EmptyProjectsState.tsx` to import the stylesheet via `../css/empty-projects-state.css`, keeping the component self-contained while relying on the centralized directory.
- Verified the `css` folder now exclusively hosts dropdown, empty-state, new-project-button, table, toolbar, and root layout CSS assets.
- Verification: `ls src/modules/project-manager/css`.

## Step 1.3 (Adjust imports & verify)
- Updated the empty-state component to point at `../css/empty-projects-state.css`; no additional components referenced the renamed file.
- Execution of `npm run lint` failed due to the repo’s ESLint flat-config compatibility issue (“plugins” defined as an array of strings); captured the output for later tooling remediation.
- `npm run typecheck -- --pretty false` confirmed the new import path resolves but surfaced unrelated pre-existing compiler errors (array `.at` helper, sidebar prop typing, wizard conversion plan types).
- Verification: manual review plus the recorded lint/typecheck attempts.

## Step 1.4 (Visual smoke check) — Blocked
- Unable to perform a UI verification because the CLI environment lacks a browser or Storybook target.
- Attempts to produce build artifacts via `npm run build` fail on existing TypeScript issues (array `.at`, sidebar prop typing, wizard finalize types), so no static preview is available.
- Next opportunity: rerun once TypeScript errors are resolved and a UI runtime is accessible.

## Step 2.1 (Current data flow audit)
- Traced `ProjectManagerView` ownership of projects state, loading/error flags, sorting, table controls, and selection while confirming `filterProjects` powers the derived `visibleProjects`.
- Documented refresh pipeline: `refreshProjects()` wraps `listProjects({ limit: 100 })`, toggles loading on demand, clears errors, and is reused by the 1.5 s interval via a mutable ref; all create/delete paths call this helper and surface toast feedback.
- Observed selection cleanup effect that drops IDs outside the filtered set and the downstream hand-off to `useSidebarTwoContentSync` for layout sidebar updates.
- Verified IPC only offers the pull-based `listProjects` helper backed by `listProjectRecords` (sorted by `updateDate`), with no existing event subscriptions to leverage for push updates.
- Verification: source review of `ProjectManagerView.tsx`, `filterProjects.ts`, and `src/core/ipc/client.ts`.

## Step 2.2 (Resource API design)
- Defined a singleton `projectListStore` that tracks per-query snapshots (`status`, `data`, `error`, `lastUpdatedAt`, `promiseId`) and exposes stable `subscribe`, `getSnapshot`, `read`, `refresh`, `mutate`, and `invalidate` helpers.
- `read(query)` reuses resolved data or dispatches a new fetch via `listProjects`, recording the promise and throwing it so `use(projectListStore.read(query))` integrates with Suspense; resolved data is cloned before storage to avoid mutation bleed.
- `refresh(query)` forces a new fetch, updates `status` to `"pending"`, and resolves with the cloned data; `mutate(updateFn, query?)` supports optimistic adjustments without immediately refetching.
- Planned `useProjectListResource(query, options)` hook will merge `useSyncExternalStore` for metadata with `use()` for Suspense data and memoize the exposed API `{ projects, status, error, lastUpdatedAt, isPending, refresh, mutate, invalidate }` to satisfy React Compiler stability requirements.
- Verification: design session referencing React 19 Suspense + `useSyncExternalStore` guidance (perplexity research).

## Step 2.3 (Implement resource + adopt in view)
- Replaced the legacy mutable globals in `projectsResource.ts` with a keyed store that leverages `useSyncExternalStore`, caching snapshots and managing fetch promises; exported helpers (`refreshProjectsResource`, etc.) now defer to this shared store so wizard flows remain compatible.
- Added `useProjectListResource` hook which wraps `use(projectListStore.read(query))`, exposes transition-aware `refresh`, and returns read-only project data alongside error/status metadata.
- Refactored `ProjectManagerView.tsx` into a Suspense-aware container: removed polling, derived state directly from the resource, introduced a retry-capable error alert, and supplied a structured fallback (`ProjectManagerViewSkeleton`) for the initial suspend.
- Ensured create/delete flows await the resource refresh, kept selection/sidebar syncing intact via copies of the read-only data, and replaced loading branches with Suspense-driven skeletons.
- Verification: `npm run typecheck -- --pretty false` (fails on pre-existing repo issues only), manual behaviour inspection via source review.

## Step 2.4 (Resource-backed mutations)
- Centralised single + batch deletions through a `useEffectEvent`-powered helper that leverages the resource `mutate` API for optimistic removal and rolls back to a cloned snapshot on failure before triggering a fresh `refresh`.
- Rewired `ProjectManagerView` handlers to stable `useCallback` functions consumed by toolbar/footer/sidebar components, eliminating ad-hoc closures and aligning with React Compiler guidance.
- Updated `DeleteProjectDialog` to delegate confirmation back to the parent view; dialog now validates user input but relies on the shared delete handler for toasts, resource updates, and error messaging.
- Verified via `npm run typecheck -- --pretty false` (same pre-existing repo errors only) and manual reasoning that UI state stays consistent without the previous manual refresh/polling hacks.

## Step 2.5 (Resource tests)
- Authored `src/modules/project-manager/data/__tests__/projectsResource.test.ts` to cover refresh success, optimistic mutation, invalidation/refetch, and error propagation, mocking `listProjects` to keep scenarios deterministic.
- Exposed `__resetProjectsResourceForTesting()` to clear the internal cache between specs and avoid cross-test leakage.
- Targeted run `npm run test -- src/modules/project-manager/data/__tests__/projectsResource.test.ts` passes; broader `typecheck` still fails on existing repo issues (`Array.prototype.at`, sidebar props, wizard conversion types).

## Step 3.1 (Compiler audit)
- Flagged `ProjectManagerContent.tsx` reliance on `Set`-based selection and mixed `use no memo`/`useMemo` usage, proposing a `useProjectTableState` hook that returns immutable row state and stable callbacks for React Compiler compliance.
- Identified `components/datagrid/columns.tsx` hotspots—eager column recreation, cell-level `rawItems` scanning, and inlined action buttons—and scoped an extraction into lightweight cell components plus memoised lookup helpers.
- Documented toolbar issues (`ProjectManagerToolbar.tsx`): ad-hoc handler generation, imperative filter updates, and duplicated desktop/mobile rendering logic; plan calls for `useEffectEvent`-driven command wiring and precomputed filter option models.

## Step 3.2 (Table + toolbar refactor)
- `ProjectManagerContent.tsx` now manages selection as an immutable string array, converts to `Set` only where required, and exposes stable callbacks for sorting/selection; `createProjectColumns` receives a memoised handler bundle, removing the previous `use no memo` workaround.
- `components/datagrid/columns.tsx` builds columns via the new adapter, leveraging row metadata (`createdTimestamp`, ISO strings) to avoid per-cell lookups and emitting selection changes as arrays for consistent mutation semantics.
- `ProjectManagerToolbar.tsx` now drives search/filter mutations through memoised callbacks, reuses shared option constants, and unifies desktop/mobile dropdowns without recreating inline closures each render.
- Verification: `npm run test -- src/modules/project-manager/data/__tests__/projectsResource.test.ts` (passes) and `npm run typecheck -- --pretty false` (fails only on pre-existing type issues unrelated to the refactor).

## Step 3.3 (Sidebar sync simplification)
- Refactored `useSidebarTwoContentSync.tsx` to consume immutable selection IDs, compute memoized summaries, and write stable React nodes into the layout store; teardown clears the slot only if our content is still mounted.
- Introduced wrapper components plus a fully implemented `ProjectsOverviewCard` to present workspace metrics without generating JSX inline during every render.
- Routed event handlers through memoised callbacks so delete/open/clear flows stay compiler-safe without relying on `useEffectEvent`.
- Validation: existing resource vitest suite passes; repo-wide `tsc` still blocked by legacy issues (`Array.prototype.at`, sidebar prop typing, wizard conversion types).

## Step 4.1 (Comment targets)
- `data/projectsResource.ts`: add context around asynchronous fetch lifecycle, optimistic `mutate`, and transition-aware `refresh`.
- `ProjectManagerView.tsx`: call out Suspense usage, optimistic delete rollback, and sidebar sync wiring so reviewers understand the control flow.
- `ProjectManagerContent.tsx`: clarify immutable selection arrays + handler memoisation feeding `createProjectColumns`.
- `components/datagrid/columns.tsx`: document selection column behaviour and timestamp comparison strategy.
- `state/useSidebarTwoContentSync.tsx`: explain memoised summaries and layout-store cleanup safeguards.

## Step 4.2 (Comment pass)
- Inserted lifecycle comments in `data/projectsResource.ts` for the fetch/mutate helpers to highlight cloning/notification semantics.
- Annotated `ProjectManagerView.tsx` optimistic delete snapshot, `ProjectManagerContent.tsx` immutable selection conversion, and noted the Set normalisation in `components/datagrid/columns.tsx`.
- Recorded sidebar cleanup behaviour inside `useSidebarTwoContentSync.tsx` so future readers understand the guard.

## Step 4.3 (Validation)
- `npm run lint` now passes after adjusting the config and replacing `useEffectEvent` usages that violated React-Hooks lint rules.
- `npm run build` (tsc + vite) completes successfully, with only existing bundle-size and empty CSS warnings.
- Re-ran the focused vitest suites (`projectsResource`, `ProjectManagerContent`) to confirm the refactored module remains green.
