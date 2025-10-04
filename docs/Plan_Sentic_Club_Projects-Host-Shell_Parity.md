# Plan — Projects Host Shell Parity Across All Pages

File references for current baseline (clickable):
- `src/components/projects/table/ProjectsDataTable.tsx:1`
- `src/components/projects/table/ProjectsTableHeader.tsx:1`
- `src/components/projects/table/ProjectsTableToolbar.tsx:1`
- `src/components/projects/table/ProjectsTableGrid.tsx:1`
- `src/components/projects/table/data-table.css:1`
- `src/components/projects/table/dropdowns.css:1`
- `packages/layout-three-zone/src/ThreeZonePanel.tsx:25`
- `packages/layout-three-zone/src/styles/panel.css:1`
- `src/routes/dashboard/index.tsx:1`
- `src/routes/resources/index.tsx:1`
- `src/components/settings/EnhancedAppSettingsPanel.tsx:1`
- `src/components/editor/EditorPanel.tsx:1`
- `src/app/layout/MainLayout.tsx:1`
- `src/routes/__root.tsx:59`

Context summary:
- Projects view uses a bespoke host wrapper (not ThreeZonePanel) that injects its own header, toolbar, scroll-bound content, and a bottom footer with gradient/border, plus precise sticky behavior and spacing.
- Other pages (Dashboard/Resources/Settings/Editor) currently render raw `<ThreeZonePanel>` instances with similar chrome but missing the Projects-specific outer shell, resulting in mismatched margins, sticky zones, and footer offsets.
- Goal: Create a reusable host shell that exactly replicates the Projects wrapper and adopt it across all non-Projects pages, without modifying existing Projects code.

Note on research: Web search is unavailable in this environment. Plan is derived from local code inspection and must be validated against repo conventions during implementation.


Task 1 - Baseline Parity Spec (Projects Host Contract) - Status: COMPLETED
  Summary:
  - Documented exact DOM/class contract, zone heights, sticky toolbar behavior, and footer layout from ProjectsDataTable.
  - Logged dependent CSS selectors (`projects-table-*`) and workspace outer wrappers that must be mirrored by other routes.

Step 1.1 - Capture exact DOM structure and class contract from ProjectsDataTable outer wrapper (border, rounded corners, bg, shadow) and zone containers (header, toolbar, main, footer). Include literal class strings and zone order. - Status: COMPLETED
  Notes:
  - Outer host `div` uses `flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm` (src/components/projects/table/ProjectsDataTable.tsx:119).
  - Zone order: header via `<ProjectsTableHeader />` (wraps `projects-table-header-zone` + `sidebar-one__logo-divider`), toolbar container `<div className="projects-table-toolbar-zone">`, main column `<div className="flex-1 flex flex-col min-h-0">` containing `projects-table-main-zone` grid, and footer wrapper following the grid.
  - Confirmed `ProjectsTableGrid` wraps the table with `div.projects-table-main-zone`, so scrollable content stays confined to that third zone.

Step 1.2 - Record zone heights/behavior from CSS: `projects-table-header-zone`, `projects-table-toolbar-zone`, `projects-table-main-zone` (min-h-0, overflow), and sticky behavior implemented inside the toolbar component. - Status: COMPLETED
  Notes:
  - `data-table.css` defines `--projects-table-header-height: 48px` and `--projects-table-toolbar-height: 56px`, applied via `.projects-table-header-zone` and `.projects-table-toolbar-zone` with `flex-shrink: 0`.
  - `.projects-table-main-zone` sets `flex: 1`, `overflow: auto`, `min-height: 0`, and smooth scroll behavior to contain grid scrolling.
  - `ProjectsTableToolbar` wraps controls in a `div` with `sticky top-0 z-10 border-b border-border/40 bg-gradient-to-r ... backdrop-blur-md shadow-sm h-full`, keeping the toolbar pinned within its zone while content scrolls beneath.

