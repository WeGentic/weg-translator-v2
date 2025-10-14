# sentic_club — New Project Database Structure and Import Flow — Execution Plan

Note: Plan aligns with current Weg Translator codebase and reuses existing backend conversions (OpenXLIFF → XLIFF, XLIFF → JLIFF). All steps are non‑destructive migrations first; old tables remain usable until final cutover.

Task 1 - Introduce Reference Tables (users, clients, domains) - Status: COMPLETED ✅

Step 1.1 - Add migration `009_create_reference_tables.sql` (SQLite) - Status: COMPLETED ✅
- Create `users(user_id TEXT PK, email UNIQUE NOT NULL, display_name, created_at DEFAULT strftime(...))`.
- Create `clients(client_id TEXT PK, name UNIQUE NOT NULL)`.
- Create `domains(domain_id TEXT PK, name UNIQUE NOT NULL)`.
- Ensure `PRAGMA foreign_keys = ON;` at file top.
  - ✅ Implemented in `src-tauri/migrations/009_create_reference_tables.sql`.

Task 2 - Extend Projects Model (owner, lifecycle, FKs, indices) - Status: IN PROGRESS

Sub-task 2.1 - Add lifecycle + ownership columns without breaking current code - Status: COMPLETED ✅

Step 2.1.1 - Add migration `010_alter_projects_add_lifecycle_and_refs.sql` - Status: COMPLETED ✅
- Add columns to `projects` (keep existing shape):
  - `owner_user_id TEXT` (FK -> users.user_id, ON UPDATE CASCADE, ON DELETE RESTRICT, enforced non-null via insert/update triggers due to SQLite ALTER COLUMN limitations).
  - `client_id TEXT NULL` (FK -> clients.client_id ON DELETE SET NULL).
  - `domain_id TEXT NULL` (FK -> domains.domain_id ON DELETE SET NULL).
  - `lifecycle_status TEXT NOT NULL DEFAULT 'CREATING' CHECK (lifecycle_status IN ('CREATING','READY','IN_PROGRESS','COMPLETED','ERROR'))`.
  - `archived_at TEXT NULL`.
- Do NOT repurpose current `status` ('active'|'archived'); keep both until cutover. Map at service layer.
  - ✅ Implemented in `src-tauri/migrations/010_alter_projects_add_lifecycle_and_refs.sql`, seeding a placeholder `local-user` owner to satisfy legacy inserts.

Step 2.1.2 - Add unique index and updated_at trigger - Status: COMPLETED ✅
- `CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_owner_name ON projects(owner_user_id, name COLLATE NOCASE) WHERE archived_at IS NULL;`
- Trigger `trg_projects_updated_at`:
  ```sql
  CREATE TRIGGER trg_projects_updated_at
  AFTER UPDATE ON projects
  FOR EACH ROW BEGIN
    UPDATE projects SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = NEW.id;
  END;
  ```
  - ✅ Added index and trigger within `src-tauri/migrations/010_alter_projects_add_lifecycle_and_refs.sql`, including recursion guard by checking previous `updated_at`.

Task 3 - Normalize Language Pairs - Status: COMPLETED ✅

Step 3.1 - Add migration `011_create_project_language_pairs.sql` - Status: COMPLETED ✅
- `project_language_pairs(pair_id TEXT PK, project_id TEXT NOT NULL, src_lang TEXT NOT NULL, trg_lang TEXT NOT NULL, created_at TEXT DEFAULT strftime(...), UNIQUE(project_id, src_lang, trg_lang), FK(project_id) REFERENCES projects(id) ON DELETE CASCADE)`.
- Notes: Use BCP‑47 tags; normalization/validation at service layer using `language-tags` crate (see Step 9.2).
  - ✅ Implemented in `src-tauri/migrations/011_create_project_language_pairs.sql`.

Task 4 - Evolve Project Files (roles, storage_state, integrity) - Status: IN PROGRESS

