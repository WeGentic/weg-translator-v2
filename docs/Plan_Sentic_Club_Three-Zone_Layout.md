Pro# Sentic Club — Three-Zone Layout Adoption Plan

This execution plan replicates the 3‑element panel structure (Header zone, Toolbar zone, Content zone) modeled after `src/components/projects/table/ProjectsDataTable.tsx` (Header: `ProjectsTableHeader`, Toolbar: `ProjectsTableToolbar`, Content: `ProjectsTableGrid`) to build placeholder pages for Dashboard and Resources, and refactor Settings and Editor to the same structure in the sentic_club app. The plan is organized into Tasks, optional Sub‑tasks, and atomic Steps.

Note: References to the current codebase are from Weg Translator for parity and guidance:
- 3‑zone panel example: `src/components/projects/table/ProjectsDataTable.tsx`
- Host panel: `src/components/projects/ProjectsPanel.tsx`
- Routing: `src/routes/__root.tsx`, `src/routes/index.tsx`
- Layout primitives: `src/app/layout/*`

All steps are designed for React 19.1.1 + TanStack Router v1 (file‑based), ShadCN v3.3.1, TailwindCSS 4.1.1, and Tauri 2.8.x frontends.

---

Task 1 - Baseline Audit and Spec Extraction - Status: COMPLETED

Step 1.1 - Confirm 3‑zone structure from Projects panel and table components (Header, Toolbar, Content+Footer) with responsive behavior and scroll boundaries based on `src/components/projects/table/ProjectsDataTable.tsx`. - Status: COMPLETED
Notes: Verified `ProjectsDataTable` wraps header, toolbar, scrollable grid, and footer inside `flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm`, matching required zones and footer outside the scroll area.

Step 1.2 - Catalog styling and utility classes used by the panel (rounded borders, border colors, gradients, shadows); capture palette constraints from `src/App.css`. - Status: COMPLETED
Notes: Collected layout CSS from `data-table.css`/`dropdowns.css` including custom properties (`--projects-table-*`) and toolbar class `projects-table-toolbar-zone`; confirmed palette tokens and gradients defined in `src/App.css` align with WeGentic palette requirements.

Step 1.3 - Record Router patterns: root layout and outlet composition (`src/routes/__root.tsx`) and file‑based route usage (`src/routes/index.tsx`; generated `src/routeTree.gen.ts`). - Status: COMPLETED
Notes: Observed TanStack Router root uses `MainLayout.*` slots with `<Outlet />`; file routes generated via `createFileRoute` (e.g., `/` in `routes/index.tsx`) with `routeTree.gen.ts` auto-adding entries; navigation events dispatched from root.

Step 1.4 - Capture layout expectations for sidebars/header/footer from `src/app/layout` to align page content spacing and scroll containers (no reliance required, but maintain consistent spacing). - Status: COMPLETED
Notes: Documented `MainLayout` shell grid (`layout-shell.tsx`) reserving sidebar columns and header row; `LayoutMain` wraps content in scroll container with `min-height: 0`; layout CSS ensures full-height flex column with overflow hidden, guiding integration for future panels.

---

Task 2 - Shared Panel Design for sentic_club - Status: COMPLETED

Sub-task 2.1 - Package and API surface - Status: COMPLETED

Step 2.1.1 - Create workspace package `packages/layout-three-zone` exporting a composable panel: `ThreeZonePanel`, `PanelHeader`, `PanelToolbar`, `PanelContent`, `PanelFooter` (optional). - Status: COMPLETED
Notes: Established workspace entry in root `package.json` and scaffolded package directory with `package.json`, `tsconfig.json`, and source folders under `packages/layout-three-zone/`.

Step 2.1.2 - Establish minimal props: `header` (ReactNode), `toolbar` (ReactNode), `footer` (ReactNode | null), children (content). Avoid prop drilling by encouraging composition slots. - Status: COMPLETED
Notes: `ThreeZonePanel` accepts slot props plus `variant` and `contentOverflow` controls per `packages/layout-three-zone/src/ThreeZonePanel.tsx`.

Step 2.1.3 - Provide convenience compound API: `<ThreeZonePanel.Header/>`, `<ThreeZonePanel.Toolbar/>`, `<ThreeZonePanel.Content/>`, `<ThreeZonePanel.Footer/>`. - Status: COMPLETED
Notes: Exported compound components via static properties and named exports (`PanelHeader`, etc.) in `ThreeZonePanel.tsx`.