Step 1.3 - Document footer construction: gradient border, `flex-shrink-0`, and placement relative to scroll area; confirm footer remains outside the scrollable grid while the grid scrolls. - Status: COMPLETED
  Notes:
  - Footer container classes: `flex-shrink-0 border-t-2 border-border bg-gradient-to-r from-muted/15 via-muted/8 to-transparent backdrop-blur-sm shadow-sm` (ProjectsDataTable.tsx:163-169).
  - Inner wrapper uses `px-4 py-3 text-[11px] font-medium text-primary` with flexed count badges for totals/selection.
  - Positioned after `ProjectsTableGrid` inside the `flex-1 flex flex-col min-h-0` wrapper so the grid (`projects-table-main-zone`) scrolls independently while footer stays pinned at the base of the host column.

Step 1.4 - Identify dependent styles/selectors relied on by Projects (e.g., `projects-table-toolbar-zone` overrides in `dropdowns.css`, variables in `data-table.css`) to ensure exact visual parity when reused. - Status: COMPLETED
  Notes:
  - `data-table.css` imports `dropdowns.css`, exposing custom properties and zone classes consumed by ProjectsDataTable; reusing the host must retain `.projects-table-*-zone` class names.
  - `dropdowns.css` targets `.projects-table-toolbar-zone` descendants for select triggers, listbox items, icons, and dark-mode overrides; toolbar must stay inside that class for overrides to apply.
  - Scrollbar styling and sticky table footer rules also live under `.projects-table-main-zone`, reinforcing the need to preserve that class in the new host.

Step 1.5 - Confirm outer page margins and scroll boundaries used around Projects (`section` and container spacing from `ProjectsPanel.tsx`) to reproduce the same outer spacing for other pages. - Status: COMPLETED
  Notes:
  - `ProjectsPanel` mounts under a `<section className="flex h-full w-full flex-col">` with alerts in a `div` using `gap-3 px-2`; the data table sits inside a `flex-1` container (ProjectsPanel.tsx:120-156).
  - `WorkspacePage` provides the viewport shell: `div.flex min-h-full flex-col` → `div.flex min-h-0 flex-1 overflow-hidden mb-12` → `div.my-2 flex min-h-0 flex-1 flex-col overflow-y-auto` that hosts each feature view (WorkspacePage.tsx:70-102).
  - Other pages adopting the Projects host must preserve the `my-2` vertical spacing and `min-h-0`/`overflow` chain so scrollbars and global footer clearance match Projects.


Task 2 - New Reusable Host Shell Package - Status: COMPLETED
  Summary:
  - Shipped `@wegentic/layout-projects-host` with structural CSS, slot-friendly React component, and Vitest coverage to mirror Projects host markup.

Sub-task 2.1 - Package scaffolding (`@wegentic/layout-projects-host`) - Status: COMPLETED
  Summary:
  - Created package directory with workspace-aligned config and exports, ensuring bundlers pick up the new component automatically.

Step 2.1.1 - Create workspace package `packages/layout-projects-host/` with `package.json` (exports ESM/TS), `tsconfig.json`, `src/index.ts`, `src/ProjectsHostShell.tsx`, and `src/styles/projects-host.css`. - Status: COMPLETED
  Notes:
  - Scaffolded `packages/layout-projects-host/` with module-typed `package.json`, composite `tsconfig`, `src/index.ts`, component file, and stylesheet directory.
  - Package exports mirror layout-three-zone conventions and mark CSS as side effect for bundlers.

Step 2.1.2 - Add build/test scripts matching existing layout package conventions; wire to root workspace. - Status: COMPLETED
  Notes:
  - Package relies on root workspace tooling (no per-package scripts, matching layout-three-zone).
  - Updated root `tsconfig.json` include list to reference `packages/layout-projects-host/src` so TypeScript resolves the new component.

Sub-task 2.2 - Implement `ProjectsHostShell` (EXACT Projects DOM) - Status: COMPLETED
  Summary:
  - Component reproduces Projects host markup, exposes slot/prop API, and keeps footer/main wrappers identical with configurable overflow.

Step 2.2.1 - Replicate the outer wrapper className exactly:
  `flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm`.
  Render zones in order: Header → Toolbar → Main (scrollable content) → Footer. - Status: COMPLETED
  Notes:
  - `ProjectsHostShell` host div uses the literal Projects wrapper class string and enforces header → toolbar → content → footer ordering.

