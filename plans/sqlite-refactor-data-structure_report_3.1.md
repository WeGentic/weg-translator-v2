# Step 3.1 Report — New Schema Types Defined

- **Scope**: Introduced Rust models that mirror every table and aggregate in the new SQLite schema (A6–A20).
- **Key Changes**:
  - Added `src-tauri/src/db/types/schema.rs` with `sqlx::FromRow` + serde-enabled structs for users, roles, permission overrides, clients, projects, subjects, language pairs, file metadata, artifacts, and jobs.
  - Created aggregate helpers (`UserProfile`, `ProjectFileBundle`, `ProjectBundle`) to capture list relationships like roles, permission overrides, language pairs, and child artifacts/jobs.
  - Re-exported the new types via `db::types` while keeping legacy exports in place until Step 3.2 updates the operations layer.
- **Verification**: `cargo check` (run from `src-tauri`) passes with the new type definitions.
- **Next Steps**: Replace the existing `db/operations` modules to use these structures and delete the legacy types once consumers are migrated.
