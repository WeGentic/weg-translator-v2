# Storage Migration Summary

## Overview of Recent Changes
- Added a YAML-backed settings manager that persists the configurable application data folder and exposes it over IPC for the React settings panel.
- Extended `DbManager` to support reopening the SQLite pool at a new base directory and introduced `update_project_root_paths` to rewrite stored project `root_path` values after a move.
- Updated the `update_app_folder` IPC command to move files on disk, reopen the database in the new location, refresh persisted project paths, and persist the new settings atomically with rollback safeguards.
- Surfaced the storage configuration in the UI via `AppSettingsPanel`, enabling users to review managed paths and trigger folder moves.

## Tests Executed
- `pnpm test src/ipc/client.test.ts`
- `cargo check`

## Potential Risks & Mitigations
- **Cross-platform file operations**: The move helper currently relies on `fs::rename` with a copy fallback; platform-specific quirks (e.g., Windows junctions) could still surface. Mitigation: add integration tests per platform and consider more granular error reporting.
- **Large project migrations**: Copying large directories on cross-device moves may block for an appreciable time. Mitigation: future async progress reporting or chunked copy with user feedback.
- **Database path updates**: The simple prefix replacement assumes all stored `root_path` values reside under the managed folder. If historic data points elsewhere, those rows are untouched. Mitigation: add a diagnostic warning/report when paths fall outside the managed root.
- **Concurrent operations**: While the write lock guards database updates, front-end actions during migration might still access stale paths. Mitigation: temporarily disable project interactions during migration or add UI messaging.

