# Project Overview + Sidebar UI/UX Revamp — Execution Plan

Scope: Compact the Project Overview UI, introduce an Editor area, and rework the sidebar navigation. Align with React 19.1.1, TailwindCSS 4.1.x, and ShadCN components used in this codebase.

Context snapshot (grounded in current code):
- Project overview: `src/components/projects/overview/ProjectOverview.tsx`
- Overview placeholder: `src/components/projects/overview/ProjectOverviewPlaceholder.tsx`
- Projects list: `src/components/projects/ProjectsPanel.tsx`
- Sidebar + main view switching: `src/App.tsx`, `src/app/layout/chrome/sidebar/AppSidebar.tsx`
- ShadCN components present under `src/components/ui/*` (Button, Card, Dialog, Table, Separator, etc.)

Assumptions:
- React 19 + new compiler already configured (package.json confirms React 19.1.1; babel-plugin-react-compiler present).
- TailwindCSS v4.1.x is active; use line-clamp utilities (built-in in v4) and spacing utilities for compactness.
- ShadCN-style primitives are in place under `src/components/ui` and should be reused.


Task 1 - Sidebar refactor (sections + Settings sticky footer) - Status: COMPLETED
Sub-task 1.1 - Replace fixedItems with minimal set - Status: COMPLETED
Step 1.1.1 - Remove Workspace, Jobs, History from menu construction in `src/App.tsx` and only keep `Projects` and `Settings` - Status: COMPLETED
Details: Updated `fixedItems` in `src/App.tsx` to include only `projects` and `settings`. Also set initial `mainView` to `projects`.
Step 1.1.2 - Introduce a new pseudo-key for Editor area (e.g., `editor:<projectId>`) in `MainView` type and routing switch - Status: COMPLETED
Details: Added `EDITOR_VIEW_PREFIX`, `EditorViewKey`, `toEditorViewKey`, and `parseEditorProjectIdFromKey` in `src/App.tsx`. `MainView` now supports both `project:<id>` and `editor:<id>`.

Sub-task 1.2 - Sidebar sections and sticky Settings - Status: COMPLETED
Step 1.2.1 - Update `src/app/layout/chrome/sidebar/AppSidebar.tsx` to support two sections: “Project” (Projects + open projects) and “Editor” (project-specific editor views). Add a visually separated sticky footer for Settings - Status: COMPLETED
Details: Refactored `AppSidebar` to render two `<nav>` groups with `temporaryItems` under Projects and `editorItems` for Editor. Introduced sticky footer region for Settings.
Step 1.2.2 - Implement a `footer` region using `sticky bottom-0 border-t border-border bg-background` containing a single Settings button (icon + label), separated by a `Separator` or border - Status: COMPLETED
Details: Added footer container with `sticky bottom-0 border-t border-border bg-background/70 p-2`; moved the Settings item into this footer automatically.
Step 1.2.3 - Add `aria-label` on each `<nav>` group to distinguish sections (e.g., `aria-label="Project navigation"`, `aria-label="Editor navigation"`) - Status: COMPLETED
Details: Applied `aria-label` to both navs for Project and Editor sections.
Step 1.2.4 - Preserve keyboard access and focus rings on all interactive items; ensure icon-only buttons have `aria-label` - Status: COMPLETED
Details: Kept existing button semantics and focus-visible styles; maintained `aria-current` and `aria-label` on items; close buttons remain accessible.

Sub-task 1.3 - Temporary (project) items restructuring - Status: COMPLETED
Step 1.3.1 - Keep temporary project items nested under Projects in the Project section. For each open project, also add a sibling Editor item under the Editor section keyed by `editor:<projectId>` - Status: COMPLETED
Details: Added `temporaryEditorItems` in `src/App.tsx` using `toEditorViewKey(projectId)` and passed as `editorItems` to `AppSidebar`.
Step 1.3.2 - Ensure `selectedKey` supports both `project:<id>` and `editor:<id>` patterns and renders the correct view - Status: COMPLETED
Details: `MainView` now includes `editor:<id>` and `App.tsx` renders `<ProjectEditor>` when an editor key is active.


