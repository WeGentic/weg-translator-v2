# Sub-task 2.3 Documentation — Interaction Contracts

Date: 2025-02-15

## Scope
Sub-task 2.3 documented the interaction boundaries between the refactored `ProjectManagerView` and its collaborators to guarantee unchanged UX while Tasks 3–6 proceed. All notes apply to `src/features/project-manager-v2/ProjectManagerView.tsx`.

## Key Decisions
- **Prop Contracts:** Downstream components (`ProjectsManagerHeader`, `ProjectsManagerToolbar`, `ProjectManagerContent`, dialogs) continue to receive the same props as the legacy view. The new `controls` state supplies `search` and `filters` separately to maintain call sites until Tasks 3–4 port the files into the v2 module.
- **Sidebar Sync:** `useSidebarTwoContentSync` still receives `(selectedRows, projects, onBatchDelete, onOpenProject, clearSelection)`. The batch delete handler now returns `Promise<void>` natively without memo wrappers, matching the hook’s expectations.
- **IPC Interactions:** `listProjects` and `deleteProject` usage is unchanged—no additional arguments or altered response handling were introduced.
- **Accessibility:** ARIA attributes on the root `<section>`, toolbar region, skeleton, empty state, and dialogs remain untouched. Event handlers simply rely on compiler-stable inline functions.

## Follow-ups
- When Tasks 3 and 4 migrate toolbar/content into the v2 directory, update imports to reference the new module while reusing the documented prop shapes.
- Task 5 should evaluate whether `filterProjects` migrates into a shared selector; current imports still point to the legacy utility by design.

## Validation
- Manual QA spot-check: confirmed toolbar controls, table rendering, and dialog toggles remain accessible through direct prop wiring.

## Next Steps
Task 2 wrap-up (Task-level documentation) aggregates these findings and records lint validation prior to moving on to the content and toolbar refactors.
