# Editor Mode UI Notes

## Header
- Replaces the standard `AppHeader` with the new `EditorHeader` when the active view targets an editor tab.
- `EditorHeader` darkens the surface (`bg-primary` with `text-primary-foreground`) and swaps the user menu for a "Close editor" tooltip icon button.
- The leading control now toggles between hidden and compact sidebar states so editor mode never expands the navigation rail.

## Sidebar
- Editor mode captures the previous sidemenu configuration and constrains it to compact/hidden only, restoring the snapshot when the user leaves the editor.
- The layout mount still happens in `WorkspacePage`, but the content is replaced with `EditorSidebarPlaceholder`, which reuses `AppSidebar` chrome so the compact rail looks identical to the project view while supplying placeholder items.
- Header buttons and toggle affordances continue to route through the layout store to stay consistent with the custom layout system.

## Footer
- Editor sessions render `EditorFooterPlaceholder`, giving the footer a tinted background and reserving space for upcoming status indicators.
- The original `WorkspaceFooter` returns automatically after closing the editor thanks to a dedicated effect that switches the slot content based on `isEditorView`.

## Layout Integration
- All header, sidebar, and footer swaps go through the layout store so grid sizing stays in sync.
- `WorkspacePage` now tracks editor state, caches the non-editor sidemenu snapshot, and restores it to avoid breaking navigation outside the editor context.
- New components live in `src/components/editor` alongside the existing placeholder to keep editor-specific UI cohesive.