Sub-task 4.1 - Non-breaking extensions to `project_files` - Status: COMPLETED ✅

Step 4.1.1 - Add migration `012_alter_project_files_extend.sql` - Status: COMPLETED ✅
- Add columns: `role TEXT NOT NULL DEFAULT 'source' CHECK(role IN ('source','reference','tm','termbase','styleguide','other'))`, `mime_type TEXT`, `hash_sha256 TEXT`, `storage_state TEXT NOT NULL DEFAULT 'COPIED' CHECK(storage_state IN ('STAGED','COPIED','MISSING','DELETED'))`, `importer TEXT`.
- Add uniqueness: `UNIQUE(project_id, stored_rel_path)` to prevent duplicate stored paths per project.
- Keep `original_path` for provenance; UI may hide it.
  - ✅ Implemented in `src-tauri/migrations/012_alter_project_files_extend.sql`, including backfill copying `checksum_sha256` into new `hash_sha256`.

Task 5 - Introduce File Targets (file × language pair) - Status: COMPLETED ✅

Step 5.1 - Add migration `013_create_file_targets.sql` - Status: COMPLETED ✅
- `file_targets(file_target_id TEXT PK, file_id TEXT NOT NULL, pair_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','EXTRACTED','FAILED')), created_at TEXT DEFAULT strftime(...), updated_at TEXT DEFAULT strftime(...), UNIQUE(file_id, pair_id), FK(file_id)->project_files(id) ON DELETE CASCADE, FK(pair_id)->project_language_pairs(pair_id) ON DELETE CASCADE)`.
- Trigger `trg_file_targets_updated_at` similar to projects.
  - ✅ Implemented in `src-tauri/migrations/013_create_file_targets.sql` with cascades and timestamp trigger.

Task 6 - Introduce Artifacts (xliff, jliff, qa_report, preview) - Status: COMPLETED ✅

Step 6.1 - Add migration `014_create_artifacts.sql` - Status: COMPLETED ✅
- `artifacts(artifact_id TEXT PK, file_target_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('xliff','jliff','qa_report','preview')), rel_path TEXT NOT NULL, size_bytes INTEGER, checksum TEXT, tool TEXT, status TEXT NOT NULL DEFAULT 'GENERATED' CHECK(status IN ('GENERATED','FAILED')), created_at TEXT DEFAULT strftime(...), updated_at TEXT DEFAULT strftime(...), UNIQUE(file_target_id, kind), FK(file_target_id)->file_targets(file_target_id) ON DELETE CASCADE)`.
- Index suggestion: `CREATE INDEX ix_artifacts_kind_path ON artifacts(kind, rel_path);`.
  - ✅ Implemented in `src-tauri/migrations/014_create_artifacts.sql` with cascaded FK, enum CHECKs, timestamp trigger, and index.

Task 7 - Introduce Validations (artifact checks) - Status: COMPLETED ✅

Step 7.1 - Add migration `015_create_validations.sql` - Status: COMPLETED ✅
- `validations(validation_id TEXT PK, artifact_id TEXT NOT NULL, validator TEXT NOT NULL, passed INTEGER NOT NULL CHECK(passed IN (0,1)), result_json TEXT, created_at TEXT DEFAULT strftime(...), FK(artifact_id)->artifacts(artifact_id) ON DELETE CASCADE)`.
  - ✅ Implemented in `src-tauri/migrations/015_create_validations.sql`.

Task 8 - Notes (per-project) - Status: COMPLETED ✅

Step 8.1 - Add migration `016_create_notes.sql` - Status: COMPLETED ✅
- `notes(note_id TEXT PK, project_id TEXT NOT NULL, author_user_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT DEFAULT strftime(...), FK(project_id)->projects(id) ON DELETE CASCADE, FK(author_user_id)->users(user_id) ON DELETE RESTRICT)`.
  - ✅ Implemented in `src-tauri/migrations/016_create_notes.sql`.

