# Project Manager V2 Migration Matrix

Date: 2025-02-14

## Target Directory Layout
```
src/features/project-manager-v2/
├── ProjectManagerView.tsx            # refactor
├── ProjectManagerContent.tsx         # refactor
├── ProjectManagerToolbar.tsx         # refactor
├── ProjectManagerHeader.tsx          # copy w/ style parity
├── ProjectManagerRoutes.tsx?         # reserved (future routing integration)
├── components/
│   ├── ProjectManagerFooter.tsx      # copy
│   ├── ProjectsBatchActionsPanel.tsx # copy
│   ├── ProjectsOverviewCard.tsx      # copy
│   ├── EmptyProjectsState.tsx        # copy
│   ├── DeleteProjectDialog.tsx       # copy
│   ├── BatchDeleteConfirmDialog.tsx  # copy
│   ├── datagrid/
│   │   ├── ProjectsTableGrid.tsx     # copy
│   │   ├── columns.tsx               # refactor-light (sync with new data flow)
│   │   └── presentation.tsx          # copy
│   └── wizard/
│       ├── CreateProjectWizard.tsx   # copy (hook refactor dependency)
│       ├── state/
│       │   └── useProjectWizard.ts   # refactor for compiler ergonomics
│       ├── steps/
│       │   ├── ProjectDetailsStep.tsx # refactor-light (remove memo wrappers)
│       │   ├── ProjectFilesStep.tsx   # refactor-light
│       │   └── ProjectReviewStep.tsx  # refactor-light
│       └── utils/
│           ├── validation.ts          # copy
│           ├── languages.ts           # copy
│           └── file-descriptor.ts     # copy
├── hooks/
│   └── useSidebarTwoContentSync.tsx  # refactor to ensure Set identity compatibility
├── utils/
│   └── filterProjects.ts             # refactor (single source of truth selector)
├── types/
│   └── types.ts                      # copy (may add discriminated unions later)
└── css/
    ├── data-table.css                # copy
    ├── dropdowns.css                 # copy
    └── new-project-button.css        # copy
```

## Migration Matrix
| Source File | Target Path | Plan | Key Dependencies | Notes |
|-------------|-------------|------|------------------|-------|
| `ProjectManagerView.tsx` | `project-manager-v2/ProjectManagerView.tsx` | Refactor | `@/ipc` (`listProjects`, `deleteProject`), `useSidebarTwoContentSync`, `ProjectsManagerToolbar`, `ProjectManagerContent`, shadcn dialogs | Consolidate filtering, rely on compiler for handlers, maintain polling/selection invariants |
| `ProjectManagerContent.tsx` | `project-manager-v2/ProjectManagerContent.tsx` | Refactor | TanStack Table, `filterProjects`, `ProjectsTableGrid`, `ProjectManagerFooter`, `useBreakpoint` | Remove duplicate filtering, streamline state bridging |
| `ProjectManagerToolbar.tsx` | `project-manager-v2/ProjectManagerToolbar.tsx` | Refactor | shadcn `Input`, `Select`, `Popover`, lucide icons | Inline cheap derived state, preserve responsive behaviour |
| `ProjectManagerHeader.tsx` | `project-manager-v2/ProjectManagerHeader.tsx` | Copy | `@/components/ui/button`, tooltip primitives | Keep UI identical; only adjust imports if directory depth changes |
| `components/ProjectManagerFooter.tsx` | `project-manager-v2/components/ProjectManagerFooter.tsx` | Copy | `cn` helper | No logic changes expected |
| `components/datagrid/columns.tsx` | `project-manager-v2/components/datagrid/columns.tsx` | Refactor-light | TanStack `ColumnDef`, `ProjectsTableGrid`, `StatusBadge` definitions | Ensure column builders operate on new row shape and avoid Set cloning |
| `components/datagrid/ProjectsTableGrid.tsx` | `project-manager-v2/components/datagrid/ProjectsTableGrid.tsx` | Copy | shadcn table primitives, `cn` | Behaviour unchanged; verify selection props |
| `components/datagrid/presentation.tsx` | `project-manager-v2/components/datagrid/presentation.tsx` | Copy | lucide icons | Palette tokens already aligned |
| `components/ProjectsBatchActionsPanel.tsx` | `project-manager-v2/components/ProjectsBatchActionsPanel.tsx` | Copy | shadcn `Button`, `Tooltip`, `BatchDeleteConfirmDialog` | Works with selection set from view |
| `components/BatchDeleteConfirmDialog.tsx` | `project-manager-v2/components/BatchDeleteConfirmDialog.tsx` | Copy | shadcn `Dialog`, `Input` | No compiler-specific changes |
| `components/ProjectsOverviewCard.tsx` | `project-manager-v2/components/ProjectsOverviewCard.tsx` | Copy | `react-icons/tb` | Informational UI |
| `components/DeleteProjectDialog.tsx` | `project-manager-v2/components/DeleteProjectDialog.tsx` | Copy | shadcn `Dialog`, `deleteProject`, `listProjects`, toast | Keep name confirmation flow |
| `components/EmptyProjectsState.tsx` | `project-manager-v2/components/EmptyProjectsState.tsx` | Copy | shadcn `Button`, lucide `Plus` | Visual only |
| `components/wizard/CreateProjectWizard.tsx` | `project-manager-v2/components/wizard/CreateProjectWizard.tsx` | Copy | `useProjectWizard`, shadcn `Dialog` | Dependent on refactored hook |
| `components/wizard/state/useProjectWizard.ts` | `project-manager-v2/components/wizard/state/useProjectWizard.ts` | Refactor | Tauri IPC (project creation), `useActionState`, `useTransition` | Remove redundant memoization, ensure compiler-safe patterns |
| `components/wizard/steps/*` | `project-manager-v2/components/wizard/steps/*` | Refactor-light | `useProjectWizard` data, `useMemo` derived arrays | Replace `useMemo` with pure helpers where feasible |
| `components/wizard/utils/*` | `project-manager-v2/components/wizard/utils/*` | Copy | Local utility exports | Already pure |
| `hooks/useSidebarTwoContentSync.tsx` | `project-manager-v2/hooks/useSidebarTwoContentSync.tsx` | Refactor | Layout store API, `ProjectsBatchActionsPanel`, `ProjectsOverviewCard` | Confirm Set-based API compatibility, potential to memoize derived arrays via helpers |
| `utils/filterProjects.ts` | `project-manager-v2/utils/filterProjects.ts` | Refactor | `ProjectListItem` typing, date math | Single filtering pass reused between view/content |
| `types/types.ts` | `project-manager-v2/types/types.ts` | Copy | `@/ipc` types | May expand with discriminated unions later |
| `css/*` | `project-manager-v2/css/*` | Copy | Imported via `../main-view.css` | Keep references identical for now |

## Outstanding Questions
- Confirm whether additional shared helpers (e.g., `ProjectsTableSkeleton`) should be consumed from existing paths or duplicated under v2.
- Decide on export surface: consider `src/features/project-manager-v2/index.ts` to toggle between legacy and modernized view when ready.

## Next Actions
- Use this matrix while copying files to ensure status (refactor vs copy) stays aligned.
- Update when new dependencies emerge during refactor work.
