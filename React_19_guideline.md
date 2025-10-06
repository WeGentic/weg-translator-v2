# React 19 Code Contribution Guidelines

## Suspense-First Data Loading
- Model asynchronous reads as dedicated resource modules that own cache state, status flags, and timestamps; expose helper methods such as `refresh`, `invalidate`, and `mutate` instead of sprinkling `useEffect` fetches across components.
- Use the React 19 `use(promise)` pattern from a custom hook layered on `useSyncExternalStore` so components suspend on cold reads but stay interactive during background refreshes.
- Keep background revalidation non-blocking—reuse cached data and surface transient failures via explicit error fields that UI can inspect without forcing a new suspend.

## Boundary Composition
- Wrap Suspense-powered routes in paired Suspense + Error boundaries, deriving `resetKeys` from query inputs so retries clear stale state deterministically.
- Keep fallback UIs side-effect free, align them with the final layout (e.g., skeletons for shell/table zones), and expose retry affordances that call back into the resource helper API.

## Mutation Patterns
- Implement mutations with `useActionState` wrappers that accept both imperative payloads and `FormData`; expose a stable `run` callback so callers can integrate with `<form action>` or button handlers.
- Drive optimistic updates through shared resource helpers (`mutate`/`refresh`) and ensure rollback logic restores previous snapshots on failure before surfacing toast or error messaging.
- Combine `useActionState` with `startTransition` or `useTransition` when mutations should defer expensive UI updates, maintaining responsiveness under concurrent rendering.

## Event-Driven Consistency
- Prefer Tauri/IPC events or other push channels over polling; centralize listener registration with reference counting so Suspense mounts/unmounts cleanly under StrictMode.
- Type event payloads and expose subscribe/unsubscribe helpers from a single module to keep frontend consumers in sync with backend contracts.

## State & Configuration Hygiene
- Store shared view state (filters, sorting, selections) in dedicated providers/selectors; export static defaults and option catalogs from standalone modules so the React Compiler can treat them as immutable constants.
- Keep component hooks order-stable and avoid ad-hoc memoization—only introduce `useMemo`/`useCallback` when profiling shows regressions the compiler cannot eliminate.

## UI & Accessibility Standards
- Build UI on ShadCN primitives + TanStack integrations using centralized configuration (columns, cell actions) to prevent drift across shells, sidebars, and toolbars.
- Ensure interactive elements include appropriate ARIA roles/labels (`role="toolbar"`, `aria-live` summaries, focusable batch actions) and respect keyboard activation patterns.
- Use palette CSS variables (`--color-tr-*`) via Tailwind utilities to guarantee theming parity between legacy and v2 surfaces.

## Testing & Observability
- Pair new hooks with Vitest coverage that exercises success, failure, optimistic rollback, and Suspense fallback scenarios using deterministic mocks.
- Add UI-level tests that validate selection syncing, boundary retries, and mutation side effects; capture structured logs or screenshots for end-to-end runs executed against the real Tauri shell.

## Rollout & Guardrails
- Guard new feature areas behind remote-configurable flags with instant fallbacks; invalidate related Suspense caches when toggles change to avoid stale mixed-mode state.
- Maintain reversible data migrations and ensure optimistic writes degrade gracefully when a flag or updater rollbacks the client to a legacy implementation.

Adhering to these patterns keeps new code aligned with React 19’s compiler, Suspense, and concurrent rendering expectations while preserving reliability across the Tauri desktop environment.
