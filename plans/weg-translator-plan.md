# Plan: weg-translator-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Fix attach_project_file_v2 to reuse a single fileUuid across file_info and project_files inserts."
- A-002: "Allow non-processable project files with empty languagePairs to attach successfully through the IPC layer."
- A-003: "Let frontend IPC mappers transmit explicit nulls so nullable columns can be cleared."
- A-004: "Introduce versioned schema migrations so existing installations receive structural updates."
- A-005: "Prevent detach_project_file from violating foreign keys when fileUuid is reused across projects."
- A-006: "Map SQLite constraint errors from sqlx::Error::Database into actionable IpcError::Validation responses."
- A-007: "Back the fixes with regression tests covering attachment workflows and nullable field updates."

## New Features required
- F-001: "Shared UUID generation and role-aware language pair handling for project file attachments."
- F-002: "Null-safe IPC payload mappers that differentiate undefined from explicit null."
- F-003: "SQLite schema migration framework with version tracking and install-time bootstrap harmonisation."
- F-004: "Robust file metadata lifecycle management guarding multi-project reuse scenarios."
- F-005: "Constraint-aware error translation layer surfacing SQLite violation codes."
- F-006: "Automated tests validating attachment flows and nullable field clearing end-to-end."

## Codebase analysis (if needed according to user_request)
- File: src-tauri/src/ipc/commands/projects_v2.rs
- Kind: Rust Tauri IPC command module
- Description: Orchestrates project asset attachment/detachment and DTO mapping.
- Role: Bridges frontend payloads with DbManager operations; current UUID minting and languagePairs gate live here.
- Dependencies: DbManager facade, uuid crate, domain DTOs from src-tauri/src/db/types.

- File: src-tauri/src/db/operations/projects_v2.rs
- Kind: Rust sqlx operations module
- Description: Implements transactional project file attach/detach SQL routines.
- Role: Persists file_info, project_files, language pair rows; handles cleanup on detach.
- Dependencies: sqlx, SqlitePool, FileLanguagePairInput, transactional helpers.

- File: src/tauri/src/db/manager.rs
- Kind: Rust database facade
- Description: Exposes async methods to IPC commands and applies write locking.
- Role: Delegates to operations modules; target for threading new migration/versioning hooks.
- Dependencies: sqlx::SqlitePool, async traits, operations namespace.

- File: src-tauri/src/db/schema.rs
- Kind: Rust schema bootstrap module
- Description: Runs idempotent CREATE statements on startup.
- Role: Ensures development schema but lacks ALTER/versioning; needs integration with migration system.
- Dependencies: sqlx::Transaction, SqlitePool.

- File: src-tauri/src/ipc/error.rs
- Kind: Rust IPC error translation module
- Description: Maps DbError variants into IpcError responses returned to frontend.
- Role: Currently collapses sqlx::Error::Database into generic Internal responses.
- Dependencies: anyhow, tauri::ipc, crate::db::DbError.

- File: src-tauri/src/db/error.rs
- Kind: Rust error definition module
- Description: Enumerates DbError variants including Sqlx and ConstraintViolation.
- Role: Central spot to enrich sqlx error handling with SQLite code inspection.
- Dependencies: thiserror, sqlx, uuid.

- File: src/core/ipc/db/projects.ts
- Kind: TypeScript IPC adapter
- Description: Maps project-related inputs/outputs between frontend models and Tauri payloads.
- Role: Uses nullish coalescing that strips explicit nulls, blocking nullable field clears.
- Dependencies: safeInvoke helper, shared DTO types, frontend domain models.

- File: src/core/ipc/db/users.ts
- Kind: TypeScript IPC adapter
- Description: Provides CRUD mapping for user profiles.
- Role: Suffers from same null handling bug; will require adjustments and tests.
- Dependencies: COMMAND constants, safeInvoke, DTO mappers.

- File: src/core/ipc/db/clients.ts
- Kind: TypeScript IPC adapter
- Description: Client CRUD mapper mirroring project/user patterns.
- Role: Also collapses nulls via ??; part of frontend fix scope.
- Dependencies: safeInvoke, DTO types.

