# Plan: project-creation-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Implementation must align with `src/modules/projects/components/wizard-v2`, `docs/db-refactor-summary.md`, and related Rust code."
- A-002: "When user click on “Finalize” create a proper Project-specific folder in the Projects folder (app root/Projects). ERROR management: if fails, return an error message in an elegant and visually appealing way."
- A-003: "Generate a proper Project UUID. ERROR management: if fails, rollback."
- A-004: "Store Project data in the Sqlite database following the current schema and using the current code. ERROR management: if fails, rollback, return an error message in an elegant and visually appealing way, log the error in details."
- A-005: "Create three subfolders: Projects/{project_name}/Translations, Projects/{project_name}/References, Projects/{project_name}/Instructions. ERROR management: if fails, rollback, return an error message in an elegant and visually appealing way, log the error in details."
- A-006: "Copy the selected files in the proper folders, according to Translation Role. ERROR management: if fails, rollback, return an error message in an elegant and visually appealing way, log the error in details."
- A-007: "Update the sqlite database project table with files, according to current schemas. ERROR management: if fails, rollback, return an error message in an elegant and visually appealing way, log the error in details."
- A-008: "Create a subfolder for each of Project language pairs selected, e.g. Projects/{project_name}/Translations/en-US_it-IT."
- A-009: "For each language, convert the document file with Translation Role into xlf, showing a visually appealing loader during the conversion step."
- A-010: "Double check that everything is correct and close the wizard."

## New Features required
- F-001: Backend orchestration command that wraps filesystem setup, database writes, and rollback guarantees for project creation.
- F-002: Frontend finalize flow that maps wizard state to the new command, surfaces progress/loader states, and renders polished error messages.
- F-003: File-ingestion pipeline that copies role-based assets, records metadata, and registers language pair directories.
- F-004: Conversion task planner that produces XLF outputs per language pair using OpenXLIFF sidecars with UI progress updates.
- F-005: Verification and observability suite covering unit/integration tests, structured logging, and post-create validation hooks.

## Codebase analysis (if needed according to user_request)
- File: docs/db-refactor-summary.md
- Kind: Architectural reference
- Description: Documents v2 SQLite schema, operations modules, and IPC command landscape.
- Role: Defines the authoritative database model and Rust entry points the wizard must target.
- Dependencies: DbManager, `projects_v2` operations, IPC DTO mappings.

- File: src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx
- Kind: React orchestrator component
- Description: Manages wizard state, handles finalize action, invokes `createProjectBundle`, and controls feedback overlay.
- Role: Primary integration point for wiring finalize flow to new backend command and conversion pipeline.
- Dependencies: Wizard hooks (`useWizardFiles`, `useWizardClients`, `useWizardDropzone`), `buildLanguagePairs`, IPC helpers, toast notifications.

- File: src/modules/projects/components/wizard-v2/hooks/useWizardFiles.ts
- Kind: React hook
- Description: Tracks staged files, assigns roles, and exposes mutation helpers for the wizard.
- Role: Source of file descriptors that must map to filesystem copy instructions and DB attachments.
- Dependencies: Wizard util functions (extractFileExtension, inferDefaultRoleFromExtension).

- File: src/modules/projects/components/wizard-v2/hooks/useWizardDropzone.ts
- Kind: React hook
- Description: Normalises drag-and-drop behaviour and captures file paths via Tauri drag events.
- Role: Provides absolute source paths required for backend copy operations; manages UX state for dropzone.
- Dependencies: `@tauri-apps/api/event`, wizard `DraftFileEntry` shape.

- File: src/modules/projects/components/wizard-v2/hooks/useWizardClients.ts
- Kind: React hook
- Description: Loads client records via IPC and maintains cached list for selection/creation.
- Role: Supplies `clientUuid` in finalize payload and refreshes after client creation.
- Dependencies: `listClientRecords` IPC helper, React state/effect primitives.

