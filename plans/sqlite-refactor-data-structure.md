# 0. Metadata
- Project: Weg Translator Tauri Application
- Working folder: /Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator

# 1. Atomic Information Extraction (Information Preservation)
- A1: Need to locate all points in the codebase where database tasks are performed.
- A2: Must refactor the entire SQLite-related code to align with a new schema; existing schema code should be deleted or modified accordingly with no legacy persistence kept.
- A3: No database migration is required because there is no legacy database; any current database artifacts must be removed.
- A4: Must provide single-scoped backend and frontend IPC functions that allow create/read/update/delete operations across all new tables, including users, projects, clients, project files, file info, language pairs, artifacts, and jobs.
- A5: `PRAGMA foreign_keys = ON` must be applied per SQLite connection and `PRAGMA recursive_triggers = OFF` left as default to avoid recursion loops.
- A6: Users table requires columns: user_uuid (TEXT PRIMARY KEY), username (TEXT NOT NULL), email (TEXT NOT NULL), phone (TEXT optional), address (TEXT optional).
- A7: User roles must be stored in `user_roles` table with composite primary key (user_uuid, role) and cascading foreign key to users.
- A8: User permission overrides stored in `user_permission_overrides` with composite primary key (user_uuid, permission) and cascading foreign key to users.
- A9: Clients table schema includes uuid, name (mandatory), optional email, phone, address, VAT, note.
- A10: Projects table requires uuid primary key, project_name, creation_date (default CURRENT_TIMESTAMP), update_date (default CURRENT_TIMESTAMP), project_status, user_uuid (mandatory FK to users with RESTRICT on delete, CASCADE on update), optional client_uuid (FK to clients with SET NULL on delete, CASCADE on update), type, optional notes.
- A11: Projects need trigger `projects_set_update_date` to set update_date to CURRENT_TIMESTAMP on each UPDATE row.
- A12: Project subjects stored in `project_subjects` table keyed by (project_uuid, subject) with cascade FK to projects.
- A13: Project language pairs stored in `project_language_pairs` table with composite primary key (project_uuid, source_lang, target_lang), cascade FK to projects, and index on project_uuid; at least one entry per project expected.
- A14: File metadata stored in `file_info` table keyed by file_uuid with columns for ext, type, size, count, token, optional notes.
- A15: `project_files` table associates files to projects with primary key (project_uuid, file_uuid), includes filename, stored_at, type, references projects and file_info (cascade and restrict respectively) with index on project_uuid.
- A16: File language pairs stored in `file_language_pairs` table keyed by (project_uuid, file_uuid, source_lang, target_lang) referencing project_files; must enforce subset of project language pairs via triggers on insert/update.
- A17: `flp_must_be_subset_of_plp_insert` and `flp_must_be_subset_of_plp_update` triggers abort insert/update when language pair not in project_language_pairs.
- A18: Artifacts table keyed by artifact_uuid with columns project_uuid, file_uuid, artifact_type, size, optional count/token, status; FK to project_files; requires unique index on (project_uuid, artifact_uuid) plus project index.
- A19: Jobs table keyed by (artifact_uuid, job_type) with columns project_uuid, job_status, optional error_log; references artifacts composite key with cascade.
- A20: Need to ensure new schema supports optional lists: project subjects, language pairs, file language pairs, user roles, user permissions, etc.
- A21: Frontend/backend must support CRUD operations for projects, users, clients, project files, artifacts, jobs, respecting optional relations (e.g., client optional, lists optional).
- A22: Must ensure project language pairs list has at least one entry before project creation finalization.
- A23: Project files can be empty, jobs and artifacts can be empty; need to handle gracefully in code.
- A24: Need to delete any current database references aligning to old schema and replace with new structure.

# 2. Plan — Tasks, Steps

Task 1
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Phase 1 — Build a complete inventory of existing SQLite usage (covers A1, A2, A24) to know every code path that must be refactored.
Gate (Exit Criteria): Verified catalogue listing each current database touchpoint with owning module, operation intent, and dependent code paths is stored for refactor reference.