Task 2 - Project Overview header: compact sub-header (remove Languages card) - Status: COMPLETED
Sub-task 2.1 - Design compact header content - Status: COMPLETED
Step 2.1.1 - Replace the Languages card in `src/components/projects/overview/ProjectOverview.tsx` with a compact sub-header showing: Project name, slug, default src→tgt, file count, created/updated (second line, muted) - Status: COMPLETED
Details: Implemented `OverviewHeader` and removed the Languages card from `ProjectOverview.tsx`.
Step 2.1.2 - Use Tailwind utilities for compact layout: `text-sm` for metadata, `text-xs text-muted-foreground` for secondary line, `line-clamp-1`/`truncate` for overflow - Status: COMPLETED
Details: Header uses `text-xl` title, `text-xs text-muted-foreground` metadata line, and `truncate/title` for overflow.
Step 2.1.3 - Keep the “Add files” action near the header (right-aligned) with size `sm` to preserve compactness - Status: COMPLETED
Details: `OverviewHeader` renders a right-aligned `Add files` button with `size="sm"`.

Sub-task 2.2 - Extract header into single-scoped component - Status: COMPLETED
Step 2.2.1 - Add `src/components/projects/overview/components/OverviewHeader.tsx` with props: `{ project: ProjectListItem; details?: ProjectDetails; onAddFiles: () => void; autoConvertOnOpen: boolean }` - Status: COMPLETED
Details: New component created and composed in `ProjectOverview.tsx`.
Step 2.2.2 - Move the auto-convert disabled banner logic into a tiny child component `OverviewAutoConvertBanner` in the same folder for clarity - Status: COMPLETED
Details: Created `OverviewAutoConvertBanner.tsx` and integrated in `ProjectOverview.tsx` below header.


Task 3 - Files area: compact two-line rows + Editor action - Status: COMPLETED
Sub-task 3.1 - Choose structure and layout - Status: COMPLETED
Step 3.1.1 - Replace the current table with a compact list component when tabular sorting isn’t required; otherwise, compress the table to two-line rows per item (primary + secondary) inside the first cell - Status: COMPLETED
Details: Replaced table with `FileList` in `ProjectOverview.tsx` and added list components.
Step 3.1.2 - Given current needs (no column-based sorting), implement a list: `FileList.tsx` and `FileListItem.tsx` under `src/components/projects/overview/components/files/` using `<ul>/<li>` with semantic roles and ShadCN styling - Status: COMPLETED
Details: Implemented new components; each item displays primary and secondary lines as specified.
Step 3.1.3 - Primary line: original filename (bold, truncated). Secondary line: ext, size, import status, and quick conversions summary (badges) in muted color - Status: COMPLETED
Details: Implemented truncation with `truncate` and inline badges via `StatusBadge`.

Sub-task 3.2 - Editor button and actions - Status: COMPLETED
Step 3.2.1 - Add an `Editor` button on each item (right side). On click, dispatch `app:navigate` with `{ view: 'editor', projectId, fileId }` or select `mainView = editor:<projectId>` and store `selectedFileId` in a new top-level state - Status: COMPLETED
Details: `FileList` dispatches `app:navigate` with `{ view: 'editor', projectId, fileId }` when clicking Editor.
Step 3.2.2 - Keep Remove (trash) action as icon-only button with `aria-label="Remove file"`; confirm via existing remove dialog - Status: COMPLETED
Details: Remove icon triggers the existing confirmation dialog via `setIsRemoveOpen(fileId)`.
Step 3.2.3 - Ensure keyboard accessibility: actions in tab order, visible focus states - Status: COMPLETED
Details: Buttons use ShadCN focus-visible styles; icon-only remove has `aria-label`.

Sub-task 3.3 - Status badges and truncation - Status: COMPLETED
Step 3.3.1 - Reuse `StatusBadge` from `ProjectOverview.tsx` but move it to `overview/components/StatusBadge.tsx` for single-scope reuse - Status: COMPLETED
Details: Added `StatusBadge.tsx` and used it in the list items.
Step 3.3.2 - For long lists of conversions, cap display with `line-clamp-1` or render up to N badges and add a `+N more` indicator - Status: COMPLETED
Details: Showing up to 4 badges per row and a `+N more` chip beyond that.

Sub-task 3.4 - Extract dialogs and queue modal - Status: COMPLETED
Step 3.4.1 - Move Add/Remove `Dialog` blocks to `overview/components/dialogs/{AddFilesDialog,RemoveFileDialog}.tsx` - Status: COMPLETED
Details: Migrated both dialogs into dedicated components and wired ProjectOverview to use them.
Step 3.4.2 - Move the Ensure conversions modal to `overview/components/EnsureQueueModal.tsx` with props for plan, progress, logs, handlers - Status: COMPLETED
Details: Created EnsureQueueModal with progress props and replaced the inline queue dialog.