- File: src/modules/projects/components/wizard-v2/utils/languagePairs.ts
- Kind: Utility module
- Description: Validates BCP‑47 language inputs and builds unique source/target pair list.
- Role: Ensures backend receives compliant language pairs for DB insertion and translation planning.
- Dependencies: `isWellFormedBcp47` shared validator, TypeScript `ProjectLanguagePair` type.

- File: src/core/ipc/db/projects.ts
- Kind: IPC adapter (TypeScript)
- Description: Wraps Tauri project bundle commands, mapping inputs/outputs between renderer types and Rust DTOs.
- Role: Existing entry point for `createProjectBundle`; will need extension or companion helpers for file attachments and conversion metadata.
- Dependencies: `safeInvoke`, shared database types, Tauri commands `create_project_bundle_v2`, `attach_project_file_v2`.

- File: src/core/ipc/client.ts
- Kind: IPC facade (TypeScript)
- Description: Aggregates higher-level project/client operations; currently contains TODO placeholders for project details, file ingestion, conversion status.
- Role: Requires implementation to expose new project creation response, conversion status updates, and post-create fetches.
- Dependencies: Lower-level IPC helpers, shared types, TODO functions for conversions.

- File: src/core/ipc/openxliff.ts
- Kind: OpenXLIFF sidecar wrapper
- Description: Provides command builders (`convertStream`, `validateStream`) with normalized error reporting and streaming progress callbacks.
- Role: Must be leveraged during conversion step to produce XLFs per language pair with loader feedback.
- Dependencies: `@tauri-apps/plugin-shell`, OpenXLIFF sidecar scripts, Tauri capabilities allowlist.

- File: src-tauri/src/ipc/commands/projects_v2.rs
- Kind: Rust IPC command module
- Description: Exposes CRUD commands for v2 project bundles, mapping payloads to `DbManager`.
- Role: Baseline for adding a higher-level orchestration command or extending existing flows for file ingestion.
- Dependencies: `DbManager`, DTO mappers, `projects_v2` operations, UUID parsing helpers.

- File: src-tauri/src/db/operations/projects_v2.rs
- Kind: Rust DB operations module
- Description: Implements transactional project creation, language pair insertions, file attachments, and artifact retrieval.
- Role: Provides primitives used by the new orchestration flow for atomic inserts and rollback on failure.
- Dependencies: SQLx queries, `NewProjectArgs`, `NewProjectFileArgs`, `FileLanguagePairInput`.

- File: src-tauri/src/settings/mod.rs
- Kind: Settings manager
- Description: Stores application folders and exposes `projects_dir()` to resolve project root paths.
- Role: Source of canonical projects directory; orchestration must use this to place new project folders.
- Dependencies: Tokio async locks, filesystem helpers, YAML persistence.

- File: src/modules/projects/ui/overview/ProjectOverview.tsx
- Kind: React feature component
- Description: Handles conversion workflows post-import (ensure plan, convert stream, validation, status updates).
- Role: Reference implementation for progress messaging, OpenXLIFF integration, and conversion status updates the wizard should emulate or reuse.
- Dependencies: IPC client facade, toast notifications, OpenXLIFF wrappers, auth context.

### Codebase insight summary
- Wizard finalize currently only calls `createProjectBundle`, so all filesystem and file metadata steps remain unimplemented; the plan must introduce new command surfaces.
- Database layer already enforces transactional integrity and language pair constraints, enabling reuse for project creation once arguments are supplied.
- Existing OpenXLIFF utilities and ProjectOverview conversion flow provide patterns for streaming progress updates and error handling that the wizard can adopt.
- Settings manager exposes the authoritative projects directory under the application data folder (`projects`), meaning input folder names require sanitisation and case-handling.
- Client IPC facade houses TODO methods for project detail retrieval and conversion status updates, signalling a broader migration to the v2 schema that the plan must respect.

