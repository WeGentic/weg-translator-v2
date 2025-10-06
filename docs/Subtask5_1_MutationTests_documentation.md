# Subtask 5.1 – Mutation Hooks Test Coverage (Step 5.1.2)

## Scope
- Delivered Step 5.1.2 by exercising the new mutation hooks (`useCreateProjectAction`, `useDeleteProjectAction`, `useBatchDeleteProjectsAction`) against mocked IPC and resource layers.
- Covered optimistic insert/rollback scenarios to guard the Suspense resource cache from regressions as the v2 shell evolves.

## Implementation Highlights
- Added `src/test/features/project-manager-v2/actions/mutationActions.test.tsx` with hoisted Vitest mocks for `@/ipc` and `projectsResource`, allowing deterministic cache state assertions.
- Asserted success, failure, and partial failure flows to ensure optimistic entries are replaced, snapshots roll back correctly, and partial batch deletions keep only failed IDs.
- Used `startTransition` + `act` coordination to reflect real React 19 usage of `useActionState`, eliminating act warnings while validating pending states.

## Verification
- `npm exec eslint src/test/features/project-manager-v2/actions/mutationActions.test.tsx`
- `npm run test -- --run src/test/features/project-manager-v2/actions/mutationActions.test.tsx`

## Follow-ups
1. Extend coverage to UI-level interactions once Suspense boundaries (Step 5.1.1) add view-layer tests.
2. Add regression tests for selection store integration after Task 4 refactors share state beyond the shell.
3. Incorporate failure telemetry assertions once toast copy is centralized for analytics.
