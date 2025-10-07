# Sub-task 6.1 Documentation

## Summary
- Relocated TanStack Router file-based routes into `src/router/routes` and removed the legacy `src/routes` directory.
- Moved the generated route tree to `src/router/routeTree.gen.ts` and added `src/router/index.ts` so app/tests import `routeTree` via the router namespace.
- Updated Vite's TanStack Router plugin and TypeScript path aliases to target the new router directory.

## Verification
- Verified `main.tsx` compiles against the new `@/router` alias.
- Confirmed `tanstackRouter` plugin configuration references `src/router/routes` and regenerates `routeTree.gen.ts` in place (manual inspection).
- Adjusted tests to import route components from `@/router/routes/**` where necessary.

## Follow Ups
- Sub-task 6.2 will migrate domain-specific routes into their modules and prune legacy references as module work progresses.
- Consider adding a CI check ensuring the generated `routeTree.gen.ts` remains in sync after future module migrations.
