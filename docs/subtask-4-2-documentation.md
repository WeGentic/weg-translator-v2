# Sub-task 4.2 – Gather Shared Hooks And Utilities

## Completed scope
- Relocated generic React hooks (`useDebouncedValue`, `useFileDrop`, `useMediaQuery`, `useTauriFileDrop`) into `src/shared/hooks/` and added a shared barrel for consistent imports.
- Decoupled `useTauriFileDrop` from project-specific file extensions by requiring callers to pass accepted types, keeping the hook reusable across domains.
- Moved cross-cutting helpers (`cn`, date formatters, BCP-47 validator) into `src/shared/utils/` with focused modules and an index export to simplify consumption.
- Updated all application code, tests, and planning docs to reference the new shared paths and injected the project file extension list where needed.

## Verification
- `npx tsc --noEmit` *(fails on pre-existing workspace/type issues in legacy project-manager files and layout packages; no new errors introduced by the shared hook/utilities migration).* 

## Follow-up notes
- `src/lib/file-formats.ts` remains in place until the projects module migration moves it under `src/modules/projects`.
- Consider augmenting the shared hooks package with story-based usage examples once the workspace shell migration stabilises.
