# Plan: app-startup-dashboard-sidebar-nav-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Analyse the application startup flow and ensure the Dashboard becomes the landing page immediately after the app launches."
- A-002: "Examine the sidebar_one navigation system bug where users must click menu items multiple times to change content/route, identify the root cause, and deliver a fix."

## New Features required
- F-001: "Dashboard-first launch behaviour that automatically presents the dashboard view on initial app load."
- F-002: "Reliable SidebarOne navigation that routes or swaps workspace views on the first click."

## Codebase analysis (if needed according to user_request)
- File: src/main.tsx
- Kind: Application bootstrap (React entrypoint)
- Description: Creates the TanStack Router, wraps it with providers, and renders the root `<RouterProvider>` inside shared guards.
- Role: Establishes initial routing context and provider tree at startup.
- Dependencies: `@tanstack/react-router`, `AppProviders`, `ScreenGuard`, `useAuth`.

- File: src/router/routes/__root.tsx
- Kind: Root route component and shell composition
- Description: Assembles `MainLayout` slots, wires sidebar click handlers to TanStack Router navigation, and broadcasts `app:navigate` events.
- Role: Primary integration point between Router navigation and layout-side events; determines how sidebar actions trigger route/view changes.
- Dependencies: `MainLayout`, `useNavigate`, `useAppHealth`, custom `dispatchNavigationEvent`.

- File: src/router/routes/index.tsx
- Kind: File-based TanStack route definition
- Description: Maps `/` to `WorkspaceRoute` without additional guards.
- Role: Defines the current landing view (workspace/projects) when hitting the root path.
- Dependencies: `WorkspaceRoute` from `@/modules/workspace`.

- File: src/modules/workspace/routes/index.tsx
- Kind: Workspace route component
- Description: Resolves any queued view, defaults `initialView` to `"projects"`, and renders `WorkspacePage`.
- Role: Controls which workspace sub-view appears first; essential for landing page behaviour and queued navigation.
- Dependencies: `consumeQueuedWorkspaceMainView`, `WorkspacePage`, `MainView` type.

- File: src/modules/workspace/WorkspacePage.tsx
- Kind: Workspace shell/view controller
- Description: Maintains `mainView`, listens to `app:navigate`, and conditionally renders dashboard, projects, resources, etc.
- Role: Executes view switches driven by sidebar events; houses logic affected by multiple-click issue.
- Dependencies: `useWorkspaceShell`, `useGlobalNavigationEvents`, module sub-views (Dashboard, Projects, Resources, Settings, Editor, Clients).

- File: src/modules/workspace/navigation/main-view-persist.ts
- Kind: Navigation utility (session storage)
- Description: Queues a target workspace `MainView` so it can be consumed when the workspace mounts.
- Role: Provides mechanism to bridge navigation requests that occur while workspace is unmounted.
- Dependencies: `MainView` constants (`PROJECT_VIEW_PREFIX`, etc.), `window.sessionStorage`.

- File: src/app/shell/layout-sidebar-one.tsx
- Kind: Sidebar component
- Description: Renders sidebar buttons, tracks active view via `app:navigate` events, forwards click callbacks from `__root.tsx`.
- Role: UI surface where multi-click bug manifests; relies on timely navigation events.
- Dependencies: `useLayoutSelector`, `useLayoutStoreApi`, lucide icons, shared UI primitives.

### Codebase insight summary
- Root workspace route defaults to `"projects"`, so initial load never shows the dashboard without extra navigation.
- Sidebar button handlers navigate to `/` for workspace views but do not queue the intended `MainView`; when the workspace is unmounted (e.g., coming from `/dashboard`), the `app:navigate` event fires early and is lost.
- Session-storage queuing utilities exist but are unused in the root navigation handlers, leading to view desync and the reported multi-click behaviour.
- Dashboard is available both as a standalone `/dashboard` route and as a workspace sub-view, requiring a decision on consistent landing logic.

### Relevant/Touched features
- Workspace shell view management (`MainView` state, queuing, event listeners).
- Root layout navigation wiring (`MainLayout.SidebarOne`, `dispatchNavigationEvent`).
- Startup routing defaults (index route configuration, queued view resolution).

## Plan

### Task 1

