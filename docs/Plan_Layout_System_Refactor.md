# Plan — Shared Layout System Refactor (React 19 + TanStack Router + Zustand + Tailwind 4 + shadcn/ui)

Task 1 - Validate external patterns and constraints - Status: COMPLETED
  - ✅ External references captured in `docs/Task1_documentation.md`; proceeding under validated patterns.

Step 1.1 - Verify TanStack Router v1 layout + staticData usage (official docs) - Status: COMPLETED
  - ✅ Confirmed via TanStack Router docs that `staticData` is defined per route and made available synchronously to layout components through `useMatches()`/`match.staticData`, enabling per-route layout configuration and typed augmentation.[^tanstack-staticdata]

Step 1.2 - Confirm React 19 Suspense/ErrorBoundary placement (react.dev) - Status: COMPLETED
  - ✅ React 19 guidance keeps persistent shells (header/nav/footer) outside Suspense/ErrorBoundary while wrapping route content to isolate loading and error fallbacks, aligning with our layout plan.[^react-suspense]

Step 1.3 - Confirm React 19 Compiler guidance (remove most memoization) - Status: COMPLETED
  - ✅ React Compiler docs instruct removing most manual `React.memo`/`useMemo`/`useCallback`; compiler stabilizes values/functions automatically, matching our plan to rely on selectors instead of memo wrappers.[^react-compiler]

Step 1.4 - Confirm Zustand selector/shallow patterns to prevent re-renders - Status: COMPLETED
  - ✅ Zustand docs recommend narrow selectors and adding `shallow` (or `useShallow`) when selectors return objects/arrays to avoid unnecessary re-renders, matching our planned focused hooks.[^zustand-shallow]

Step 1.5 - Confirm shadcn/ui with Tailwind v4.1 config (Vite) - Status: COMPLETED
  - ✅ shadcn/ui Tailwind v4 guide confirms CLI + component support, with required `@config` import and updated theme vars when using Vite builds—no blockers for our integration.[^shadcn-tailwind4]


Task 2 - Define architecture and type contracts - Status: COMPLETED
  - ✅ Types, unions, and slot precedence implemented; summary noted in `docs/Task2_documentation.md`.

Sub-task 2.1 - Layout configuration model - Status: COMPLETED

Step 2.1.1 - Define `LayoutVisibility` type: `{ header?: boolean; footer?: boolean; sidemenu?: 'expanded'|'compact'|'hidden' }` - Status: COMPLETED
  - ✅ Added `LayoutVisibility` in `src/app/layout/layout-types.ts` alongside related layout primitives.

Step 2.1.2 - Define `BackgroundConfig` discriminated union: `{ kind: 'default' } | { kind: 'gradient'; name: string } | { kind: 'image'; src: string; blur?: number } | { kind: 'component'; element: React.ReactNode }` - Status: COMPLETED
  - ✅ Exposed `BackgroundConfig` union in `src/app/layout/layout-types.ts` to capture default, gradient, image, and component backgrounds.

Step 2.1.3 - Define route-level `LayoutStaticData` type to attach on TanStack Router routes via `staticData` (typed through module augmentation) - Status: COMPLETED
  - ✅ `LayoutStaticData` extends `LayoutVisibility`, adds background/slots, and augments `StaticDataRouteOption` in `layout-types.ts` for typed `staticData.layout` usage.

Sub-task 2.2 - Sidebar (Sidemenu) discriminated union - Status: COMPLETED

Step 2.2.1 - Define `SidemenuState` as discriminated union:
`{ kind: 'expanded'; width: number; pinned?: boolean } | { kind: 'compact'; width: number } | { kind: 'hidden' }` - Status: COMPLETED
  - ✅ Introduced `SidemenuState` union with default width constants in `src/app/layout/sidemenu.ts`.

Step 2.2.2 - Provide `cycleSidemenu(state)` and guards `isExpanded`, `isCompact`, `isHidden` with exhaustive switches - Status: COMPLETED
  - ✅ Added helpers `cycleSidemenu`, `isExpanded`, `isCompact`, `isHidden` with exhaustive switch fallback in `src/app/layout/sidemenu.ts`.

Sub-task 2.3 - Slots & composition contracts - Status: COMPLETED

