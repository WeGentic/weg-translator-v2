# SQLite Integration Implementation Plan

## 1. Objectives & Scope
- Deliver a production-ready SQLite persistence layer for the Tauri 2.8.5 application with a React 19.1.1 frontend (ShadCN + TailwindCSS 4.1.1).
- Provide a full-stack example that persists translation jobs/results and exposes them through IPC to a React UI view for validation.
- Establish reusable patterns for migrations, connection management, error handling, and testing so future features can extend the data model confidently.

## 2. Baseline Assumptions
1. Rust toolchain ≥ 1.89.0 with `cargo`, `rustup`, and `rustfmt` installed; Node.js environment already configured (pnpm/npm/yarn).
2. Project already builds via `pnpm dev` / `pnpm tauri dev` and `cargo build` (verify before modifying). Fix build blockers before touching the database layer.
3. No existing persistent storage; introducing SQLite must not regress current IPC or UI behaviours.
4. Security posture follows Tauri capability model; any new command or plugin must be explicitly allowed in `capabilities/` manifests.

## 3. High-Level Architecture
- **Database file**: `AppConfig` directory via `tauri::api::path::BaseDirectory::AppConfig` to preserve data across updates.
- **Access library**: [`tauri-plugin-sql`](https://v2.tauri.app/plugin/sql/) (2024-verified) with SQLite feature enabled; leverage `sqlx` via the plugin for async-ready calls.
- **Migrations**: Versioned SQL files embedded at build time, executed by plugin builder; ensures deterministic schema evolution.
- **Rust layer**: `DbManager` service (new module) wraps plugin connection for typed queries and business logic; commands access DB via `State`.
- **IPC**: Commands remain the only surface for DB mutations/reads (frontend **must not** send raw SQL). DTOs in `src-tauri/src/ipc/dto.rs` extended accordingly.
- **Frontend**: React hooks + ShadCN components read/write data through new IPC wrappers. Local state caches results while keeping SQLite canonical.

## 4. Phase 0 – Preparation & Safety
[x] Run `cargo check`, `pnpm lint`, and existing test suite to capture a clean baseline.
[x] Create branch (if using git) dedicated to SQLite work.
[x] Audit `.gitignore` to ensure SQLite files (e.g., `*.db`) are ignored except for migrations.
[x] Document baseline in `OpenXLIFF-Plan.md` (summary of goals, potential risks) before changing code.

## 5. Phase 1 – Backend Dependencies & Plugin Wiring
[x] **Cargo dependencies** (`src-tauri/Cargo.toml`):
   [x] Add `tauri-plugin-sql = { version = "2.3.0", features = ["sqlite"] }`.
   [x] Add `tokio = { version = "1", features = ["full"] }` if not already present.
   [x] Ensure logging dependencies remain compatible (pay attention to MSRV).
[x] **Plugin registration** (`src-tauri/src/lib.rs`):
   [x] Import `tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind}`.
   [x] Instantiate plugin before `TranslationState::new()` to ensure DB is ready before IPC commands execute.
   [x] Example stub: `SqlBuilder::default().add_migrations("sqlite:weg_translator.db", migrations).build()`.
[x] **Capability manifest** (`src-tauri/capabilities/sqlite.json`, new):
   [x] Define permissions for the SQL plugin (read/write command set scoped to the main window) and reference it from `tauri.conf.json`.
[x] **`tauri.conf.json` adjustments**:
   [x] Register new capability and plugin config under `plugins` section (e.g., `"sql": { "preload": ["sqlite:weg_translator.db"] }`).
[x] 5. Re-run `cargo check` to confirm dependency graph compiles.

## 6. Phase 2 – Migrations & Schema Design
[x] Create directory `src-tauri/migrations/` (adjacent to `src-tauri/src/`).
[x] Author migration files (ASCII SQL):
   [x] `001_create_translation_jobs.sql` for core job metadata (`id`, `source_language`, `target_language`, `input_text`, `status`, timestamps).
   [x] `002_create_translation_outputs.sql` for job outputs (`job_id`, `output_text`, token usage, duration_ms).
   [x] Optional `003_seed_demo_data.sql` for sample rows (wrapped in `INSERT` statements guarded by `WHERE NOT EXISTS`).
[x] Update Rust to embed migrations using `include_str!` (Up only; Down migrations optional but recommended for dev workflow).
[x] Add helper to `.setup()` to ensure DB directory exists before plugin initialization (`std::fs::create_dir_all(app_handle.path_resolver().app_config_dir()?)`).
[x] Validate migrations by running a smoke command: temporary binary or `cargo tauri dev` and checking log output for migration success; inspect generated DB with `sqlite3` CLI if desired.

## 7. Phase 3 – Database Service Layer
[x] Create `src-tauri/src/db/mod.rs` with:
   [x] `pub struct DbManager` holding a pooled SQLite connection for reuse in commands.
   [x] `impl DbManager { pub async fn new(app: &AppHandle) -> Result<Self, DbError>; }` to open connection.
   [x] CRUD helpers (`insert_job`, `update_status`, `store_output`, `list_jobs`, `list_history`) returning `Result<T, DbError>`.
   [x] Encapsulate SQL strings (parameterized) and map rows to structs using `serde` or manual mapping.
[x] Define `DbError` enum wrapping DB errors (`sqlx::Error` → string) with conversions to `IpcError::internal`.
[x] Register `DbManager` in `tauri::Builder::setup` via `app.manage(db_manager)` to expose as shared state.
[x] Extend `ipc/dto.rs` with serializable structs for DB responses (e.g., `TranslationHistoryRecord`, `StoredTranslationJob`).
[x] Update `ipc/error.rs` to translate `DbError` variants.

## 8. Phase 4 – IPC Commands & Translation Pipeline Integration
[x] Modify `start_translation` in `src-tauri/src/ipc/commands.rs`:
   [x] Before queuing job, call `db.insert_job` to persist initial state.
   [x] During progress updates, call `db.update_status` (consider debouncing writes for simulated stages).
   [x] On completion, call `db.store_output`.
[x] Add new commands:
   [x] `#[tauri::command] async fn list_translation_history(state: State<'_, DbManager>) -> IpcResult<Vec<TranslationHistoryRecord>>`.
   [x] `#[tauri::command] async fn clear_translation_history(...)` (soft delete or truncate as per requirements).
   [x] Optional `#[tauri::command] async fn get_translation_job(job_id: Uuid) -> IpcResult<TranslationHistoryRecord>`.
[x] Wire commands into `tauri::generate_handler!` inside `lib.rs`.
[x] Update translation state caching (`TranslationState`) to reconcile with DB results where necessary (e.g., on app launch refresh from DB).
[x] Ensure commands log meaningful context (`job_id`, `stage`) and handle errors gracefully.

## 9. Phase 5 – Frontend Integration
[x] **IPC layer** (`src/ipc/index.ts`):
   [x] Add wrappers `listTranslationHistory()`, `clearTranslationHistory()`, `getTranslationJob()` using `invoke` with strong TypeScript types (server handles persistence so client-side save not required).
   [x] Ensure events in `src/ipc/events.ts` notify listeners to refetch history after completion/failure.
[x] **State hook** (`src/hooks/useTranslationHistory.ts`, new):
   [x] Internal state holds `history`, `isLoading`, `error`.
   [x] Fetch on mount + manual refresh; subscribe to translation completion events to trigger revalidation.
[x] **UI components**:
   [x] Create ShadCN-compliant table `src/components/history/TranslationHistoryTable.tsx` with columns (Job ID, Languages, Status, Duration, Last Updated).
   [x] Add `HistoryToolbar` with actions (refresh, clear, filter toggles).
[x] **App integration**:
   [x] Update `src/App.tsx` (or new dashboard route) to render history panel below existing job list.
   [x] Provide toggles to show/hide history and confirm clearing history via modal (using `AlertDialog`).
[x] **Example workflow**:
   [x] When translation completes, UI should reflect stored output (e.g., card showing `outputText` from DB) to prove end-to-end persistence works.

## 10. Phase 6 – Testing Strategy
[x] **Rust**:
   [x] Add async integration tests under `src-tauri/tests/` using `tokio::test` + in-memory SQLite (`sqlite::memory:` URI) to validate migrations and DbManager functions.
   [x] Include regression tests for duplicate job insertion, updates, and clear-history command.
[x] **TypeScript**:
   [x] Extend IPC unit tests or add Vitest tests mocking `invoke` to ensure wrappers pass correct payloads.
   [x] Add React component tests with React Testing Library for `TranslationHistoryTable` behaviours (loading, empty state, data rendering).
[ ] **Manual QA checklist** (document in plan):
   [ ] App start with empty DB → UI states. *(Pending manual run on desktop build.)*
   [ ] Submit translation → job persists. *(Pending manual run on desktop build.)*
   [ ] Restart app → history still visible. *(Pending manual run on desktop build.)*
   [ ] Clear history → DB table emptied. *(Pending manual run on desktop build.)*

## 11. Phase 7 – Observability & Error Handling
[x] Reuse `logger` to emit structured DB logs (success/failure) with `target: "db"` for filtering.
[x] Map user-facing errors to actionable messages (e.g., "Unable to open database. Check disk permissions.").
[x] Surface backend errors via IPC to React (display using `Alert` or toast component).
[ ] Consider adding simple telemetry metrics (counts of jobs) for future instrumentation hooks. *(Future enhancement.)*

## 12. Phase 8 – Security & Concurrency Considerations
[x] SQLite handles a single writer; ensure commands queue writes (existing Tokio tasks suffice). Avoid parallel `clear_history` + `insert` races by serializing operations per job ID.
[x] Validate/sanitize all user inputs before storing (languages, text length) to avoid bloating DB.
[x] Ensure capability manifest restricts DB path to the expected file; never allow arbitrary URIs from frontend. *(Confirmed via `src-tauri/tauri.conf.json` + `capabilities/sqlite.json`.)*
[ ] Backup/restore strategy (future): export DB file via dedicated command using Tauri secure file dialog.

## 13. Phase 9 – Tooling & CI updates
[x] Update `README.md` with instructions for running migrations, inspecting DB (`pnpm tauri dev -- --log-level debug`, `pnpm db:inspect` optional script).
[ ] Add npm script `"db:migrate": "pnpm tauri dev --migrate-only"` if desired (requires custom CLI handler). *(Deferred until CLI handler exists.)*
[ ] Configure CI to run `cargo test`, `cargo fmt -- --check`, `cargo clippy`, `pnpm lint`, `pnpm test`. *(CI pipeline not updated yet.)*
[x] Add DB file patterns to `.gitignore` (`*.sqlite`, `/sqlite/*.db`).

## 14. Phase 10 – Documentation & Knowledge Transfer
[x] Update `OpenXLIFF-Plan.md` with summary of implementation decisions, referencing this plan.
[x] Document schema (`docs/data-model.md`) summarizing tables/columns, relationships, and example queries.
[x] Provide onboarding notes for contributors (how to reset DB, run tests, extend migrations).

---

**Verification Exit Criteria**
- All migrations apply successfully on fresh install and upgrade.
- Example translation flow persists data and survives app restart.
- Automated tests cover DbManager logic and UI components.
- No new lint/clippy warnings; CI pipeline updated accordingly.
- Documentation updated and shared with team.
