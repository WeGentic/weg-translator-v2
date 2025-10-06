# Subtask 2.1 – Suspense Boundaries & Fallbacks (Step 2.1.2)

## Scope
- Completed Step 2.1.2 by adding error boundaries and loading fallbacks tailored to the new Suspense resource model.
- Ensured the v2 Project Manager route always renders within a Suspense/Error boundary wrapper.

## Implementation Highlights
- Introduced `ProjectsBoundary` (`src/features/project-manager-v2/shell/boundaries/ProjectsBoundary.tsx`) combining `AppErrorBoundary` with a Suspense fallback. The boundary derives `resetKeys` from query arguments so retries occur automatically on filter/limit changes.
- Added a dedicated `ProjectsSkeleton` that mirrors the planned v2 layout (header metrics + table zone) to provide visual stability during Suspense fetches.
- Built `ProjectsError` with retry controls that invalidate and refresh the `projectsResource` before resetting the boundary, preventing stale-cache loops.
- Connected `ProjectManagerRoute` to the new boundary so downstream shell/content implementations inherit consistent error/loading UX once they arrive.

## React 19 Considerations
- Fallback components remain side-effect free until user interaction, aligning with React 19’s compiler expectations.
- Retry logic uses `invalidateProjectsResource` + `refreshProjectsResource` to avoid immediate re-suspension loops and keep boundary state deterministic.
- Suspense fallback lives at the feature module boundary, limiting the reveal surface to the Project Manager panel.

## Next Steps
1. Implement the actual `ProjectManagerShell` and content presenters that consume `useProjectsResource` within the new boundary (Task 3).
2. Add dedicated error analytics hooks or toast notifications if future UX requires them.
3. Integrate Tauri event subscriptions (Step 2.1.3) so boundary refreshes respond to backend pushes instead of interval polling.

## Validation Checklist
- [x] Suspense fallback renders without lint violations (`npm exec eslint src/features/project-manager-v2/...`).
- [x] Error fallback retries invalidate + refresh the Suspense cache.
- [x] Route now renders inside boundary scaffolding.
- [ ] Shell/content consumers still pending (Task 3).
- [ ] Automated tests to assert boundary behaviour scheduled for Task 5.1.
