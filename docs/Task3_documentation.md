# Task 3 Documentation — Centralized Layout Store

## Key additions
- `src/app/layout/layout-store.ts`
  - Initializes layout state (header/footer visibility, sidemenu discriminated union, background config, slot map).
- Exposes granular selector hooks and typed action accessors directly via `useLayoutStore`.
  - Aligns with React 19 compiler guidance by avoiding manual memoisation hooks.
- `src/app/layout/MainLayout.tsx`
  - Consumes the layout store via the new context provider and compound components.
- `package.json` / `package-lock.json`
  - Adds `zustand@^5.0.8` dependency required for the shared store.

## Usage notes
- Selectors rely on Zustand’s `shallow` comparison where objects are returned to minimise re-renders.
- Slot updates are merged, so callers should provide partial slot payloads.
- Actions are typed as `this: void` to satisfy strict eslint rules and avoid accidental rebinding.