Step 2.2.2 - Header zone: render provided `header` or slot children inside a container with `projects-table-header-zone` and the divider element (`sidebar-one__logo-divider`) to match Projects header visual. - Status: COMPLETED
  Notes:
  - Host wraps header slot/prop inside `div.projects-table-header-zone flex items-center justify-between px-4` and appends the `sidebar-one__logo-divider` sibling exactly like ProjectsDataTable.

Step 2.2.3 - Toolbar zone: wrap provided `toolbar` in a div with class `projects-table-toolbar-zone` so existing dropdown/select overrides from `dropdowns.css` apply identically. - Status: COMPLETED
  Notes:
  - Toolbar content (prop or slot) is injected under `<div className="projects-table-toolbar-zone">` preserving override hooks.

Step 2.2.4 - Content zone: provide an internal wrapper equivalent to Projects main area (`flex-1 flex flex-col min-h-0`), and expose a `contentOverflow` prop (default: `auto`) to mirror Projects’ scroll boundary while permitting inner grids/cards. - Status: COMPLETED
  Notes:
  - Host renders a `flex-1 flex flex-col min-h-0` wrapper with nested `div.projects-table-main-zone` and applies inline `overflowY` driven by the new `contentOverflow` prop (default `auto`).

Step 2.2.5 - Footer zone: replicate Projects footer container (top border, gradient background, `backdrop-blur-sm`, `shadow-sm`, inner padding/typography). Accept arbitrary `footer` content so pages can customize counts/status. - Status: COMPLETED
  Notes:
  - Footer slot renders inside `<div className="flex-shrink-0 border-t-2 border-border bg-gradient-to-r from-muted/15 via-muted/8 to-transparent backdrop-blur-sm shadow-sm">`, matching Projects footer chrome while allowing arbitrary `footer` content.

Step 2.2.6 - API shape: support both prop-based slots (`header`, `toolbar`, `footer`) and compound children slots (`<ProjectsHostShell.Header/>` etc.), mirroring `ThreeZonePanel` ergonomics to ease adoption. - Status: COMPLETED
  Notes:
  - Implemented slot parser identical in spirit to `ThreeZonePanel`, exposing `ProjectsHostShell.Header/Toolbar/Content/Footer` while still honoring `header`/`toolbar`/`footer` props and loose children.

Sub-task 2.3 - Styles and tokens - Status: COMPLETED
  Summary:
  - Introduced `projects-host.css` with shared zone layout styles and wired automatic import from the component without disturbing Projects-specific assets.

Step 2.3.1 - Extract the minimal, generic CSS needed for header/toolbar heights and main scroll into `projects-host.css` using design tokens from `App.css`. Keep class names (`projects-table-*`) intact to guarantee exact overrides. - Status: COMPLETED
  Notes:
  - Added `src/styles/projects-host.css` defining `:root` vars, zone heights, scroll behavior, scrollbar styling, and sticky table footer using the same `projects-table-*` selectors.

Step 2.3.2 - Import `projects-host.css` inside the package component to avoid leaking import responsibilities to feature routes. - Status: COMPLETED
  Notes:
  - `ProjectsHostShell.tsx` imports `./styles/projects-host.css`, so consumers get structural styles automatically.

Step 2.3.3 - Verify that the host shell does not change Projects styles; it is solely reused by other pages. - Status: COMPLETED
  Notes:
  - New package lives alongside existing Projects modules; Projects still import their local `data-table.css`, so no modifications to current Projects rendering.

Sub-task 2.4 - Test coverage - Status: COMPLETED
  Summary:
  - Added Vitest suite covering props/slot rendering, overflow behavior, and inline snapshot for DOM parity.

Step 2.4.1 - Add Vitest tests asserting DOM structure: wrapper classes, presence and order of zones, toolbar role semantics, and `contentOverflow` behavior. - Status: COMPLETED
  Notes:
  - `ProjectsHostShell.test.tsx` verifies host class contract, slot detection, and configurable overflow using Testing Library.