### Codebase insight summary
- Attachment mapper currently generates two independent UUIDs, causing FK mismatch against file_info primary key when payload lacks fileUuid.
- Non-processable asset roles intentionally produce empty language pair lists, so the hard validation gate in map_new_project_file_args conflicts with design documented in Sqlite-docs.md.
- Frontend adapters rely on nullish coalescing, preventing explicit null propagation and violating Option<Option<T>> contract expected by backend update handlers.
- Schema bootstrap lacks ALTER/version tracking; we must integrate sqlx migrations or equivalent to satisfy ongoing evolution.
- Detach logic deletes file_info indiscriminately, risking FK failures if file metadata is shared or reattached elsewhere; needs existence check or uniqueness constraint.
- Current error mapping logs sqlx::Error but discards SQLite constraint details; per contemporary guidance (see perplexity response on sqlx constraint handling), we should inspect Database errors and convert recognised constraint codes to validation responses.

### Relevant/Touched features
- Project asset attachment and lifecycle management.
- Project/user/client CRUD flows through IPC adapters.
- Database initialisation and migration strategy.
- Error reporting pathway from Rust backend to React frontend.
- Automated test coverage for SQLite-related workflows.

## Plan

### Task 1

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Repair the project file attachment pipeline so a single UUID flows through file_info and project_files, and role-aware language pair rules match backend expectations.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Manual attachments without pre-seeded UUIDs succeed for all asset roles, eliminating current foreign key failures.

#### Step 1.1

**Status**: NOT COMPLETED
**Description**: Audit and refactor Rust mappers so map_new_file_info_args and map_new_project_file_args share a generated UUID.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, src-tauri/src/db/operations/projects_v2.rs
**Sample snippets (optional)**: N/A
**What to do***: Ensure the UUID is generated once per payload and passed into both argument structs before calling DbManager::attach_project_file.
**How to**: Return both NewFileInfoArgs and NewProjectFileArgs from a single helper or thread the file_uuid through payload handling.
**Check**: Unit/integration tests confirming attach_project_file_v2 inserts matching UUIDs and succeeds without payload.fileUuid.
**Gate (Exit Criteria)**: Tests pass and manual invocation via IPC succeeds for processable files without UUID.

#### Step 1.2

**Status**: NOT COMPLETED
**Description**: Relax language pair validation so non-processable roles with empty lists attach cleanly while preserving safeguards for processable files.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, src-tauri/src/db/operations/projects_v2.rs
**Sample snippets (optional)**: N/A
**What to do***: Update validation logic to skip the empty-check when role is not Processable and adjust SQL helper to handle zero language pair rows.
**How to**: Pass asset role into mapper or derive from payload.type, adjusting downstream replace_file_language_pairs calls accordingly.
**Check**: Regression test covering reference/instruction/image attachments with empty languagePairs returns success.
**Gate (Exit Criteria)**: attach_project_file_v2 accepts non-processable files and recorded bundles reflect expected language pair rows.

#### Step 1.3

**Status**: NOT COMPLETED
**Description**: Add automated test coverage validating attachment behaviour for both processable and non-processable roles.
**Codebase touched**: src-tauri/src/db/operations/projects_v2.rs (tests), src-tauri/tests or equivalent harness
**Sample snippets (optional)**: N/A
**What to do***: Implement Rust async tests or integration specs replicating IPC payloads, asserting persisted data consistency.
**How to**: Use temp SQLite pool via DbManager test utilities to simulate attach scenarios.
**Check**: New tests fail before fixes and pass after; CI-ready.
**Gate (Exit Criteria)**: Tests committed and executed successfully.

### Task 2

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Enable frontend IPC adapters to transmit explicit nulls so users can clear optional fields across projects, users, and clients.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Nullable fields become editable/clearable from the UI, matching backend Option<Option<T>> semantics.

#### Step 2.1

**Status**: NOT COMPLETED
**Description**: Refactor TypeScript mappers to distinguish between undefined (omitted) and null (clear).
**Codebase touched**: src/core/ipc/db/projects.ts, src/core/ipc/db/users.ts, src/core/ipc/db/clients.ts
**Sample snippets (optional)**: N/A
**What to do***: Replace nullish coalescing with conditional spreads or explicit property assignments preserving null.
**How to**: Use helper to include properties when value !== undefined; allow null to pass through unchanged.
**Check**: Manual inspection and lint pass verifying payloads keep null.
**Gate (Exit Criteria)**: TypeScript build passes; payload snapshots show null forwarded.

