## Context & Objectives
- **Goal**: Plan the removal of every `useEffect` usage while adopting React 19 first-class primitives (Actions, Resources, `useEffectEvent`, Server Components-ready patterns, React Compiler friendly code).
- **Primary Stakeholders**: Frontend platform team, Desktop app engineers, QA automation, Product/Localization owners relying on stable translation workflows.
- **Success Criteria**: No remaining `useEffect` imports, feature parity across Tauri desktop shell, no regressions in Supabase-driven auth/project flows, measurable reduction in effect-related race conditions, regression test suite remains green.
- **Constraints**: Must comply with React 19+ guidance, keep compatibility with TanStack Router, React Query, and Tauri IPC bridges, respect existing modular folder structure, ensure changes remain under 300–500 LOC per file where possible.

## High-Level Architecture Snapshot
- **Framework Stack**: React 19.2 + Vite + TanStack Router, React Query, Zustand, Tailwind (via `@tailwindcss/vite`), Tauri 2 backend.
- **Providers**: `AppProviders` composes `LogProvider`, `AppErrorBoundary`, `QueryProvider`, `ToastProvider`, `AuthProvider`.
- **Routing**: `src/main.tsx` bootstraps TanStack router with `ScreenGuard`, `PageTransitionProvider`, `TransitionSuspenseFallback`.
- **State & Data**:
  - Supabase auth/profile state via `AuthProvider` (manual `useEffect` for session syncing, profile hydration, orphan detection).
  - React Query used sparingly (QueryClient wrapper) but many custom hooks still rely on manual effects.
  - IPC bridges under `src/core/ipc` returning Promises to hooks/components.
- **UI Composition**: Modules split into `modules/*` (workspace, projects, auth, wizards, history). Shell layout in `src/app/shell/*`.
- **Testing**: Vitest with RTL wrappers (tests exist for some hooks e.g., `useSupabaseHealth`).

## `useEffect` Inventory & Patterns
_Files containing `useEffect`: 55 (162 occurrences)._

### 1. **Shell & Providers**
- `src/main.tsx`, `src/app/providers/useShellReadyEmitter.ts`, `src/core/logging/LogProvider.tsx`, `src/app/providers/auth/AuthProvider.tsx`, `src/app/providers/errors/AppErrorBoundary.tsx`.
- **Use Cases**: Emitting readiness events to Tauri splash, attaching Tauri log streams, observing Supabase session changes, global error resets.
- **Risks**: Race conditions (retry timers, cleanup flags), reliance on imperative subscriptions, potential memory leaks if cleanups fail.

### 2. **Routing & Transition System**
- `src/shared/transitions/PageTransitionProvider.tsx`, `TransitionSuspenseFallback.tsx`, `layout-*` components.
- **Use Cases**: Router lifecycle subscriptions, suspense overlays, DOM class toggles for transitions.
- **Pain Points**: Heavy effect orchestration around timers and router events; difficult to reason about concurrency; not React Compiler friendly.

### 3. **Workspace & Navigation**
- `src/modules/workspace/WorkspacePage.tsx`, `useGlobalNavigationEvents.ts`, layout controllers/sidebars.
- **Use Cases**: Window resize listeners, custom `app:navigate` events, panel synchronization.
- **Observations**: Manual event listener setup/teardown; opportunity to migrate to `useSyncExternalStore` or event-channel abstractions.

### 4. **Data Fetching / Polling Hooks**
- `useTranslationHistory`, `useSupabaseHealth`, `useAppHealth`, `useWizardClients`, `useWizardDropzone`, `useClientsData`.
- **Use Cases**: Fetch on mount, subscribe to backend events, polling intervals.
- **Issues**: Re-implementing caching/loading logic instead of leveraging React Query/Resources or Server Actions. Complex `isMountedRef` logic to avoid race conditions.

### 5. **UI Utilities & Media Hooks**
- `useMediaQuery`, `usePrefersReducedMotion`, debounced value hooks, file-drop listeners, page resize watchers.
- **Use Cases**: Browser APIs requiring subscription (matchMedia, window events, file drop).
- **Concerns**: Need declarative replacements (e.g., `useSyncExternalStore`, `requestAnimationFrame` loops) that align with React 19 guidelines.

### 6. **Forms & Wizards**
- Auth registration forms, project wizard dialogs.
- **Use Cases**: Form validation side effects, focusing inputs, orchestrating multi-step workflows.
- **Note**: Many can migrate to React 19 Actions/Form state or component-local event handlers without effects.

## Technical Debt & Hotspots
- **Manual Lifecycle Guards**: Frequent `isMountedRef` and cleanup flags indicate effect-based concurrency issues.
- **Duplicated Patterns**: Polling logic repeated among health hooks; event subscription wrappers repeated across modules.
- **Intermixed Concerns**: Components mixing data fetching, DOM subscriptions, and state updates in single effect blocks.
- **Testing Fragility**: Tests referencing hook `useEffect` behavior (e.g., `useSupabaseHealth.test.tsx`) will need updates when migrating.
- **Missing Internal Docs**: Referenced `docs/react19-guidelines.md` absent—must validate expectations with stakeholders or recreate guidance.

## Assumptions & Open Questions
- **Assumption**: React Query or upcoming React 19 Resources are acceptable replacements for all asynchronous fetch/poll flows.
- **Assumption**: Tauri IPC APIs can be wrapped in declarative resources/actions without regression.
- **Unknowns**: Preferred approach for DOM event channel (custom store vs. external library). Requirements for legacy `LegacyApp` shell usage after refactor.
- **Need Verification**: Acceptable to introduce new helper utilities/store abstractions? Are there SSR constraints (likely none in Tauri but must confirm)? Can we rely on experimental `useActionState`/`useOptimistic` etc.?

## Recommended Focus Areas
1. **Catalog & Classify** every effect by type (subscription vs. fetch vs. timer) prior to refactor.
2. **Introduce Shared Primitives**: e.g., `createEventStore`, `createPollingResource`, `useDeferredTask` built on React 19 `use`/Actions to replace duplicated effect logic.
3. **Leverage React Query** for IPC-driven data (history, clients, settings) to remove bespoke effect-based state.
4. **Adopt React 19 Features**: Replace event handlers with `useEffectEvent`, convert async flows to Actions or TanStack Router loaders where feasible, depend on React Compiler-friendly patterns.
5. **Testing Strategy**: Update unit/integration tests to cover new abstractions (especially for event/polling replacements) and guard against regressions.

## Potential Risks
- **Regression Scope**: Removing effects touches nearly every module; risk of shipping partial updates without comprehensive testing.
- **Feature Coverage**: Some effect logic interfaces with backend (Supabase/Tauri). Need integration validation after migrating to new abstractions.
- **Concurrency Semantics**: React 19 concurrent rendering may surface hidden issues if replacements aren't concurrent-safe.
- **Timeline**: Large surface area (55 files). Requires phased delivery with clear feature flags or rollout strategy.

## Next Steps
- Validate assumptions with stakeholders (especially regarding experimental APIs).
- Define requirements & phases per domain (providers, data hooks, UI utilities).
- Draft design leveraging shared primitives and React 19 capabilities.
- Prepare migration & testing plan to ensure safe rollout.
