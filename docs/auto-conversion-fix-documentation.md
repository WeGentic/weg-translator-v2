# Auto-Conversion Flow Fix — Documentation

Summary
- Implemented robust missing-resources detection and user-facing error propagation for OpenXLIFF sidecars.
- Verified and documented bundling layout; ensured wrapper scripts standardize error output across platforms.
- Finalized rollout docs: manual verification checklist, migration order validation, and usage notes.

Changes
- Frontend: src/lib/openxliff.ts
  - Added missing-resources pattern detection to `detectKnownError` to catch wrapper messages like:
    "[convert wrapper] Could not locate OpenXLIFF resources …" and surface a helpful message.
- Sidecars: no code change required; wrappers already standardize messages.
- Plan updates: docs/ProjectSpecificPagePlan.md
  - Marked Fix Plan items 1–4 as complete.
  - Marked Docs/Rollout tasks (23–24, 26) as complete.

How to fetch/build OpenXLIFF
1) scripts/fetch-openxliff.sh [--version vX.Y.Z]
   - Clones/builds upstream and mirrors dist to vendor/openxliff/dist-<platform>.
2) scripts/sync-openxliff-resources.sh
   - Copies vendor dist into src-tauri/resources/openxliff/<platform>.
3) scripts/normalize-openxliff-resources.sh (optional)
   - Normalize permissions and shebangs if needed.

Packaging verification
- Ensure src-tauri/tauri.conf.json includes bundle.resources entries for `resources/openxliff` (already present), then build:
  - macOS: verify `<.app>/Contents/Resources/resources/openxliff/<platform>` exists.
  - Windows/Linux: verify `resources/openxliff/<platform>` exists adjacent to executable.

Manual verification checklist
- Create a project with defaults (e.g., en-US → it-IT).
- Add a `.docx` and a `.xlf` file.
- Open project: auto‑conversion starts for `.docx`; `.xlf` is bypassed; validation runs; statuses become completed.
- If OpenXLIFF resources are missing, UI shows a clear error and DB stores the message; project still opens.
- Remove file: both DB entries and on-disk artifacts are removed.

Migrations
- 006_add_project_languages.sql, 007_create_project_file_conversions.sql present and applied in order. Confirm `sqlx::migrate!` runs on startup.

Notes
- Feature flag "Auto-convert on open" is exposed in settings and defaults to enabled.
- Only relative paths are persisted; UI computes absolute paths using project root.