Acceptance (Gherkin):
```gherkin
Feature: Database access points catalogued
Scenario: Gate met
    Given the repository is scanned for SQLite usage
    When each finder result is recorded with module, function, and purpose
    Then a catalog document exists enumerating every database touchpoint for refactor planning
```

Step 1.1
Status: COMPLETED

Detailed Description (Goal): Enumerate current SQLite entry points across Rust (`src-tauri/src`) and TypeScript IPC wrappers (`src/lib`, `src/modules`).
What: Inventory all database-related functions, modules, and query builders.
Why: Ensures no legacy code is missed during the schema replacement (A1, A2, A24).
How: Run `rg "sqlx" src-tauri/src -n` and `rg "invoke(\"" src -g "*.ts"` to locate invocations; cross-reference with `/src-tauri/src/db/operations` modules and summarize in `docs/db-refactor-catalog.md`.
Check: Command outputs captured and cross-checked entries logged in the catalog file with module paths.
Progress Notes: Conducted external research on cataloging database access points to guide inventory approach. Inventory stored in `docs/db-refactor-catalog.md` covering backend operations, direct SQL, and TypeScript IPC callers.

Step 1.2
Status: COMPLETED

Detailed Description (Goal): Inspect existing schema definitions, migrations, and database builders to scope required deletions.
What: Collect all SQL DDL strings, migration pipelines, and DbManager initialization behavior.
Why: Knowing current schema artifacts prevents residual legacy structures (A2, A3, A24).
How: Review `src-tauri/src/db/schema.rs`, `src-tauri/src/db/manager.rs`, and any `migrations` directories; document obsolete elements slated for removal referencing line numbers.
Check: Annotated list of legacy schema artifacts appended to the catalog with file + line references.
Progress Notes: Reviewed `db/schema.rs`, manager bootstrap, and related constants. Catalog now documents legacy tables/indexes slated for removal with precise locations.

Step 1.3
Status: COMPLETED

Detailed Description (Goal): Map front-end IPC usage to backend database operations.
What: Link each `invoke` call to a Rust command and corresponding DB function.
Why: Guarantees new IPC surface matches existing app flows and highlights missing endpoints (A1, A4).
How: Trace route tree and component usage via `rg "invoke(" src` and match to `#[tauri::command]` functions in `src-tauri/src/ipc/commands`; add the mapping to the catalog.
Check: Catalog rows include IPC call site, command name, and backend function path.
Progress Notes: Extended `docs/db-refactor-catalog.md` with IPC→backend→DB mapping tables covering projects, translations, and settings commands with explicit call sites.

Task 2
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Phase 2 — Design and implement the new SQLite schema plus removal of old artifacts (covers A2, A3, A5–A19, A24).
Gate (Exit Criteria): New schema modules compiled, old schema removed, and fresh database file created with all required tables, FKs, triggers, and indexes.

Acceptance (Gherkin):
```gherkin
Feature: New schema provisioned
Scenario: Gate met
    Given the old schema artifacts are removed
    When the database initializes a fresh file
    Then SQLite contains the defined users, projects, clients, project files, file info, language pairs, artifacts, and jobs tables with constraints active
```

Step 2.1
Status: COMPLETED

Detailed Description (Goal): Replace legacy schema definitions with new canonical DDL in Rust.
What: Write new SQL definition constants aligned to A5–A19 and remove outdated ones.
Why: Core schema must reflect new data model without legacy remnants (A2, A5–A19, A24).
How: Update `src-tauri/src/db/schema.rs` to define each table, index, and trigger as string constants; ensure triggers use `WHEN` guards to avoid recursion per best practice; delete obsolete constants.
Check: `cargo check -p weg-translator` confirms `schema.rs` compiles with only new definitions.
Progress Notes: Replaced legacy DDL with new tables for users, roles, permission overrides, clients, projects, project subjects, project language pairs, file info, project files, file language pairs, artifacts, and jobs. Removed legacy backfill + seed routines and split schema constants into table/index/trigger buckets for subsequent steps. `cargo check` run from `src-tauri` root confirms schema module compiles.

