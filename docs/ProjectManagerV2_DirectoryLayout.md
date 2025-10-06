# Project Manager v2 Directory Layout

## Objectives
- Keep the legacy `src/features/project-manager` module untouched while building v2 in parallel.
- Provide a predictable file system structure for the React 19 refactor so contributors can work in parallel without collisions.
- Co-locate resources, actions, and UI surfaces to align with Suspense-first data flow and the React Compiler.

## Target Directory Tree
```
src/features/project-manager-v2/
- index.ts
- ProjectManagerRoute.tsx
- shell/
  - ProjectManagerShell.tsx
  - layout/
    - ProjectManagerLayout.tsx
  - header/
    - ProjectManagerHeader.tsx
  - toolbar/
    - ProjectManagerToolbar.tsx
  - footer/
    - ProjectManagerFooter.tsx
  - boundaries/
    - ProjectsBoundary.tsx
    - ProjectsError.tsx
    - ProjectsSkeleton.tsx
- content/
  - ProjectManagerContent.tsx
  - EmptyProjectsState.tsx
- data/
  - projectsResource.ts
  - useProjectsResource.ts
  - projectSelectors.ts
- state/
  - projectManagerStore.ts
  - filtersSlice.ts
  - selectionSlice.ts
- actions/
  - createProjectAction.ts
  - deleteProjectAction.ts
  - batchDeleteAction.ts
- mutations/
  - DeleteProjectDialog.tsx
- table/
  - ProjectsTableGrid.tsx
  - ProjectsDataTable.tsx
  - tableConfig.ts
  - columns.ts
  - presentation.ts
- sidebar/
  - SidebarController.tsx
  - useSidebarContentSync.ts
  - components/
    - ProjectsBatchActionsPanel.tsx
    - ProjectsOverviewCard.tsx
    - BatchDeleteConfirmDialog.tsx
- wizard/
  - CreateProjectWizard.tsx
  - hooks/
    - useProjectWizard.ts
  - steps/
    - ProjectDetailsStep.tsx
    - ProjectFilesStep.tsx
    - ProjectReviewStep.tsx
  - utils/
    - file-descriptor.ts
    - languages.ts
    - validation.ts
  - types.ts
- utils/
  - filterProjects.ts
- styles/
  - new-project-button.css
  - data-table.css
  - dropdowns.css
- types/
  - index.ts
  - table.ts
  - wizard.ts
- constants/
  - filters.ts
  - table.ts
```

