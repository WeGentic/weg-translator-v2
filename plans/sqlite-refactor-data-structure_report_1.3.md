# Step 1.3 Report — IPC to Database Mapping

- **Scope**: Linked all renderer `invoke` usages to their corresponding Tauri commands and downstream database operations to satisfy catalog requirements (A1, A4).
- **Method**: Cross-referenced `src/core/ipc/client.ts` and UI call sites with `#[tauri::command]` handlers (`rg '#[tauri::command]' src-tauri/src`). Documented the relationships inside `docs/db-refactor-catalog.md` under the new “IPC → Backend → Database Mapping” section, grouped by domain.
- **Key Highlights**:
  - Every project/conversion command now lists its React entry points (e.g., `src/modules/projects/actions/createProjectAction.ts:91`) and the Rust services/operations they rely on (`src-tauri/src/ipc/commands/projects/service.rs:502`, `src-tauri/src/db/operations/projects.rs:41`, etc.).
  - Translation commands map cleanly onto `DbManager` functions in `src-tauri/src/db/operations/translation_jobs.rs`, clarifying where history persistence occurs.
  - Settings and utility commands are identified as configuration-only versus those that reopen or mutate the SQLite database.
- **Deliverable**: Updated catalog (`docs/db-refactor-catalog.md`) now includes detailed tables ensuring future refactor steps know exactly which database routines each IPC surface depends on.
- **Open Questions**: None; ready to advance to Task 2 planning.
