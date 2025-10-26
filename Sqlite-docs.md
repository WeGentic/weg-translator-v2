# SQLite Data Layer Documentation

This document explains how the Tr-entic desktop application manages its SQLite database, how the Rust-side modules fit together, and the conventions you should follow when changing or extending the data layer.

## Technology Stack

- **Runtime:** Rust 1.89 bundled via Tauri 2.8.5.
- **Database:** SQLite 3 accessed asynchronously with [`sqlx`](https://github.com/launchbadge/sqlx).
- **Frontend integration:** Tauri IPC commands exposed to the React 19 frontend.
- **Primary module root:** `src-tauri/src/db/`.

## Module Layout

`src-tauri/src/db/` is split by responsibility to keep types, schema bootstrap, and data access isolated:

| Path | Purpose |
| --- | --- |
| `config.rs` | Defines `DatabasePerformanceConfig` with whitelisted PRAGMA overrides. |
| `constants.rs` | Shared constants (database filename, SQL projections, extension allow-lists). |
| `error.rs` | `DbError` enum plus the `DbResult<T>` alias used throughout the layer. |
| `manager.rs` | Owns the `SqlitePool`, enforces concurrency, and acts as the façade for IPC. |
| `schema.rs` | Programmatic bootstrap that creates tables, indexes, and triggers idempotently. |
| `types/` | Strongly typed records (`*_Record`), aggregated bundles, and argument structs. |
| `operations/` | Per-entity query modules (e.g., `projects_v2.rs`, `users.rs`, `clients.rs`). |
| `builders.rs` | Helpers that hydrate legacy domain models from raw `SqliteRow` values. |
| `utils.rs` | Small utilities (timestamp formatting, error helpers). |

Older modules (`operations/projects.rs`, `operations/jobs.rs`, etc.) remain for backward compatibility but the V2 entry points (`projects_v2`, `jobs_v2`, `artifacts_v2`, `users`, `clients`) are the only ones wired into the current manager.

## Connection & Pool Management

All database access flows through `DbManager` (`src-tauri/src/db/manager.rs`):

- A `SqlitePool` (max 5 connections) is created per application session. Pool handles are wrapped in `Arc<RwLock<SqlitePool>>` to support atomic pool swaps when reopening the database (`reopen_with_base_dir`).
- A top-level `Arc<Mutex<()>>` (`write_lock`) serialises write operations exposed by the façade (e.g., create/update/delete flows) to avoid long-running concurrent transactions. Read-only calls skip the mutex but still coordinate through the pool.
- PRAGMA configuration is centralised in `DatabasePerformanceConfig`:
  - Defaults to `journal_mode = WAL` and `synchronous = NORMAL`, matching current best practice for desktop apps that need concurrency without sacrificing durability.
  - Settings can be overridden via `settings.yaml`; invalid values fall back to defaults with a warning.
  - `after_connect` applies the PRAGMA statements and enables foreign keys plus disables recursive triggers for predictability.
- `SQLITE_DB_FILE` is fixed to `weg_translator.db` and lives in the path derived from Tauri’s `app_data_dir()`. The manager ensures the directory exists before opening the pool.

These choices align with the industry guidance we verified (WAL + synchronous=NORMAL for GUI workloads, modest pool sizes, short transactions).

## Schema Bootstrap

`initialise_schema` (`src-tauri/src/db/schema.rs`) runs once per pool creation. It opens a transaction and executes a set of idempotent statements that ensure the latest development schema exists. Highlights:

- **Tables:** `users`, `user_roles`, `user_permission_overrides`, `clients`, `projects`, `project_subjects`, `project_language_pairs`, `file_info`, `project_files`, `file_language_pairs`, `artifacts`, and `jobs`. Each table mirrors the structs under `types/schema.rs`.
- **Indexes:** Primarily target project-centric lookups (e.g., `idx_project_language_pairs_project`, `idx_project_files_project`).
- **Triggers:**  
  - `projects_set_update_date` keeps `update_date` in sync on mutations.  
  - Two `flp_must_be_subset_of_plp_*` triggers enforce that file-level language pairs are a subset of the project-level pairs, raising `ABORT` on violation.

Because the bootstrap is idempotent, it is safe to run during every startup, during tests, and from migration tooling.

## Domain Types & Aggregations

- `types/schema.rs` defines `*_Record` structs with `#[derive(FromRow)]` to map 1:1 with tables. These are the primary values returned from the V2 operations.
- The same module defines aggregated views such as:
  - `UserProfile` (user + roles + permission overrides),
  - `ProjectBundle` (project record + subjects + language pairs + file bundles + jobs),
  - `ProjectFileBundle` (link + metadata + conversions + artifacts),
  - `ProjectStatistics` and the nested totals structures computed in memory.
- Argument types (`NewProjectArgs`, `UpdateProjectArgs`, etc.) encapsulate payloads needed for inserts/updates, ensuring only validated, structured data flows into SQL builders.

`builders.rs` exists to hydrate legacy domain objects still referenced by other parts of the backend. Each helper validates stringified UUIDs, translates enum strings into Rust enums, and surfaces typed errors via `DbError`.

## Operations Modules

Each module in `operations/` owns the SQL for a specific aggregate. The pattern is consistent:

1. Begin a transaction (`pool.begin().await?`).
2. Perform all inserts/updates/deletes with `sqlx::query` or `QueryBuilder`.
3. Fetch the latest row(s) for the caller (`fetch_optional`, `fetch_one`, or `query_as`).
4. Commit and return typed records.

Key modules currently in use:

- **`users.rs`:** Manages user CRUD with role and permission list replacement helpers. Uses `QueryBuilder` to build partial updates dynamically.
- **`clients.rs`:** Mirrors the user module for client metadata, including optional field updates.
- **`projects_v2.rs`:** The largest module, handling project creation, updates, deletion, file attachments, and statistics. It validates inputs (e.g., enforces non-empty language pairs), performs cascading deletes within its transaction, and materialises `ProjectBundle` views. Helpers such as `replace_project_language_pairs` respect schema triggers and maintain referential integrity.
- **`artifacts_v2.rs`:** Provides upsert/update/delete for conversion artifacts and lists artifacts per file.
- **`jobs_v2.rs`:** Upserts job rows keyed by `(artifact_uuid, job_type)` and exposes per-project listing.

Modules that assemble aggregates read back through the same transaction that performed the writes, guaranteeing callers receive fully consistent snapshots.

## Error Handling

`DbError` (`src-tauri/src/db/error.rs`) wraps:

- Infrastructure failures (IO, JSON, SQLx).
- User-facing domain violations (invalid enum values stored in DB, missing rows, duplicate identifiers).
- Soft constraints (`ConstraintViolation(String)`) used for business rule validation before the database returns an error.

All public manager methods return `DbResult<T>`. IPC handlers convert them into `IpcError`, propagating meaningful messages to the frontend.

## Concurrency & Transactions

- Writes obtain the global `write_lock` (an async mutex) before delegating to the operations module, preventing overlapping write transactions from different commands. This avoids prolonged `SQLITE_BUSY` states while still allowing multiple reader requests to proceed concurrently.
- Read-heavy methods (`get_project_bundle`, `list_project_records`, etc.) skip the mutex and only clone the current pool via the `RwLock`. They still run inside transactions to ensure consistent snapshot reads when multiple tables are involved.
- Within transactions, SQL is executed without interleaving with non-database async work to keep them short-lived—a core SQLite best practice for WAL-mode databases.

## Integration with Tauri IPC

- `src-tauri/src/lib.rs` initialises `DbManager` during `tauri::Builder::setup`, storing it in application state via `app.manage(db_manager)`.
- IPC commands under `src-tauri/src/ipc/commands/*_v2.rs` pull the manager from `State<'_, DbManager>` and simply map DTOs into the typed arguments defined in the DB layer. Example: `create_project_bundle_v2` converts the payload into `NewProjectArgs` before calling `DbManager::create_project_bundle`.
- Because the manager is `Clone` (internally backed by `Arc`), commands safely hold a handle without duplicating the underlying pool.

## Testing Strategy

- Unit and integration tests live under `src-tauri/tests/`. `db_manager_v2.rs` demonstrates the preferred pattern:
  - Spin up an in-memory pool (`SqlitePoolOptions::new().connect(":memory:")`).
  - Call `initialise_schema` to bootstrap tables.
  - Use the manager façade for end-to-end scenarios (project creation, file attachment, reopen behaviour).
- Operation modules include focused tests behind `#[cfg(test)]` that exercise rollback scenarios and transactional guarantees (e.g., language pair validation).

When adding new queries, mirror these patterns to keep regression coverage high.

## Extending the Schema

When you introduce a new concept:

1. Update `schema.rs` with the new table/index/trigger statements. Keep them idempotent.
2. Add corresponding record and argument structs in `types/schema.rs`. Derive `FromRow` for any direct selects.
3. Create a new operations module or extend an existing one. Ensure every multi-step write is wrapped in a transaction.
4. Expose manager methods in `manager.rs`, acquiring the `write_lock` for mutating flows.
5. Add IPC command handlers that map DTOs to the new argument types and call the manager.
6. Back the new functionality with unit/integration tests using the in-memory pool helpers.

Always run `initialise_schema` after your changes to verify the bootstrap covers the new tables.

## Platform Considerations

- The app stores the SQLite file under the user-specific application data directory. This avoids sandbox restrictions on macOS and write-permission issues on Windows.
- `libsqlite3-sys` builds SQLite as part of the Rust toolchain, so no additional bundling steps are required, but keep CI targets aligned (especially if enabling optional SQLite features).
- If future features rely on synchronous triggers or extensions, ensure the PRAGMA whitelist in `DatabasePerformanceConfig` reflects the supported values—never pass arbitrary user input directly into PRAGMA statements.

## Alignment with Best Practices

The current setup matches the external guidance we reviewed:

- WAL + synchronous NORMAL yields good throughput while still guarding against crashes.
- The pool size and serialised writes keep contention low on desktop workloads.
- Transactions are scoped tightly around SQL commands, avoiding async work while a connection is held.
- Types and operations are isolated, making the data layer easy to reason about and extend.

Keep these principles in mind for future evolution, and consult the `config.rs` defaults if you need to revisit PRAGMA choices for specialised workflows (e.g., air-gapped high-durability deployments).

## Runtime Telemetry & Validation

- `DbManager::connect_pool` logs the configured and active `PRAGMA journal_mode` and `PRAGMA synchronous` values (log target `db::connect`) so support can confirm runtime durability settings.
- Project creation/update paths call `ensure_project_language_pairs_unique` (Rust-side HashSet dedupe) and return `DbError::ConstraintViolation("Duplicate project language pair ...")` when a user submits duplicates.
- Constraint failures from SQLite (unique/foreign key checks, trigger aborts) are mapped to user-friendly `IpcError::Validation` messages; the IPC layer rewrites messages for common scenarios (duplicate language pairs, subjects, file conversion conflicts, file language pair trigger).
- Vitest suites (`src/core/ipc/db/__tests__/null-forwarding.test.ts`, `projects-adapter.test.ts`) guard the IPC adapters, ensuring optional fields and explicit nulls round-trip correctly.