Task 9 - Jobs Ledger (copy, extract, convert, validate) - Status: COMPLETED ✅

Step 9.1 - Add migration `017_create_jobs.sql` - Status: COMPLETED ✅
- `jobs(job_id TEXT PK, project_id TEXT NOT NULL, job_type TEXT NOT NULL CHECK(job_type IN ('COPY_FILE','EXTRACT_XLIFF','CONVERT_JLIFF','VALIDATE')), file_target_id TEXT, artifact_id TEXT, state TEXT NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED')), attempts INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT DEFAULT strftime(...), started_at TEXT, finished_at TEXT, FK(project_id)->projects(id) ON DELETE CASCADE, FK(file_target_id)->file_targets(file_target_id) ON DELETE CASCADE, FK(artifact_id)->artifacts(artifact_id) ON DELETE CASCADE)`.
- Index: `CREATE INDEX ix_jobs_project_state ON jobs(project_id, state);`.
  - ✅ Implemented in `src-tauri/migrations/017_create_jobs.sql`.

Step 9.2 - Language normalization helper (service layer) - Status: COMPLETED ✅
- Use crate `language-tags` to parse/normalize BCP‑47 strings; reject invalid tags early.
- Plan: small adapter in Rust to return a canonical form (case/variant normalization) for storage.
- File references for integration points: `src-tauri/src/ipc/commands/projects/validation.rs`, `src-tauri/src/ipc/commands/projects/service.rs:34`.
  - ✅ Added normalization via `language_tags` in validation/service modules ensuring invalid tags raise validation errors and persisted values use canonical casing.

Task 10 - Runtime PRAGMA and Pool Tuning - Status: COMPLETED ✅

Step 10.1 - Set WAL + synchronous in `DbManager` after connect - Status: COMPLETED ✅
- Update `src-tauri/src/db/manager.rs:44` connect to execute:
  - `PRAGMA foreign_keys=ON;`
  - `PRAGMA journal_mode=WAL;`
  - `PRAGMA synchronous=NORMAL;` (or `FULL` if you prioritize maximum durability).
- Rationale validated via SQLite docs; keep per-connection initialization.
  - ✅ `DbManager::connect_pool` now applies PRAGMAs on a fresh connection before migrations.

Task 11 - Filesystem Layout Alignment - Status: COMPLETED ✅

Step 11.1 - Adopt artifact folder structure under project root - Status: COMPLETED ✅
- Structure per project UUID folder:
  - `original/<file_id>__<sanitized_name.ext>`
  - `artifacts/xliff/<src>__<trg>/<file_id>.xlf`
  - `artifacts/xjliff/<src>__<trg>/<file_id>.json`
  - `artifacts/qa/<src>__<trg>/<file_id>__report.json`
- Paths stored in DB are always relative to project root.
- Update builders/planners to target these new paths (compat fallback kept for existing rows).
  - ✅ `create_project_directory` now scaffolds `original/` and `artifacts/` trees; file imports store originals as `original/{uuid}__name.ext`.
  - ✅ Conversion planning/output updated to emit XLIFF/JLIFF under `artifacts/<kind>/<src>__<trg>/` with filenames keyed by `project_file_id`.

Task 12 - Stage → Promote Project Creation Flow - Status: NOT COMPLETED

Sub-task 12.1 - Seed metadata in DB (Transaction A) - Status: COMPLETED ✅

Step 12.1.1 - Add service method to seed metadata only - Status: COMPLETED ✅
- In `src-tauri/src/ipc/commands/projects/service.rs`, add `seed_project_metadata()` that:
  - Inserts `projects(lifecycle_status='CREATING')` with `owner_user_id` (single local user for now).
  - Inserts `project_language_pairs` rows (deduped, normalized BCP‑47).
  - Inserts `project_files` rows with `storage_state='STAGED'`, temporary `stored_rel_path='.staging/...'`.
  - Pre-creates `file_targets` (one per processable file × language pair) with `status='PENDING'`.
