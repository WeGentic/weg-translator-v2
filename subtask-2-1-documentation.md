# Sub-task 2.1 Documentation — State & Derived Data Refresh

Date: 2025-02-15

## Scope
Sub-task 2.1 focused on modernising the `ProjectManagerView` state model for the React 19 compiler while keeping feature parity with the legacy implementation. The work lives in `src/features/project-manager-v2/ProjectManagerView.tsx` and covers search/filter handling, derived project lists, and memoisation strategy.

## Implementation Notes
- Introduced a consolidated `controls` state object that wraps `search` and `filters`, reducing related `useState` hooks. Guarded updates with `filtersMatch` and equality checks to avoid unnecessary renders while keeping behaviour identical to the legacy view.
- Kept `selectedRows` in its own `Set<string>` state to preserve downstream semantics (sidebar sync, batch actions) but rely on compiler-optimised callbacks instead of manual `useCallback` wrappers.
- Derived `visibleProjects` via a single `filterProjects(projects, controls.filters, controls.search)` call each render. This replaces the previous `useMemo` dependency gymnastics and serves as the single source for the grid, sidebar, and selection-pruning effect.
- Added small helper utilities (`createDefaultTableControls`, `filtersMatch`) to keep defaults immutable and declarative while matching legacy defaults.

## Behavioural Parity
- Project listings, sorting defaults, and filter presets mirror the legacy constants. All UI components still receive the same prop shapes (`search`, `filters`, `selectedRows`).
- Selection pruning runs against the derived list to ensure hidden rows are unselected, matching prior behaviour and keeping sidebar badge counts correct.

## Risks & Follow-ups
- `_filterProjects` still imports from the legacy module. Task 5 will revisit whether to relocate or share a typed selector.
- Future Task 3 updates to `ProjectManagerContent` must continue to expect the consolidated `controls` object (exposed today via separate props) to prevent divergence.

## Validation
- `npx eslint src/features/project-manager-v2/ProjectManagerView.tsx` (passes).

## Next Steps
Proceed to Sub-task 2.2 to modernise effects, async flows, and error handling while leveraging the new state layout.
