# Task 1 – Baseline Audit and Spec Extraction

## Step 1.1 – 3-zone Structure Confirmation
- `src/components/projects/table/ProjectsDataTable.tsx` wraps header, toolbar, content grid, and footer inside `flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm`.
- Footer remains outside the scrollable grid, matching the required fixed zones for new panels.

## Step 1.2 – Styling and Palette Inventory
- Table-specific CSS lives in `src/components/projects/table/data-table.css` and `dropdowns.css`, including custom properties (`--projects-table-*`) for heights, spacing, and typography.
- Global color tokens sourced from `src/App.css` (WeGentic palette) must back any new shared panel styles.

## Step 1.3 – Router Patterns
- Root route (`src/routes/__root.tsx`) mounts `MainLayout` slots and renders `<Outlet />` for nested pages.
- File-based routes defined with `createFileRoute` (e.g., `src/routes/index.tsx`), with generated types preserved in `src/routeTree.gen.ts`.

## Step 1.4 – Layout Expectations
- `src/app/layout/layout-shell.tsx` defines the grid template for header, sidebars, sidemenu, and main content; `layout-main.tsx` ensures the outlet is wrapped in a scrollable container with `min-height: 0`.
- Layout styles in `src/app/layout/css-styles/layout-main.css` keep content full-height and manage overflow, informing panel integration within the shell.