Task 4 - Editor area (placeholder) - Status: COMPLETED
Sub-task 4.1 - New view components - Status: COMPLETED
Step 4.1.1 - Create `src/components/projects/editor/ProjectEditor.tsx` (placeholder): header with project name, optional selected file info, and a stubbed editor surface - Status: COMPLETED
Step 4.1.2 - Optionally add `ProjectEditorPlaceholder.tsx` for fallback when project/file context is missing - Status: COMPLETED
Details: Added ProjectEditorPlaceholder and render fallback when editor context is missing.

Sub-task 4.2 - Wiring navigation and state - Status: COMPLETED
Step 4.2.1 - Extend `MainView` type in `src/App.tsx` to include `editor:<projectId>` and parse functions like existing `project:` helpers - Status: COMPLETED
Step 4.2.2 - Add `selectedFileId` in `App.tsx` state, set from the Editor button in file list, and pass it to `ProjectEditor` - Status: COMPLETED
Details: Added `selectedFileId` and set it from global event when navigating to editor with file context.
Step 4.2.3 - Render `ProjectEditor` when `mainView` matches `editor:<id>` and the corresponding project exists in `openProjects` - Status: COMPLETED

Sub-task 4.3 - Sidebar Editor entries - Status: COMPLETED
Step 4.3.1 - In `App.tsx`, build Editor temporary items mirroring open projects: label “Editor — {project.name}” with a document icon; `key = editor:<projectId>` - Status: COMPLETED
Details: Added `temporaryEditorItems` mirroring open projects; labels use “Editor — {project.name}”.
Step 4.3.2 - In `AppSidebar.tsx`, render an “Editor” section with these items; ensure close buttons only close the project’s Editor entry (does not close the project) - Status: COMPLETED
Details: Editor items appear in a dedicated nav group; close button uses the same handler as project close.


Task 5 - Single-scoped file organization - Status: COMPLETED
Sub-task 5.1 - Overview components - Status: COMPLETED
Step 5.1.1 - Create `src/components/projects/overview/components/OverviewHeader.tsx` - Status: COMPLETED
Step 5.1.2 - Create `src/components/projects/overview/components/OverviewAutoConvertBanner.tsx` - Status: COMPLETED
Step 5.1.3 - Create `src/components/projects/overview/components/StatusBadge.tsx` - Status: COMPLETED
Step 5.1.4 - Create `src/components/projects/overview/components/files/FileList.tsx` and `FileListItem.tsx` - Status: COMPLETED
Step 5.1.5 - Create `src/components/projects/overview/components/dialogs/AddFilesDialog.tsx` and `RemoveFileDialog.tsx` - Status: COMPLETED
Details: Added scoped dialog components and exposed them for ProjectOverview.
Step 5.1.6 - Create `src/components/projects/overview/components/EnsureQueueModal.tsx` - Status: COMPLETED
Details: Provided EnsureQueueModal to encapsulate queue progress UI with accessibility hooks.
Step 5.1.7 - Refactor `ProjectOverview.tsx` to compose these components; keep business logic and IPC calls in `ProjectOverview.tsx` - Status: COMPLETED
Details: Updated ProjectOverview to compose header/list modules while delegating dialogs and queue modal to the new scoped components.

Sub-task 5.2 - Editor components - Status: COMPLETED
Step 5.2.1 - Create `src/components/projects/editor/ProjectEditor.tsx` (placeholder) - Status: COMPLETED
Details: Enriched ProjectEditor with project header, context summary, and editor surface placeholder.
Step 5.2.2 - Optionally create `src/components/projects/editor/ProjectEditorPlaceholder.tsx` - Status: COMPLETED
Details: Added placeholder component and render path in App.tsx for missing editor context.


Task 6 - Styling and compactness guidelines (Tailwind v4 + ShadCN) - Status: COMPLETED
Sub-task 6.1 - Header and list density - Status: COMPLETED
Step 6.1.1 - Use `text-sm` for primary labels and `text-xs text-muted-foreground` for secondary metadata - Status: COMPLETED
Step 6.1.2 - Use `truncate` and `title={fullValue}` for one-line truncation; for multi-line, use `line-clamp-2` - Status: COMPLETED
Step 6.1.3 - Reduce paddings: rows `px-3 py-2`, header `py-3`, containers `gap-3` - Status: COMPLETED