### Relevant/Touched features
- Project creation wizard v2 UI and supporting hooks.
- Tauri project bundle IPC and SQLite v2 schema operations.
- Filesystem project root and subdirectory management within settings-managed app folder.
- OpenXLIFF conversion pipeline and conversion status recording.
- Error handling, toast notifications, and progress overlay UX in wizard context.

## Plan

### Task 1

**Status**: COMPLETED
**Detailed description (scope/goals)**: Align wizard state, validation logic, and backend expectations into a single project-creation payload contract with clear error semantics.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Ensure front-end can assemble a canonical payload while surfacing validation feedback prior to heavy operations.

#### Step 1.1

**Status**: COMPLETED
**Description**: Map draft wizard state to a typed payload including sanitized project name, client UUID, subjects, language pairs, and file descriptors with roles.
**Codebase touched**: src/modules/projects/components/wizard-v2/types.ts, src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx
**Sample snippets (optional)**: ...
**What to do**: Introduce TypeScript interfaces (e.g., `WizardFinalizePayload`) and helper to build payload from local state.
**How to**: Follow React 19 guidelines—derive payload via pure function invoked inside finalize handler prior to `useTransition` start.
**Check**: TypeScript typecheck passes; payload object contains normalized project name and file metadata in devtools log.
**Gate (Exit Criteria)**: Payload builder covers all wizard fields and rejects incomplete state with user-facing messages before invoking backend.
**Notes**: Added typed `WizardFinalizePayload` contracts, folder-name sanitisation helper, and `buildWizardFinalizePayload` orchestration in `CreateProjectWizardV2.tsx`. Frontend now logs the built payload before invoking Tauri and blocks finalize when validation fails, using error messaging tied to wizard steps.

#### Step 1.2

**Status**: COMPLETED
**Description**: Define frontend error and progress event contract for finalize flow, including mapping of backend error codes to overlay copy.
**Codebase touched**: src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx, src/modules/projects/components/wizard-v2/components/WizardFeedbackOverlay.tsx
**Sample snippets (optional)**: ...
**What to do**: Enumerate error categories (validation, filesystem, database, conversion) and encode them in a discriminated union.
**How to**: Extend feedback overlay props to accept structured error info; update finalize handler to translate backend errors using `instanceof IpcError`.
**Check**: Simulated backend error triggers descriptive message and destructive toast without console warnings.
**Gate (Exit Criteria)**: Overlay displays tailored messaging per error type and gracefully resets on retry.
**Notes**: Introduced structured finalize feedback union, overlay now renders per-category copy, and finalize handler maps backend codes/messages through `resolveFinalizeError` for user-friendly messaging.

#### Step 1.3

**Status**: COMPLETED
**Description**: Document and implement project folder naming constraints consistent with filesystem expectations (slug, deduplication).
**Codebase touched**: src/modules/projects/components/wizard-v2/utils/projectFolder.ts, src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx
**Sample snippets (optional)**: ...
**What to do**: Create helper to slugify project name, enforce length limits, and resolve conflicts via suffixing strategy.
**How to**: Added shared `sanitizeProjectFolderName`/`generateUniqueProjectFolderName` utilities with Unicode normalisation and Windows-safe filtering; wizard now reuses them and injects existing folder slugs from the projects resource before finalizing.
**Check**: Manual verification plus `pnpm typecheck`; duplicates auto-suffix while preserving readability.
**Gate (Exit Criteria)**: Sanitizer returns deterministic folder names and surfaces validation errors when unsalvageable.
**Notes**: Utility file documents the constraints, normalises diacritics, and appends numeric suffixes when snapshot-derived folder slugs collide, ensuring filesystem-safe uniqueness pre-backend.

### Task 2

**Status**: COMPLETED
**Detailed description (scope/goals)**: Implement a Rust-side orchestration command that performs filesystem setup, database writes, and rollback with structured logging.
**Feature required (optional)**: F-001, F-003
**Purpose/Outcome**: Guarantee atomic project creation respecting requirements A-002 through A-008 with resilient error handling.