#### Step 2.2

**Status**: NOT COMPLETED
**Description**: Add frontend tests ensuring nullable fields can be cleared and backend receives null.
**Codebase touched**: src modules test setup (e.g., src/test or dedicated adapter tests)
**Sample snippets (optional)**: N/A
**What to do***: Implement Vitest cases mocking safeInvoke, asserting mapper outputs.
**How to**: Use expect(payload.notes).toBeNull style assertions with new mapping helpers.
**Check**: Tests fail prior to mapper change and pass after update.
**Gate (Exit Criteria)**: Vitest suite including new cases passes locally.

### Task 3

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Replace ad-hoc schema bootstrap with a migration system that updates existing databases while keeping dev bootstrap intact.
**Feature required (optional)**: F-003
**Purpose/Outcome**: Schema changes are versioned and applied automatically, preventing drift for existing users.

#### Step 3.1

**Status**: NOT COMPLETED
**Description**: Design migration strategy aligning sqlx::migrate! (or custom) with existing initialise_schema flow.
**Codebase touched**: src-tauri/src/db/manager.rs, src-tauri/src/db/schema.rs
**Sample snippets (optional)**: N/A
**What to do***: Decide migration storage (e.g., src-tauri/migrations), version tracking, and entry point for application startup.
**How to**: Evaluate sqlx CLI compatibility; document required boot order adjustments.
**Check**: Proposed design reviewed against Sqlite-docs alignment.
**Gate (Exit Criteria)**: Approved migration approach ready for implementation.

#### Step 3.2