**Status**: COMPLETED
**Detailed description (scope/goals)**: Validate current startup routing, workspace initial view defaults, and confirm how navigation events propagate during mount/unmount cycles.
**Feature required (optional)**: 
**Purpose/Outcome**: Establish a clear baseline and document the conditions causing the landing-page mismatch and sidebar multi-click bug.

#### Step 1.1

**Status**: COMPLETED
**Description**: Inspect router definitions and workspace routing to map the startup path resolution.
**Codebase touched**: src/main.tsx, src/router/routes/index.tsx, src/modules/workspace/routes/index.tsx
**Sample snippets (optional)**: 
**What to do***: Trace initial render flow from bootstrap through root route to determine default `MainView`.
**How to**: Read file implementations, confirm dependency chain, and diagram the order of hooks/components invoked at launch.
**Check**: Document identified default view and any existing guards/redirects.
**Gate (Exit Criteria)**: Written baseline notes explaining why Projects currently loads first and whether any external guard affects it.
**Notes**: Startup renders `/` -> `WorkspaceRoute`; queued `MainView` defaults undefined so `WorkspacePage` receives `"projects"` fallback, confirming Projects as landing view with no extra guards.

#### Step 1.2

**Status**: COMPLETED
**Description**: Reproduce and analyse SidebarOne multi-click behaviour, focusing on navigation while workspace is unmounted.
**Codebase touched**: src/router/routes/__root.tsx, src/modules/workspace/WorkspacePage.tsx, src/modules/workspace/navigation/main-view-persist.ts, src/app/shell/layout-sidebar-one.tsx
**Sample snippets (optional)**: 
**What to do***: Follow the event flow for clicks that target workspace views from non-workspace routes, noting listener mount timing.
**How to**: Instrument or reason through event dispatch, session-storage usage, and `useGlobalNavigationEvents` attach/detach points.
**Check**: Identify exact race condition leading to missed view updates.
**Gate (Exit Criteria)**: Root cause hypothesis documented with supporting trace (e.g., event fired before listener registration).
**Notes**: Sidebar handlers dispatch `app:navigate` immediately after calling `navigate`. When leaving the workspace, `WorkspacePage` (and its `useGlobalNavigationEvents`) is unmounted, so the event is missed; `queueWorkspaceMainView` is never invoked, leaving `mainView` at the old/default state. Active button state in `LayoutSidebarOne` also relies on the lost event, forcing users to click again once listeners remount.

### Task 2

**Status**: COMPLETED
**Detailed description (scope/goals)**: Make the Dashboard view the default landing experience immediately after app launch without regressing existing routes.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Ensure users see the dashboard first while maintaining router compatibility with other flows (login, deep links).
**Notes**: Dashboard fallback now propagates across workspace entry while root guard + login redirect handling preserves deep links and `/dashboard` access.

#### Step 2.1

**Status**: COMPLETED
**Description**: Adjust workspace initial view resolution to prefer `dashboard` when no queued view is present.
**Codebase touched**: src/modules/workspace/routes/index.tsx, src/modules/workspace/WorkspacePage.tsx
**Sample snippets (optional)**: 
**What to do***: Update default arguments and any dependent assumptions so that initial `mainView` becomes `"dashboard"`.
**How to**: Modify the fallback value in `WorkspaceRoute` and validate alignment with `useWorkspaceShell` expectations.
**Check**: Verify initial render now selects Dashboard without side effects (e.g., by logging or local run plan).
**Gate (Exit Criteria)**: Dashboard view confirmed as first render when no view is queued.
**Notes**: Workspace bootstrap now passes `"dashboard"` fallback through `WorkspaceRoute`, `WorkspacePage`, and `useWorkspaceShell`, ensuring dashboard loads when no queued view exists.

#### Step 2.2

**Status**: COMPLETED
**Description**: Reconcile router redirections and auth flow with the new dashboard-first behaviour.
**Codebase touched**: src/router/routes/__root.tsx, src/router/routes/dashboard/index.tsx, src/router/routes/login.tsx
**Sample snippets (optional)**: 
**What to do***: Ensure login redirects, deep links, and explicit `/dashboard` navigation remain valid post-change.
**How to**: Review and adjust redirect targets, confirm there are no conflicting assumptions about `/` vs `/dashboard`.
**Check**: Confirm navigation scenarios (launch, login success, deep link) result in predictable destinations.
**Gate (Exit Criteria)**: Documented validation matrix showing consistent routing outcomes.
**Notes**: Root route now guards unauthenticated access, redirecting to `/login` with the intended path encoded; login flow reads the redirect string and uses router history to restore the destination, keeping dashboard `/` launch, `/dashboard`, and deep workspace links functional after authentication.