Sub-task 2.2 - Styling and Semantics - Status: COMPLETED

Step 2.2.1 - Mirror container and zones CSS to match Weg Translator’s table host: `flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm`. - Status: COMPLETED
Notes: Default layout classes baked into `BASE_CLASSNAME`; complementary styles defined in `src/styles/panel.css` preserve rounded corners, border tokens, and popover background parity.

Step 2.2.2 - Header zone fixed height ~54–64px; Toolbar zone auto height; Content `min-h-0` scroll area; optional Footer sticky below content (separate from scroll). - Status: COMPLETED
Notes: CSS layer sets header/toolbar min-heights via custom properties and `flex-shrink:0`; content container enforces `flex:1`, `min-height:0`, and configurable overflow.

Step 2.2.3 - Use ShadCN primitives for UI controls; enforce color tokens from WeGentic palette (App.css) and Tailwind config. - Status: COMPLETED
Notes: Zone surfaces leverage palette tokens (`--popover`, `--border`, `--muted`) guaranteeing compatibility with existing ShadCN button/input styling.

Sub-task 2.3 - React 19 Compiler considerations - Status: COMPLETED

Step 2.3.1 - Keep props stable; avoid unnecessary `useMemo`/`useCallback`; tables receive direct state (compiler optimizes). - Status: COMPLETED
Notes: Component stays stateless and avoids memo helpers, letting the React Compiler optimize slot rendering naturally.

Step 2.3.2 - Support controlled state patterns for sorting/search/filters (if used); no internal polling logic inside layout primitives. - Status: COMPLETED
Notes: Layout only orchestrates presentation; all stateful concerns remain with consumers, satisfying compiler-friendly composition guidance.

---

Task 3 - Implement `packages/layout-three-zone` - Status: COMPLETED

Step 3.1 - Scaffold package: `packages/layout-three-zone/package.json`, `tsconfig.json`, `src/index.ts`, `src/ThreeZonePanel.tsx`, `src/styles/panel.css`. - Status: COMPLETED
Notes: Workspace added with npm lock update; baseline files created under `packages/layout-three-zone/`.

Step 3.2 - Implement `ThreeZonePanel` with slots: `<Header/>`, `<Toolbar/>`, `<Content/>`, `<Footer/>`; CSS grid or flex with `grid-rows-[auto_auto_1fr]` or `flex-col` and fixed header. - Status: COMPLETED
Notes: Slot parsing and composition handled in `ThreeZonePanel.tsx`, supporting props plus compound children and optional footer handling.

Step 3.3 - Add CSS classes mirroring `projects-table-toolbar-zone` behavior and visual parity (borders, gradients, subtle shadow). - Status: COMPLETED
Notes: `src/styles/panel.css` includes gradients, borders, and scrollbar styling tuned to WeGentic palette tokens.

Step 3.4 - Export TypeScript types and ensure `@/` alias compatibility in consumers. - Status: COMPLETED
Notes: `src/index.ts` re-exports component and slot types; root `tsconfig.json` adds workspace include/reference so app imports resolve without new aliases.

Step 3.5 - Add unit tests for composition order and zone rendering using React Testing Library. - Status: COMPLETED
Notes: Added `packages/layout-three-zone/src/ThreeZonePanel.test.tsx` covering prop-based slots, compound slots, overflow variants, and default content fallback.

---

Task 4 - Dashboard Page (placeholder) - Status: COMPLETED

Sub-task 4.1 - Routing - Status: COMPLETED

Step 4.1.1 - Add file‑based route `apps/sentic_club/src/routes/dashboard/index.tsx` via `createFileRoute("/dashboard")`. - Status: COMPLETED
Notes: Added `src/routes/dashboard/index.tsx` defining the `/dashboard` route via `createFileRoute` with a temporary placeholder component; route tree regeneration pending during next build.

Step 4.1.2 - Ensure `__root.tsx` mounts app layout and renders `<Outlet/>`; include sidebars/header/footer if applicable. - Status: COMPLETED
Notes: Root layout now wires `onDashboardClick` to TanStack navigation (`src/routes/__root.tsx`), ensuring sidebar actions push the correct route while still rendering through `<Outlet />`.

Sub-task 4.2 - Page Composition - Status: COMPLETED

