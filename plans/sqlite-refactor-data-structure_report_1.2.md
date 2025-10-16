# Step 1.2 Report — Legacy Schema Audit

- **Scope**: Inventoried all existing schema DDL and bootstrap logic (A2, A3, A24) to identify artifacts that must be replaced during the refactor.
- **Reviewed Files**:
  - `src-tauri/src/db/schema.rs` (table/index/trigger definitions, column backfill helper, default user seed).
  - `src-tauri/src/db/manager.rs` (connection + PRAGMA configuration, existing reset semantics).
  - `src-tauri/src/db/constants.rs` and related modules for schema-aligned constants.
- **Deliverable**: Extended `docs/db-refactor-catalog.md` with a “Legacy Schema Artifacts” section enumerating every table/index/trigger to retire, including file + line references.
- **Key Findings**:
  - Current schema still models legacy translation history, conversion pipeline, and note systems that are out-of-scope for the new design.
  - `DbManager::connect_pool` applies PRAGMAs but does not aggressively reset the database file; future work must enforce clean bootstrap per requirement A3.
  - Column backfill helper and default user seeding are unnecessary once the new schema is in place.
- **Open Questions**: None; ready to proceed to Step 1.3.