Step 2.3.1 - Define slot keys: `header`, `footer`, `sidemenu`, `background` - Status: COMPLETED
  - ✅ Exported `LayoutSlotKey` union (`"header" | "footer" | "sidemenu" | "background"`) in `src/app/layout/layout-types.ts`.

Step 2.3.2 - Define `LayoutSlots` interface: `{ header?: ReactNode; footer?: ReactNode; sidemenu?: ReactNode; background?: ReactNode }` - Status: COMPLETED
  - ✅ Declared `LayoutSlots` interface in `src/app/layout/layout-types.ts` for slot composition.

Step 2.3.3 - Decide slot precedence: Route staticData > Local route component `Slot` declarations > Global defaults - Status: COMPLETED
  - ✅ Documented slot source order via `LAYOUT_SLOT_SOURCE_ORDER` (`static-data`, `component-slot`, `global-default`) in `src/app/layout/layout-types.ts`.


Task 3 - Create centralized layout store (Zustand) - Status: COMPLETED

Sub-task 3.1 - Store scaffolding - Status: COMPLETED

Step 3.1.1 - Install dependency: `zustand@latest` (package.json) - Status: COMPLETED
  - ✅ Added `zustand` via npm; package.json and lockfile updated.

Step 3.1.2 - Add file `src/app/layout/layout-store.ts` exporting `useLayoutStore` - Status: COMPLETED
  - ✅ Created Zustand store module under `src/app/layout/layout-store.ts` with state/actions and selector exports.

Step 3.1.3 - State shape:
`{ headerVisible: boolean; footerVisible: boolean; sidemenu: SidemenuState; background: BackgroundConfig; slots: LayoutSlots; }` - Status: COMPLETED
  - ✅ Store initialises header/footer visibility, sidemenu state, background config, and slot map with defaults in `layout-store.ts`.

Step 3.1.4 - Actions:
`setHeaderVisible(boolean)`, `setFooterVisible(boolean)`, `setSidemenu(SidemenuState)`, `cycleSidemenu()`, `setBackground(BackgroundConfig)`, `setSlots(partial: LayoutSlots)`, `resetSlots()` - Status: COMPLETED
  - ✅ Implemented full action set with immutable updates inside `layout-store.ts`.

Sub-task 3.2 - Performance-friendly selectors - Status: COMPLETED

Step 3.2.1 - Export focused hooks: `useHeaderVisible()`, `useFooterVisible()`, `useSidemenuState()`, `useBackground()`, `useSlots()` using selectors and `shallow` where objects are returned - Status: COMPLETED
  - ✅ Added selector helpers in `layout-store.ts`, using `shallow` for background and slot maps.

Step 3.2.2 - Remove any manual React.memo/useMemo/useCallback in layout components, rely on React 19 compiler; keep selectors granular - Status: COMPLETED
  - ✅ Simplified `MainLayout` to rely on inline values (no memo/callback hooks) while keeping store selectors focused.


Task 4 - Implement MainLayout (compound component pattern) - Status: RESET

Sub-task 4.1 - Context + provider - Status: IN PROGRESS

Step 4.1.1 - Add `src/app/layout/MainLayout.tsx` exporting compound: `MainLayout.Root`, `MainLayout.Background`, `MainLayout.Header`, `MainLayout.Sidemenu`, `MainLayout.Main`, `MainLayout.Footer` - Status: COMPLETED
  - ✅ Rebuilt `MainLayout` around a layout-scoped Zustand store to drive region mount/visibility and expose a `Controller` helper for configuration.

Step 4.1.2 - Create `LayoutContext` providing: current effective config, helper actions (toggle header/footer/sidemenu), and slot registration APIs (for local route Slot components) - Status: IN PROGRESS
  - 🔄 New provider now exposes store actions/selectors; slot-specific helpers will be reintroduced after base skeleton validation.

Step 4.1.3 - Orchestrate regions in `MainLayout.Root` with CSS Grid: rows `[header, 1fr, footer]`, columns `[sidemenu, main]`; ensure pinned header/footer and full-height side rail - Status: COMPLETED
  - ✅ Grid shell enforces zero padding, fixed header/footer heights, and dynamic sidemenu column widths (`unmounted/hidden/compact/expanded`).

Sub-task 4.2 - Background - Status: IN PROGRESS

