# Task 10 Documentation — Accessibility & Responsiveness

## Scope
- Retain a single global screen guard while ensuring it blocks interactions below viewport thresholds.
- Reinstate semantic roles for layout regions and preserve ARIA attributes on navigation items.

## Key Changes
- `src/main.tsx`
  - Uses the new `ScreenGuard` alias as the sole guard instance.
- `src/app/layout/MainLayout.tsx`
  - Assigns `role="banner"`, `role="navigation"`, `role="main"`, and `role="contentinfo"` to compound regions.
- `src/app/layout/chrome/sidebar/AppSidebar.tsx`
  - Continues to expose `aria-current` and label semantics for nav items.

## Validation
- Static analysis of JSX roles and guard overlay; manual accessibility audit pending due to lack of runnable dev server.
