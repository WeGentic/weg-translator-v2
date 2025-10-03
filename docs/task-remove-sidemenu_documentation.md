# Legacy Sidebar Removal Notes

## Summary
- Removed the legacy sidemenu implementation (`LayoutSidemenu`) and its Zustand state so the workspace relies exclusively on the new Sidebar One/Two rails.
- Deleted the AppSidebar/UI plumbing that previously injected navigation via `setSidemenuContent`, preventing the old panel from reappearing when users interact with Sidebar One.
- Simplified header/editor components to drop sidemenu toggles and cleaned up related store exports, layout shell math, and TanStack root config.

## Key Files
- `src/app/layout/layout-store.ts`: pruned sidemenu types/actions; store now tracks header, footer, sidebarOne, sidebarTwo, main.
- `src/app/layout/layout-shell.tsx`, `src/app/layout/layout-main.tsx`: updated grid calculations to cover only Sidebar One/Two + Main.
- `src/routes/__root.tsx`, `src/features/workspace/WorkspacePage.tsx`, `src/components/editor/EditorHeader.tsx`: removed sidemenu wiring and legacy sidebar placeholders.

## Follow-up
- Future tasks should populate Sidebar Two with contextual tools (editor/project specifics) to replace the retired AppSidebar features.
- Run a full TanStack router QA pass once dashboard/resources routes ship to confirm navigation events still update Sidebar Two titles correctly.