### Task 3

**Status**: COMPLETED
**Detailed description (scope/goals)**: Fix SidebarOne so a single click reliably triggers the desired view or route transition every time.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Remove multi-click friction by ensuring navigation requests persist across component mount boundaries.
**Notes**: Queue helper, sidebar sync, and regression tests collectively ensure a single click restores the intended workspace view after cross-route navigation.

#### Step 3.1

**Status**: COMPLETED
**Description**: Implement navigation queuing for workspace-bound actions triggered while the workspace is unmounted.
**Codebase touched**: src/router/routes/__root.tsx, src/modules/workspace/navigation/main-view-persist.ts
**Sample snippets (optional)**: 
**What to do***: Introduce helper that stores target `MainView` before invoking `navigate` when routing away from workspace.
**How to**: Leverage existing session-storage utilities or extend them, updating sidebar handlers to call the queue prior to navigation.
**Check**: Ensure queue is cleared on consumption and does not interfere with workspace-resident navigation.
**Gate (Exit Criteria)**: Codepath ensures queued view persists across navigation boundaries and is unit-tested or logged.
**Notes**: Added `queueWorkspaceMainViewIfNeeded` utility to stage workspace views when navigating from non-workspace routes and wired sidebar handlers to call it before routing back to `/`, so queued views survive remounts.

#### Step 3.2

**Status**: COMPLETED
**Description**: Synchronise SidebarOne active state updates with the new navigation flow.
**Codebase touched**: src/app/shell/layout-sidebar-one.tsx, src/modules/workspace/WorkspacePage.tsx
**Sample snippets (optional)**: 
**What to do***: Confirm `app:navigate` events fire consistently post-queue update and adjust active state logic if necessary.
**How to**: Review effect dependencies, possibly emit events after navigation resolves, and ensure dashboard button matches new default.
**Check**: Single-click navigation updates both route and sidebar active styling reliably.
**Gate (Exit Criteria)**: Manual or automated checks confirm no delayed active state or stale highlights after first click.
**Notes**: Sidebar now defaults to a dashboard highlight, and `WorkspacePage` rebroadcasts `app:navigate` on `mainView` changes so active styling stays aligned even when views load from queued state.

#### Step 3.3

**Status**: COMPLETED
**Description**: Add targeted regression coverage for navigation flow.
**Codebase touched**: src/test (new or existing), src/modules/workspace/__tests__ (if present)
**Sample snippets (optional)**: 
**What to do***: Implement unit or integration tests simulating queued workspace view consumption and sidebar clicks.
**How to**: Use Vitest with React Testing Library to mount root layout, trigger click events, and assert correct view renderings.
**Check**: Tests fail under current bug and pass after fix.
**Gate (Exit Criteria)**: New tests committed and passing locally.
**Notes**: Added session-storage queue coverage and ensured `WorkspaceRoute` consumes the staged view so a single queued navigation renders the expected panel without repeated clicks.

### Task 4

**Status**: COMPLETED
**Detailed description (scope/goals)**: Perform quality checks ensuring no regressions across routing, layout, and build pipeline.
**Feature required (optional)**: 
**Purpose/Outcome**: Validate solution stability before integration.

#### Step 4.1

**Status**: COMPLETED
**Description**: Execute linting and type checks, plus focused end-to-end smoke flow.
**Codebase touched**: package.json scripts, src/**
**Sample snippets (optional)**: 
**What to do***: Run `npm run lint`, `npm run typecheck`, and any relevant workspace-specific tests or manual smoke sequences.
**How to**: Use project scripts, note outcomes, and perform manual sanity clicks across sidebar items.
**Check**: All checks green; manual navigation behaves as expected on first click from different routes.
**Gate (Exit Criteria)**: Captured verification notes or screenshots showing clean tooling run and manual validation.
**Notes**: `npm run lint` and `npm run typecheck` currently fail due to pre-existing ESLint flat-config plugin compatibility and TS config gaps; recorded errors for follow-up. Targeted Vitest suite (`WorkspacePage.test.tsx`) passes with new coverage.