#### Step 2.1

**Status**: COMPLETED
**Description**: Scaffold new Tauri command (e.g., `create_project_with_assets_v2`) with DTO definitions and router exports.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, src-tauri/src/ipc/dto.rs, src/core/ipc/db/projects.ts
**Sample snippets (optional)**: ...
**What to do**: Define request/response structs carrying project metadata, file descriptors, and language pairs.
**How to**: Mirror existing DTO style; register command in `lib.rs`; expose TypeScript adapter via `safeInvoke`.
**Check**: `cargo check` and `pnpm typecheck` succeed; command callable via mocks.
**Gate (Exit Criteria)**: New command accessible from renderer with strongly typed payload/response.
**Notes**: Added `create_project_with_assets_v2` command returning a placeholder error, new DTOs (assets, conversion plan), and TypeScript adapter `createProjectWithAssets`; command registered in Tauri handler and safeInvoke wrapper passes schema-checked payload.

#### Step 2.2

**Status**: COMPLETED
**Description**: Retrieve projects root from settings, sanitize folder name, and ensure destination availability before transaction.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, src-tauri/src/settings/mod.rs
**Sample snippets (optional)**: ...
**What to do**: Use `settings.current().await.projects_dir()` to build target path; validate uniqueness; emit progress event.
**How to**: Wrap blocking FS checks inside `tokio::task::spawn_blocking` per Tauri best practice (per Perplexity insight).
**Check**: Command returns validation error when folder exists; logs action via `log::info!`.
**Gate (Exit Criteria)**: Destination path prepared or descriptive error raised without side effects.
**Notes**: Added backend folder-name validation and destination check via `SettingsManager::current()` inside `create_project_with_assets_v2`, executing filesystem lookups with `spawn_blocking` and surfacing user-friendly validation errors when the slug is empty, invalid, or already present.

#### Step 2.3

**Status**: COMPLETED
**Description**: Create project root and required subdirectories (Translations, References, Instructions) with rollback guard.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs
**Sample snippets (optional)**: ...
**What to do**: Implement helper that tracks created paths and removes them on error.
**How to**: Execute `fs::create_dir_all` inside `spawn_blocking`; record path list for cleanup RAII.
**Check**: Integration test asserts directories exist after success; failure removes partial folders.
**Gate (Exit Criteria)**: All core subfolders created with rollback coverage.
**Notes**: Added `DirectoryCreationGuard` and `create_project_scaffold` helper to build root + role subdirectories inside `create_project_with_assets_v2`, using `spawn_blocking` and automatic cleanup on failure; guard retained for future steps.

#### Step 2.4

**Status**: COMPLETED
**Description**: Generate project UUID, start SQLx transaction, and insert project record with subjects/language pairs.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, src-tauri/src/db/operations/projects_v2.rs
**Sample snippets (optional)**: ...
**What to do**: Map payload to `NewProjectArgs`, call `projects_v2::create_project`, capture bundle.
**How to**: Acquire `DbManager` write lock, run inside async context, handle `DbError`.
**Check**: Transaction rolls back on duplicate language pair; logs error details.
**Gate (Exit Criteria)**: Project bundle persisted or command fails gracefully without residual DB rows.
**Notes**: Payload now maps to `NewProjectArgs` via helper and persists using `DbManager::create_project_bundle`; response returns mapped bundle alongside scaffold path.

#### Step 2.5

**Status**: COMPLETED
**Description**: Copy source files into role-specific directories and capture file metadata.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, new Rust helper module (filesystem utilities)
**Sample snippets (optional)**: ...
**What to do**: Iterate file descriptors, map role → destination (`Translations` vs `References` vs `Instructions`), copy, stat size.
**How to**: Use `spawn_blocking` per file to call `std::fs::copy`; collect metadata for DB insert; on failure trigger cleanup and transaction rollback.
**Check**: Files appear in target folders with correct byte size; simulated error removes any copies.
**Gate (Exit Criteria)**: All staged files successfully copied and metadata captured.
**Notes**: Assets are copied via `copy_project_assets`, which places processable files under `Translations` and references/instructions under role-specific directories, collecting metadata and returning results in the response while cleaning up on failures.

