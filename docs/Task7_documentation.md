# Task 7 Documentation — Route Migration to Shared Layout

## Scope
- Migrate workspace and login routes to the new layout system.
- Simplify `__root` route to delegate shell rendering to `MainLayout`.

## Key Changes
- `src/routes/index.tsx`
  - Points to `WorkspacePage` and seeds layout defaults via `staticData.layout`.
- `src/routes/login.tsx`
  - Hides structural chrome and injects the animated background through layout config.
- `src/routes/__root.tsx`
  - Renders `MainLayout.Root` as the route wrapper with content boundary handled inside the layout.

## Validation
- Static route configuration inspected; UI smoke test blocked by sandbox, pending manual run once dev server access is available.
