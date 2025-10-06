# Sub-task 1.1 – Migration Strategy Summary

## Completed Outputs
- Updated `Plan_ProjectManagerV2_React19_Refactor.md` with detailed status, classification table, directory summary, and dependency matrix.
- Created `docs/ProjectManagerV2_DirectoryLayout.md` describing the v2 folder structure and legacy-to-v2 path mapping.
- Documented copy vs. refactor decisions for every legacy file under `src/features/project-manager/`.
- Captured a migration matrix covering external/shared dependencies and their reuse/refactor strategy.

## Key Decisions
- Build the new implementation under `src/features/project-manager-v2/` with dedicated folders for shell, data, state, actions, table, sidebar, wizard, utils, types, and styles.
- Refactor IPC interactions (`listProjects`, `deleteProject`, `createProject`) into shared action/resource modules to enable Suspense and optimistic updates.
- Keep ShadCN primitives, shared hooks (`useBreakpoint`, `useToast`), and icon sets, while isolating copy-only assets (CSS, `filterProjects`) inside the v2 tree.
- Maintain legacy functionality by duplicating only necessary styling (`main-view.css` rules, table skeleton) so legacy files remain untouched.

## Next Focus Areas
1. Sub-task 1.2 – Define feature flags/import paths for running legacy and v2 side-by-side and plan copy flows for copy-only assets.
2. Kick off Task 2 by designing `useProjectsResource` and Suspense boundaries informed by the dependency matrix.
3. Align team on icon strategy (`react-icons/tb` vs. lucide) during sidebar refactor to reduce bundle churn.