#### Step 2.6

**Status**: COMPLETED
**Description**: Attach copied files to database with language pair metadata.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, src-tauri/src/db/operations/projects_v2.rs
**Sample snippets (optional)**: ...
**What to do**: Build `NewFileInfoArgs` and `NewProjectFileArgs` per file; reuse `attach_project_file`.
**How to**: Within existing transaction, ensure `language_pairs` subset validation per schema; log success.
**Check**: Query returns project files count matching payload; transaction failure reverts.
**Gate (Exit Criteria)**: Database reflects file attachments and associated language pairs.
**Notes**: `create_project_with_assets_v2` now calls `attach_project_file` for each copied asset, mapping roles into DB types and assigning project-wide language pairs to processable files while returning the refreshed project bundle.

#### Step 2.7

**Status**: COMPLETED
**Description**: Create language pair translation subdirectories and seed conversion job records.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, src-tauri/src/db/operations/projects_v2.rs, src-tauri/src/db/operations/jobs_v2.rs
**Sample snippets (optional)**: ...
**What to do**: For each pair, create `Translations/{src}_{tgt}` directory and enqueue conversion job placeholders referencing copied files.
**How to**: Add helper to join sanitized locales; call `jobs_v2::upsert_job` with status `pending`.
**Check**: Directory tree exists; job table contains entries for each processable file/pair combination.
**Gate (Exit Criteria)**: Translation directories ready and jobs persisted for downstream conversion.
**Notes**: `create_project_with_assets_v2` now prepares translation subdirectories and seeds pending conversion artifacts/jobs for each processable file and language pair.

#### Step 2.8

**Status**: COMPLETED
**Description**: Finalize command response with bundle summary and ensure rollback/cleanup on any failure path.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs
**Sample snippets (optional)**: ...
**What to do**: Commit transaction, drop cleanup guard, emit Tauri progress `window.emit("project:create:complete", ...)`.
**How to**: Use custom struct implementing `Drop` to remove directories if `commit` not reached.
**Check**: Manual panic during file copy leaves no directories or DB rows.
**Gate (Exit Criteria)**: Command guarantees atomicity and returns enriched payload for UI.
**Notes**: Progress/complete events now stream to the frontend and the scaffold guard still rolls back on any failure path before commit.

### Task 3

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Wire frontend finalize action to the new backend command, reflect progress states, and handle success/error UX.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Deliver responsive user experience with loader, progress, and closure once backend completes.

#### Step 3.1

**Status**: COMPLETED
**Description**: Update IPC adapters to call new command and return structured response with project + conversion plan summary.
**Codebase touched**: src/core/ipc/db/projects.ts, src/core/ipc/client.ts
**Sample snippets (optional)**: ...
**What to do**: Export `createProjectWithAssets` helper; map response DTO to friendly TypeScript type.
**How to**: Extend `safeInvoke` usage; update index exports and jest mocks.
**Check**: Devtools network shows invoke payload/response; tests assert mapping.
**Gate (Exit Criteria)**: Renderer can call command and receives typed data.

#### Step 3.2

**Status**: COMPLETED
**Description**: Integrate progress handling in wizard using `WizardFeedbackOverlay`, including streaming updates via Tauri events.
**Codebase touched**: src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx, src/modules/projects/components/wizard-v2/components/WizardFeedbackOverlay.tsx
**Sample snippets (optional)**: ...
**What to do**: Subscribe to progress events (e.g., `"project:create:progress"`) during finalize and update overlay copy.
**How to**: Use `useEffect` with `listen` from Tauri event API; ensure cleanup on unmount.
**Check**: UI displays step-by-step messages (Creating folders, Copying files, Persisting project, etc.).
**Gate (Exit Criteria)**: Overlay reflects backend progress and reverts to idle on completion/failure.