Step 4.2.1 - Compose `<ThreeZonePanel>`; Header: title “Dashboard”; actions placeholder (e.g., New… button) using ShadCN `Button`. - Status: COMPLETED
Notes: Dashboard route renders `ThreeZonePanel` with contextual header (`New Project` button) per `src/routes/dashboard/index.tsx`.

Step 4.2.2 - Toolbar: search `Input`, filter `Select`, and quick actions (ghost buttons). Functional stubs only. - Status: COMPLETED
Notes: Toolbar hosts search input plus outline/ghost action buttons arranged responsively for placeholder behavior.

Step 4.2.3 - Content: placeholder grid with empty state card and guidance text. - Status: COMPLETED
Notes: Content uses `PanelContent` to provide scrollable grid of cards describing future widgets, jobs table, and quick links.

Step 4.2.4 - Optional Footer: item counts / summary placeholder (parity with Projects table footer styling). - Status: COMPLETED
Notes: Footer summarizes “Last update” and item totals using muted text styling consistent with projects table count footer.

---

Task 5 - Resources Page (placeholder) - Status: COMPLETED

Sub-task 5.1 - Routing - Status: COMPLETED

Step 5.1.1 - Add file-based route `apps/sentic_club/src/routes/resources/index.tsx`. - Status: COMPLETED
Notes: Introduced `src/routes/resources/index.tsx` registering `/resources` via `createFileRoute`, mirroring Dashboard mount semantics and dispatching `app:navigate` with `view: "resource"` for sidebar sync.

Sub-task 5.2 - Page Composition - Status: COMPLETED

Step 5.2.1 - Compose `<ThreeZonePanel>`; Header: title “Resources”; actions placeholder (Import/Sync). - Status: COMPLETED
Notes: Header slot renders title copy plus staged `Import` and `Sync` buttons using ShadCN `Button` variants for future wiring.

Step 5.2.2 - Toolbar: search + filters for resource type/status (stubs). - Status: COMPLETED
Notes: Toolbar combines `Input` search with two `Select` controls (`Type`, `Status`) and action buttons, matching adaptive flex layout from dashboard scaffold.

Step 5.2.3 - Content: placeholder table/list shell; empty state with CTA. - Status: COMPLETED
Notes: Panel content lays out summary cards and a staged library section with dashed empty-state panel and example CTAs; uses ThreeZonePanel `PanelContent` to maintain scroll behavior.

---

Task 6 - Refactor Settings to 3‑zone - Status: IN PROGRESS

Sub-task 6.1 - Inventory and Wrap - Status: COMPLETED

Step 6.1.1 - Identify current Settings screen(s) in sentic_club; isolate the main panel component(s). - Status: COMPLETED
Notes: Confirmed `EnhancedAppSettingsPanel` as primary settings surface embedded in `WorkspacePage`; mapped legacy wrapper padding that needed removal for full-height panel integration.

Step 6.1.2 - Wrap Settings content inside `<ThreeZonePanel>`; Header: “Settings”; actions: Save/Reset placeholders; Toolbar: search or category filter (optional); Content: existing settings form/components. - Status: COMPLETED
Notes: Refactored `src/components/settings/EnhancedAppSettingsPanel.tsx` to render a `ThreeZonePanel` with header actions, search/filter toolbar, and footer status messaging while preserving existing forms.

Step 6.1.3 - Ensure consistent spacing and scroll: Content hosts scroll; header/toolbar remain fixed within the panel. - Status: COMPLETED
Notes: Applied panel content padding via `PanelContent` and removed the extra wrapper in `src/features/workspace/WorkspacePage.tsx` so the settings view stretches within the layout shell without double scrollbars.

Sub-task 6.2 - Behavior Parity - Status: IN PROGRESS

Step 6.2.1 - Wire existing save/cancel behaviors; keep IPC calls/hooks outside layout primitives. - Status: COMPLETED
Notes: Preserved all IPC update handlers and reload flow through `handleUpdateSetting`/`loadSettings`, adding explicit `void` guards to maintain async handling under the new layout.

Step 6.2.2 - Add minimal tests for layout zones rendering and submission flow remains intact. - Status: NOT COMPLETED
Notes: Tests still pending; plan to introduce panel render smoke coverage once test harness stubs for Tauri IPC are finalized.

---

Task 7 - Refactor Editor to 3‑zone - Status: COMPLETED

Sub-task 7.1 - Header Mapping - Status: COMPLETED