## Legacy to v2 Path Mapping
| Legacy Path | Classification | v2 Target Path | Notes |
| --- | --- | --- | --- |
| `src/features/project-manager/ProjectManagerView.tsx` | Refactor | `src/features/project-manager-v2/shell/ProjectManagerShell.tsx` | Split into data loader + layout shell per Task 3.1; becomes Suspense entry point. |
| `src/features/project-manager/ProjectManagerHeader.tsx` | Copy-only | `src/features/project-manager-v2/shell/header/ProjectManagerHeader.tsx` | Copy unchanged; still triggers the create wizard. |
| `src/features/project-manager/ProjectManagerContent.tsx` | Refactor | `src/features/project-manager-v2/content/ProjectManagerContent.tsx` | Rewritten to consume selectors and Suspense resources. |
| `src/features/project-manager/ProjectManagerToolbar.tsx` | Refactor | `src/features/project-manager-v2/shell/toolbar/ProjectManagerToolbar.tsx` | Refactor to use centralized filter store and compiler-safe handlers. |
| `src/features/project-manager/hooks/useSidebarTwoContentSync.tsx` | Refactor | `src/features/project-manager-v2/sidebar/useSidebarContentSync.ts` | Modernize to consume selectors and Suspense-friendly effects. |
| `src/features/project-manager/components/ProjectsBatchActionsPanel.tsx` | Refactor | `src/features/project-manager-v2/sidebar/components/ProjectsBatchActionsPanel.tsx` | Slim component fed by new selection store and optimistic mutations. |
| `src/features/project-manager/components/DeleteProjectDialog.tsx` | Refactor | `src/features/project-manager-v2/mutations/DeleteProjectDialog.tsx` | Rebuilt around shared action-state helpers. |
| `src/features/project-manager/components/ProjectManagerFooter.tsx` | Copy-only | `src/features/project-manager-v2/shell/footer/ProjectManagerFooter.tsx` | Copy as-is to keep footer styling. |
| `src/features/project-manager/components/BatchDeleteConfirmDialog.tsx` | Copy-only | `src/features/project-manager-v2/sidebar/components/BatchDeleteConfirmDialog.tsx` | Copy; invoked by new batch delete action. |
| `src/features/project-manager/components/EmptyProjectsState.tsx` | Copy-only | `src/features/project-manager-v2/content/EmptyProjectsState.tsx` | Copy for reuse when resource returns zero rows. |
| `src/features/project-manager/components/ProjectsOverviewCard.tsx` | Refactor | `src/features/project-manager-v2/sidebar/components/ProjectsOverviewCard.tsx` | Streamline to read derived metrics from selectors. |
| `src/features/project-manager/components/datagrid/presentation.tsx` | Refactor | `src/features/project-manager-v2/table/presentation.ts` | Export static presentation helpers consumed by compiler-friendly columns. |
| `src/features/project-manager/components/datagrid/ProjectsTableGrid.tsx` | Refactor | `src/features/project-manager-v2/table/ProjectsTableGrid.tsx` | Adapt to controlled table instance and shared selection store. |
| `src/features/project-manager/components/datagrid/columns.tsx` | Refactor | `src/features/project-manager-v2/table/columns.ts` | Move to static column definitions with dependency-free handlers. |
| `src/features/project-manager/components/wizard/CreateProjectWizard.tsx` | Refactor | `src/features/project-manager-v2/wizard/CreateProjectWizard.tsx` | Uses new action-state flow and shared wizard store. |
| `src/features/project-manager/components/wizard/steps/ProjectDetailsStep.tsx` | Refactor | `src/features/project-manager-v2/wizard/steps/ProjectDetailsStep.tsx` | Rewired to consume selectors and validation helpers. |
| `src/features/project-manager/components/wizard/steps/ProjectFilesStep.tsx` | Refactor | `src/features/project-manager-v2/wizard/steps/ProjectFilesStep.tsx` | Refactored to use centralized file state and event hooks. |
| `src/features/project-manager/components/wizard/steps/ProjectReviewStep.tsx` | Refactor | `src/features/project-manager-v2/wizard/steps/ProjectReviewStep.tsx` | Pulls derived summary fields from wizard selectors. |
| `src/features/project-manager/components/wizard/types.ts` | Refactor | `src/features/project-manager-v2/wizard/types.ts` | Expanded with action-state status types and exported step metadata. |
| `src/features/project-manager/components/wizard/state/useProjectWizard.ts` | Refactor | `src/features/project-manager-v2/wizard/hooks/useProjectWizard.ts` | Consolidates optimistic actions and Suspense-safe transitions. |
| `src/features/project-manager/components/wizard/utils/file-descriptor.ts` | Copy-only | `src/features/project-manager-v2/wizard/utils/file-descriptor.ts` | Copy; utility remains unchanged. |
| `src/features/project-manager/components/wizard/utils/languages.ts` | Copy-only | `src/features/project-manager-v2/wizard/utils/languages.ts` | Copy static language catalogue. |
| `src/features/project-manager/components/wizard/utils/validation.ts` | Copy-only | `src/features/project-manager-v2/wizard/utils/validation.ts` | Copy; validation logic remains valid. |
| `src/features/project-manager/utils/filterProjects.ts` | Copy-only | `src/features/project-manager-v2/utils/filterProjects.ts` | Copy; reused by selectors and table formatting. |
| `src/features/project-manager/css/new-project-button.css` | Copy-only | `src/features/project-manager-v2/styles/new-project-button.css` | Copy to preserve button styling tokens. |
| `src/features/project-manager/css/data-table.css` | Copy-only | `src/features/project-manager-v2/styles/data-table.css` | Copy existing table styling. |
| `src/features/project-manager/css/dropdowns.css` | Copy-only | `src/features/project-manager-v2/styles/dropdowns.css` | Copy for toolbar dropdown visual consistency. |
| `src/features/project-manager/types/types.ts` | Refactor | `src/features/project-manager-v2/types/index.ts` | Refactor to expose normalized state types and surface contracts used across v2. |

