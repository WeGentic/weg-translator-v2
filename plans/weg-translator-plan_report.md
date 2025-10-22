# weg-translator-plan Execution Report

## Step 1.1 – Shared UUID handling (Completed 2025-02-14)
- Implemented `resolve_attachment_file_uuid` so `attach_project_file_v2` resolves the target UUID a single time and threads it into both mapper builders.
- Updated `map_new_file_info_args` and `map_new_project_file_args` signatures to accept the resolved UUID, removing duplicate minting.
- Source changes: `src-tauri/src/ipc/commands/projects_v2.rs`.
- Tests: Covered by the Step 1.3 mapper suite executed via `cargo test --manifest-path src-tauri/Cargo.toml attachment_mapper`.

## Step 1.2 – Role-aware language pair validation (Completed 2025-02-14)
- Added a `requires_language_pairs` guard in `map_new_project_file_args` so only `processable` attachments enforce the non-empty language pair rule; non-processable roles now accept empty vectors.
- No database operation updates were required because `replace_file_language_pairs` already handles zero-row scenarios safely.
- Source changes: `src-tauri/src/ipc/commands/projects_v2.rs`.
- Tests: Covered by the Step 1.3 mapper suite executed via `cargo test --manifest-path src-tauri/Cargo.toml attachment_mapper`.

## Step 1.3 – Attachment mapper regression tests (Completed 2025-02-14)
- Added three mapper-focused unit tests validating shared UUID threading, non-processable attachments with empty language pairs, and the validation guard for processable roles.
- Tests live in `src-tauri/src/ipc/commands/projects_v2.rs` under the new `tests` module and executed via `cargo test --manifest-path src-tauri/Cargo.toml attachment_mapper`.
- All newly added tests pass locally.

## Task 1 – Status Update (2025-10-21)
- Re-reviewed attachment workflow against current codebase and confirmed single-UUID handling, role-aware validation, and regression coverage remain intact.
- Consulted current sqlx/Tauri best practices on UUID reuse via Perplexity to validate assumptions; no additional changes required.
- Updated master plan status for Task 1 to completed.

## Step 2.1 – Null-safe IPC mappers (Completed 2025-02-14)
- Added an `includeIfDefined` spread helper across project, user, and client IPC adapters so optional properties are only omitted when truly undefined while forwarding explicit `null` values.
- Updated the affected mapping functions to reuse the helper instead of `?? undefined`, preventing nullable fields from being stripped during payload assembly.
- Source changes: `src/core/ipc/db/projects.ts`, `src/core/ipc/db/users.ts`, `src/core/ipc/db/clients.ts`.
- Validation: `npm run typecheck`.

## Step 2.2 – Mapper regression tests (Completed 2025-02-14)
- Introduced `null-forwarding.test.ts` to assert that project, user, and client IPC mappers retain explicit `null` values while omitting `undefined`.
- Tests cover project, user, and client update flows to guard the new helper logic.
- Source additions: `src/core/ipc/db/__tests__/null-forwarding.test.ts`.
- Validation: `npx vitest run src/core/ipc/db/__tests__/null-forwarding.test.ts`.

## Task 2 – Status Update (2025-10-21)
- Re-ran `npx vitest run src/core/ipc/db/__tests__/null-forwarding.test.ts` to confirm nullable-field propagation remains intact.
- Spot-checked `includeIfDefined` helper usages across project/user/client mappers; no regressions detected.
- Updated the master plan to mark Task 2 as completed.

## Step 3.1 – Migration strategy (Completed 2025-02-14)
- Defined the migration roadmap: create `src-tauri/migrations/0001_baseline_*.sql` mirroring the current `schema.rs` DDL (keeping the `IF NOT EXISTS` guards for idempotency), embed migrations with `sqlx::migrate!("migrations")`, and execute them during `DbManager::connect_pool`.
- Legacy databases can safely run the baseline migration without additional stamping, while fresh installs rely solely on the embedded migration set.
- `initialise_schema` will be converted into a thin shim around the embedded migrator so tests continue using the same helper while benefitting from versioned migrations.

## Step 3.2 – Migration runner (Completed 2025-02-14)
- Embedded the SQLx migrator via `sqlx::migrate!("./migrations")` and replaced `initialise_schema` with a thin wrapper around it.
- Added `src-tauri/migrations/0001_baseline_schema.{up,down}.sql` mirroring the previous bootstrap DDL and realigned startup to execute the migrations.
- Validation: `cargo test --manifest-path src-tauri/Cargo.toml db_manager_v2::project_bundle_round_trip_v2`.

## Task 3 – Status Update (2025-10-21)
- Re-ran `cargo test --manifest-path src-tauri/Cargo.toml db_manager_v2::project_bundle_round_trip_v2` to ensure migration runner stays green.
- Reviewed the `initialise_schema` wrapper plus embedded migrator invocation; no drift or pending follow-ups identified.
- Marked Task 3 as completed in the master plan.

