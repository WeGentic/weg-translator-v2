# Sentic Club — Three-Zone Layout Adoption Plan

This execution plan replicates the 3‑element panel structure (Header zone, Toolbar zone, Content zone) modeled after `src/components/projects/table/ProjectsDataTable.tsx` (Header: `ProjectsTableHeader`, Toolbar: `ProjectsTableToolbar`, Content: `ProjectsTableGrid`) to build placeholder pages for Dashboard and Resources, and refactor Settings and Editor to the same structure in the sentic_club app. The plan is organized into Tasks, optional Sub‑tasks, and atomic Steps.

Note: References to the current codebase are from Weg Translator for parity and guidance:
- 3‑zone panel example: `src/components/projects/table/ProjectsDataTable.tsx`
- Host panel: `src/components/projects/ProjectsPanel.tsx`
- Routing: `src/routes/__root.tsx`, `src/routes/index.tsx`
- Layout primitives: `src/app/layout/*`

All steps are designed for React 19.1.1 + TanStack Router v1 (file‑based), ShadCN v3.3.1, TailwindCSS 4.1.1, and Tauri 2.8.x frontends.

---

Task 1 - Baseline Audit and Spec Extraction - Status: NOT COMPLETED

Step 1.1 - Confirm 3‑zone structure from Projects panel and table components (Header, Toolbar, Content+Footer) with responsive behavior and scroll boundaries based on `src/components/projects/table/ProjectsDataTable.tsx`. - Status: NOT COMPLETED

Step 1.2 - Catalog styling and utility classes used by the panel (rounded borders, border colors, gradients, shadows); capture palette constraints from `src/App.css`. - Status: NOT COMPLETED

Step 1.3 - Record Router patterns: root layout and outlet composition (`src/routes/__root.tsx`) and file‑based route usage (`src/routes/index.tsx`; generated `src/routeTree.gen.ts`). - Status: NOT COMPLETED

Step 1.4 - Capture layout expectations for sidebars/header/footer from `src/app/layout` to align page content spacing and scroll containers (no reliance required, but maintain consistent spacing). - Status: NOT COMPLETED

---

Task 2 - Shared Panel Design for sentic_club - Status: NOT COMPLETED

Sub-task 2.1 - Package and API surface - Status: NOT COMPLETED

Step 2.1.1 - Create workspace package `packages/layout-three-zone` exporting a composable panel: `ThreeZonePanel`, `PanelHeader`, `PanelToolbar`, `PanelContent`, `PanelFooter` (optional). - Status: NOT COMPLETED

Step 2.1.2 - Establish minimal props: `header` (ReactNode), `toolbar` (ReactNode), `footer` (ReactNode | null), children (content). Avoid prop drilling by encouraging composition slots. - Status: NOT COMPLETED

Step 2.1.3 - Provide convenience compound API: `<ThreeZonePanel.Header/>`, `<ThreeZonePanel.Toolbar/>`, `<ThreeZonePanel.Content/>`, `<ThreeZonePanel.Footer/>`. - Status: NOT COMPLETED

Sub-task 2.2 - Styling and Semantics - Status: NOT COMPLETED

Step 2.2.1 - Mirror container and zones CSS to match Weg Translator’s table host: `flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm`. - Status: NOT COMPLETED

Step 2.2.2 - Header zone fixed height ~54–64px; Toolbar zone auto height; Content `min-h-0` scroll area; optional Footer sticky below content (separate from scroll). - Status: NOT COMPLETED

Step 2.2.3 - Use ShadCN primitives for UI controls; enforce color tokens from WeGentic palette (App.css) and Tailwind config. - Status: NOT COMPLETED

Sub-task 2.3 - React 19 Compiler considerations - Status: NOT COMPLETED

Step 2.3.1 - Keep props stable; avoid unnecessary `useMemo`/`useCallback`; tables receive direct state (compiler optimizes). - Status: NOT COMPLETED

Step 2.3.2 - Support controlled state patterns for sorting/search/filters (if used); no internal polling logic inside layout primitives. - Status: NOT COMPLETED

---

Task 3 - Implement `packages/layout-three-zone` - Status: NOT COMPLETED