- Use a tight SQL transaction; do not touch filesystem.
  - ✅ Implemented `ProjectService::seed_project_metadata` with staging helpers and new DTOs; adds language pairs, staged file rows, and file targets inside a single transaction.

Sub-task 12.2 - Create staging folder and copy originals - Status: COMPLETED ✅

Step 12.2.1 - Create `{project_uuid}.staging` structure - Status: COMPLETED ✅
- Implemented `create_project_staging_dir()` plus `CreatedProjectStagingDirectory` in `src-tauri/src/ipc/commands/projects/file_operations.rs`, preparing `{uuid}-{slug}.staging` alongside computed final path, cleaning stale staging folders, and scaffolding `.staging/original` + artifact subdirectories.
- Reference: `create_project_directory()` in `src-tauri/src/ipc/commands/projects/file_operations.rs:41`.

Step 12.2.2 - Copy files atomically with hashing - Status: COMPLETED ✅
- Added streaming SHA-256 staging copy helper (`copy_file_into_staging`) returning size/hash metadata (`src-tauri/src/ipc/commands/projects/file_operations.rs`), storing files under `.staging/original/<id>__name.ext`.
- Persist staged metadata and lifecycle/error handling via `ProjectService::stage_original_files`, including job ledger writes through `DbManager::insert_job_row` and failure cleanup (`src-tauri/src/ipc/commands/projects/service.rs`, `src-tauri/src/db/operations/{project_files,projects,jobs}.rs`).
- On failure paths, helper marks project `lifecycle_status='ERROR'`, records `jobs` row with `FAILED`, and removes the staging directory; successes log `COPY_FILE` jobs with `SUCCEEDED` state.

Sub-task 12.3 - Promote staging → live (atomic rename) - Status: COMPLETED ✅

Step 12.3.1 - Perform single directory rename within same volume - Status: COMPLETED ✅
- Implemented staging promotion helper that atomically renames `{uuid}-{slug}.staging` → `{uuid}-{slug}`, promotes `.staging/original`/`artifacts` into their final locations, and reverses on failure (`src-tauri/src/ipc/commands/projects/file_operations.rs`).
- Added service orchestration `ProjectService::promote_staged_project` to finalize stored paths, update project root, and mark lifecycle `READY`, with rollback to staged layout on database errors (`src-tauri/src/ipc/commands/projects/service.rs`).
- Database layer now exposes `finalize_staged_project_files` and `update_project_root_path` to flip `storage_state='COPIED'`, strip `.staging/` prefixes, and persist the final root path (`src-tauri/src/db/operations/project_files.rs`, `src-tauri/src/db/operations/projects.rs`).

Task 13 - XLIFF Extraction (per file_target) - Status: COMPLETED ✅

Step 13.1 - Build extraction plan using existing backend - Status: COMPLETED ✅
- Updated `build_conversions_plan` (`src-tauri/src/ipc/commands/projects/artifacts.rs`) to source pending work from `file_targets`, create per-pair XLIFF destinations, and lazily bridge to legacy `project_file_conversions` via `find_or_create_conversion_for_file`.
- Added defensive checks (status filtering, empty path guards) and fallback to legacy conversions when file_targets are absent, maintaining current IPC contract while priming artifact directories for `<src>__<trg>/<file_id>.xlf`.
-- Reuse current OpenXLIFF sidecar wrappers and capability allowlists (`src-tauri/capabilities/default.json`).

Step 13.2 - Upsert artifacts and transition file_target status - Status: COMPLETED ✅
- ✅ Persisted XLIFF artifacts via `DbManager::upsert_artifact_row` and `ProjectService::update_conversion_status`, updating `file_targets` and logging `EXTRACT_XLIFF` jobs with best-effort retries (`src-tauri/src/db/operations/{artifacts,file_targets}.rs`, `src-tauri/src/ipc/commands/projects/service.rs`).