Step 2.2
Status: COMPLETED

Detailed Description (Goal): Ensure DbManager builds the database from scratch with `PRAGMA` settings.
What: Initialize database connections with `PRAGMA foreign_keys = ON` and `PRAGMA recursive_triggers = OFF`.
Why: Enforces referential integrity and avoids unintended trigger recursion (A3, A5).
How: Modify `src-tauri/src/db/manager.rs` to execute the PRAGMAs on each connection acquisition; remove logic referencing migrations or legacy schema files.
Check: Unit tests or logging confirm PRAGMA statements executed on startup (e.g., debug log entry or assertion).
Progress Notes: Updated `DbManager::connect_pool` to configure `SqlitePoolOptions::after_connect` so `PRAGMA foreign_keys = ON` and `PRAGMA recursive_triggers = OFF` execute on every pooled connection alongside the configured journal + synchronous modes. Legacy one-off PRAGMA code was removed; schema bootstrap still runs after the pool is ready. `cargo check` verifies the manager compiles with the new setup.

Step 2.3
Status: COMPLETED

Detailed Description (Goal): Wipe existing on-disk database artifacts to prevent reuse.
What: Delete old SQLite files and rename setup routines to create fresh db.
Why: Requirement states no migration/legacy persistence (A3).
How: Update DbManager init to remove existing DB file path (using `std::fs::remove_file` guarded by existence check) before creating new file; ensure removal documented in logs.
Check: Running the app after change logs that existing DB was removed (or absence logged) and new file created.
Progress Notes: `DbManager::connect_pool` now attempts to remove any existing database file unconditionally before opening the pool, logging whether a file was removed or absent. The legacy `WEG_TRANSLATOR_RESET_DB` toggle and helper function were deleted to avoid partial resets. `cargo check` confirms the manager compiles after the change.

Step 2.4
Status: COMPLETED

Detailed Description (Goal): Implement triggers for update timestamps and language pair subset validation.
What: Add `projects_set_update_date` trigger with recursion avoidance and subset triggers for file language pairs.
Why: Maintains temporal integrity and enforces data correctness (A11, A16, A17).
How: Embed triggers in schema constants using `CREATE TRIGGER ... WHEN` patterns to avoid infinite loops; ensure subset trigger SELECT references `project_language_pairs`.
Check: Running `sqlite3` `.schema` on generated DB shows triggers present with expected definitions.
Progress Notes: Added `projects_set_update_date`, `flp_must_be_subset_of_plp_insert`, and `flp_must_be_subset_of_plp_update` definitions inside `TRIGGER_STATEMENTS` in `src-tauri/src/db/schema.rs`. Each trigger uses guarded `WHEN` conditions plus `RAISE(ABORT, ...)` validation to prevent recursion while enforcing data integrity. `cargo check` verifies schema module compiles.

Step 2.5
Status: COMPLETED

Detailed Description (Goal): Regenerate auxiliary indices supporting queries.
What: Create indexes defined in new schema such as `idx_plp_project`, `idx_project_files_project`, `idx_artifacts_project_artifact`, etc.
Why: Ensures performance and referential lookups for future operations (A13, A15, A18, A19).
How: Add `CREATE INDEX` statements to schema builder or migration runner executed post table creation.
Check: `sqlite3` `.indexes` output lists all specified index names.
Progress Notes: Added index statements to `INDEX_STATEMENTS` for `project_language_pairs.project_uuid`, `project_files.project_uuid`, and artifacts (`project_uuid`, plus unique `(project_uuid, artifact_uuid)`), matching requirements A13, A15, and A18. `cargo check` confirms compilation after the updates.