Step 7.1.1 - Map existing editor header (title, close/back, status) to `<ThreeZonePanel.Header>`; preserve keyboard shortcuts. - Status: COMPLETED
Notes: Migrated `EditorHeader` for panel usage with optional back/close actions and subtitle text, now rendered inside `EditorPanel` (`src/components/editor/EditorPanel.tsx`, `src/components/editor/EditorHeader.tsx`). Layout header reverts to `AppHeader`, eliminating the previous special-case override.

Sub-task 7.2 - Toolbar Mapping - Status: COMPLETED

Step 7.2.1 - Move editor actions (search/replace, segment navigation, validation) into `<ThreeZonePanel.Toolbar>` as ShadCN buttons/inputs (functional stubs where needed). - Status: COMPLETED
Notes: `EditorPanel` composes toolbar stubs with `Input`, `Select`, and action buttons covering search, navigation, filters, and validation placeholders; status chip mirrors draft state.

Sub-task 7.3 - Content Mapping - Status: COMPLETED

Step 7.3.1 - Place editor content (document/segments) into `<ThreeZonePanel.Content>` with `min-h-0` and internal scroll. - Status: COMPLETED
Notes: Panel content hosts the existing `EditorPlaceholder` inside a scroll-capable container, ready for future segment list integration.

Step 7.3.2 - Preserve existing footer/status bar (if any) or move to `<ThreeZonePanel.Footer>` for consistency. - Status: COMPLETED
Notes: `EditorFooterPlaceholder` now renders inside the panel footer, while the global workspace footer remains unchanged for health telemetry.

Notes: Sidebar “Editor” button now dispatches the placeholder flow via `app:navigate` when no project editor is active, allowing users to open the idle `EditorPanel` directly from navigation (`src/routes/__root.tsx`, `src/features/workspace/WorkspacePage.tsx`).

---

Task 8 - Routing Integration and Navigation - Status: COMPLETED

Step 8.1 - Update navigation (sidebar/menu) to include `/dashboard` and `/resources`; keep `/settings` and `/editor` as is but with refactored content. - Status: COMPLETED
Notes: Root route now wires sidebar handlers for Dashboard and Resources, navigating via TanStack Router and dispatching `app:navigate` events so both sidebars highlight the active zone (`src/routes/__root.tsx`).

Step 8.2 - Confirm TanStack Router file-based route generation and types via `routeTree.gen.ts` in sentic_club. - Status: COMPLETED
Notes: Checked `src/routeTree.gen.ts` includes `/dashboard/` and `/resources/` entries; no additional generation needed after adding the routes.

Step 8.3 - Add basic loader/placeholder states to avoid layout shift during data fetches. - Status: COMPLETED
Notes: Both dashboard and resource pages now show skeleton panels during initial render (`src/routes/dashboard/index.tsx`, `src/routes/resources/index.tsx`), ready to tie into future data loaders.

Step 8.4 - Retire legacy sidemenu layout components to prevent old sidebar from rendering. - Status: COMPLETED
Notes: Removed `LayoutSidemenu`, associated store state, and sidemenu-driven AppSidebar wiring so navigation relies solely on Sidebar One/Two.

---

Task 9 - Theming, Tokens, and Styles - Status: COMPLETED

Step 9.1 - Ensure WeGentic palette tokens exist in sentic_club `App.css` (align with Weg Translator’s tokens); wire Tailwind 4.1 config to reference tokens. - Status: COMPLETED
Notes: Verified full palette coverage in `src/App.css` including dark theme overrides and Tailwind 4 `@theme inline` mappings back to the same tokens so utility classes resolve to WeGentic colors.

Step 9.2 - Add shared CSS classes for the toolbar zone (e.g., `projects-table-toolbar-zone` parity) within the new package or app styles. - Status: COMPLETED
Notes: `three-zone-panel__toolbar` styles in `packages/layout-three-zone/src/styles/panel.css` mirror the projects table toolbar surface (gradient, borders, blur).

Step 9.3 - Validate ShadCN v3.3.1 components render with correct contrast and ring colors from tokens. - Status: COMPLETED
Notes: Standardized focus states across core inputs/buttons/textarea to use `ring` + `ring-offset-background` driven by palette tokens, ensuring consistent contrast and accessibility (`src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`).

---

Task 10 - Testing and QA - Status: COMPLETED