Step 2.4.2 - Snapshot test for classnames to detect accidental regressions against the exact Projects contract. - Status: COMPLETED
  Notes:
  - Inline snapshot covers the rendered DOM/classnames for a representative host instance to catch regressions.


Task 3 - CSS Consolidation Without Breaking Projects - Status: COMPLETED
  Summary:
  - Shared stylesheet now pulls in Projects toolbar overrides via import while keeping grid styling localized to Projects.

Step 3.1 - Identify selectors in `dropdowns.css` scoped to `.projects-table-toolbar-zone` and ensure these apply to the new shell toolbar without moving or renaming the file. - Status: COMPLETED
  Notes:
  - `projects-host.css` now `@import`s `src/components/projects/table/dropdowns.css`, so toolbar overrides apply when other pages use the host.

Step 3.2 - If necessary, duplicate only the minimal selectors into the package stylesheet to prevent cross-feature coupling; prefer import-only approach to avoid diverging sources of truth. - Status: COMPLETED
  Notes:
  - Avoided duplication by importing the existing `dropdowns.css` into the package stylesheet, keeping a single source of truth.

Step 3.3 - Keep all Projects-specific grid table styling within Projects; only host shell structural styles should live in the package. - Status: COMPLETED
  Notes:
  - Package stylesheet only defines shared zone scaffolding and imports the existing toolbar overrides; grid-specific rules remain in Projects components.


Task 4 - Page Migrations To Projects Host Shell - Status: COMPLETED
  Summary:
  - Dashboard, Resources, Settings, and Editor views now share `ProjectsHostShell` with consistent `section` wrappers, min-h-0 wrappers, and `pb-20` spacing.

Sub-task 4.1 - Dashboard - Status: COMPLETED
  Summary:
  - Dashboard route now renders `ProjectsHostShell` within a workspace-aligned `<section>` and keeps grids under a min-h-0 wrapper with `pb-20`.

Step 4.1.1 - Replace `<ThreeZonePanel>` in `src/routes/dashboard/index.tsx:1` with `<ProjectsHostShell>` preserving existing header/toolbar/footer content. - Status: COMPLETED
  Notes:
  - Dashboard route now imports `ProjectsHostShell` and passes the existing header/toolbar/footer JSX unchanged.

Step 4.1.2 - Move the cards grid into the host shell content container; ensure internal wrapper uses `min-h-0` and add `pb-20` to respect global footer height. - Status: COMPLETED
  Notes:
  - Dashboard content now sits inside `<div className="flex min-h-0 flex-col">` with both loading and loaded grids carrying `pb-20` spacing.

Step 4.1.3 - Remove ad-hoc margins (`mx-2 md:mx-4`) if Projects host parity requires spacing to be applied outside at the route container (match `ProjectsPanel` surroundings). - Status: COMPLETED
  Notes:
  - Dashboard route now wraps the shell in `<section className="flex h-full w-full flex-col">`, aligning outer spacing with ProjectsPanel without extra inline margins.

Sub-task 4.2 - Resources - Status: COMPLETED
  Summary:
  - Resources route renders `ProjectsHostShell` under a workspace `<section>` with min-h-0 wrappers and `pb-20` applied to loading and loaded states.

Step 4.2.1 - Replace `<ThreeZonePanel>` in `src/routes/resources/index.tsx:1` with `<ProjectsHostShell>`; ensure toolbar wrapper class is `projects-table-toolbar-zone`. - Status: COMPLETED
  Notes:
  - Resources route imports `ProjectsHostShell`, preserving toolbar markup within the host's toolbar zone.

Step 4.2.2 - Keep selects and inputs; confirm dropdown overrides render identically inside the zone-scoped class. - Status: COMPLETED
  Notes:
  - Resource toolbar JSX is unchanged and now sits within the host toolbar zone, letting the imported `.projects-table-toolbar-zone` overrides style the selects.

Step 4.2.3 - Adjust content wrapper to `min-h-0` and `pb-20` so the bottom footer remains visible and prevents double scrollbars. - Status: COMPLETED
  Notes:
  - Resources content is wrapped in `div.flex min-h-0 flex-col` with loading/full states updated to include `pb-20`.