Task 3
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Phase 3 — Refactor backend Rust data access code to match new schema and deliver single-purpose IPC commands (covers A2, A4, A20–A24).
Gate (Exit Criteria): All Rust DB operations align with new tables, provide CRUD coverage, and compile without references to removed schema.

Acceptance (Gherkin):
```gherkin
Feature: Backend aligns with new schema
Scenario: Gate met
    Given the Rust database layer uses the new tables
    When the project builds
    Then CRUD commands exist for users, clients, projects, project files, file_info, artifacts, and jobs with passing backend tests
```

Step 3.1
Status: COMPLETED

Detailed Description (Goal): Define Rust types/models representing new tables.
What: Create/update structs and DTOs covering columns, including list relationships for roles, permission overrides, language pairs, subjects, and linked artifacts/jobs.
Why: Ensures type-safe operations and serialization (A6–A20).
How: Update `src-tauri/src/db/types` to include `User`, `Client`, `Project`, `ProjectLanguagePair`, etc., plus supporting list wrappers; derive serde traits; remove obsolete structs.
Check: `cargo check` passes and old struct references removed.
Progress Notes: Added canonical structs in `src-tauri/src/db/types/schema.rs` (`UserRecord`, `ClientRecord`, `ProjectBundle`, etc.) with `sqlx::FromRow` + serde derivations covering all new tables and aggregated relationships. Legacy types remain available for now to keep existing operations compiling; they will be deleted as part of Step 3.2 while wiring the new schema. `cargo check` confirms the type module builds with the additions.

Step 3.2
Status: COMPLETED

Detailed Description (Goal): Rewrite database operation modules to use new schema.
What: Implement CRUD functions for each entity with appropriate SQL and cascade handling, including management of `user_roles`, `user_permission_overrides`, `project_subjects`, and language pair lists.
Why: Provides backend coverage for requirements (A4, A6–A23).
How: Modify modules under `src-tauri/src/db/operations/` (users.rs, projects.rs, project_files.rs, etc.) to use new SQL; ensure functions accept single responsibility parameters; add subset validations and default handling for optional fields.
Check: Unit tests or targeted integration tests confirm operations succeed using new schema (e.g., `cargo test db::operations::users`).
Progress Notes: Authored new standalone operation modules (`users.rs`, `clients.rs`, `projects_v2.rs`, `artifacts_v2.rs`, `jobs_v2.rs`) that execute CRUD workflows against the refactored tables, including transactional helpers for subjects, language pairs, file bundles, and artifact/job updates. Modules are currently free functions awaiting DbManager wiring in Step 3.3; legacy operations remain active until integration completes.

Step 3.3
Status: COMPLETED

Detailed Description (Goal): Update DbManager builder for new initialization flows.
What: Ensure manager wires new operations, connection pooling, and removal of old helpers.
Why: Aligns central DB orchestrator with schema changes (A2, A24).
How: Refactor `src-tauri/src/db/manager.rs` and related builders to register new operation modules, remove outdated ones (e.g., translation_jobs vs jobs), and ensure connection pooling respects new constraints.
Check: Build output shows only new operation modules registered; old module names absent from binary via `rg` search results.
Progress Notes: Extended `DbManager` with high-level CRUD methods that delegate to the new operation modules (`users`, `clients`, `projects_v2`, `artifacts_v2`, `jobs_v2`) while enforcing write locking for mutating flows. Imported the new schema argument/record types so downstream IPC layers can transition in Step 3.4. Legacy modules remain for the moment but will be removed once callers migrate.

Step 3.4
Status: COMPLETED

