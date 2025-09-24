# Task 8 Documentation — Store-driven Layout Components

## Scope
- Update header, sidebar, and footer components to consume shared layout state/actions.
- Remove legacy prop plumbing in favour of shared context/store usage.

## Key Changes
- `src/components/layout/header/AppHeader.tsx`
  - Derives sidemenu toggle label/icon without `useMemo`, consuming the store directly.
- `src/components/layout/sidebar/AppSidebar.tsx`
  - Reads `SidemenuState` from the store and adapts rendering for compact/hidden modes automatically.
- `src/components/layout/footer/WorkspaceFooter.tsx`
  - Uses store actions to collapse/expand the footer slot.

## Validation
- Covered indirectly via `layout-store` tests; manual UI check pending due to dev server restrictions.