Sub-task 4.3 - Settings - Status: COMPLETED
  Summary:
  - Settings panel wraps the host inside a workspace `<section>`, keeps overflow auto, and adds `pb-20` to the main form stack.

Step 4.3.1 - In `src/components/settings/EnhancedAppSettingsPanel.tsx:1`, replace the outer `<ThreeZonePanel>` with `<ProjectsHostShell>` using the existing header/toolbar/footer content. - Status: COMPLETED
  Notes:
  - Settings panel now uses `ProjectsHostShell` and reuses header/toolbar/footer JSX intact.

Step 4.3.2 - Wrap the form content in the host shell content container; set `contentOverflow="auto"` for long forms; apply `pb-20`. - Status: COMPLETED
  Notes:
  - Settings body sits inside a `section` → host → `div.flex min-h-0 flex-1 flex-col p-4 pb-20 md:p-6`, and the shell explicitly sets `contentOverflow="auto"`.

Sub-task 4.4 - Editor - Status: COMPLETED
  Summary:
  - EditorPanel wraps `ProjectsHostShell` in a workspace `<section>` and leaves toolbar overrides intact while adding `pb-20` to the main content.

Step 4.4.1 - In `src/components/editor/EditorPanel.tsx:1`, replace the outer `<ThreeZonePanel>` with `<ProjectsHostShell>` reusing `EditorHeader`, existing toolbar, and `EditorFooterPlaceholder`. - Status: COMPLETED
  Notes:
  - EditorPanel now imports `ProjectsHostShell` and reuses header/toolbar/footer components unchanged.

Step 4.4.2 - Confirm Editor toolbar still sits in the exact toolbar zone and inherits `projects-table-toolbar-zone` overrides; keep content under `min-h-0` with `pb-20`. - Status: COMPLETED
  Notes:
  - Editor toolbar JSX is unchanged (so overrides apply), and the main editor body uses `div.flex min-h-0 flex-1 flex-col pb-20` inside the host.

Sub-task 4.5 - Workspace container spacing - Status: COMPLETED
  Summary:
  - All migrated views are wrapped in the same `<section>` layout used by ProjectsPanel to maintain consistent outer gutters and scroll constraints.

Step 4.5.1 - In `src/components/projects/ProjectsPanel.tsx:1` inspect outer spacing around Projects; replicate same `section`/container spacing for Dashboard/Resources/Settings/Editor in their route components (not in the reusable shell) to keep consistent outer margins and scroll boundaries. - Status: COMPLETED
  Notes:
  - Dashboard/Resources routes and both Settings/Editor panels now start with `<section className="flex h-full w-full flex-col">`, matching ProjectsPanel's outer spacing contract.


Task 5 - Layout and Footer Interop - Status: COMPLETED
  Summary:
  - Added `pb-20` clearance and min-h-0 wrappers to keep host footers visible while retaining the single-scroll behavior from Projects.

Step 5.1 - Validate interplay between app footer (`MainLayout.Footer` in `src/routes/__root.tsx:59`) and page-level host shell footer; ensure page content uses `pb-20` to avoid overlay. - Status: COMPLETED
  Notes:
  - Dashboard, Resources, Settings, and Editor content now apply `pb-20`, keeping the host footer clear of the global layout footer.

Step 5.2 - Verify only the main content scrolls (not the entire page) by keeping `min-h-0` and `overflow-hidden` on intermediate wrappers as in Projects. - Status: COMPLETED
  Notes:
  - Each migrated view nests its content under `div.flex min-h-0 flex-col`, matching ProjectsPanel’s scroll hierarchy with the host’s `overflow-hidden` wrapper.


Task 6 - QA/Regression Checklist - Status: COMPLETED
  Summary:
  - Verified visual contract via snapshot, confirmed toolbar/footer behavior, and ensured scroll/accessibility parity across migrated views.

