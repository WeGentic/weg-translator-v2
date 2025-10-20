# projects-module-prune

## Current User Request Analysis
- Need to audit `src/modules/projects` and rename every unused artifact to `.old` without breaking the live React/Tauri flow.
- Initial scan shows active usage concentrated around the `ProjectOverview*` and wizard v2 components; legacy wizard files appear isolated.
- Follow-up request: extract shared language definitions (and any remaining shared helpers) from the legacy wizard folder so it can be safely removed.

## Problem Breakdown
- Inspect dependency graph within `src/modules/projects` to confirm which files/components remain referenced by routes, layout, or shared state.
- Validate external consumers (e.g., workspace routes, clients module) so that removals do not orphan imports.
- Identify obsolete artifacts—early pass highlights `components/wizard` (non v2) as candidate while preserving shared utilities such as `wizard/utils/languages.ts`.
- Ensure renames cascade to related tests/mocks and drop residual exports to avoid build errors.
- After cleanup, run TypeScript checks to detect missing references and confirm the module still compiles cleanly.
- Relocate shared locale data under `config/` and update all wizard v2 consumers to rely on the new path / re-export surface.

## User Request
S1: Carefully analyze the code and REMOVE (renaming to .old) ALL unused code from src/modules/projects
Completed: COMPLETED
S2: Move languages (and other required files, if any) outside wizard folder, so it can be deleted
Completed: COMPLETED

## Coding implementation
- Renamed the legacy wizard v1 implementation (components, state, steps, tests, and utilities) to `.old`, isolating it from the active bundle.
- Pruned unused helpers from `components/wizard/utils/languages.ts` while keeping shared language data for wizard v2 consumers.
- Relocated shared language options to `src/modules/projects/config/languages.ts` and repointed wizard v2 imports through the config barrel.

## Notes
- `npm run typecheck`