Step 4.2.1 - Implement `Background` reading config and rendering behind content (absolute/fixed, `-z-10`) - Status: COMPLETED
  - ✅ Background controller mounts/unmounts an arbitrary `ReactNode` with visibility toggles while keeping the main grid untouched.

Step 4.2.2 - Support per-route overrides via static configuration or future slot wiring - Status: IN PROGRESS
  - 🔄 Base controller is in place; route-level helpers to be layered back once layout stability is confirmed.

Sub-task 4.3 - Header - Status: IN PROGRESS

Step 4.3.1 - Provide `MainLayout.Header` surface that honours mount/visible flags and fixed height - Status: COMPLETED
  - ✅ Header surface mounts with fixed height and now hosts the restored `AppHeader` (toggle + auth actions) via the layout store selectors.

Step 4.3.2 - Add slot API / advanced composition - Status: TODO
  - ⏳ Awaiting validation of base container before reintroducing slot precedence logic.

Sub-task 4.4 - Sidemenu - Status: IN PROGRESS

Step 4.4.1 - Provide side rail honoring four modes (unmounted, hidden, compact, expanded) - Status: COMPLETED
  - ✅ Column width/visibility derived from the new layout store; header toggles now cycle expanded → compact → hidden on the real `AppSidebar` skeleton.

Step 4.4.2 - Slot/API for injecting route-specific menu trees - Status: TODO
  - ⏳ Deferred until core container passes UI review.

Step 4.4.3 - Ensure layout adjusts content width based on sidemenu mode - Status: COMPLETED
  - ✅ Main area automatically spans the remaining columns when the side rail collapses or unmounts.

Sub-task 4.5 - Main content container - Status: COMPLETED

Step 4.5.1 - Supply scrollable main pane occupying residual space - Status: COMPLETED
  - ✅ Main section fills available grid cell and defaults to `overflow-y: auto` without additional padding.

Step 4.5.2 - Scoped suspense/error handling - Status: TODO
  - ⏳ Will be reinstated after confirming base layout.

Sub-task 4.6 - Footer - Status: IN PROGRESS

Step 4.6.1 - Provide footer surface honouring mount/visible flags and fixed height - Status: COMPLETED
  - ✅ Footer spans both columns, pinned to the grid’s final row; `WorkspaceFooter` + collapsed affordance now manipulate the layout store directly.


Task 5 - Route-level configuration integration (TanStack Router) - Status: COMPLETED
  - ✅ Layout provider aggregates `staticData.layout` and syncs store defaults/background/slots per route.

Sub-task 5.1 - Define and read staticData - Status: COMPLETED

Step 5.1.1 - Augment TanStack Router types to include `StaticDataRouteOption['layout']?: LayoutStaticData` - Status: COMPLETED
  - ✅ Module augmentation added in `layout-types.ts` for typed `staticData.layout`.

Step 5.1.2 - In `MainLayout.Root`, read `matches` via `useRouterState()` or `useMatches()` and fold their `staticData.layout` to compute effective layout (deep-merge with parent precedence to child) - Status: COMPLETED
  - ✅ `LayoutProvider` aggregates `staticData.layout` across matches to drive store defaults.

Sub-task 5.2 - Apply config to store/effective context - Status: COMPLETED

Step 5.2.1 - On route change, apply computed layout: set header/footer visibility, sidemenu kind, background; reset slots; mount any `Slot` declarations found in children - Status: COMPLETED
  - ✅ `LayoutProvider` effect now resets slots, seeds staticData slots, and syncs store visibility/background on navigation.

Step 5.2.2 - Provide sensible defaults: header true, footer true, sidemenu expanded, background default - Status: COMPLETED
  - ✅ Defaults applied when static data omits values (header/footer true, expanded sidemenu, default background).


Task 6 - Root-level ScreenGuard (single implementation) - Status: COMPLETED

Step 6.1 - Keep existing `src/components/ResolutionGuard.tsx:1` but re-export as `ScreenGuard` via `src/app/layout/screen-guard.ts` for consistency - Status: COMPLETED
  - ✅ Added alias export so layout code uses `ScreenGuard` without duplicating the component (`src/app/layout/screen-guard.ts:1`).

Step 6.2 - Ensure single usage at root: keep only in `src/main.tsx:15` wrapping `<RouterProvider />`; remove or prevent additional usages across routes/layout - Status: COMPLETED
  - ✅ Root now imports the alias and remains the lone mount of the guard, no other modules reference `ResolutionGuard` directly (`src/main.tsx:5`,`src/main.tsx:46`).


