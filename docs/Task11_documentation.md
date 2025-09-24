# Task 11 Documentation — React 19 Performance Pass

## Scope
- Remove legacy memoisation from layout components and rely on React Compiler.
- Tighten Zustand selector usage to minimise re-renders, adding equality helpers where appropriate.

## Key Changes
- `src/components/layout/header/AppHeader.tsx`
  - Drops `useMemo` in favour of straightforward toggle mapping constants.
- `src/app/layout/layout-store.ts`
  - Annotates selector hooks and applies `useShallow` for object selections; exposes typed selectors.
- `src/app/layout/sidemenu.ts`
  - Shares `sidemenuEquals` for layout effects needing equality checks.

## Validation
- `npm run test:run -- src/app/layout/layout-store.test.tsx`
  - Confirms sidemenu cycling and slot selector shallow equality behaviour.
