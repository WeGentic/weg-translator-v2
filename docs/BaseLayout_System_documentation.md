# Base Layout Skeleton — Delivery Notes

## Overview
- Replaced the previous slot-driven shell with a minimal five-region grid (background, header, sidemenu, main, footer).
- Header/Footer: fixed heights (64px/56px by default), pinned to the top/bottom rows without extra padding, and render with transparent chrome so the background layer always bleeds through.
- Sidemenu: supports four modes (`unmounted`, `hidden`, `compact`, `expanded`) with configurable widths and a transparent surface to match the chrome.
- Main content: occupies the remaining grid cell, scrolls vertically when content overflows, and exposes a transparent background so upstream surfaces can show through when desired.
- Background: optional layer rendered behind everything via mount/visible flags.

## Architecture Overview
- Core layout primitives (`MainLayout.Root`, `Header`, `Sidemenu`, `Main`, `Footer`, `Background`, `Controller`) live under `src/app/layout/MainLayout.tsx`. The shell renders a 3×2 CSS grid that is pinned to `h-screen`; header/footer occupy the first and third rows, the side rail the first column, and the main region fills the remaining cell. Only the main region can scroll (`overflow-y-auto`); the other bands stay fixed.
- Each layout region is controlled by a per-layout Zustand store (`src/app/layout/layout-store.ts`). The store tracks mount/visibility metadata (e.g., height, widths) **and** the React nodes that should fill each slot. Components update the store through `useLayoutActions`, and consumer routes read state through `useLayoutSelector`.
- `MainLayout.Controller` provides a declarative way to set defaults (e.g., hide the chrome on the login route) by calling `applyConfig` on the store whenever a route is mounted.

## Content Injection Pattern
| Region | Setter | Typical usage |
| --- | --- | --- |
| Header | `setHeader` + `setHeaderContent` | `WorkspacePage` mounts `AppHeader`, while login clears the header entirely. |
| Sidemenu | `setSidemenu` + `setSidemenuContent` | Workspace injects `AppSidebar` and defines compact/expanded widths; login sets `mode: hidden`. |
| Footer | `setFooter` + `setFooterContent` | Workspace mounts `WorkspaceFooter`; routes that want an empty footer leave content unset. |
| Background | `setBackground` | Workspace pushes the brand gradient, login pushes a custom animated background. |
| Main | children | Routes render their main view inside `MainLayout.Main` (workspace renders the projects/editor stack; login renders the form). |

Because the shell stores the React node per region, layout components do **not** render header/footer/sidebar markup inside the scrollable main area. This keeps the chrome fixed while allowing routes to swap content dynamically.

## Key Files
- `src/app/layout/layout-store.ts`: Store definition, merge helpers, `cycleSidemenu()`, and content setter actions (`setHeaderContent`, etc.).
- `src/app/layout/MainLayout.tsx`: Grid shell that reads store state to decide when to reserve space, render content, or collapse regions; `Main` wraps its children in `overflow-y-auto` so only the content scrolls.
- `src/app/layout/backgrounds/BlankBackground.tsx`: Provides a neutral, customizable canvas for routes that want a blank backdrop without gradients.
- `src/features/workspace/WorkspacePage.tsx`: Example consumer that injects header/sidemenu/footer/background content and renders only main workspace panes.
- `src/routes/login.tsx`: Shows how to opt out of chrome while using the same layout helpers.

## Behaviour Summary
- Header/Footer: fixed pixel heights (default 64/56). When `visible` is false they still take part in the grid (0px reserved) but no content renders. Both regions intentionally stay background-transparent to avoid masking the shared background layer.
- Sidemenu: modes cycle `expanded → compact → hidden` via header toggle; widths come from store; when hidden/unmounted the first column collapses and the main column spans the full width.
- Main: fills the remaining cell and scrolls independently; top/bottom chrome stay pinned, and the main surface remains transparent unless a route explicitly opts in to a surface color.
- Background: attaches to a full-screen absolute layer (`pointer-events-none`), set per route.

## Working with the System
1. Inside a route component, set defaults with `<MainLayout.Controller config={...} />` if required.
2. Use `useLayoutActions` to push content into header/sidemenu/footer/background on mount, and clean up in `useEffect` return handlers.
3. Render your page body exclusively inside `MainLayout.Main` (or let your route component return the page content when the shell is already set up, as with `WorkspacePage`).
4. To hide chrome at runtime, call the corresponding setter (`setHeader({ visible: false })` etc.); the layout automatically collapses the space and the sidebar remains full-height between whatever chrome is still visible.

## Next Steps
- Reintroduce slot/slot-precedence logic once the base container is approved.
- Layer route-driven configuration helpers (e.g., staticData adapters) on top of the current `Controller` primitive.
- Wire real header/footer/sidebar/main implementations using this skeleton.