## Step 4.1 – File reuse decision (Completed 2025-02-14)
- Chose to preserve multi-project file reuse in line with F-004; `file_uuid` remains globally reusable with `attach_project_file` already performing `ON CONFLICT` upserts.
- Upcoming work will adjust `detach_project_file` to drop metadata only when no other `project_files` rows reference the UUID, avoiding FK violations without adding uniqueness constraints.


## Step 4.2 – Conditional detach (Completed 2025-02-14)
- Adjusted `detach_project_file` to only remove `file_info` when no other `project_files` rows reference the shared UUID, preserving metadata for reused files.
- Added test `detach_project_file_retains_shared_metadata` to cover multi-project reuse and guard against regressions.
- Validation: `cargo test --manifest-path src-tauri/Cargo.toml detach_project_file_retains_shared_metadata`.

## Task 4 – Status Update (2025-10-21)
- Re-ran `cargo test --manifest-path src-tauri/Cargo.toml detach_project_file_retains_shared_metadata`; shared-metadata safeguard still holds.
- Reviewed `detach_project_file` conditional delete logic and confirmed alignment with file reuse decision documented in Task 4.1.
- Marked Task 4 as completed in the master plan.

## Step 5.1 – Constraint mapping (Completed 2025-02-14)
- Added dynamic `DbError::ConstraintViolation` mapping for SQLite constraint errors (including trigger aborts) so they surface with friendly messages instead of generic sqlx errors.
- Updated projects/conversions tests to cover the new pathway.
- Validation: `cargo test --manifest-path src-tauri/Cargo.toml projects_v2::`

## Step 5.2 – IPC validation messaging (Completed 2025-02-14)
- Constraint violations now map to friendly IPC validation messages (duplicate language pairs, duplicate subjects, trigger aborts, FK failures).
- Implemented helper in `ipc/error.rs` and added focused tests ensuring the friendly messages surface.
- Validation: `cargo test --manifest-path src-tauri/Cargo.toml ipc::error::tests -- --nocapture`.

## Task 5 – Status Update (2025-10-21)
- Re-ran `cargo test --manifest-path src-tauri/Cargo.toml ipc::error::tests -- --nocapture`; SQLite constraint mapping continues to yield friendly validation messages.
- Inspected `DbError::from(sqlx::Error)` branch to confirm constraint code coverage for FK and unique violations remains wired.
- Marked Task 5 as completed in the master plan.

## Step 6.1 – Language pair validation (Completed 2025-02-14)
- Added Rust-side duplicate detection for project language pairs using a HashSet and emit a descriptive constraint violation before hitting SQLite.
- Updated create/update project tests to assert the friendly error message.
- Validation: `cargo test --manifest-path src-tauri/Cargo.toml create_project_rolls_back_on_duplicate_language_pair -- --nocapture`.

## Step 6.2 – PRAGMA diagnostics (Completed 2025-02-14)
- Logged configured and active SQLite `journal_mode`/`synchronous` values during pool initialization to aid diagnostics.
- Changes live in `src-tauri/src/db/manager.rs` via info-level logging around `DbManager::connect_pool`.
- Validation: manual inspection of the new log output during startup (log target `db::connect`).

## Step 6.3 – IPC adapter tests (Completed 2025-02-14)
- Added Vitest coverage (`projects-adapter.test.ts`) ensuring the project IPC mapper forwards optional attachment fields and preserves explicit nulls.
- Tests mock `safeInvoke` to assert payload shape, complementing the null-forwarding suite.
- Validation: `npx vitest run src/core/ipc/db/__tests__/projects-adapter.test.ts`.

## Task 6 – Status Update (2025-10-21)
- Re-ran `cargo test --manifest-path src-tauri/Cargo.toml create_project_rolls_back_on_duplicate_language_pair -- --nocapture` and `npx vitest run src/core/ipc/db/__tests__/projects-adapter.test.ts`; both passed.
- Spot-checked diagnostics logging and duplicate-language-pair guard; no regressions observed.
- Confirmed Task 6 completion in the master plan.

## Task 7 – SQLite Documentation (Completed 2025-10-21)
- Authored `docs/sqlite-docs-v2.md`, consolidating the v2 schema inventory, migration workflow, PRAGMA policy, transaction patterns, feature workflows, error mapping, testing strategy, maintenance steps, and troubleshooting guidance.
- Structure and content validated against latest code (`src-tauri/src/db/manager.rs`, `src-tauri/src/db/operations/projects_v2.rs`, `src-tauri/migrations/0001_baseline_schema.up.sql`) and recent regression tests.
- Incorporated industry best practices from Perplexity research on SQLite documentation (versioning, transaction safety, performance tuning).
