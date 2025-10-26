# SQLite v2 Architecture & Operations Guide

This guide describes the production SQLite stack that powers the Tr-entic desktop application. It supplements historic notes in `docs/db-refactor-summary.md` with the current schema, migration workflow, operational guarantees, and troubleshooting procedures introduced in the v2 revamp. All instructions apply to Tauri 2.8.5 + Rust 1.89 deployments unless otherwise noted.

## 1. Overview

- **Purpose**: Persist projects, clients, users, file metadata, conversion artifacts, and translation jobs in a single-tenant SQLite database that ships with the desktop app.
- **Tech stack**: SQLite 3.x accessed via `sqlx` (async/await) inside the Tauri backend. The renderer communicates through typed IPC commands in `src-tauri/src/ipc/commands`.
- **Key guarantees**:
  - Strict foreign-key enforcement and trigger-backed invariants.
  - Serialised write access to avoid `database is locked` errors when the renderer issues concurrent mutations.
  - Versioned migrations embedded at compile time, ensuring upgrades run automatically at startup.

## 2. File Layout & Runtime Environment

- **Database file**: `weg_translator.db`, created under the per-user application directory (`<app-folder>/weg_translator.db`). The base path is derived from `SettingsManager` (`src-tauri/src/settings/mod.rs`) and defaults to the platform-specific app data directory.
- **Migrations**: Stored in `src-tauri/migrations/` and embedded via `sqlx::migrate!`. The project currently ships with `0001_baseline_schema.{up,down}.sql`.
- **Rust access layer**: Centralised in `src-tauri/src/db/manager.rs`. `DbManager` owns the pooled connection, enforces PRAGMAs, and funnels every mutation through a process-wide async `Mutex`.
- **IPC bindings**: Renderer adapters live under `src/core/ipc/db/*.ts` and line up 1:1 with the Rust commands.
- **Testing fixtures**: In-memory pools (`:memory:`) are provisioned in module tests such as `src-tauri/src/db/operations/projects_v2.rs`.

## 3. Schema Inventory

The v2 schema reflects the baseline migration (`0001_baseline_schema.up.sql`). All tables use TEXT UUIDs, allowing cross-platform readability while keeping SQL indexes compact.

### 3.1 Core Tables

| Table | Purpose | Key Columns | Notes |
| --- | --- | --- | --- |
| `projects` | Project metadata | `project_uuid` PK, `project_name`, `project_status`, FK `user_uuid`, optional FK `client_uuid` | `update_date` auto-refreshes through trigger `projects_set_update_date`. |
| `project_language_pairs` | Allowed language pairs per project | Composite PK `(project_uuid, source_lang, target_lang)` | Enforced subset for file language pairs. |
| `project_files` | Link between project and file metadata | Composite PK `(project_uuid, file_uuid)` | `type` stores asset role. FK to `file_info`. |
| `file_info` | Physical file metadata | `file_uuid` PK, `ext`, `type`, `size_bytes`, `segment_count`, `token_count`, `notes` | Shared across projects when files are reused. |
| `artifacts` | Conversion outputs | `artifact_uuid` PK, FK `(project_uuid, file_uuid)` | Uniqueness enforced by `ux_artifacts_project_artifact`. |
| `jobs` | Translation jobs tied to artifacts | Composite PK `(artifact_uuid, job_type)` | Carries `job_status` and optional `error_log`. |

### 3.2 Supporting Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | Owners/operators of projects. |
| `user_roles` | Multi-role assignment table (`PRIMARY KEY (user_uuid, role)`). |
| `user_permission_overrides` | Explicit allow/deny flags per permission. |
| `clients` | Optional organisation attached to a project. |
| `project_subjects` | Textual project tags, unique per project. |
| `file_language_pairs` | Allowed language pairs per file (`PRIMARY KEY (project_uuid, file_uuid, source_lang, target_lang)`). |

### 3.3 Indices & Triggers

- Indices (`idx_project_language_pairs_project`, `idx_project_files_project`, `idx_artifacts_project`) accelerate dashboard queries and statistics.
- Trigger `projects_set_update_date` keeps `projects.update_date` aligned with the last write.
- Triggers `flp_must_be_subset_of_plp_{insert,update}` abort inserts/updates when file-level pairs step outside the project-level superset.

## 4. Data Relationships & Invariants

- **Foreign keys**: Enabled globally (`PRAGMA foreign_keys = ON`). Cascades remove dependent rows, except for `file_info` entries, which retain `ON DELETE RESTRICT` to protect reused files.
- **Language pair invariants**:
  - Projects must own ≥1 language pair (`projects_v2::create_project`).
  - `file_language_pairs` must be a subset of `project_language_pairs` (enforced by triggers + Rust pre-validation).
