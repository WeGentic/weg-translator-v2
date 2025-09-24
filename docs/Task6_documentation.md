# Task 6 Documentation — ScreenGuard Consolidation

## Scope
- Alias the existing resolution guard to a layout-scoped `ScreenGuard` export.
- Ensure only one guard instance wraps the router entry point.

## Key Changes
- `src/app/layout/screen-guard.ts`
  - Re-exports `ResolutionGuard` as `ScreenGuard` for consistent naming across layout modules.
- `src/main.tsx`
  - Switches to the alias and keeps the guard as the sole root-level usage.

## Validation
- Verified no other modules import `ResolutionGuard` directly (code search). Dev server launch remains blocked by sandbox (`listen EPERM ::1:1420`).