Task 14 - XLIFF → JLIFF Conversion (per successful XLIFF) - Status: COMPLETED ✅

Step 14.1 - Reuse `convert_xliff_to_jliff()` and persist artifacts - Status: COMPLETED ✅
- ✅ Extended `convert_xliff_to_jliff` to upsert JLIFF artifacts, resolve file targets, capture size metadata, and log `CONVERT_JLIFF` job outcomes (`src-tauri/src/ipc/commands/projects/artifacts.rs`).

Task 15 - Validations (schema, QA) - Status: COMPLETED ✅

Step 15.1 - Persist JLIFF schema validation results - Status: COMPLETED ✅
- ✅ `convert_xliff` now surfaces schema validation summaries, and `convert_xliff_to_jliff` persists `validations` rows with outcome metadata for generated JLIFF artifacts (`src-tauri/src/jliff/mod.rs`, `src-tauri/src/db/operations/validations.rs`, `src-tauri/src/ipc/commands/projects/artifacts.rs`).

Step 15.2 - Optional XLIFF validation (OpenXLIFF checker) - Status: COMPLETED ✅
- ✅ Captured `xliffchecker` results from the conversion pipeline, forwarded them through `update_conversion_status`, and stored `xliff_schema` records alongside XLIFF artifacts (`src/modules/projects/ui/overview/ProjectOverview.tsx`, `src/core/ipc/client.ts`, `src-tauri/src/ipc/commands/projects/service.rs`).

Task 16 - Backfill & Compatibility Layer - Status: NOT COMPLETED

Step 16.1 - Backfill users/owner for existing projects - Status: COMPLETED ✅
- ✅ Ensure `local-user` placeholder exists in `users` and assign it to orphaned projects during startup (`src-tauri/src/db/operations/projects.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/ipc/commands/projects/constants.rs`).

Step 16.2 - Backfill language pairs from defaults - Status: COMPLETED ✅
- ✅ Startup backfill now inserts missing default language pairs per project using `DEFAULT_SOURCE_LANGUAGE` / `DEFAULT_TARGET_LANGUAGE` fallbacks (`src-tauri/src/db/operations/projects.rs`, `src-tauri/src/lib.rs`).

Step 16.3 - Backfill file_targets and artifacts - Status: NOT COMPLETED
- For each `project_file_conversions` row, create corresponding `file_targets` and `artifacts` (xliff/jliff) with computed checksums and sizes when files exist.
- Mark `file_targets.status` to `EXTRACTED` when an XLIFF artifact exists; otherwise `PENDING`/`FAILED` per status.

Task 17 - DB Layer Additions (Rust) - Status: NOT COMPLETED

Sub-task 17.1 - New types and builders - Status: COMPLETED ✅

Step 17.1.1 - Add Rust types for new tables - Status: COMPLETED ✅
- Add structs/enums in `src-tauri/src/db/types/` for: `User`, `Client`, `Domain`, `LanguagePair`, `FileTarget`, `Artifact`, `Validation`, `Note`, `Job`, plus status enums mirroring CHECK constraints.
- Add builders in `src-tauri/src/db/builders.rs` to hydrate rows safely.
  - ✅ Implemented new domain structs and enums (`reference.rs`, `language_pair.rs`, `file_target.rs`, `artifact.rs`, `note.rs`, `job.rs`) with strongly typed status/kind helpers and extended `validation.rs` aliasing for compatibility. Added corresponding builder functions and re-exports in `src-tauri/src/db/builders.rs`, `src-tauri/src/db/mod.rs`, and introduced new `DbError` variants to surface invalid status parsing.

Sub-task 17.2 - Operations and queries - Status: COMPLETED ✅

