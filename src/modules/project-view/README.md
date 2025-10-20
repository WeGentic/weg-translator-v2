# Project Overview Module

This feature module encapsulates the project workspace experience that was previously nested under `modules/projects`.

## Public API

- `ProjectViewRoute` — TanStack Router component that wires data loading, mutations, and the shared React context.
- `ProjectViewProvider` / `useProjectViewContext` — supplies the current project summary, bundle, and statistics to deeply nested UI.
- `ProjectView` / `ProjectViewPlaceholder` — workspace widgets rendered inside the Workspace shell.

## Responsibilities

- Keep the overview context in sync with backend mutations (file add/remove, role changes, conversion regeneration).
- Execute OpenXLIFF conversion plans and surface progress via the processing overlay.
- Provide presentation components (`views/`, `ui/components/`) that render project metadata, file tables, and quick stats.

## Integration Notes

- Consumers should import from `@/modules/project-view` instead of `@/modules/projects`.
- Project View defines its own layout wrapper (`ProjectViewLayout`) to avoid depending on Project Manager internals.
- Tests reside alongside their respective UI (`ui/__tests__`, `ui/components/files/__tests__`). Use `npm run test -- project-overview` to target them.
