# Task 4 Documentation — MainLayout Compound Shell

## Objective
Deliver a reusable layout skeleton with pinned header/footer, a four-mode side rail, configurable background, and a scrollable content pane, while allowing routes to supply their own chrome elements.

## Implementation Summary
- **Per-layout store (`src/app/layout/layout-store.ts`)**
  - Tracks region state (mounted, visible, dimensions) and the actual React nodes for header, footer, and sidemenu (`setHeaderContent`, etc.).
  - Exposes `cycleSidemenu()` to step through `expanded → compact → hidden` while keeping the rail mounted.
  - `reset()` clears both structural state and content to guarantee predictable tear-down between routes.
- **Layout shell (`src/app/layout/MainLayout.tsx`)**
  - Renders a 3×2 CSS grid pinned to `h-screen`; header/footer rows reserve space only when visible, side rail width follows store-provided dimensions.
  - `Main` is the only scrollable region (`overflow-y-auto`), keeping header, footer, and sidebar fixed.
  - Region components (`Header`, `Sidemenu`, `Footer`, `Background`) consume store state and fall back to stored content when no children are supplied.
  - `useLayoutSelector` / `useLayoutActions` are exported to encapsulate store access for consumers.
- **Workspace route (`src/features/workspace/WorkspacePage.tsx`)**
  - Exemplifies dynamic injection: pushes gradient background, `AppHeader`, `AppSidebar`, and `WorkspaceFooter` into the layout via actions, leaving only the workspace body in the scrolling pane.
  - Re-uses existing workspace logic (projects, editors, settings) without reintroducing layout params in the main content.
- **Login route (`src/routes/login.tsx`)**
  - Demonstrates hiding chrome by clearing header/footer/sidemenu content and mounting only the animated background.
- **Root route (`src/routes/__root.tsx`)**
  - Mounts the bare shell; child routes are responsible for providing region content.

## Behaviour Characteristics
- Header/footer heights default to 64/56 px but are overridable per route.
- Side rail honours `unmounted`, `hidden`, `compact`, and `expanded` states with store-configured widths; hidden/unmounted collapses the first column so the main pane spans the full width.
- Background sits behind the grid, accepts any React node, and honours visibility flags.
- Main content inherits a single vertical scrollbar; header/footer/sidebar remain pinned regardless of overflow.

## Validation
- `npm run test:run -- src/app/layout/layout-store.test.tsx`
  - Verifies store config merges, sidemenu cycling, content setters, and reset behaviour.
- Manual verification required (outside sandbox): ensure header/footer/sidebar remain fixed while the workspace body scrolls, and check login chrome suppression.

## Next Steps
- Reintroduce slot precedence helpers once more routes need to contribute multiple layers of content (e.g., stack header actions).
- Wire additional routes to the new pattern and remove legacy layout hooks once all consumers have migrated.
