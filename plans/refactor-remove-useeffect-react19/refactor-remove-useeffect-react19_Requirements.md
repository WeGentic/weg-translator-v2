# Requirements Document

## Introduction

This initiative refactors the Weg Translator Tauri frontend to eliminate every `useEffect` invocation and adopt React 19-first patterns (Actions, Resources, `useEffectEvent`, React Compiler-compatible state helpers). The scope spans shared providers, shell layout, domain hooks, and form workflows that currently rely on imperative effects for data fetching, subscriptions, or DOM integration. Success is measured by: (1) zero `useEffect` imports across `src/`, (2) feature parity for Supabase auth, project/translation management, and workspace UI, (3) measurable reduction in effect-derived race conditions or memory leaks, and (4) full regression test coverage running green (Vitest, end-to-end smoke). Out of scope: backend Rust/Tauri changes, Supabase schema modifications, or unrelated UI redesigns.

## Glossary

- **React 19 Patterns**: First-class primitives introduced or stabilized in React 19 (Actions, Resources, Server Components readiness, `useEffectEvent`, React Compiler).
- **Resource**: Declarative async data primitive (React 19 proposal) or equivalent abstraction that uses `use` for suspenseful reads.
- **Server Action**: Function invoked via React’s action system to perform mutations without client-side effects.
- **Event Store**: Client-side abstraction wrapping DOM/Tauri events exposed through `useSyncExternalStore` or similar to avoid manual effects.
- **Legacy Shell**: Existing `LegacyApp` layout retained for previews, located in `src/App.tsx`.

## Non-Functional Requirements (NFRs)

- **Performance**: Maintain or reduce time-to-interactive and avoid additional blocking suspense boundaries; new abstractions must be React Compiler-friendly.
- **Scalability**: Ensure new stores/resources support concurrent renders and future routing expansions without race conditions.
- **Reliability**: Provide deterministic cleanup semantics (no timers/listeners leaking across navigations).
- **Security & Privacy**: Preserve Supabase session handling and authentication flows without exposing sensitive logs.
- **Observability**: Logging pipelines (Tauri log stream, analytics) must remain intact with structured logs on failure paths.
- **Usability**: UI transitions, health indicators, and wizard flows must behave identically (or better) to current UX with improved responsiveness.

## Requirement 1

#### User Story: As a platform engineer, I want the core app providers and shell readiness flow to operate without `useEffect` so that bootstrapping remains deterministic under React 19 concurrent rendering.

#### Acceptance Criteria

1. `LogProvider`, `AuthProvider`, `AppErrorBoundary`, `useShellReadyEmitter`, and `main.tsx` contain no `useEffect` imports.
2. Log streaming attaches via an event/resource abstraction that guarantees unsubscribe on provider disposal without manual `cancelled` flags.
3. Supabase session hydration uses declarative resources or React Query, supporting suspense during initial load with fallback UI intact.
4. Shell readiness notifications emit through a retryable action/resource without manual timers managed by effects.
5. Error boundary reset logic leverages React 19 response cache or event APIs rather than effect-based state resets.
6. Vitest suites covering auth/logging pass without needing fake timers tied to effects.

### Priority & Complexity

- Priority: Must
- Complexity: High

## Requirement 2

#### User Story: As a localization PM, I need translation history, health monitors, and project data to refresh declaratively so that data stays accurate without effect-driven race conditions.

#### Acceptance Criteria

1. `useTranslationHistory`, `useSupabaseHealth`, `useAppHealth`, and related domain hooks use React Query or resources instead of local state + `useEffect`.
2. Polling logic is centralized (e.g., reusable scheduler) and configurable, with no direct `setInterval` inside components.
3. Subscriptions to Tauri IPC events leverage `useSyncExternalStore`/React Query invalidation rather than effect-managed refs.
4. Suspense fallbacks surface while async data resolves, replacing manual `isLoading` toggles.
5. Clearing/refresh actions expose typed server/client actions validated by existing unit tests.
6. No hook retains `isMountedRef` or `cancelled` flags for lifecycle safety.

### Priority & Complexity

- Priority: Must
- Complexity: High

## Requirement 3

#### User Story: As a UX engineer, I want DOM, media, and navigation subscriptions handled via reusable React 19-friendly stores so that UI responsiveness improves without effect boilerplate.

#### Acceptance Criteria

1. `useMediaQuery`, `usePrefersReducedMotion`, `useGlobalNavigationEvents`, layout controllers, and file-drop hooks expose `useSyncExternalStore`-powered APIs (or equivalent) instead of `useEffect`.
2. Global navigation events dispatch through a typed event bus with stable handlers (powered by `useEffectEvent` or event store) that integrate with TanStack Router.
3. Media query updates propagate immediately after viewport changes with no redundant re-renders.
4. File drop and Tauri window listeners clean up automatically when consumers unmount without explicit cleanup functions in components.
5. New abstractions include regression tests mocking event emission without relying on `act` to flush effects.
6. Legacy `LegacyApp` shell remains functional using the new subscription primitives.

### Priority & Complexity

- Priority: Must
- Complexity: Medium

## Requirement 4

#### User Story: As an interaction designer, I need page transitions and suspense overlays to coordinate via declarative state so that navigation feedback stays smooth without manual timers.

#### Acceptance Criteria

1. `PageTransitionProvider` and `TransitionSuspenseFallback` move to state machines/resources without `useEffect` for timer management.
2. Router lifecycle hooks rely on TanStack Router subscriptions or resource signals that handle concurrent navigations safely.
3. Transition timers (exiting/entering) leverage browser APIs abstracted behind request-driven schedulers and shut down automatically on unmount.
4. Suspense registrations/unregistrations work in concurrent mode with deterministic ordering.
5. Reduced-motion preference instantly disables transitions without waiting for effect cleanup.
6. Transition overlay unit tests cover enter/exit flows using deterministic mocks (no reliance on timers from effects).

### Priority & Complexity

- Priority: Should
- Complexity: Medium

## Requirement 5

#### User Story: As an onboarding specialist, I want auth and wizard forms to leverage React 19 Actions and event handlers so that validation and submission flows remain reliable without effect side channels.

#### Acceptance Criteria

1. Auth registration/recovery hooks (`useRegistrationForm`, `useRegistrationSubmission`, `useUserAccountDialog`, etc.) remove all `useEffect`.
2. Form state relies on `useActionState`, controlled inputs, or framework-provided event handlers with no manual DOM focus effects.
3. Address autocomplete, client wizard dialogs, and debounced validation use shared scheduler utilities rather than ad-hoc effects.
4. Supabase-driven status polls update via React Query invalidations or action responses.
5. Form components expose actionable error states and success toasts using the toast provider without effect-initiated side effects.
6. Existing E2E smoke flows (registration, client wizard) pass without additional flakiness.

### Priority & Complexity

- Priority: Should
- Complexity: High
