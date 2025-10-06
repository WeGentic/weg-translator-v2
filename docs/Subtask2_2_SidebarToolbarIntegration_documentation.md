# Subtask 2.2 – Sidebar & Toolbar Integration (Step 2.2.3)

## Scope
- Completed Step 2.2.3 by wiring the new mutation hooks into the v2 shell, toolbar, and sidebar batch panels.
- Ensured single and batch delete flows share the same optimistic cache handling and toast feedback to avoid divergence from Step 2.2.1.

## Implementation Highlights
- Introduced `ProjectManagerShell` to coordinate `useProjectsResource`, selection state, and the shared `useBatchDeleteProjectsAction` instance consumed by both toolbar and sidebar.
- Added `ProjectManagerToolbar` with search, manual selection clear, and batch delete triggers that pass through the centralized action hook.
- Refactored `ProjectsBatchActionsPanel` into a presentational component receiving `onBatchDelete`/`isDeleting`, keeping selection cleanup logic isolated inside the shell.
- Implemented `DeleteProjectDialog` on top of `useDeleteProjectAction`, aligning single deletes with optimistic rollback behaviour and toast messaging defined earlier in Subtask 2.2.

## React 19 Considerations
- Leveraged a single `useBatchDeleteProjectsAction` instance to prevent multiple `useActionState` state machines from competing during concurrent transitions.
- Drove all action invocations through the shell, making it straightforward to wrap calls in `startTransition` once the UI moves beyond basic selection state.
- Maintained Suspense-friendly data access by continuing to read from `useProjectsResource`, so toolbar and sidebar remain consistent with the table view.

## Verification
- `npm exec eslint src/features/project-manager-v2` (targeted files) to ensure React 19 compiler-friendly code.
- `npm run test -- --run src/test/features/project-manager-v2/actions/mutationActions.test.tsx` to validate optimistic create/delete/batch flows against mocked IPC endpoints and resource cache.

## Follow-ups
1. Flesh out the v2 table layer (Task 3 & Task 4) so selection derives from shared stores rather than local state within the shell.
2. Expand toolbar/side-panel metrics once the data selectors land in upcoming tasks.
3. Add UI-focused tests (Step 5.1.1) covering Suspense fallbacks and selection UX interactions powered by the new shell.
