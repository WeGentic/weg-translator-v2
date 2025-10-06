# Step 3.1.3 – Shared Defaults Extraction (2025-02-21)

## Summary
- Centralized the project manager’s default search string, sorting blueprint, and filter presets so React Compiler can treat them as static exports.
- Extended the project-manager-v2 store snapshot to hold `filters` and `sorting`, providing setters/resetters that normalize incoming values before committing to state.
- Published filter option catalogs (`progress`, `projectType`, `updatedWithin`) for upcoming toolbar/sidebar refactors to consume without recreating literals.

## Implementation Notes
- Added `data/projectFilters.ts` with typed presets, option lists, and a normalizer used by the store.
- Added `config/defaults.ts` to expose helper factories (`createDefaultProjectManagerFilters`, `createDefaultProjectManagerSorting`) alongside constants for other modules.
- Updated `projectManagerStore.tsx` to rely on the new helpers, ensuring cloned defaults each time we reset or initialize state.

## Testing
- `npm run test -- --run src/test/features/project-manager-v2/shell/ProjectManagerShell.test.tsx`
  - Confirms shell flows still pass after the store contract change.

## Follow-ups
- Wire the new `filters` and `sorting` selectors into the toolbar/sidebar as part of Task 3.3.
- Re-enable table sorting once columns expose sortable headers aligned with the exported blueprint IDs.