Step 3.1 - Scaffold package: `packages/layout-three-zone/package.json`, `tsconfig.json`, `src/index.ts`, `src/ThreeZonePanel.tsx`, `src/styles/panel.css`. - Status: NOT COMPLETED

Step 3.2 - Implement `ThreeZonePanel` with slots: `<Header/>`, `<Toolbar/>`, `<Content/>`, `<Footer/>`; CSS grid or flex with `grid-rows-[auto_auto_1fr]` or `flex-col` and fixed header. - Status: NOT COMPLETED

Step 3.3 - Add CSS classes mirroring `projects-table-toolbar-zone` behavior and visual parity (borders, gradients, subtle shadow). - Status: NOT COMPLETED

Step 3.4 - Export TypeScript types and ensure `@/` alias compatibility in consumers. - Status: NOT COMPLETED

Step 3.5 - Add unit tests for composition order and zone rendering using React Testing Library. - Status: NOT COMPLETED

---

Task 4 - Dashboard Page (placeholder) - Status: NOT COMPLETED

Sub-task 4.1 - Routing - Status: NOT COMPLETED

Step 4.1.1 - Add file‑based route `apps/sentic_club/src/routes/dashboard/index.tsx` via `createFileRoute("/dashboard")`. - Status: NOT COMPLETED

Step 4.1.2 - Ensure `__root.tsx` mounts app layout and renders `<Outlet/>`; include sidebars/header/footer if applicable. - Status: NOT COMPLETED

Sub-task 4.2 - Page Composition - Status: NOT COMPLETED

Step 4.2.1 - Compose `<ThreeZonePanel>`; Header: title “Dashboard”; actions placeholder (e.g., New… button) using ShadCN `Button`. - Status: NOT COMPLETED

Step 4.2.2 - Toolbar: search `Input`, filter `Select`, and quick actions (ghost buttons). Functional stubs only. - Status: NOT COMPLETED

Step 4.2.3 - Content: placeholder grid with empty state card and guidance text. - Status: NOT COMPLETED

Step 4.2.4 - Optional Footer: item counts / summary placeholder (parity with Projects table footer styling). - Status: NOT COMPLETED

---

Task 5 - Resources Page (placeholder) - Status: NOT COMPLETED

Sub-task 5.1 - Routing - Status: NOT COMPLETED

Step 5.1.1 - Add file‑based route `apps/sentic_club/src/routes/resources/index.tsx`. - Status: NOT COMPLETED

Sub-task 5.2 - Page Composition - Status: NOT COMPLETED

Step 5.2.1 - Compose `<ThreeZonePanel>`; Header: title “Resources”; actions placeholder (Import/Sync). - Status: NOT COMPLETED

Step 5.2.2 - Toolbar: search + filters for resource type/status (stubs). - Status: NOT COMPLETED

Step 5.2.3 - Content: placeholder table/list shell; empty state with CTA. - Status: NOT COMPLETED

---

Task 6 - Refactor Settings to 3‑zone - Status: NOT COMPLETED

Sub-task 6.1 - Inventory and Wrap - Status: NOT COMPLETED

Step 6.1.1 - Identify current Settings screen(s) in sentic_club; isolate the main panel component(s). - Status: NOT COMPLETED

Step 6.1.2 - Wrap Settings content inside `<ThreeZonePanel>`; Header: “Settings”; actions: Save/Reset placeholders; Toolbar: search or category filter (optional); Content: existing settings form/components. - Status: NOT COMPLETED

Step 6.1.3 - Ensure consistent spacing and scroll: Content hosts scroll; header/toolbar remain fixed within the panel. - Status: NOT COMPLETED

Sub-task 6.2 - Behavior Parity - Status: NOT COMPLETED

Step 6.2.1 - Wire existing save/cancel behaviors; keep IPC calls/hooks outside layout primitives. - Status: NOT COMPLETED

Step 6.2.2 - Add minimal tests for layout zones rendering and submission flow remains intact. - Status: NOT COMPLETED

---

Task 7 - Refactor Editor to 3‑zone - Status: NOT COMPLETED

Sub-task 7.1 - Header Mapping - Status: NOT COMPLETED

Step 7.1.1 - Map existing editor header (title, close/back, status) to `<ThreeZonePanel.Header>`; preserve keyboard shortcuts. - Status: NOT COMPLETED

