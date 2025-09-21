# Project Overview & Auto‑Conversion (Steps 12–15)

This milestone delivers the project‑specific page with file management and automatic XLIFF conversion.

What changed
- New UI: `src/components/projects/overview/ProjectOverview.tsx`
  - Loads details via `getProjectDetails(projectId)`.
  - Renders default languages, files table, per‑conversion status badges.
  - Actions: Add files (dialog via `@tauri-apps/plugin-dialog`), Remove file (confirm).
  - Auto‑conversion on open: calls `ensureProjectConversionsPlan(projectId)`, opens modal, sequentially executes tasks with streaming logs using `convertStream` and validates via `validateStream`.
  - Persists status transitions with `updateConversionStatus` and stores relative `xliff_rel_path`.
- App integration: `src/App.tsx`
  - Uses `ProjectOverview` for opened projects instead of placeholder.

Behavior
- On first open, if pending conversions are found for supported formats, the modal appears and starts automatically.
- Cancellation stops after current item; completed items remain persisted.
- Failed conversions are surfaced with a banner on the page and can be retried later.

Notes
- Status badges: pending, running, completed, failed.
- Output files live under `<project.root_path>/xliff/` as `<stem>.<src>-<tgt>.xlf`.