- **File reuse**: A `file_uuid` can be attached to multiple projects. Detaching a file only deletes `file_info` when no other project references it (`projects_v2::detach_project_file`).
- **UUID reuse**: Attachment flows resolve the UUID once (`resolve_attachment_file_uuid` in `projects_v2`), ensuring `file_info` and `project_files` share the same identifier.
- **Job lifecycle**: Jobs are keyed by `(artifact_uuid, job_type)` to allow multiple job types per artifact without duplicates.

## 5. Migration & Versioning Strategy

- `initialise_schema` (`src-tauri/src/db/schema.rs`) proxies to the embedded migrator and runs during `DbManager::connect_pool`.
- Each migration file should:
  - Use the naming convention `NNNN_description.up.sql` / `.down.sql`.
  - Include `IF NOT EXISTS` guards when changes must remain idempotent for legacy installs.
  - Provide reversible logic where possible (dropping or recreating objects inside `.down.sql`).
- **Creating a migration**:
  1. `cd src-tauri`
  2. `cargo sqlx migrate add <description>`
  3. Edit the generated `.sql` files.
  4. Run `cargo test --manifest-path src-tauri/Cargo.toml schema_migrations` to validate application.
- **Deployment**: Migrations run automatically on startup. Manual reapplication can be forced by deleting the SQLite file—only safe during development because production data would be lost.
- **Schema diffs**: Use `sqlite3 weg_translator.db ".schema"` or `sqlx migrate info` to inspect applied versions.

## 6. Connection Management & PRAGMA Policy

- Connection pool is configured in `DbManager::connect_pool`:
  - `SqlitePoolOptions::new().max_connections(5)` suits desktop workloads.
  - `after_connect` hook enforces:
    - `PRAGMA foreign_keys = ON`
    - `PRAGMA recursive_triggers = OFF`
    - `PRAGMA journal_mode = <config>`
    - `PRAGMA synchronous = <config>`
- `DatabasePerformanceConfig` (`src-tauri/src/db/config.rs`) exposes whitelisted journal/synchronous modes and parses user overrides from `settings.yaml`.
- Logging: Active PRAGMA values are logged to `db::connect` for diagnostics.
- `DbManager::reopen_with_base_dir` hot-swaps pools when the user changes the projects directory.

## 7. Transaction Patterns & Concurrency Controls

- **Write lock**: `DbManager::write_lock` (an async `Mutex`) serialises mutating operations, preventing concurrent writers from clashing with SQLite’s single-writer model.
- **Per-operation transactions**: Major operations (`create_project`, `update_project`, `attach_project_file`, `ensure_project_conversions_plan`) open a transaction via `pool.begin()`, perform all inserts/updates, and commit at the end. Failure paths roll back automatically.
- **HashSet validation**: Before inserts, helpers such as `ensure_project_language_pairs_unique` guard against duplicate data, surfacing user-friendly errors without invoking SQL constraints.
- **QueryBuilder usage**: `projects_v2::update_project` dynamically builds `UPDATE` statements, binding only the fields supplied by the IPC payload while staying within a transaction.

## 8. Feature Workflows

### 8.1 Project Creation

1. IPC command `create_project_with_assets_v2` validates the destination folder, scaffolds disk structure, and maps payloads into `NewProjectArgs`.
2. `DbManager::create_project_bundle` wraps `projects_v2::create_project`, which inserts the project, subjects, and language pairs in a single transaction.
3. Post-commit, the bundle is fetched and returned to the renderer for UI hydration.
4. Regression coverage: `attach_project_file_rolls_back_on_invalid_language_pair` and `create_project_rolls_back_on_duplicate_language_pair` tests ensure transactions roll back on invalid inputs.

### 8.2 File Attachment & Metadata

1. Renderer sends `AttachProjectFilePayload` without a UUID; `resolve_attachment_file_uuid` generates or reuses the identifier.
2. `NewFileInfoArgs` and `NewProjectFileArgs` share the UUID, keeping `file_info` and `project_files` in sync.
3. Language pair requirements:
   - Processable roles must include at least one pair.
   - Non-processable roles may omit pairs; the mapper skips validation accordingly.
4. Detach logic (`projects_v2::detach_project_file`) only removes `file_info` when no other project references the file, preventing FK violations across shared attachments.

### 8.3 Artifacts & Jobs

1. Conversion planning writes records into `artifacts` and related `jobs` tables via `artifacts_v2` and `jobs_v2` modules.
2. Each artifact inherits the `project_uuid`/`file_uuid` from the originating file attachment.
3. Jobs update lifecycle fields (`job_status`, `error_log`) with optimistic concurrency: callers fetch the current row and reissue updates through targeted SQL statements.

## 9. Error Handling & IPC Mapping