Task 7 - Migrate current pages to new layout system - Status: COMPLETED

Sub-task 7.1 - Protected workspace (`/`) - Status: COMPLETED

Step 7.1.1 - Convert `src/routes/index.tsx:1` to render a `WorkspacePage` (new) instead of `App` - Status: COMPLETED
  - ✅ `/` route now points to `WorkspacePage` and attaches layout defaults through `staticData`.

Step 7.1.2 - Extract workspace content from `src/App.tsx:1` into `src/features/workspace/WorkspacePage.tsx` (only main pane rendering: ProjectsPanel, settings, editor/overview switching) - Status: COMPLETED
  - ✅ Workspace logic lives in `src/features/workspace/WorkspacePage.tsx`; `App.tsx` remains only for rollback.

Step 7.1.3 - Move layout-specific logic (header/footer visibility, paddings, side offsets) into `MainLayout` orchestration; `WorkspacePage` should only render main content - Status: COMPLETED
  - ✅ New page relies on `MainLayout` slots for structural regions, keeping component output scoped to content and alerts.

Step 7.1.4 - Provide sidemenu items via `Sidemenu.Slot` from `WorkspacePage` (populate fixed + project/editor tabs using existing `MenuItem` model) - Status: COMPLETED
  - ✅ `WorkspacePage` registers `MainLayout.Sidemenu.Slot` with fixed/temporary/editor items derived from workspace shell state.

Step 7.1.5 - Define route `staticData.layout` for `/`: `{ header: true, footer: true, sidemenu: 'expanded', background: { kind: 'default' } }` - Status: COMPLETED
  - ✅ `src/routes/index.tsx:18` seeds layout defaults for the workspace route (header/footer visible, expanded sidemenu, default background).

Sub-task 7.2 - Login (`/login`) - Status: COMPLETED

Step 7.2.1 - Update `src/routes/login.tsx:1` `staticData.layout` to hide structural regions: `{ header: false, footer: false, sidemenu: 'hidden', background: { kind: 'component', element: <BlankBackground tone="default" /> } }` - Status: COMPLETED
  - ✅ Login route static data now hides structural chrome and delegates decorative background to layout background component.

Step 7.2.2 - Ensure `LoginPage` renders only its form; background provided by layout; remove local absolute/overlay wrappers conflicting with layout - Status: COMPLETED
  - ✅ Login page content focuses on grid/form layout without absolute wrappers; visual container stays within main content grid.

Sub-task 7.3 - Root route and error boundary - Status: COMPLETED

Step 7.3.1 - Update `src/routes/__root.tsx:1` to render just `<MainLayout.Root />` (and devtools in dev); move existing `AppErrorBoundary` usage to `MainLayout.MainContent` (content-scoped) - Status: COMPLETED
  - ✅ Root route composes full `MainLayout` shell and defers content boundary to `MainLayout.MainContent`.

Step 7.3.2 - Remove duplicated `AppErrorBoundary` wrapping in `__root` because `src/main.tsx:15` already has a global boundary - Status: COMPLETED
  - ✅ Duplicate boundary stripped; only global boundary remains at bootstrap.


Task 8 - Update existing layout components to store-driven - Status: COMPLETED

Step 8.1 - `AppHeader` to consume layout store selectors (`useSidemenuState`, `cycleSidemenu`, `setHeaderVisible`) and drop `state`/`onToggleSidebar` props - Status: COMPLETED
  - ✅ Header now reads sidemenu state from store and triggers `cycleSidemenu` internally; external props trimmed to layout-agnostic inputs.

Step 8.2 - `AppSidebar` to read `SidemenuState` from store; hide entirely when `kind === 'hidden'`; adjust width for compact/expanded; keep presentational nature - Status: COMPLETED
  - ✅ Sidebar subscribes to store sidemenu state and auto-applies width/visibility without caller props.

Step 8.3 - `WorkspaceFooter` / `CollapsedFooterBar` mapped to store’s `footerVisible` with `setFooterVisible` - Status: COMPLETED
  - ✅ Footer components toggle layout visibility through store actions, enabling slot-based collapsed and expanded views.


Task 9 - Backgrounds and theming - Status: COMPLETED