Step 17.2.1 - Insert/update helpers for each new table - Status: COMPLETED ✅
- Add `operations/*` modules for CRUD + state transitions (e.g., `update_file_target_status`, `upsert_artifact`, `insert_validation`, `insert_job`, `transition_job_state`).
  - ✅ Added new `reference`, `language_pairs`, and `notes` operation modules plus expanded `file_targets`, `artifacts`, `jobs`, and `validations` operations with strongly typed APIs (`insert_pipeline_job`, status transitions, artifact lookups) now returning hydrated domain structs.
  - ✅ Updated IPC/service callers to adopt typed status enums (`FileTargetStatus`, `ArtifactKind`, `ArtifactStatus`) and ensured helper functions (`upsert_artifact`, `update_file_target_status`) keep unique conflict semantics while returning structured data.

Step 17.2.2 - Bridge from legacy conversion rows - Status: COMPLETED ✅
- Provide mapping methods to derive `file_targets` from `project_file_conversions` during transition to avoid breaking UI and existing flows.
  - ✅ Implemented `DbManager::bridge_file_target_from_conversion` and `bridge_project_conversions` to project conversions into language pairs, file targets, and artifacts, including automatic status escalation and idempotent artifact upserts (see `src-tauri/src/db/operations/file_targets.rs`).

Task 18 - Service Layer Changes (Rust) - Status: COMPLETED ✅

Step 18.1 - Implement staged project creation - Status: COMPLETED ✅
- Refactor `create_project_with_files` in `src-tauri/src/ipc/commands/projects/service.rs:24` to follow: validate → Transaction A (seed) → stage copy (jobs COPY_FILE) → promote → set lifecycle_status READY.
- Keep current API contract; only internal behavior changes.
  - ✅ `create_project_with_files` now seeds metadata via `seed_project_metadata`, stages originals in `.staging/`, promotes atomically, and transitions lifecycle (`CREATING` → `IN_PROGRESS` → `READY`) while logging COPY_FILE jobs (`src-tauri/src/ipc/commands/projects/service.rs:395`).

Step 18.2 - Ensure conversion plan uses file_targets - Status: COMPLETED ✅
- Update `ensure_project_conversions_plan()` to query `file_targets` first (fallback to legacy table until complete), then build tasks.
  - ✅ `build_conversions_plan` bridges legacy conversions when required, re-queries `file_targets`, and uses typed `FileTargetStatus` handling before generating tasks (`src-tauri/src/ipc/commands/projects/artifacts.rs:526`).

Task 19 - Filesystem Operations Enhancements - Status: COMPLETED ✅

Step 19.1 - Add staging helpers and hashing - Status: COMPLETED ✅
- ✅ Added shared 16 KiB buffer constant and new `compute_sha256_streaming` helper returning `(bytes, hash)` for reuse across staging flows (`src-tauri/src/ipc/commands/projects/file_operations.rs:299`).
- ✅ Updated streaming staging copy to leverage the shared buffer and verified checksum metadata with a dedicated unit test (`src-tauri/src/ipc/commands/projects/file_operations.rs:350`, `src-tauri/src/ipc/commands/projects/file_operations.rs:927`).

Task 20 - UI/IPC Adjustments (Minimal) - Status: COMPLETED ✅

Step 20.1 - Keep IPC stable; add new endpoints later - Status: COMPLETED ✅
- ✅ Confirmed that backend changes remain service-only and no new Tauri commands were introduced; existing handlers continue to rely on `ProjectService` without breaking IPC contracts (`src-tauri/src/ipc/commands/projects/commands.rs:1`).
- ✅ Deferred new summary DTO endpoints per plan, documenting the follow-up for future UI surfaces.

Task 21 - Migration Safety, Idempotency, and Recovery - Status: NOT COMPLETED

Step 21.1 - Idempotency keys and UNIQUE guards - Status: COMPLETED ✅
- ✅ Added migration `018_alter_jobs_add_job_key.sql` introducing a unique `job_key` column with non-null triggers to back idempotent inserts while keeping legacy rows compatible.
- ✅ Job operations now upsert on `job_key`, and service/artifact flows generate deterministic keys (`COPY_FILE::{project_id}::{file_id}`, `EXTRACT_XLIFF::{project_id}::{file_target_id}`, `CONVERT_JLIFF::{project_id}::{file_target_id}`) to update existing rows rather than duplicating ledger entries.

