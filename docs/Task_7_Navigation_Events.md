# Task 7 — Navigation Events Update

Status: Completed

Changes
- Extended global `app:navigate` event handling to accept `{ view: 'editor', projectId?: string, fileId?: string }`.
- Routes to `editor:<projectId>` and stores `selectedFileId` in top-level state.
- Added debug logging when switching to the Editor with project/file context.

Files Updated
- src/App.tsx