#### Step 3.3

**Status**: COMPLETED
**Description**: Handle finalize resolution—clear wizard state, close dialog, refresh project list, and toast success.
**Codebase touched**: src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx
**Sample snippets (optional)**: ...
**What to do**: On success, call existing `handleClear`, trigger `onProjectCreated`, close dialog, and optionally navigate to project overview.
**How to**: Chain actions within `startSubmission` callback; guard with `submissionPending`.
**Check**: QA flow confirms wizard resets and parent project list updates without manual refresh.
**Gate (Exit Criteria)**: Post-success state matches expectation and no stale UI remnants remain.

#### Step 3.4

**Status**: COMPLETED
**Description**: Render detailed error information from backend (fs/db/conversion) with retry affordances.
**Codebase touched**: src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx, src/shared/ui/toast
**Sample snippets (optional)**: ...
**What to do**: Map `IpcError` payload to copy, display watchers, offer “Try again” button to re-trigger finalize.
**How to**: Extend overlay to show bullet list of failed steps; hook to `dismissFeedback`.
**Check**: Synthetic errors produce consistent overlay + toast with actionable guidance.
**Gate (Exit Criteria)**: User can recover from failure without reloading app.

### Task 4

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Execute conversion workflow for processable files per language pair, emitting loader updates and recording outcomes.
**Feature required (optional)**: F-004
**Purpose/Outcome**: Satisfy A-008 and A-009 by producing XLF artifacts with responsive UX during finalize.

#### Step 4.1

**Status**: COMPLETED
**Description**: Derive conversion plan from backend response, including absolute input/output paths and language pairs.
**Codebase touched**: src/core/ipc/client.ts, src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx
**Sample snippets (optional)**: ...
**What to do**: Parse command response to build array of conversion tasks keyed by file UUID and language pair.
**How to**: Introduce helper to join translation directory path with file stem; ensure OS-safe separators.
**Check**: Debug log lists planned conversions matching language pairs count.
**Gate (Exit Criteria)**: Plan covers every processable file × target language combination.

#### Step 4.2

**Status**: COMPLETED
**Description**: Run sequential (or configured parallel) conversions using `convertStream` with progress callbacks updating overlay.
**Codebase touched**: src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx, src/core/ipc/openxliff.ts
**Sample snippets (optional)**: ...
**What to do**: Loop tasks, update overlay message per progress event, handle stdout/stderr logging.
**How to**: Use `async` iterator; optionally throttle concurrency; feed `onStdout`/`onStderr` to console.
**Check**: Loader shows conversion step; success writes XLF files to expected directories.
**Gate (Exit Criteria)**: All conversions succeed or first failure aborts with descriptive error.

#### Step 4.3

**Status**: COMPLETED
**Description**: Validate generated XLFs and update conversion/job status in database.
**Codebase touched**: src/core/ipc/openxliff.ts, src/core/ipc/client.ts, src-tauri/src/ipc/commands/jobs_v2.rs (if required)
**Sample snippets (optional)**: ...
**What to do**: Invoke `validateStream`; call new IPC helper to mark job `completed`/`failed` with validation summary.
**How to**: Reuse `updateConversionStatus` TODO by implementing backend counterpart.
**Check**: Database job rows show final status; UI toast describes completion.
**Gate (Exit Criteria)**: Validation results persisted and surfaced to user.

#### Step 4.4