Step 21.2 - Resume on startup - Status: COMPLETED ✅
- ✅ Startup hook now queries the pipeline `jobs` table for `PENDING`/`FAILED` entries, logs a structured summary, and broadcasts a `pipeline://jobs_need_attention` event containing job digests for the renderer (`src-tauri/src/lib.rs:171`).
- ✅ Added `PipelineJobSummary` DTO, event constant, and read-only accessor to keep UI integration simple without triggering automatic retries (`src-tauri/src/ipc/dto.rs:62`, `src-tauri/src/ipc/events.rs:5`, `src-tauri/src/db/operations/jobs.rs:151`).

Task 22 - Tests - Status: IN PROGRESS

Step 22.1 - DB migrations compile and apply - Status: COMPLETED ✅
- Added `tests/schema_migrations.rs` covering the full SQLx migration directory against an in-memory SQLite pool, asserting reference table presence plus critical FK, CHECK, index, and trigger guarantees across `projects`, `project_files`, `file_targets`, `artifacts`, and `jobs`.
- Cleared legacy `dead_code` warnings by pruning unused exports and reusing filesystem helpers within active import flows, ensuring schema regression tests run warning-free.

Step 22.2 - Staging → promote flow - Status: COMPLETED ✅
- Added end-to-end staging flow test (`src-tauri/src/ipc/commands/projects/file_operations.rs:939`) using `tempfile::tempdir()` that exercises streaming copy with checksum validation and verifies atomic promotion cleans up the staging placeholder across platforms.

Step 22.3 - Conversion planning and artifact upsert - Status: COMPLETED ✅
- Added integration coverage in `tests/conversion_plan.rs` validating `build_conversions_plan` output paths alongside artifact directory scaffolding, and verifying `upsert_artifact` updates reuse existing rows for repeated inserts.

Task 23 - Performance & PRAGMAs - Status: COMPLETED ✅

Step 23.1 - Validate WAL/synchronous tradeoffs - Status: COMPLETED ✅
- Default to `WAL + NORMAL` for desktop; allow override via settings if needed.
- Keep `PRAGMA foreign_keys=ON` always.
- ✅ 2025-10-14: Confirmed WAL + NORMAL guidance via SQLite docs and engineering write-ups (`sqlite.org/wal.html`, agwa.name) and wired sanitized overrides through `SettingsManager` → `DbManager::new_with_base_dir_and_performance`, plus YAML serialization.
- ✅ 2025-10-14: Added `DatabasePerformanceConfig` (whitelisted journal/synchronous enums), persisted new settings fields/UI DTOs, and updated Rust/TS tests & IPC helpers to respect runtime overrides while defaulting safely.

Task 24 - Security & Integrity - Status: COMPLETED ✅

Step 24.1 - Path safety and capabilities - Status: COMPLETED ✅
- ✅ 2025-10-14: Hardened directory handling by sanitizing language-derived artifact folder names (`build_language_directory_name`) and rejecting unsafe subdirectory requests via `DbManager::ensure_subdir` (now validates single-segment inputs).
- ✅ 2025-10-14: Routed stored file joins through `join_within_project` in artifact planning to prevent traversal when staging sidecar tasks.
- ✅ 2025-10-14: Added regression tests covering traversal rejection and sanitized naming, and verified existing sidecar capability entries remain compatible (no new flags required).

