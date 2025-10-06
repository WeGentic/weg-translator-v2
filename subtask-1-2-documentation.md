# Sub-task 1.2 Documentation — React 19 Compiler Readiness

Date: 2025-02-14

## Scope
Validate that the Project Manager workspace is ready for the React 19 compiler tooling and catalogue existing manual memoization hooks for later optimization decisions.

## Tooling Verification
- **Dependencies**: `react@19.1.1`, `react-dom@19.1.1`, `babel-plugin-react-compiler@19.1.0-rc.3`, `eslint-plugin-react-compiler@19.1.0-rc.2` already declared in `package.json`.
- **Build pipeline**: `vite.config.ts` registers the React compiler Babel plugin via `@vitejs/plugin-react` ensuring transformations during dev and build.
- **Linting**: `eslint.config.js` enables the `react-compiler/react-compiler` rule at `error` level, alongside updated React Hooks linting.
- **TypeScript**: `tsconfig.json` set to `jsx: "react-jsx"` with strict mode and bundler resolution, aligning with React 19 requirements.
- **Optional**: consider wiring `npx react-compiler-healthcheck` into CI to continuously flag incompatible patterns.

## Memoization Inventory Highlights
- **ProjectManagerView.tsx**: one `useMemo` (`visibleProjects`) and multiple `useCallback` handlers (loading, selection, dialog control). These wrappers appear removable once compiler handles stability.
- **ProjectManagerContent.tsx**: repeated `useMemo` chains for filtering, mapping, and column creation; duplicates top-level filtering logic.
- **ProjectManagerToolbar.tsx**: small derived booleans memoized; candidates for inline calculations.
- **DeleteProjectDialog.tsx**: button disabled flag via `useMemo` with minimal cost.
- **Wizard files** (`CreateProjectWizard`, `useProjectWizard`, step components): numerous `useCallback`/`useMemo` usages around state machine helpers and derived display data; to be reviewed when porting to `project-manager-v2`.
- **Across module**: no `React.memo` usage detected, simplifying modernization.

## Risks / Considerations
- Removal of memoization must preserve Set identity expectations (sidebar sync) and TanStack table behaviour; tests needed post-refactor.

## Next Steps
Move to Sub-task 1.3 to define the migration layout, file mapping, and dependency matrix for the new `project-manager-v2` module.