**Status**: COMPLETED
**Description**: Persist metadata for produced XLF/JLIFF artifacts and enqueue further processing if needed.
**Codebase touched**: src-tauri/src/db/operations/artifacts_v2.rs, src-core/ipc/client.ts
**Sample snippets (optional)**: ...
**What to do**: Create artifact records referencing XLF path, optionally trigger JLIFF conversion tasks.
**How to**: Call `artifacts_v2::upsert_artifact` via new IPC helper, then schedule `convertXliffToJliff`.
**Check**: Artifact table entries appear; follow-up conversions optional but staging ready.
**Gate (Exit Criteria)**: Artifact metadata exists for each XLF output.

### Task 5

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Validate new flow via automated tests, logging, and manual QA checklist.
**Feature required (optional)**: F-005
**Purpose/Outcome**: Ensure reliability, regressions coverage, and observability post-integration.

#### Step 5.1

**Status**: COMPLETED
**Description**: Add frontend unit/integration tests for payload builder, error mapping, and finalize flow.
**Codebase touched**: src/modules/projects/components/wizard-v2/__tests__ (new), vitest config
**Sample snippets (optional)**: ...
**What to do**: Write Vitest cases simulating success/failure of finalize handler using mocked IPC calls.
**How to**: Mock `createProjectWithAssets` and conversion helpers; assert overlay states.
**Check**: `pnpm test wizard-v2` passes with new cases.
**Gate (Exit Criteria)**: Tests guard critical UX paths and validation logic.

#### Step 5.2

**Status**: COMPLETED
**Description**: Implement Rust integration tests covering command rollback scenarios and filesystem cleanup.
**Codebase touched**: src-tauri/src/ipc/commands/projects_v2.rs, src-tauri/tests/project_creation_rollback.rs, src-tauri/Cargo.toml, src-tauri/src/lib.rs
**Sample snippets (optional)**: Added generic `create_project_with_assets_impl` helper (wrapping the command) plus `rollback_project_creation` compensation calls across failure paths; introduced mock-driven integration test exercising missing-source rollback.
**What to do**: Write async test using tempdir verifying failure during copy leaves no directories and no DB rows.
**How to**: Reused `tempfile::TempDir`, `tauri::test::mock_app`, and `create_project_with_assets_impl` to drive the pipeline and assert filesystem/database cleanup.
**Check**: `cargo test command_rollback_removes_db_entries_on_copy_failure` passes; logs show structured errors.
**Gate (Exit Criteria)**: Tests confirm atomicity guarantees with documented rollback coverage.

#### Step 5.3

**Status**: NOT COMPLETED
**Description**: Document manual QA checklist and enable structured logging for error analytics.
**Codebase touched**: docs/QA.md (if allowed), src-tauri/src/ipc/commands/projects_v2.rs (logging)
**Sample snippets (optional)**: ...
**What to do**: Draft test scenarios (success, duplicate name, conversion failure) and ensure `log::error!` includes context.
**How to**: Update command to emit JSON logs; share QA steps with team.
**Check**: Manual run adheres to checklist; logs visible in dev console.
**Gate (Exit Criteria)**: QA artefacts ready and logging present for observability.

#### Step 5.4

**Status**: COMPLETED
**Description**: Ensure authenticated Supabase users are mirrored in the local SQLite users table so project creation receives a valid UUID.
**Codebase touched**: src/app/providers/auth/AuthProvider.tsx, src/core/ipc/db/users.ts (consumer), src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx, src/modules/projects/components/wizard-v2/__tests__/finalize-utils.test.ts.
**Sample snippets (optional)**: Added `ensureDomainUserProfile` effect in `AuthProvider` and swapped wizard finalize logic to use `useAuth`.
**What to do**: On auth session changes, upsert the user profile via IPC; wire the wizard to consume the authenticated user's UUID instead of the `local-user` placeholder.
**How to**: Reuse `getUserProfile`/`createUserProfile` helpers with Supabase IDs, handle logging and loading states, and update tests to reflect UUID usage.
**Check**: Login flow inserts/updates the local user as needed and project creation succeeds without `invalid userUuid`.
**Gate (Exit Criteria)**: Wizard finalize payload carries a real UUID and backend validation passes.