Sub-task 7.2 - Toolbar Mapping - Status: NOT COMPLETED

Step 7.2.1 - Move editor actions (search/replace, segment navigation, validation) into `<ThreeZonePanel.Toolbar>` as ShadCN buttons/inputs (functional stubs where needed). - Status: NOT COMPLETED

Sub-task 7.3 - Content Mapping - Status: NOT COMPLETED

Step 7.3.1 - Place editor content (document/segments) into `<ThreeZonePanel.Content>` with `min-h-0` and internal scroll. - Status: NOT COMPLETED

Step 7.3.2 - Preserve existing footer/status bar (if any) or move to `<ThreeZonePanel.Footer>` for consistency. - Status: NOT COMPLETED

---

Task 8 - Routing Integration and Navigation - Status: NOT COMPLETED

Step 8.1 - Update navigation (sidebar/menu) to include `/dashboard` and `/resources`; keep `/settings` and `/editor` as is but with refactored content. - Status: NOT COMPLETED

Step 8.2 - Confirm TanStack Router file‑based route generation and types via `routeTree.gen.ts` in sentic_club. - Status: NOT COMPLETED

Step 8.3 - Add basic loader/placeholder states to avoid layout shift during data fetches. - Status: NOT COMPLETED

---

Task 9 - Theming, Tokens, and Styles - Status: NOT COMPLETED

Step 9.1 - Ensure WeGentic palette tokens exist in sentic_club `App.css` (align with Weg Translator’s tokens); wire Tailwind 4.1 config to reference tokens. - Status: NOT COMPLETED

Step 9.2 - Add shared CSS classes for the toolbar zone (e.g., `projects-table-toolbar-zone` parity) within the new package or app styles. - Status: NOT COMPLETED

Step 9.3 - Validate ShadCN v3.3.1 components render with correct contrast and ring colors from tokens. - Status: NOT COMPLETED

---

Task 10 - Testing and QA - Status: NOT COMPLETED

Step 10.1 - Unit tests: ThreeZonePanel renders all zones; Header/Toolbar fixed, Content scrolls. - Status: NOT COMPLETED

Step 10.2 - Page smoke tests: Dashboard/Resources/Settings/Editor mount without errors; keyboard nav accessible. - Status: NOT COMPLETED

Step 10.3 - Visual checks: borders, spacing, and shadows match Projects panel baseline. - Status: NOT COMPLETED

---

Task 11 - Performance and React 19 Compliance - Status: NOT COMPLETED

Step 11.1 - Verify no unnecessary `useMemo`/`useCallback` added; compiler warnings clean. - Status: NOT COMPLETED

Step 11.2 - Confirm controlled state patterns for tables/forms do not jitter under polling. - Status: NOT COMPLETED

---

Task 12 - Rollout & Documentation - Status: NOT COMPLETED

Step 12.1 - Incremental rollout: land shared package, then Dashboard/Resources, then Settings, then Editor. - Status: NOT COMPLETED

Step 12.2 - Create a short usage snippet in `packages/layout-three-zone/README.md` documenting composition API. - Status: NOT COMPLETED

Step 12.3 - Add a migration checklist to guarantee parity for Settings/Editor behavior. - Status: NOT COMPLETED

---

## Notes & References

- Reference 3‑zone structure: `src/components/projects/table/ProjectsDataTable.tsx` (Header, Toolbar, Content, with Footer inside content container)
- Host usage in Projects: `src/components/projects/ProjectsPanel.tsx`
- Router patterns: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routeTree.gen.ts`
- Layout shell and sidebars: `src/app/layout/layout-shell.tsx`, `src/app/layout/layout-sidebar-one.tsx`, `src/app/layout/layout-sidebar-two.tsx`
- React 19 Compiler: avoid unnecessary manual memoization; prefer stable props through simple objects and direct event handlers
- ShadCN + Tailwind 4.1.1: keep to provided WeGentic tokens from `src/App.css`

Outcome: Sentic Club’s Dashboard, Resources, Settings, and Editor will share a consistent 3‑zone panel layout, reducing duplication, aligning behavior, and improving maintainability while staying within React 19 + TanStack Router + ShadCN best practices.