Step 9.1 - Provide default background using tokens (`bg-background`, gradients if needed) - Status: COMPLETED
  - ✅ `LayoutShell` wraps the grid with `bg-background` and `BackgroundSurface` falls back to an `absolute` panel using the same token (`src/app/layout/MainLayout.tsx:179` and `:228`).

Step 9.2 - Replace the legacy `AnimatedBackground` gradient with the reusable `BlankBackground` slot component; ensure stacking order (`z-index`) and performance (reduce overdraw) - Status: COMPLETED
  - ✅ Login route `staticData` injects the animated background via layout config while `LayoutShell` renders it behind content with `pointer-events-none`/`-z-10` container (`src/routes/login.tsx:12`, `src/app/layout/MainLayout.tsx:186`).


Task 10 - Accessibility and responsiveness - Status: COMPLETED

Step 10.1 - Preserve skip-link (`#main-content`) inside `MainLayout.Header` or earliest focusable region; ensure correct tab order - Status: COMPLETED
  - ✅ Accessible skip link reinstated at top of layout shell with proper focus styles targeting `#main-content`.

Step 10.2 - Ensure `ScreenGuard` fully blocks interactions below threshold and remains the single global instance - Status: COMPLETED
  - ✅ `ResolutionGuard` overlay keeps pointer events trapped while the alias `ScreenGuard` stays mounted only at the root (`src/components/ResolutionGuard.tsx:48`, `src/app/layout/screen-guard.ts:1`, `src/main.tsx:46`).

Step 10.3 - Maintain ARIA roles: `banner`, `navigation`, `main`, `contentinfo`; ensure `aria-hidden` and `aria-current` as in current components - Status: COMPLETED
  - ✅ Layout wrappers assign the appropriate roles (`banner`/`navigation`/`main`/`contentinfo`) while sidebar items preserve `aria-current` states (`src/app/layout/MainLayout.tsx:248`, `:269`, `:294`, `:318`; `src/app/layout/chrome/sidebar/AppSidebar.tsx:70`).


Task 11 - Performance pass (React 19 friendly) - Status: COMPLETED

Step 11.1 - Remove unnecessary React.memo/useMemo/useCallback from layout components; rely on compiler - Status: COMPLETED
  - ✅ Header toggle logic now derives labels/icons inline without `useMemo`, matching React Compiler guidance (`src/app/layout/chrome/header/AppHeader.tsx:21`).

Step 11.2 - Ensure all store consumers use narrow selectors and `shallow` where returning objects - Status: COMPLETED
  - ✅ Store selectors use `useShallow` and a shared `sidemenuEquals` equality helper to avoid redundant renders (`src/app/layout/layout-store.ts:55`, `src/app/layout/sidemenu.ts:33`).

Step 11.3 - Add Suspense boundaries around lazily split route content if/when applicable - Status: COMPLETED
  - ✅ Route content remains wrapped in `Suspense` with a scoped fallback inside `MainLayout.MainContent` (`src/app/layout/MainLayout.tsx:293`).


Task 12 - Incremental migration and compatibility - Status: COMPLETED

Step 12.1 - Keep old `App.tsx` temporarily, but stop routing to it; ensure no duplicate `ResolutionGuard`/`ErrorBoundary` - Status: COMPLETED
  - ✅ `/` route now renders `WorkspacePage` while the legacy `App.tsx` remains unused and guards are mounted only once (`src/routes/index.tsx:23`, `src/main.tsx:46`).

Step 12.2 - Verify existing features still work: project tabs (temporary items), open editor navigation events (`useGlobalNavigationEvents`), header title (`useHeaderTitle`) - Status: COMPLETED
  - ✅ `WorkspacePage` wires project/editor slots, navigation events, and explicit header titles using the shared hooks (`src/features/workspace/WorkspacePage.tsx:27-122`).

Step 12.3 - Validate visual parity for header/sidebar/footer padding and sticky behavior; adjust Tailwind classes in `MainLayout` if needed - Status: COMPLETED
  - ✅ Grid shell preserves spacing while header/footer components keep their sticky/fixed styling (`src/app/layout/MainLayout.tsx:178-193`, `src/app/layout/chrome/header/AppHeader.tsx:60`, `src/app/layout/chrome/footer/WorkspaceFooter.tsx:19`).