Step 10.1 - Unit tests: ThreeZonePanel renders all zones; Header/Toolbar fixed, Content scrolls. - Status: COMPLETED
Notes: `packages/layout-three-zone/src/ThreeZonePanel.test.tsx` verifies slot rendering, toolbar role, and content overflow modes via Vitest.

Step 10.2 - Page smoke tests: Dashboard/Resources/Settings/Editor mount without errors; keyboard nav accessible. - Status: COMPLETED
Notes: `src/test/routes/panels.test.tsx` now drives keyboard tab-order assertions for Dashboard, Resources, Settings, and Editor while waiting for data skeletons to settle, ensuring each panel mounts and exposes its primary controls (`New Project`, `Import`, `Reset`, `Close editor`).

Step 10.3 - Visual checks: borders, spacing, and shadows match Projects panel baseline. - Status: COMPLETED
Notes: Added regression assertion in `src/test/routes/panels.test.tsx` verifying the rendered ThreeZonePanel carries `three-zone-panel` chrome classes (rounded corners, border tokens, `bg-popover`, `shadow-sm`) so the new screens match the Projects baseline container styling.

---

Task 11 - Performance and React 19 Compliance - Status: COMPLETED

Step 11.1 - Verify no unnecessary `useMemo`/`useCallback` added; compiler warnings clean. - Status: COMPLETED
Notes: `ThreeZonePanel.tsx` uses pure functions and child parsing without memo helpers, aligning with React Compiler guidance gathered in planning research.

Step 11.2 - Confirm controlled state patterns for tables/forms do not jitter under polling. - Status: COMPLETED
Notes: Reviewed panel integrations (`src/routes/dashboard/index.tsx`, `src/routes/resources/index.tsx`, `src/components/settings/EnhancedAppSettingsPanel.tsx`, `src/components/editor/EditorPanel.tsx`) to ensure only intentional local state is used for skeleton toggles; no polling loops or uncontrolled props were introduced, and the new smoke tests confirm stable focus targets after render.

---

Task 12 - Rollout & Documentation - Status: COMPLETED

Step 12.1 - Incremental rollout: land shared package, then Dashboard/Resources, then Settings, then Editor. - Status: COMPLETED
Notes: Verified ThreeZonePanel adoption across all target surfaces—`src/routes/dashboard/index.tsx`, `src/routes/resources/index.tsx`, `src/components/settings/EnhancedAppSettingsPanel.tsx`, and `src/components/editor/EditorPanel.tsx`—confirming the shared package rollout sequence is fully realized.

Step 12.2 - Create a short usage snippet in `packages/layout-three-zone/README.md` documenting composition API. - Status: COMPLETED
Notes: README showcases prop-based and compound slot usage examples alongside exposed props list.

Step 12.3 - Add a migration checklist to guarantee parity for Settings/Editor behavior. - Status: COMPLETED
Notes: Migration checklist recorded:
  1. Ensure Settings panel loads baseline data via `getAppSettings` mock before interactions (`src/test/routes/panels.test.tsx`).
  2. Confirm Settings toolbar retains search/reset controls mapped to ThreeZonePanel slots (`src/components/settings/EnhancedAppSettingsPanel.tsx`).
  3. Validate Editor header/toolbar/footers render within ThreeZonePanel with accessible labels (`src/components/editor/EditorPanel.tsx`).
  4. Re-run `npm run test -- src/test/routes/panels.test.tsx` to confirm navigation + styling regressions remain covered.

---

## Notes & References

- Reference 3‑zone structure: `src/components/projects/table/ProjectsDataTable.tsx` (Header, Toolbar, Content, with Footer inside content container)
- Host usage in Projects: `src/components/projects/ProjectsPanel.tsx`
- Router patterns: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routeTree.gen.ts`
- Layout shell and sidebars: `src/app/layout/layout-shell.tsx`, `src/app/layout/layout-sidebar-one.tsx`, `src/app/layout/layout-sidebar-two.tsx`
- React 19 Compiler: avoid unnecessary manual memoization; prefer stable props through simple objects and direct event handlers
- ShadCN + Tailwind 4.1.1: keep to provided WeGentic tokens from `src/App.css`

Outcome: Sentic Club’s Dashboard, Resources, Settings, and Editor will share a consistent 3‑zone panel layout, reducing duplication, aligning behavior, and improving maintainability while staying within React 19 + TanStack Router + ShadCN best practices.
