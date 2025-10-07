# Sub-task 7.3 Documentation

## Summary
- Migrated Resources view, header, toolbar, and content into `src/modules/resources/view`, replacing the legacy `src/features/resources` directory.
- Updated module barrel and router wrapper to consume the relocated view, and adjusted workspace integration to import from the module namespace.
- Consolidated the shared `main-view.css` under `src/shared/styles/main-view.css` so dashboard, projects, and resources share a single source.

## Verification
- Grepped for `@/features/resources` to ensure only documentation references remain.
- Confirmed `src/router/routes/resources/index.tsx` renders the module route wrapper and workspace view renders successfully under the module path (static analysis / type checks pending Task 10).

## Follow Ups
- When resources gains IPC/service logic, create dedicated `ipc/` or `services/` folders under the module to house those concerns.
- Revisit resources UI after module migrations to ensure styling aligns with the shared main-view stylesheet.
