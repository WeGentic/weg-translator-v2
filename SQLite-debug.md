# SQLite Data Layer Review

This report evaluates the current SQLite usage across the Rust backend, the Tauri IPC layer, and the React/TypeScript frontend. Findings are cross-referenced with the documented architecture in `Sqlite-docs.md` and current best practices for `sqlx` + SQLite deployments.

## Observed Strengths
- `DbManager` configures a pooled `SqlitePool` with WAL + `synchronous=NORMAL`, and enforces `foreign_keys` & `recursive_triggers=OFF` in `after_connect`, matching the guidance documented in `Sqlite-docs.md` (“Connection & Pool Management”).
- Write-path serialization via `DbManager::write_lock` mirrors the intent called out in `Sqlite-docs.md`, limiting concurrent long-running writes while still allowing concurrent reads.
- Schema bootstrap keeps statements idempotent, so clean installs recover automatically, and tests reuse `initialise_schema` (`schema.rs`) as described in the internal docs.

## Critical Bugs
- **Mismatched file UUIDs during manual attachment** – `map_new_file_info_args` and `map_new_project_file_args` each mint a fresh UUID when the IPC payload omits `fileUuid`, so the inserted `file_info` row uses ID _A_ while `project_files` references ID _B_. The foreign-key check fails (`FOREIGN KEY constraint failed`), and the IPC command surfaces as a generic internal error.  
  • `src-tauri/src/ipc/commands/projects_v2.rs:1326-1354`  
  • Observable today by calling `attach_project_file_v2` through the TypeScript adapter without pre-seeding `fileUuid` (the default path for new uploads).  
  • Severity: High – all manual attachments without an explicit UUID fail.

- **Non-processable files cannot be attached through IPC** – `map_new_project_file_args` rejects empty `language_pairs` (`projects_v2.rs:1356-1359`) while `file_language_pairs_for_role` explicitly returns an empty list for reference/instruction/image assets (`projects_v2.rs:1261-1275`). The built-in asset pipeline bypasses this mapper and therefore succeeds, but any frontend call to `attachProjectFile` with a reference file (its `languagePairs` array is naturally empty) is rejected with `Validation("languagePairs must include at least one entry")`.  
  • Severity: High – the IPC endpoint is currently unusable for non-processable roles, blocking parity with the Rust-side workflow described in `Sqlite-docs.md`.

- **Frontend cannot clear nullable columns** – Every update adapter uses the nullish coalescing operator (`??`) before sending payloads, so an explicit `null` is converted to `undefined` and never reaches the backend. Examples:  
  • `mapUpdateProjectInput` (`src/core/ipc/db/projects.ts:486-497`)  
  • `mapUpdateUserInput` (`src/core/ipc/db/users.ts:73-82`)  
  • `mapUpdateClientInput` (`src/core/ipc/db/clients.ts:72-80`)  
  As a result it is impossible to remove a client association, clear notes, or wipe phone/address fields even though the backend (`UpdateProjectArgs`, `UpdateUserArgs`, `UpdateClientArgs`) supports `Option<Option<...>>`.  
  • Severity: High – data becomes permanently “sticky”, violating the CRUD story promised in `Sqlite-docs.md` (“Operations Modules”).

## High-Risk Gaps
- **Schema evolution lacks migrations** – `schema.rs` only issues `CREATE TABLE/INDEX/TRIGGER IF NOT EXISTS`. Once a user booted an older build, later schema changes (new columns, defaults, indices) will _not_ be applied. `Sqlite-docs.md` notes that the bootstrap “mirrors the latest development layout”, but without `ALTER` statements or version tracking existing installations drift out of sync. This is a release blocker for any future schema change.

- **Implicit single-project assumption for `file_uuid`** – `detach_project_file` deletes the `file_info` row (`projects_v2.rs:272-289`) after dropping the `(project_uuid, file_uuid)` link. If a file UUID is ever reused across projects, the delete will suddenly fail with a foreign-key violation. Either enforce uniqueness (`UNIQUE (file_uuid)` on `project_files`) or delete the metadata only when no other rows reference it.

- **Limited surfacing of database constraint errors** – All raw `sqlx::Error::Database` cases are flattened into `IpcError::Internal` (`src-tauri/src/ipc/error.rs:30-45`), so the UI receives a generic “Database operation failed unexpectedly.” even for user-facing issues (duplicate language pair, FK failures, etc.). Mapping well-known SQLite error codes (e.g., `SQLITE_CONSTRAINT_FOREIGNKEY`) back to validation messages would greatly improve debuggability and aligns with the error-handling guidance in `Sqlite-docs.md`.

## Additional Improvement Opportunities
- Validate and de-duplicate `language_pairs` on the Rust side before insert so that user intent errors surface as clean validation failures instead of constraint exceptions. (`projects_v2::create_project` already depends on the PK to enforce uniqueness.)
- Consider persisting the configured journal mode & synchronous level in diagnostics so support tooling can confirm whether overrides from `settings.yaml` were applied. (`DatabasePerformanceConfig` already filters inputs.)
- Expand automated tests around the IPC adapters (especially for the attachment workflow) to catch regressions where backend helpers and IPC mappers drift apart – the current Rust unit tests exercise only the lower-level operations.

## Suggested Next Steps
1. Fix `attach_project_file_v2` to reuse a single generated UUID, and relax the language-pair requirement for non-processable roles. Add coverage that mirrors the frontend DTO pathway.  
2. Update the TypeScript adapters to distinguish “unset” (`undefined`) from “explicitly clear” (`null`), and add regression tests for clearing optional fields.  
3. Introduce versioned migrations (either `sqlx::migrate!` or a lightweight schema_version table) so future schema changes reach existing databases.  
4. Add a uniqueness guarantee on `project_files.file_uuid` or adjust delete logic to account for multi-project reuse.  
5. Extend error mapping in `ipc/error.rs` to convert common SQLite constraint violations into `IpcError::Validation`, giving the renderer actionable feedback.

Addressing these items restores the guarantees outlined in `Sqlite-docs.md` and keeps the SQLite layer reliable as features evolve.
