# Task 1 — Sidebar Refactor Summary

Status: Completed

Changes
- Reduced fixed menu to `Projects` and `Settings` only.
- Added support for editor views with keys `editor:<projectId>`.
- Introduced Editor section in the sidebar listing one entry per open project.
- Moved `Settings` into a sticky footer with visual separation.

Files Updated
- src/App.tsx: adjusted `MainView`, added editor key helpers, pruned fixed items, created `temporaryEditorItems`, and added `<ProjectEditor>` route.
- src/components/layout/AppSidebar.tsx: rendered two `<nav>` sections (Project and Editor), extracted `settings` to a sticky footer, and kept accessibility attributes.
- src/components/projects/editor/ProjectEditor.tsx: added placeholder editor view component.

Notes
- Existing navigation remains intact for `projects` and project overviews (`project:<id>`).
- Editor items currently render a placeholder component and will be expanded in later tasks.