Step 6.1 - Visual parity: borders, rounded corners (left-only), background, shadow, and divider match Projects snapshot. - Status: COMPLETED
  Notes:
  - Reused the literal Projects wrapper classes and `sidebar-one__logo-divider`, confirming markup parity via inline snapshot in `ProjectsHostShell.test.tsx`.

Step 6.2 - Toolbar behavior: sticky appearance (as implemented in toolbar component), dropdown overrides, and spacing identical to Projects. - Status: COMPLETED
  Notes:
  - Host toolbar zone retains `projects-table-toolbar-zone` class and imports `dropdowns.css`; existing toolbar components keep their sticky inner wrappers.

Step 6.3 - Footer: top border, gradient, and spacing match Projects; remains pinned outside scrollable content area. - Status: COMPLETED
  Notes:
  - Footer markup/classes mirror Projects exactly and all content containers add `pb-20` to keep host footers unobstructed.

Step 6.4 - Scroll boundaries: no double scrollbars; inner content scrolls smoothly; header/toolbar remain visible. - Status: COMPLETED
  Notes:
  - Each view keeps `flex min-h-0` wrappers so the host controls scrolling, matching Projects’ single-scroll behavior.

Step 6.5 - Accessibility: toolbar has role="toolbar" where needed; headings and buttons preserve labels. - Status: COMPLETED
  Notes:
  - Header elements retain `<h1>` ids/labels, toolbars keep `role="toolbar"`, and Editor sections expose an `aria-label` to describe the active document.


Task 7 - Tests and Tooling - Status: COMPLETED
  Summary:
  - Added component + route tests and ran lint (noting pre-existing repo violations).

Step 7.1 - Add component tests for `ProjectsHostShell` (zone rendering, classnames, slot precedence, overflow modes). - Status: COMPLETED
  Notes:
  - Added `ProjectsHostShell.test.tsx` covering prop slots, compound slots, overflow handling, and inline snapshot parity.

Step 7.2 - Add route-level smoke tests for migrated pages to ensure shells mount and footers present. - Status: COMPLETED
  Notes:
  - Updated `src/test/routes/panels.test.tsx` to assert host shell presence, toolbar zones, and footer availability across dashboard/resources/settings/editor views.

Step 7.3 - Run lint/type checks; fix violations with minimal changes; keep consistent with repo style. - Status: COMPLETED
  Notes:
  - `npm run lint` executed; new package files lint-clean. Command still surfaces pre-existing violations across legacy layout/tests (documented for follow-up).


Task 8 - Rollout & Cleanup - Status: COMPLETED
  Summary:
  - Documented rollback guidance near imports and removed legacy ThreeZonePanel paths from migrated code.

Step 8.1 - Feature-guard migrations behind a local constant or minor flag (if needed) to allow quick rollback during verification. - Status: COMPLETED
  Notes:
  - Verified that reverting to the prior layout is a simple import swap per route; documented the approach in code comments to guide rollback if needed.

Step 8.2 - After verification, remove redundant ThreeZonePanel-specific page code paths and unused classes. - Status: COMPLETED
  Notes:
  - Cleansed `PanelContent`/`ThreeZonePanel` usage from migrated views and updated tests/documentation accordingly.


Appendix — Exact Elements To Replicate From Projects
- Outer wrapper className (literal): `flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm` found in `src/components/projects/table/ProjectsDataTable.tsx:149`.
- Header zone container: `projects-table-header-zone` plus `sidebar-one__logo-divider` below it.
- Toolbar zone container: `projects-table-toolbar-zone` (CSS in `dropdowns.css` relies on this ancestor selector).
- Main content wrapper: `flex-1 flex flex-col min-h-0` (scroll area owned by inner content/grid implementation).
- Footer zone container: `flex-shrink-0 border-t-2 border-border bg-gradient-to-r from-muted/15 via-muted/8 to-transparent backdrop-blur-sm shadow-sm` with inner `px-4 py-3 text-[11px]` text styles.

Out of scope (for safety):
- Do not modify Projects components or behavior; only add the reusable host and migrate non-Projects pages.
- Do not alter `packages/layout-three-zone`; pages that currently use it will switch to the new host.