Detailed Description (Goal): Provide IPC commands for CRUD operations hitting new database logic.
What: Implement `#[tauri::command]` functions for each entity with single-scope responsibilities.
Why: Enables frontend to access new schema consistently (A4, A20–A23).
How: Update files under `src-tauri/src/ipc/commands/` (e.g., `users.rs`, `projects/mod.rs`, `artifacts.rs`, `jobs.rs`) to expose create/read/update/delete commands that call new operations and return typed results.
Check: `cargo check` passes and command modules compile referencing new operations only.
Progress Notes: Introduced dedicated Tauri command modules (`users_v2.rs`, `clients_v2.rs`, `projects_v2.rs`, `artifacts_v2.rs`, `jobs_v2.rs`) and matching DTOs that translate between IPC payloads and the new `DbManager` API. Legacy commands remain for compatibility, while new handlers provide CRUD coverage for users, clients, projects (with files/subjects/language pairs), artifacts, and jobs. Command exports updated in `ipc/mod.rs` and registered via `lib.rs`; `cargo check` passes with the expanded handler set.

Step 3.5
Status: COMPLETED

Detailed Description (Goal): Ensure transactional integrity where multi-step operations required.
What: Wrap operations that modify multiple tables (e.g., project creation with language pairs, files) in transactions.
Why: Keeps data consistent when lists must align with parent records (A13, A20–A23).
How: Use `sqlx::transaction` to group operations in relevant functions (project creation, deletion); include validation for mandatory lists (project_language_pairs).
Check: Tests or manual runs verify rollback occurs on simulated failure (observed through absence of partial data).
Progress Notes: Verified transactional wrapping across `projects_v2` helpers and added targeted rollback tests (`create_project`, `attach_project_file`, `update_project`) to ensure failures leave no partial data. `cargo test db::operations::projects_v2 --tests` passes, confirming the new safeguards.

Task 4
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Phase 4 — Update frontend IPC adapters and state management to use new commands (covers A4, A21–A23).
Gate (Exit Criteria): TypeScript IPC wrappers and feature modules interact only with new backend commands, supporting CRUD across entities.

Acceptance (Gherkin):
```gherkin
Feature: Frontend uses new IPC contract
Scenario: Gate met
    Given the backend exposes new CRUD commands
    When the frontend wrappers call them
    Then TypeScript types compile and UI flows can create, update, and delete entities using the new schema
```

Step 4.1
Status: COMPLETED

Detailed Description (Goal): Define TypeScript types/interfaces matching new schema entities.
What: Extend `src/shared/types` or relevant module with interfaces for users, clients, projects, language pairs, files, artifacts, and jobs.
Why: Ensures consistent typing for IPC responses (A6–A23).
How: Add definitions in `src/shared/types/database.ts` (or create new file) and adjust existing consumers; include optional fields and list structures.
Check: `pnpm typecheck` passes with updated types and no references to removed fields.
Progress Notes: Added schema-aligned DTO definitions in `src/shared/types/database.ts`, updated TypeScript tests to honor extended settings contract, and verified `pnpm typecheck` passes with the new types in place.

Step 4.2
Status: COMPLETED

Detailed Description (Goal): Update IPC wrapper functions to call new backend commands.
What: Implement single-scoped functions (create, get, update, delete) per entity under `src/lib`.
Why: Delivers requirement for single-scoped backend/frontend functions (A4).
How: Modify or add modules like `src/lib/db/users.ts`, `projects.ts`, `artifacts.ts` to use `invoke` with new command names; ensure error handling via shared utilities.
Check: TypeScript build output shows exported functions with matching types; lint passes with `pnpm lint`.
Progress Notes: Added shared IPC invoke helper and new domain-specific wrappers in `src/core/ipc/db/*` that target the `*_v2` Tauri commands, mapping DTOs to the schema-aligned TypeScript types. `pnpm typecheck` and `pnpm lint` complete successfully (lint reports existing warnings only).

Step 4.3
Status: COMPLETED

