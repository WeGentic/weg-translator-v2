# Subtask 2.1 – Event-Driven Refresh (Step 2.1.3)

## Scope
- Completed Step 2.1.3 by replacing interval-only polling with Tauri event notifications that keep the projects resource in sync.
- Ensured React 19 Suspense consumers subscribe/unsubscribe cleanly, even under StrictMode double-invocation.

## Implementation Highlights
- **Backend events**: Added `projects://updated` in `src-tauri/src/ipc/events.rs` with `ProjectsChangedPayload` emitted from create/delete/file mutation commands so the frontend is notified whenever list data changes.
- **Typed IPC listeners**: Extended `src/ipc/types.ts` and `src/ipc/events.ts` with `ProjectsChangedKind`/`onProjectsUpdated` helpers, providing a single source of truth for event names and payload typing.
- **Resource bridge**: Updated `src/features/project-manager-v2/data/projectsResource.ts` with a reference-counted event listener that refreshes cached queries on notifications and tears down subscriptions when no consumers remain.
- **Hook integration**: `useProjectsResource` now retains/releases the listener inside a `useEffect`, guaranteeing cleanup across Suspense mounts while exposing a stable API for downstream components.

## Decisions
- Chose to broadcast a single `projects://updated` event (with `kind` metadata) instead of multiple specialized events to keep backend changes minimal during v2 rollout.
- Kept refresh logic simple (full query revalidation) rather than optimistic mutation; future tasks can refine by inspecting `ProjectsChangedKind` for targeted updates once state stores land.
- Wrapped event logging in `import.meta.env.DEV` guards to avoid leaking diagnostics in production builds.

## Verification
- `cargo fmt` to normalize Rust formatting after command signature updates.
- `npm exec eslint src/ipc/events.ts src/ipc/types.ts src/features/project-manager-v2/data/projectsResource.ts src/features/project-manager-v2/data/useProjectsResource.ts` (passes; repo still has unrelated lint debt tracked separately).

## Follow-ups
1. Extend backend commands that mutate project metadata (e.g., settings rename, status changes) to emit the same event for parity.
2. Consider optimistic `mutateProjectsResource` helpers for deletion/creation once mutation actions migrate in Sub-task 2.2.
3. Add unit tests around the resource listener (Task 5.1) to ensure events trigger refresh exactly once per notification.