- All database functions return `DbResult<T>`, with `DbError` mapping constraint violations, invalid enums, and IO issues.
- `DbError::from(sqlx::Error)` inspects SQLite error kinds plus extended codes (e.g., trigger abort 1811) and converts them into `ConstraintViolation` messages.
- IPC layer (`src-tauri/src/ipc/error.rs`) wraps `DbError` into user-facing `IpcError::Validation` or `IpcError::Internal`.
  - Messages mentioning `project_language_pairs`, `project_subjects`, `file language pair` etc. are translated into clear guidance.
  - Unhandled SQLx errors are logged and returned as generic retry instructions.
- Renderer adapters propagate explicit `null` values through `includeIfDefined`, enabling nullable columns to be cleared without being dropped (`src/core/ipc/db/*.ts`).

## 10. Testing & Validation

- **Rust unit tests**:
  - `projects_v2` module tests cover duplicate language pair handling, rollback semantics, file attachment invariants, and shared metadata cleanup.
  - `ipc::error::tests` asserts constraint message mapping.
- **Integration tests**: `tests/db_manager_v2.rs`, `tests/schema_migrations.rs`, and `tests/project_creation_rollback.rs` run against temporary directories, verifying end-to-end flows.
- **Frontend Vitest suites**: `src/core/ipc/db/__tests__/null-forwarding.test.ts` and `projects-adapter.test.ts` guarantee that IPC payloads match backend expectations.
- **Recommended commands**:
  - `cargo test --manifest-path src-tauri/Cargo.toml` (full backend suite).
  - `npx vitest run src/core/ipc/db/__tests__/null-forwarding.test.ts`.
  - `npx vitest run src/core/ipc/db/__tests__/projects-adapter.test.ts`.

## 11. Maintenance Procedures

- **Backups**: Before running manual migrations or issuing destructive commands, create a snapshot with `sqlite3 weg_translator.db ".backup weg_translator_$(date +%Y%m%d).db"`.
- **Resetting dev database**: Delete the `.db` file inside the dev app folder; the next launch will recreate it via migrations. Never do this on user machines.
- **Adding columns/indexes**:
  1. Generate a migration (`cargo sqlx migrate add add_subject_priority`).
  2. Update relevant TypeScript DTOs (`src/shared/types`).
  3. Extend operations and IPC mappers.
  4. Add regression tests when invariants change.
- **Schema inspection**: `sqlite3 weg_translator.db ".tables"` or `.schema projects`.
- **Data exports**: Use `.mode csv` + `.once` commands in `sqlite3` to produce snapshots for support investigations.

## 12. Performance Tuning Guidelines

- Default configuration uses `journal_mode = WAL` and `synchronous = NORMAL`, balancing durability with desktop responsiveness.
- Users may override values in `settings.yaml` (`database_journal_mode`, `database_synchronous`). Invalid inputs fall back to defaults with a warning.
- Additional tuning tips:
  - Keep large write operations batched inside explicit transactions (already handled in operations).
  - Avoid unnecessary indices; profile queries with `EXPLAIN QUERY PLAN` when investigating slow dashboards.
  - Clean up abandoned artifacts/jobs periodically to keep database size manageable (future task F-004 can extend this guide).

## 13. Troubleshooting Checklist

| Symptom | Likely Cause | Resolution |
| --- | --- | --- |
| `database is locked` errors | External process holds the file or long-running query executed outside write lock. | Ensure all writes go through `DbManager`; verify no external editors keep the DB open. |
| `File language pair must match existing project language pair` | Attempted to attach file with unmatched pair. | Add the pair to `project_language_pairs` first or adjust payload. |
| `Each project language pair must be unique.` | Duplicate pair supplied in IPC payload. | Deduplicate UI selections; backend already rejects duplicates. |
| Foreign-key violation during detach | File was detached while another project still references it (pre-v2 behaviour). | Confirm running build includes v2 conditional delete; if issue persists, inspect `project_files` table for stale rows. |
| Migration failure on startup | Corrupted file or manual edits. | Backup the DB, inspect with `.schema`, and re-run the app. If unrecoverable, restore from backup. |

## 14. Reference Commands & Resources

- `cargo sqlx migrate run` — Applies pending migrations manually.
- `cargo sqlx migrate info` — Lists applied/available migrations.
- `sqlite3 weg_translator.db ".schema"` — Dumps full schema for auditing.
- `sqlite3 weg_translator.db "PRAGMA foreign_keys;"` — Confirms PRAGMA state (expect `1`).
- `cargo test --manifest-path src-tauri/Cargo.toml projects_v2::` — Focused backend tests.
- `npx vitest run src/core/ipc/db/__tests__/*.test.ts` — Renderer IPC regression suite.
- SQLite official docs: <https://sqlite.org/docs.html>
- SQLx migration guide: <https://docs.rs/sqlx/latest/sqlx/macro.migrate.html>