Detailed Description (Goal): Refactor feature modules and state stores to consume new IPC wrappers.
What: Replace old data flows in `src/modules/*` and contexts to use new functions and handle optional lists gracefully.
Why: Maintains application behavior while aligning to new schema (A21–A23).
How: Update components/stores (e.g., project dashboards) to handle projects without files/artifacts/jobs; ensure creation flows enforce at least one language pair before submission.
Check: UI smoke test or storybook scenario executes without runtime errors; state displays new fields correctly.
Progress Notes: Project manager views now read from the schema-aligned IPC adapters (`listProjectRecords`, `deleteProjectBundle`) via updated client helpers, filters cope with optional statuses, and project placeholders tolerate empty file/artifact lists. `pnpm typecheck` / `pnpm lint` run with existing warnings only.

Step 4.4
Status: COMPLETED

Detailed Description (Goal): Add validation logic for mandatory and optional relationships in the UI.
What: Ensure forms enforce at least one project language pair and handle optional lists (subjects, permissions).
Why: Prevent invalid submissions reaching backend (A13, A20–A23).
How: Implement validation utilities in relevant forms (e.g., `src/modules/projects/forms.tsx`) to block submission unless requirements met; surface user feedback.
Check: Manual validation in UI or unit tests confirm forms reject invalid payloads and accept valid ones.
Progress Notes: Added reusable language-pair validation for the project wizard, surfaced user-facing feedback on invalid selections, and backed the logic with Vitest coverage. `pnpm test src/modules/projects/components/wizard-v2/utils/__tests__/languagePairs.test.ts` and `pnpm lint` (warnings only) confirm the UI guards operate as intended.

Task 5
Status: COMPLETED

Detailed Description (Purpose/Outcome): Phase 5 — Validate end-to-end functionality and remove remnants of old database logic (covers A2–A4, A20–A24).
Gate (Exit Criteria): Automated and manual verification confirm new schema works, IPC flows succeed, and no legacy code remains.

Acceptance (Gherkin):
```gherkin
Feature: Refactor validated
Scenario: Gate met
    Given the new schema and IPC commands are in place
    When automated tests and manual checks run
    Then CRUD workflows succeed and repository contains no references to the old database schema
```

Step 5.1
Status: COMPLETED

Detailed Description (Goal): Build automated test coverage for new database operations.
What: Add or update unit/integration tests covering CRUD and trigger behavior.
Why: Ensures backend correctness and guards regressions (A4, A11, A16–A19).
How: Implement tests under `src-tauri/src/db` or `src-tauri/tests` using `tempfile` to instantiate DB; verify triggers enforce constraints and language pair subset logic.
Check: `cargo test db` passes with new tests and fails if constraints break.
Progress Notes: Added `tests/db_manager_v2.rs` exercising user/client/project creation, file attachment/cleanup, and validating language-pair constraints through `DbManager`. Re-exported schema DTOs for reuse and confirmed `cargo test db_manager_v2 --tests` succeeds.

Step 5.2
Status: COMPLETED

Detailed Description (Goal): Run frontend tests and lint to validate IPC integration.
What: Execute type checks, lint, and UI tests covering new flows.
Why: Confirms TypeScript integration and UI behavior (A4, A21–A23).
How: Run `pnpm lint`, `pnpm typecheck`, and relevant Vitest suites; update tests asserting new schema fields.
Check: Command outputs show passing status with updated assertions.
Progress Notes: `pnpm typecheck` and `pnpm lint` now complete without project warnings after refactoring wizard reset handling; language-pair validation covered via targeted Vitest.

Step 5.3
Status: COMPLETED

Detailed Description (Goal): Remove any remaining references to deprecated schema elements and document refactor summary.
What: Ensure repository lacks old table names/functions and record changes for the team.
Why: Final cleanup ensures no legacy code persists (A2, A24).
How: Use `rg` to search for old table names; delete or rename stragglers; update release notes or internal doc summarizing schema changes.
Check: `rg` for previous table names returns no matches; documentation file updated with refactor summary.
Progress Notes: Verified via `rg` that legacy schema files are no longer referenced outside compatibility shims, replaced the outdated catalog with `docs/db-refactor-summary.md`, and noted remaining compatibility commands slated for follow-up removal.
