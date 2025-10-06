# Task 1 Report — Project Manager React 19 Modernization Baseline

Date: 2025-02-14
Prepared by: Codex (React 19 modernization audit)

## 1. Executive Summary
Task 1 established a comprehensive baseline for the legacy `src/features/project-manager` module to ensure the forthcoming React 19 modernization preserves behaviour, UI parity, and integration points. The audit captured state/effect graphs, UI invariants, memoization hot spots, and a migration matrix for the upcoming `project-manager-v2` module. No regressions were introduced; all work consisted of analysis and documentation.

## 2. Behavioural Audit
### 2.1 State & Effect Inventory (`ProjectManagerView.tsx`)
- State atoms: project list, wizard/dialog toggles, loading/error, sorting, search, filter triple, selection (`Set<string>`), delete dialog target.
- Effects: initial load + 1500 ms polling with cleanup; selection pruning effect triggered by filtered view; sidebar synchronisation via `useSidebarTwoContentSync`.
- Derived data: `visibleProjects` memo (filters + search) and `showEmptyState` gating.
- Critical callbacks: project load, batch delete (IPC + toast), dialog open/close, selection resets, wizard triggers, open-by-id helper.

### 2.2 UI / UX Invariants
- **Toolbar**: Search input (`aria-label="Search projects"`, placeholder "Search projects…"), clear button, three desktop filters (status/type/date) plus mobile popover with animated badge; WeGentic palette tokens embedded in classes.
- **Table Grid**: shadcn `Table` with gradient header, striped rows, selection highlight using `var(--color-tr-primary-blue)`, animated hover, empty state referencing active search term.
- **Footer**: sticky `footer` with `aria-live="polite"`, displays total projects chip and conditional selected count chip.
- **Dialogs**: Delete dialog enforces name confirmation and verifies removal; Create Project wizard runs 3-step flow with progress indicator, spinner on submit; both rely on shadcn `Dialog` primitives. `EmptyProjectsState` and `ProjectsManagerHeader` share the "Create project" CTA experience.

### 2.3 Integration Points
- `filterProjects` invoked in both view and content layers, duplicating filter work.
- `useSidebarTwoContentSync` toggles layout store sidebar visibility, switching between `ProjectsBatchActionsPanel` (selection) and `ProjectsOverviewCard` (summary) while computing derived metrics (active projects, total files, 24 h updates).
- Dialogs and wizard coordinate with `onProjectCreated`, `onAfterDelete`, and selection Set semantics expected by TanStack Table and layout store.

## 3. Tooling & Memoization Readiness
- Dependencies already upgraded: `react@19.1.1`, `react-dom@19.1.1`, `babel-plugin-react-compiler@19.1.0-rc.3`, `eslint-plugin-react-compiler@19.1.0-rc.2`.
- `vite.config.ts` loads React compiler Babel plugin via `@vitejs/plugin-react`; `eslint.config.js` enables `react-compiler/react-compiler` rule at error level; `tsconfig.json` uses `jsx: react-jsx` with strict mode.
- Memoization inventory identified redundant `useMemo`/`useCallback` usage across the module (view, content, toolbar, dialogs, wizard). No `React.memo` usage detected. Removals must preserve Set identity and TanStack integration.

## 4. Migration Strategy (`project-manager-v2`)
- New module root: `src/features/project-manager-v2`, mirroring legacy structure for ease of comparison.
- File classification:
  - **Refactor**: `ProjectManagerView`, `ProjectManagerContent`, `ProjectManagerToolbar`, `components/datagrid/columns`, `utils/filterProjects`, `hooks/useSidebarTwoContentSync`, wizard state/steps.
  - **Copy**: Presentational components (header, footer, dialogs, empty state, batch actions), wizard shell, CSS assets, `types/types`.
- `project-manager-v2-migration-matrix.md` captures source → target mapping, dependencies (IPC, TanStack, shadcn), and planned adjustments. CSS will be copied verbatim initially to maintain parity.

## 5. Risks & Considerations
- Duplicated filtering between view/content risks future drift; v2 refactor will centralize filtering and rely on compiler-based memoization.
- Sidebar sync expects `Set` identity; handler refactors must retain consistent semantics to avoid stale content in layout store.
- Copying CSS without consolidation could cause divergence if palette tokens change; revisit post-modernization.
- Recommend adding `npx react-compiler-healthcheck` to CI to continually enforce compiler-compatible patterns.

## 6. Next Steps
1. Begin Task 2 using this report plus subtask documentation to modernize `ProjectManagerView` within `project-manager-v2`.
2. Implement unified filtering selector and remove redundant memoization while validating behaviour through unit/UI smoke tests (to be defined in Task 6).
3. Update migration matrix as refactor decisions evolve and revisit risk items (sidebar sync, CSS consolidation).

## Appendix
- Reference documents:
  - `subtask-1-1-documentation.md` — Behavioural audit details.
  - `subtask-1-2-documentation.md` — Tooling & memoization readiness.
  - `subtask-1-3-documentation.md` — Migration layout decisions.
  - `project-manager-v2-migration-matrix.md` — Source/target mapping and dependencies.