## Additional Notes
- The `index.ts` entrypoint will expose the v2 shell while legacy routes continue importing from `project-manager`.
- `ProjectManagerRoute.tsx` will compose Suspense boundaries and feature-flag toggles without touching legacy exports.
- `actions/` contains async mutation wrappers shared between dialogs, toolbar buttons, and sidebar panels so optimistic updates stay consistent.
- `state/` holds the Zustand slices (or React context) used for filter and selection coordination per Task 3.2; no legacy stores are modified.
- CSS assets live under `styles/` to keep the copy-only files isolated and easy to delete when we transition fully to Tailwind-only styling.

## Copy-Only Migration Workflow (2025-02-15)
To keep the legacy module untouched while preparing v2 assets, copy-only files will be migrated with the following guardrails:

1. **Create mirrored folders first.** Materialize the destination folders under `src/features/project-manager-v2/*` before copying so Git history shows intent (e.g., `styles/`, `utils/`, `shell/footer/`). This prevents `cp` from flattening paths or inferring default casing.
2. **Use deterministic copy commands.** Apply `pnpm tsx scripts/copy-project-manager-assets.ts --mode=copy-only` (to be authored in Task 4) so each run copies files verbatim and verifies checksums. Until the script exists, use `rsync --checksum` with the paths enumerated below; never edit files in-place.
3. **Lock imports to v2 root.** After copying, update relative imports in the duplicated files to point inside `project-manager-v2` (e.g., `../utils/filterProjects` → `@/features/project-manager-v2/utils/filterProjects`). This avoids accidental coupling back to legacy helpers.
4. **Isolate CSS scope.** When copying CSS assets (`new-project-button.css`, `data-table.css`, `dropdowns.css`), prefix selectors with `.project-manager-v2` wrapper once the shell scaffolding exists. Until those wrappers land, keep the files untouched but mount them only within the v2 feature flag path to prevent bleed.
5. **Validate parity via smoke tests.** Load both legacy and v2 views in Storybook/preview with the feature flag toggled to confirm copied assets behave identically. This double-checks that assets remain read-only in the legacy tree.

### Copy-Only Asset Checklist
- `src/features/project-manager/components/ProjectManagerHeader.tsx` → `src/features/project-manager-v2/shell/header/ProjectManagerHeader.tsx`
- `src/features/project-manager/components/ProjectManagerFooter.tsx` → `src/features/project-manager-v2/shell/footer/ProjectManagerFooter.tsx`
- `src/features/project-manager/components/BatchDeleteConfirmDialog.tsx` → `src/features/project-manager-v2/sidebar/components/BatchDeleteConfirmDialog.tsx`
- `src/features/project-manager/components/EmptyProjectsState.tsx` → `src/features/project-manager-v2/content/EmptyProjectsState.tsx`
- `src/features/project-manager/components/wizard/utils/file-descriptor.ts` → `src/features/project-manager-v2/wizard/utils/file-descriptor.ts`
- `src/features/project-manager/components/wizard/utils/languages.ts` → `src/features/project-manager-v2/wizard/utils/languages.ts`
- `src/features/project-manager/components/wizard/utils/validation.ts` → `src/features/project-manager-v2/wizard/utils/validation.ts`
- `src/features/project-manager/utils/filterProjects.ts` → `src/features/project-manager-v2/utils/filterProjects.ts`
- `src/features/project-manager/css/new-project-button.css` → `src/features/project-manager-v2/styles/new-project-button.css`
- `src/features/project-manager/css/data-table.css` → `src/features/project-manager-v2/styles/data-table.css`
- `src/features/project-manager/css/dropdowns.css` → `src/features/project-manager-v2/styles/dropdowns.css`

Each item stays read-only post-copy; edits to v2 duplicates should never flow back to legacy files. This checklist will be used to validate the future copy script before Task 4 begins.
