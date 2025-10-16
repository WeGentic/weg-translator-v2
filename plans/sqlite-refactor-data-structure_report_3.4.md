# Step 3.4 Report — IPC Layer Migrated to New Schema

- **Scope**: Exposed CRUD-ready IPC commands that bridge the renderer with the refactored database schema (A4, A20–A23).
- **Key Changes**:
  - Added `users_v2`, `clients_v2`, `projects_v2`, `artifacts_v2`, and `jobs_v2` command modules, each delegating to the new `DbManager` APIs and translating between DTOs and backend structs.
  - Expanded `ipc/dto.rs` with lean request/response shapes for user profiles, clients, projects (including subjects, language pairs, and file bundles), artifacts, and jobs.
  - Updated `ipc/mod.rs` and `src-tauri/src/lib.rs` to re-export and register the new commands while leaving legacy handlers intact for transitional compatibility.
- **Validation**: `cargo check` (run from `src-tauri`) confirms the IPC layer compiles after the additions.
- **Next Steps**: Move to Task 4 to refactor the renderer IPC wrappers and UI state to consume the new command surface.