Step 24.2 - Hash-based tamper detection - Status: COMPLETED ✅
- ✅ 2025-10-14: Cached streaming SHA-256 recomputation during conversion planning, comparing against `project_files.hash_sha256` and warning on mismatches while avoiding duplicate hashing across language pairs.
- ✅ 2025-10-14: Surfaced `hash_sha256` in `ProjectFileDetails` hydration so integrity checks run without extra queries; maintained UI DTO stability by keeping hashes server-side only.
- ✅ 2025-10-14: Added unit coverage for updated builders and hashing helpers plus reran targeted integration tests (`conversion_plan`, `project_conversions`, `ipc_artifacts`).
- ✅ 2025-10-14: Exposed integrity alerts through the conversions plan DTO and surfaced destructive toasts in the Project Overview UI whenever mismatches are detected.

Task 25 - Backward Compatibility & Rollout - Status: COMPLETED ✅

Step 25.1 - Dual-write (optional, time-boxed) - Status: COMPLETED ✅
- ✅ 2025-10-14: `ProjectService::seed_project_metadata` now seeds legacy `project_file_conversions` rows alongside new `file_targets`, honoring convertible extension filters and sharing the same transaction to avoid dual-write drift (`src-tauri/src/ipc/commands/projects/service.rs`).
- ✅ 2025-10-14: Added unit coverage (`seed_project_metadata_dual_writes_legacy_conversions`) verifying new projects create pending conversion rows for convertible files while skipping non-convertible extensions, keeping legacy workflows intact during rollout.

Step 25.2 - Data migration CLI - Status: COMPLETED ✅
- ✅ 2025-10-14: Introduced reusable legacy backfill tooling. `DbManager::backfill_file_targets_from_legacy` summarises bridging outcomes (`src-tauri/src/db/operations/file_targets.rs`), `FileTargetBackfillSummary` captures counts (`src-tauri/src/db/types/file_target.rs`), and the new `backfill-legacy-data` CLI orchestrates owner/language backfills plus conversion promotion for deployed installs (`src-tauri/src/bin/backfill_legacy_data.rs`).
- ✅ 2025-10-14: Added regression coverage (`backfill_legacy_conversions_creates_file_targets`) ensuring backfills promote pending conversions without duplicating language pairs or artifacts (`src-tauri/tests/project_conversions.rs`).

Task 26 - Folder Layout Migration (existing projects) - Status: COMPLETED ✅

Step 26.1 - Register existing files as artifacts - Status: COMPLETED ✅
- ✅ 2025-10-14: Added filesystem indexing helper `DbManager::backfill_artifacts_from_disk` that scans legacy XLIFF/JLIFF directories, computes SHA-256 hashes, and upserts artifacts against file targets while reconciling language pairs (`src-tauri/src/db/operations/file_targets.rs`).
- ✅ 2025-10-14: Extended `backfill-legacy-data` CLI to invoke the artifact indexer and surface summary metrics for operators (`src-tauri/src/bin/backfill_legacy_data.rs`).
- ✅ 2025-10-14: Added coverage ensuring on-disk artifacts are registered with checksums and correct relative paths (`register_existing_artifacts_records_files`, `src-tauri/tests/project_conversions.rs`).

Task 27 - Documentation & Dev Notes - Status: COMPLETED ✅

Step 27.1 - Add docs for schema and flow - Status: COMPLETED ✅
- ✅ 2025-10-14: Authored `docs/db-pipeline-backfill-documentation.md` summarising schema touchpoints, staging lifecycle, path safety, and the recovery/backfill playbook, referencing new helpers/CLI for legacy artifact indexing.

—

Implementation Notes (validated):
- PRAGMA and pool settings: enable `WAL`, `synchronous=NORMAL|FULL`, and `foreign_keys=ON` at connect time.
- Atomic rename of directories is supported on macOS and Windows within the same volume; ensure destination doesn’t pre-exist and handle interference by AV/indexers gracefully.
- BCP‑47 parsing/canonicalization: prefer `language-tags` (or `langtag`) crate for validation/normalization in Rust.
- Trigger-based `updated_at` is acceptable; use `strftime('%Y-%m-%dT%H:%M:%fZ','now')` for UTC.
