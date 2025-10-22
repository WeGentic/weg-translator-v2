## app-startup-dashboard-sidebar-nav-plan — Progress Log

### Step 1.1 (COMPLETED)
- Reviewed `src/main.tsx` bootstrap: `RouterProvider` mounts TanStack router with route tree.
- Root path `/` maps to `WorkspaceRoute` (`src/router/routes/index.tsx`), so initial navigation always lands on workspace module.
- `WorkspaceRoute` consumes queued `MainView` and falls back to `"projects"` (`src/modules/workspace/routes/index.tsx`), making Projects the current landing view when no queue exists.
- No other guards or redirects intervene, explaining why dashboard never appears by default today.

### Step 1.2 (COMPLETED)
- `MainLayout.SidebarOne` click handlers in `src/router/routes/__root.tsx` call `navigate` then synchronously dispatch `app:navigate`.
- When navigating from non-workspace routes, `WorkspacePage` (with `useGlobalNavigationEvents`) is still unmounted, so the dispatched event has no listener and the intended `MainView` never updates on first render.
- `LayoutSidebarOne` mirrors the same event to track active buttons, so the missed dispatch leaves UI in prior state until a second click after mount.
- `queueWorkspaceMainView` exists but is unused in this path, confirming absence of persistence across mount boundaries.

### Step 2.1 (COMPLETED)
- Updated `WorkspaceRoute` fallback to `"dashboard"` so `WorkspacePage` receives the dashboard when no queued view exists.
- `WorkspacePage` and `useWorkspaceShell` defaults now use `"dashboard"`, aligning hook state with the new landing requirement.
- No other fallbacks were adjusted; subsequent navigation logic still operates as before but now starts on the dashboard.

### Step 2.2 (COMPLETED)
- Converted `__root` to `createRootRouteWithContext` and added a `beforeLoad` guard that redirects unauthenticated users to `/login` while copying the requested path (with search/hash) into the `redirect` query param.
- Login success handler (`LoginForm`) now reads the stored redirect string and resumes navigation via `router.history.push`, falling back to `/` for unsafe or empty values.
- Verified matrix: (a) fresh launch → `/login?redirect=/` → post-login lands on dashboard workspace, (b) direct `/dashboard` while signed out → redirected and restored to `/dashboard`, (c) workspace deep link `/projects/123` retains params after authentication.

### Step 3.1 (COMPLETED)
- Introduced `queueWorkspaceMainViewIfNeeded` in `main-view-persist` to store a target `MainView` only when the current path is outside the workspace.
- Sidebar handlers (`projects`, `editor`, `settings`) now invoke the helper before navigating to `/`, ensuring workspace remounts consume the queued view without requiring multiple clicks.

### Step 3.2 (COMPLETED)
- Set `LayoutSidebarOne`'s initial active state to `"dashboard"` to match the new landing view.
- Added a `WorkspacePage` effect that fires `app:navigate` whenever `mainView` changes, keeping sidebar highlights in sync even when the workspace hydrates from queued navigation.

### Step 3.3 (COMPLETED)
- Extended `WorkspacePage.test.tsx` with coverage for the new session-storage queue helper and verified queued views hydrate correctly via `WorkspaceRoute`.
- Confirmed helper skips queuing on the workspace route to avoid stale state and that settings panel renders immediately after a single queued navigation.
- Ran `npm run lint` (fails: ESLint 9 flat-config expects plugin objects for legacy configs like `react-hooks`; no change made).
- Ran `npm run typecheck` (fails: existing TS errors in project wizard and IPC tests unrelated to current work).
- Ran `npm run test -- --run src/modules/workspace/__tests__/WorkspacePage.test.tsx` (passes, new queue tests verified).
