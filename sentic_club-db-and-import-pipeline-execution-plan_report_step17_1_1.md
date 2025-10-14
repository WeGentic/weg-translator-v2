# Step 17.1.1 Completion Report

## Summary
- Added strongly typed domain models for reference tables, language pairs, file targets, artifacts, notes, validations, and jobs under `src-tauri/src/db/types/`, including status/kind enums that mirror SQLite CHECK constraints.
- Extended `src-tauri/src/db/builders.rs` with typed hydrators for the new tables and introduced additional `DbError` variants plus top-level re-exports (`src-tauri/src/db/mod.rs`) to surface the new types safely.
- Exposed project constants (`LOCAL_OWNER_*`, default languages) through `ipc::commands` for startup backfills, updating `src-tauri/src/lib.rs` to rely on the re-exported symbols without touching private modules.

## Validation
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`

## Notes
- `cargo check` emits existing warnings about unused staging helpers/constants in the projects module; no new warnings introduced by this step.