**Status**: NOT COMPLETED
**Description**: Implement migration runner and integrate with DbManager startup, ensuring backwards compatibility with initialise_schema for fresh installs.
**Codebase touched**: src-tauri/src/db/manager.rs, src-tauri/src/db/schema.rs, src-tauri/migrations/*
**Sample snippets (optional)**: N/A
**What to do***: Add migrate! macro or manual runner, ensure new migrations execute before/after bootstrap as needed.
**How to**: Introduce schema_version tracking or rely on sqlx metadata; update tests.
**Check**: Migration suite runs during startup tests; existing DB upgrades validated.
**Gate (Exit Criteria)**: Migration execution succeeds on clean and pre-populated databases.

#### Step 3.3

**Status**: NOT COMPLETED
**Description**: Create initial baseline migration representing current schema and adjust developer tooling.
**Codebase touched**: src-tauri/migrations, scripts (if needed)
**Sample snippets (optional)**: N/A
**What to do***: Generate SQL migration files, ensure CI/test harness applies them.
**How to**: Use sqlx migrate add baseline; update docs/scripts accordingly.
**Check**: Running migrations on empty DB produces schema matching schema.rs definitions.
**Gate (Exit Criteria)**: Baseline migration committed and verified via sqlx migrate run.

### Task 4

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Harden file metadata lifecycle to avoid FK violations when detaching files shared across projects.
**Feature required (optional)**: F-004
**Purpose/Outcome**: Detach operations behave predictably regardless of file reuse patterns.

#### Step 4.1

**Status**: NOT COMPLETED
**Description**: Analyse current file reuse requirements and decide on uniqueness constraint vs reference counting.
**Codebase touched**: src-tauri/src/db/operations/projects_v2.rs, Sqlite schema/migrations
**Sample snippets (optional)**: N/A
**What to do***: Confirm whether file_uuid should remain globally unique or support reuse; document chosen approach.
**How to**: Review domain docs, consult stakeholders if ambiguity remains.
**Check**: Decision recorded and reflected in migration plan.
**Gate (Exit Criteria)**: Clear strategy approved for implementation.

#### Step 4.2

**Status**: NOT COMPLETED
**Description**: Implement chosen safeguard (UNIQUE constraint or conditional delete) and update detach logic accordingly.
**Codebase touched**: src-tauri/src/db/operations/projects_v2.rs, migration files
**Sample snippets (optional)**: N/A
**What to do***: Modify SQL and Rust to enforce uniqueness or check references before deleting file_info.
**How to**: Use SQL EXISTS to skip delete when other rows remain or add unique index with ON DELETE CASCADE adjustments.
**Check**: Tests covering multi-project attachments pass without FK errors.
**Gate (Exit Criteria)**: Detach operations validated for both unique and shared scenarios per strategy.

### Task 5

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Enhance error propagation so SQLite constraint violations surface as validation errors with user-friendly messages.
**Feature required (optional)**: F-005
**Purpose/Outcome**: Frontend receives actionable feedback rather than generic internal failure notices.

#### Step 5.1

**Status**: NOT COMPLETED
**Description**: Extend DbError::Sqlx handling to inspect sqlx::Error::Database and extract SQLite extended error codes.
**Codebase touched**: src-tauri/src/db/error.rs, src-tauri/src/ipc/error.rs
**Sample snippets (optional)**: N/A
**What to do***: Match on database error codes (e.g., SQLITE_CONSTRAINT_FOREIGNKEY) and translate to specific DbError variants.
**How to**: Use sqlite_error_code() accessor from sqlx SQLite error to drive mapping, referencing best practices (per perplexity guidance).
**Check**: Unit tests verifying code paths for FK violations and unique constraints.
**Gate (Exit Criteria)**: Tests confirm specific validation messages emitted for known constraint errors.

#### Step 5.2

**Status**: NOT COMPLETED
**Description**: Update IPC error mapping to return precise Validation messages based on new DbError variants.
**Codebase touched**: src-tauri/src/ipc/error.rs
**Sample snippets (optional)**: N/A
**What to do***: Add match arms for new constraint-specific DbError values providing user-readable guidance.
**How to**: Extend From<DbError> impl to preserve messages and include context like duplicate language pair info.
**Check**: End-to-end test verifying IPC response contains validation message for constraint failure.
**Gate (Exit Criteria)**: Frontend receives clear validation errors when triggers or constraints are hit.

### Task 6

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Address supporting improvements around input validation and diagnostics to reinforce stability.
**Feature required (optional)**: F-006
**Purpose/Outcome**: Reduce future regressions and improve observability of SQLite configuration.

#### Step 6.1

**Status**: NOT COMPLETED
**Description**: Add server-side validation/deduplication for languagePairs before insert.
**Codebase touched**: src-tauri/src/db/operations/projects_v2.rs
**Sample snippets (optional)**: N/A
**What to do***: Ensure duplicates are filtered and informative validation errors returned rather than relying on SQL constraint.
**How to**: Deduplicate vector or check with HashSet prior to SQL insert; return DbError::ConstraintViolation.
**Check**: Tests verifying duplicate pairs trigger friendly validation message.
**Gate (Exit Criteria)**: Dedup logic covered by tests and integrated with error mapping.

#### Step 6.2

**Status**: NOT COMPLETED
**Description**: Consider logging configured journal mode and synchronous level within diagnostics endpoints.
**Codebase touched**: src-tauri/src/db/manager.rs, potential diagnostic utilities
**Sample snippets (optional)**: N/A
**What to do***: Expose current PRAGMA values via log or health check for supportability.
**How to**: Query PRAGMA journal_mode/synchronous after pool init and stash in diagnostics struct.
**Check**: New diagnostic output validated in logs or IPC response.
**Gate (Exit Criteria)**: Diagnostics reflect runtime configuration without impacting performance.

#### Step 6.3

**Status**: NOT COMPLETED
**Description**: Expand automated tests around IPC adapters to cover attachment workflow and nullable field handling regression scenarios.
**Codebase touched**: src/test utilities, adapter-specific test suites
**Sample snippets (optional)**: N/A
**What to do***: Implement Vitest or Rust integration tests mirroring frontend DTO pathways flagged in SQLite-debug.md.
**How to**: Use mocks/stubs for safeInvoke and Tauri commands to assert expected behaviour.
**Check**: Test suite includes new cases; fails without fixes.
**Gate (Exit Criteria)**: Tests merged and running in CI alongside existing coverage.

