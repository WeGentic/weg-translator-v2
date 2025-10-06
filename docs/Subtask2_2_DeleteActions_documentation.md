# Subtask 2.2 – Delete Actions (Step 2.2.1)

## Scope
- Completed Step 2.2.1 by wrapping single and batch delete flows in React 19 `useActionState`, replacing ad-hoc mutation handling.
- Introduced optimistic cache updates that coordinate with the Suspense projects resource and the new projects event bridge.

## Implementation Highlights
- Added `useDeleteProjectAction` for single deletions and `useBatchDeleteProjectsAction` for multi-select removal in `src/features/project-manager-v2/actions/`.
- Both hooks parse either imperative payloads or `FormData`, enabling reuse across button handlers and `<form action>` submissions.
- Optimistic UI: `mutateProjectsResource` removes the affected rows immediately, while failures restore the original snapshot before raising destructive toasts.
- Success paths trigger `refreshProjectsResource` and emit consistent toast copy so downstream shells/toolbars receive uniform UX feedback.
- Batch delete handles partial failures gracefully by only keeping successfully removed IDs out of the cache and surfacing an aggregated error message.

## React 19 Considerations
- `useActionState` supplies `isPending` flags for disabling UI controls; state machines collapse to `idle | success | error` to keep the compiler’s analysis simple.
- Hooks stay referentially stable (`useCallback` for `run`) so toolbar/sidebar consumers won’t retrigger memoized computations.
- Optimistic updates cooperate with the event-driven refresh added in Step 2.1.3, ensuring cache parity even if external mutations occur mid-flight.

## Validation
- `npm exec eslint src/features/project-manager-v2/actions`
- Manual reasoning for rollback scenarios (single failure, partial batch failure) to confirm cache consistency.

## Follow-ups
1. Wire these hooks into the upcoming v2 shell/toolbar components (Task 3) so UI controls leverage the shared mutation layer.
2. Extend the hooks with `useOptimistic` once selection stores land, enabling richer inline feedback (e.g., row strike-through).
3. Add Vitest coverage (Task 5.1) simulating batch success/failure to guard against regressions in rollback logic.
