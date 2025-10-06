# Sub-task 1.1 Documentation — Project Manager Baseline Audit

Date: 2025-02-14

## Scope
Sub-task 1.1 required auditing the existing `src/features/project-manager` implementation to understand the runtime state model, user interactions, and cross-component dependencies before starting the React 19 modernization.

## Findings
- **State & Effects (`ProjectManagerView.tsx`)**
  - Maintains project data, UI toggles (wizard/dialog), filter/search/sort inputs, and selection (`Set<string>`). Relies on constants (`DEFAULT_SORTING`, `DEFAULT_FILTERS`, polling interval).
  - Uses a polling `useEffect` to refresh project listings every 1500 ms with cleanup, plus a secondary effect that prunes selections when filtered rows change.
  - IPC integration: `listProjects` for reads, `deleteProject` (single/batch) with toast feedback. Selection synchronised with sidebar via `useSidebarTwoContentSync`.
- **UI/UX Invariants**
  - Toolbar: Search field with placeholder `Search projects…`, accessible clear button, three desktop selects (status/type/date) and mobile popover variant with animated badge. Palette tokens from WeGentic theme embedded in classes.
  - Grid: `ProjectsTableGrid` uses shadcn `Table` with gradient header, striped rows, animated hover/selection styles, empty state message referencing search query.
  - Footer: Sticky footer (`aria-live="polite"`) reporting total and selected counts with chip styling.
  - Dialogs: Delete dialog enforces name confirmation and verifies removal; Create Project wizard offers 3-step flow with progress bar and spinner on submit; both use shadcn `Dialog` components.
- **Integration Points**
  - `filterProjects` normalization logic reused in both `ProjectManagerView` and `ProjectManagerContent`, creating duplicate filtering passes that must stay behaviourally identical during refactor.
  - `useSidebarTwoContentSync` toggles sidebar visibility and injects either `ProjectsBatchActionsPanel` (selection) or `ProjectsOverviewCard` (summary) using derived metrics (active projects, files, 24h updates).
  - Ancillary components (`ProjectsManagerHeader`, `EmptyProjectsState`, wizard, delete dialog) rely on callbacks (`onCreateProject`, `onProjectCreated`, `onAfterDelete`) from the view component to keep flows consistent.

## Risks / Considerations
- Removing manual memoization must not alter Set identity behaviour expected by `useSidebarTwoContentSync` and TanStack `useReactTable`.
- Duplicated filtering introduces potential desync if logic diverges; plan to centralize while measuring impacts.

## Next Steps
Proceed to Task 1.2 to confirm tooling readiness for the React 19 compiler and catalogue manual memoization usage across the module.