Sub-task 6.2 - Actions and icons - Status: COMPLETED
Step 6.2.1 - `Editor` uses `size="sm"` or `size="icon"` based on viewport; hide text on small screens via `hidden sm:inline` - Status: COMPLETED
Step 6.2.2 - Ensure `aria-label` for icon-only buttons (Remove, Editor) - Status: COMPLETED
Step 6.2.3 - Keep focus styles: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50` - Status: COMPLETED


Task 7 - Navigation events and compatibility - Status: COMPLETED
Sub-task 7.1 - Global events - Status: COMPLETED
Step 7.1.1 - Extend current global event `app:navigate` to accept `{ view: 'editor', projectId?: string, fileId?: string }` while preserving existing cases (projects, settings) - Status: COMPLETED
Step 7.1.2 - Update the `useEffect` listener in `src/App.tsx` to route `view: 'editor'` to `editor:<projectId>` when provided (fallback to projects if missing) - Status: COMPLETED
Details: The global event handler now supports `editor` with `projectId` and optional `fileId`, updating `selectedFileId` and routing accordingly.


Task 8 - Tests updates - Status: COMPLETED
Sub-task 8.1 - Unit tests (TS) - Status: COMPLETED
Step 8.1.1 - Update `src/components/projects/overview/ProjectOverview.test.tsx` to match the compact header (no Languages card) and list markup - Status: COMPLETED
Details: Adjusted overview tests for new header assertions, dialog controls, and list semantics.
Step 8.1.2 - Add tests for `FileListItem` minimum rendering (name, secondary meta, Editor button presence, remove action) - Status: COMPLETED
Details: Added FileListItem tests covering metadata display and action callbacks.
Step 8.1.3 - Add simple render test for `ProjectEditor` placeholder - Status: COMPLETED
Details: Added editor tests ensuring both primary and placeholder views render as expected.


Task 9 - Non-functional checks - Status: COMPLETED
Sub-task 9.1 - Accessibility - Status: COMPLETED
Step 9.1.1 - Verify roles/labels for list and controls; ensure header levels remain logical; separators use `aria-hidden` - Status: COMPLETED
Details: Confirmed list roles, added aria-hidden on separators, and marked queue log as a polite live region.

Sub-task 9.2 - Performance - Status: COMPLETED
Step 9.2.1 - Use `useMemo` for derived rows and `useCallback` for handlers to avoid unnecessary re-renders on long lists - Status: COMPLETED
Details: Memoized file rows, badge subsets, and editor/remove handlers to stabilize renders.

Sub-task 9.3 - Logging - Status: COMPLETED
Step 9.3.1 - Emit debug logs when switching to Editor with project/file context to assist troubleshooting - Status: COMPLETED
Details: Added debug log in global navigation handler when routing to editor.


Task 10 - Acceptance criteria - Status: COMPLETED
Step 10.1 - Sidebar shows only Projects (with nested open projects) and Editor section (per open project). Settings sits as a sticky footer, visually separated - Status: COMPLETED
Step 10.2 - Project Overview displays a compact sub-header with key info; Languages card is removed - Status: COMPLETED
Step 10.3 - Files area is a two-line dense list with truncation and badges; actions include Editor and Remove - Status: COMPLETED
Step 10.4 - Clicking Editor opens a project-specific Editor placeholder view and optionally selects the clicked file in context - Status: COMPLETED
Step 10.5 - All components are single-scoped, placed in appropriate subfolders, and existing logic is preserved - Status: COMPLETED
Details: Completed scope moves for dialogs, queue modal, and editor modules while preserving existing behaviors.


Notes from best-practices research (applied):
- Prefer semantic list for compact file lists; keep table only if tabular semantics (sorting/alignment) are required
- Use Tailwind v4 built-in `line-clamp-*` for multi-line truncation; keep `truncate` for single-line with `title` tooltip fallback
- Sidebar sections: use multiple `<nav aria-label=…>` groups; implement a sticky footer (`sticky bottom-0`) with a `border-t` separator for Settings

## 2025-02-15 Review
- Reviewed Tasks 1–10 against current codebase; implementation is present and matches the documented completion notes.
- No additional work is required for this execution plan at this time.
