# Step 18.2 Completion Report

## Summary
- `build_conversions_plan` now attempts to populate `file_targets` via `DbManager::bridge_project_conversions` before falling back, re-querying the table to keep file/language pair state aligned with the new schema (`src-tauri/src/ipc/commands/projects/artifacts.rs:539`).
- File-target rows are parsed into strongly typed `FileTargetStatus` values, ensuring tasks skip only `EXTRACTED` targets while still honoring failed states when legacy conversions already produced artifacts (`src-tauri/src/ipc/commands/projects/artifacts.rs:569`).
- The planning step retains legacy conversion fallback but only after exhausting file-target options, guaranteeing new projects created through the staging flow are serviced exclusively through `file_targets`.

## Validation
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`

## Notes
- Future work: swap raw SQL joins for typed fetchers once aggregate helpers (e.g., `list_file_targets_for_project`) land, reducing manual row parsing further.
