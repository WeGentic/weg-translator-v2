# Sub-task 7.5 Documentation

## Summary
- Created `src/modules/auth` with `components`, `routes`, and `hooks` folders to own the login surface and expose the `LoginForm` and `LoginRoute` primitives.
- Updated `src/router/routes/login.tsx` to consume the module route component, keeping TanStack Router's guard logic while delegating rendering to the auth module.
- Added a module-level `useAuth` hook wrapper and migrated `ResolutionGuard` into `src/shared/guards`, ensuring shared consumers import guards from a neutral namespace.

## Verification
- Grepped for `@/components/LoginForm` and `@/components/ResolutionGuard` to ensure only documentation references remain.
- Confirmed `src/router/routes/login.tsx` compiled against the module export and `LoginForm` references the module hook without circular imports.
- Manually inspected `src/app/shell/screen-guard.ts` to verify it re-exports `ResolutionGuard` from the shared guards entry point.

## Follow Ups
- Introduce dedicated auth service functions (`modules/auth/services`) once registration/forgot-password flows are defined.
- Add integration tests for the login route after test suite re-organization (Task 8) to cover redirects and error handling.