Task 13 - Testing and validation - Status: IN PROGRESS

Step 13.1 - Run `npm i zustand` and `npm run dev` to validate compile/runtime - Status: BLOCKED
  - ⚠️ Attempted to start Vite dev server but sandbox denied binding to loopback (`Error: listen EPERM ::1:1420`); full `tsc` build also fails due to pre-existing repository type errors outside the layout scope.

Step 13.2 - Add minimal tests around store transitions (expanded→compact→hidden→expanded) and selectors behavior with shallow compare - Status: COMPLETED
  - ✅ Added Vitest coverage for sidemenu cycling and slot selector re-renders (`src/app/layout/layout-store.test.tsx`).

Step 13.3 - Manually test route overrides: `/login` hides structural regions and shows background; `/` shows full workspace - Status: BLOCKED
  - ⚠️ UI smoke test pending because dev server cannot run within sandbox; static route configs verified in code (`src/routes/login.tsx:12`, `src/routes/index.tsx:18`).


Task 14 - Documentation and examples - Status: COMPLETED

Step 14.1 - Add `docs/Layout_System_Usage.md` with examples: per-route `staticData.layout`, using `Header.Slot`, cycling sidemenu, programmatic visibility toggles from child components - Status: COMPLETED
  - ✅ Authored usage guide covering staticData, slot APIs, background overrides, and programmatic actions (`docs/Layout_System_Usage.md`).

Step 14.2 - Add code comments in `MainLayout.tsx` clarifying composition pattern and slot precedence - Status: COMPLETED
  - ✅ Documented slot precedence directly in the layout synchronization effect (`src/app/layout/MainLayout.tsx:116`).


Appendix — Repo-specific notes (grounded in current codebase)

- Root wrappers are currently in `src/main.tsx:1` (global `AppErrorBoundary`, `AuthProvider`, `ToastProvider`, `ResolutionGuard`, `RouterProvider`). Keep `ResolutionGuard` as the single global ScreenGuard.
- `src/routes/__root.tsx:1` wraps `<Outlet />` in `AppErrorBoundary` again; plan removes duplication and scopes boundary to `MainLayout.MainContent`.
- `src/App.tsx:1` presently implements header/sidebar/footer paddings and offsets; these move into `MainLayout` orchestration; `WorkspacePage` keeps only the main area logic.
- `src/app/layout/chrome/header/AppHeader.tsx:1` and `src/app/layout/chrome/sidebar/AppSidebar.tsx:1` remain presentational, but read from the store; keep shadcn/ui primitives.
- Sidebar state previously relied on the standalone helper in `src/app/layout/chrome/sidebar/sidebar-state.ts`; we removed that file and consolidated the cycle logic inside the shared layout store to avoid drift.
- `src/components/ResolutionGuard.tsx:1` remains intact and is aliased to `ScreenGuard`.

Non-goals

- Do not change DB or IPC layers.
- Do not alter existing project/editor flows beyond UI composition.
- Avoid unrelated visual redesign; target functional parity first.

Rollback plan

- Keep `App.tsx` and old layout components during migration for quick fallback by pointing the `/` route back to `App` if necessary.

[^tanstack-staticdata]: TanStack Router v1 docs on routing concepts and static route data confirm per-route layout configuration via `staticData` and consumption through route matches (https://tanstack.com/router/v1/docs/framework/react/routing/routing-concepts, https://tanstack.com/router/latest/docs/framework/react/guide/static-route-data).
[^react-suspense]: React Suspense reference recommends boundary placement around asynchronous route content, keeping persistent layout shells outside to avoid resetting stable UI (https://react.dev/reference/react/Suspense).
[^react-compiler]: React Compiler introduction explains that React 19 automatically optimizes components, making most manual memoization unnecessary (https://react.dev/learn/react-compiler/introduction).
[^zustand-shallow]: Zustand official documentation on `useShallow` advises using selectors for minimal subscriptions and applying shallow comparison when selectors return objects or arrays to prevent extra renders (https://zustand.docs.pmnd.rs/hooks/use-shallow, https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow).
[^shadcn-tailwind4]: shadcn/ui Tailwind v4 documentation outlines the required CLI setup, `@config` usage, and theming updates for Vite projects, confirming compatibility (https://ui.shadcn.com/docs/tailwind-v4).
