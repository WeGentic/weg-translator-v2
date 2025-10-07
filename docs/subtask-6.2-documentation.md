# Sub-task 6.2 Documentation

## Summary
- Added module-level route wrappers for workspace, dashboard, and resources under `src/modules/**/routes`, enabling the router to depend on module barrels instead of feature paths.
- Updated `src/router/routes/{index,dashboard,resources}.tsx` to import from the new module namespaces, keeping route definitions thin and ready for future module migrations.

## Verification
- Confirmed no remaining `@/features/*` imports inside `src/router/routes/**`.
- Ensured the generated `routeTree.gen.ts` still references the relocated route files (manual inspection after plugin configuration).

## Follow Ups
- When additional modules (projects auth, etc.) gain dedicated routes, extend the module barrels to expose loaders/actions as needed.
- Consider co-locating tests for router wrappers once module migrations for dashboard/resources complete.
