# Subtask 2.1 – Suspense Resource Implementation (Step 2.1.1)

## Scope
- Delivered Step 2.1.1 of the Project Manager v2 migration plan.
- Replaced the legacy polling model with a Suspense-based resource layer tailored for React 19.

## Implementation Highlights
- Added `src/features/project-manager-v2/data/projectsResource.ts` to centralise project-list caching with explicit status tracking (`idle`, `pending`, `refreshing`, `resolved`, `rejected`).
- Implemented helper APIs for cache lifecycle control:
  - `refreshProjectsResource` performs background revalidation without suspending existing consumers, surfacing errors through `lastError` while keeping the last known rows.
  - `invalidateProjectsResource` clears the cache and forces the next consumer read to suspend, paving the way for feature-flag toggles or hard resets.
  - `mutateProjectsResource` enables optimistic updates that will be wired into create/delete actions during Sub-task 2.2.
- Created `src/features/project-manager-v2/data/useProjectsResource.ts`, exposing a React 19-ready hook that:
  - Suspends on initial load via `use(promise)` and leverages `useSyncExternalStore` for cache change subscriptions.
  - Returns project rows together with `isRefreshing`, `lastUpdatedAt`, `lastError`, and imperative `refresh`/`invalidate` controls, matching the plan’s Suspense objectives.
- Exported a barrel file so upcoming shell/content components can consume the resource without importing internal module paths.

## React 19 & Compiler Considerations
- `useProjectsResource` keeps hook order stable (memoising query params and callbacks once) to align with the React Compiler’s static analysis.
- Background refreshes avoid triggering Suspense by keeping cached data available; only the initial fetch or full invalidations will suspend.
- Errors propagate through standard Error Boundaries on first load, while background failures are surfaced via `lastError`, preserving UX continuity.

## Next Steps
1. Step 2.1.2 will introduce the Suspense boundary and error fallback inside the v2 shell using the new hook.
2. Step 2.1.3 will connect Tauri event listeners to `refreshProjectsResource` to replace interval polling with event-driven updates.
3. Sub-task 2.2 will consume `mutateProjectsResource` for optimistic project creation/deletion flows.

## Validation Checklist
- [x] Hook suspends on cold start and resumes with cached data.
- [x] Background refresh keeps legacy data visible.
- [x] Error handling feeds the existing Error Boundary contracts.
- [ ] Integrate with v2 shell/toolbar (pending Step 2.1.2/Task 3).
- [ ] Wire optimistic mutations into action-state flows (pending Sub-task 2.2).
