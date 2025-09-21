# Project IPC Commands Milestone

This milestone implements the IPC surface for the Project-specific page as outlined in `docs/ProjectSpecificPagePlan.md` (steps 5, 6, and 11).

## What’s Included

- DTOs: Added project-related DTOs in `src-tauri/src/ipc/dto.rs`:
  - `ProjectFileDto`, `ProjectFileConversionDto`, `ProjectFileWithConversionsDto`, `ProjectDetailsDto`
  - `AddFilesResponseDto`, `EnsureConversionsPlanDto` (+ task item)
- Commands: Implemented in `src-tauri/src/ipc/commands.rs` and registered in `src-tauri/src/lib.rs`:
  - `get_project_details(project_id)`
  - `add_files_to_project(project_id, files[])`
  - `remove_project_file(project_id, project_file_id)`
  - `ensure_project_conversions_plan(project_id)`
  - `update_conversion_status(conversion_id, status, { xliff_rel_path?, error_message? })`
- Frontend wrappers: `src/ipc/client.ts` + types in `src/ipc/types.ts`.

## Behavior Notes

- Details include files and their conversions; languages default to `en-US` → `it-IT` if unset.
- Add-files reuses the same validation/dedup as project creation and persists via `DbManager::add_files_to_project`.
- Remove-file deletes DB rows (with cascade) and removes on-disk artifacts (original + any `xliff_rel_path`).
- Conversion plan prepares sequential tasks with absolute I/O paths, ensuring `<project>/xliff/` exists.
- Status updates set timestamps based on new state and optionally store relative XLIFF path or error message.

## Next Steps

- Wire the project overview UI to consume `getProjectDetails` and render tables/badges.
- Implement the queue modal to execute tasks from `ensureProjectConversionsPlan` using `openxliff.ts`.
- Extend the project creation wizard to set default languages (steps 8–10).

