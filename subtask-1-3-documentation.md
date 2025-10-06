# Sub-task 1.3 Documentation — Migration Strategy & Layout

Date: 2025-02-14

## Scope
Establish the structure for the new `project-manager-v2` module, classify legacy files as refactor vs copy-only, and capture a dependency matrix to guide implementation while keeping the legacy module untouched.

## Key Decisions
- **Module Boundary**: All new work will live under `src/features/project-manager-v2`, mirroring the legacy folders (`components`, `hooks`, `utils`, `types`, `css`) to simplify diffing and reviews.
- **File Classification**:
  - **Refactor**: Core logic surfaces (`ProjectManagerView`, `ProjectManagerContent`, `ProjectManagerToolbar`, datagrid columns, `filterProjects`, `useSidebarTwoContentSync`, wizard state + steps) targeted for React 19 compiler alignment and data-flow cleanup.
  - **Copy**: Presentational components, dialogs, CSS assets, and helper utilities that already satisfy parity requirements; will only receive minimal import path adjustments as needed.
- **Documentation**: Created `project-manager-v2-migration-matrix.md` summarizing target paths, plan (refactor vs copy), dependencies, and notes for each asset.

## Dependency Highlights
- Shared dependencies such as shadcn UI primitives, TanStack Table, layout store APIs, and IPC commands remain imported from existing shared locations.
- `filterProjects` will become a single shared selector reused by both view and content in v2 to remove duplicate filtering.
- `useSidebarTwoContentSync` needs careful handling of `Set` identity; the refactor will maintain compatibility with layout store expectations.

## Risks / Considerations
- Copying CSS files verbatim risks divergence if future tokens change; consider consolidating once v2 stabilizes.
- The migration matrix should be updated if new shared utilities emerge during later tasks.

## Next Steps
Proceed to Sub-task 1.4 to compile the Task 1 analysis report leveraging the documentation produced so far.
