# Project Creation Plan – Progress Log

## Step 1.1 (Wizard finalize payload)
- Introduced `WizardFinalizePayload` and related result types in `src/modules/projects/components/wizard-v2/types.ts`.
- Implemented `buildWizardFinalizePayload` with cross-platform folder-name sanitisation and validation gates inside `CreateProjectWizardV2.tsx`.
- Updated finalize handler to use the new helper, surface structured errors, and log the payload prior to IPC invocation.
- Verification: `pnpm typecheck`.

## Step 1.2 (Finalize feedback contract)
- Replaced ad-hoc `feedbackState`/message pair with `WizardFinalizeFeedback` union in `src/modules/projects/components/wizard-v2/types.ts`, adding progress phases and error categories.
- Updated `WizardFeedbackOverlay.tsx` to accept structured feedback, render category-specific copy, and disable dismissal while progress is running.
- Refined finalize flow in `CreateProjectWizardV2.tsx` to emit progress events, classify backend errors via `resolveFinalizeError`, and surface category-aware toasts; added heuristics/code mapping for filesystem, database, validation, and conversion failures.
- Adjusted `WizardFooter.tsx` to respect the new `finalizeBusy` flag and keep the finalize button state in sync.
- Verification: `pnpm typecheck`.

## Step 1.3 (Project folder naming)
- Authored `utils/projectFolder.ts` with documented slug rules, Unicode normalization, diacritic stripping, reserved-name handling, and deterministic numeric suffixing for collisions.
- Updated `CreateProjectWizardV2.tsx` to generate folder slugs via the shared helper, feed existing project names from `projectsResource`, and include the resolved slug in the finalize payload.
- Added detail styling to the feedback overlay to surface optional error hints when sanitization fails.
- Verification: `pnpm typecheck`.

## Step 2.1 (Scaffold create_project_with_assets_v2)
- Defined `CreateProjectWithAssetsPayload`/`Response` DTOs plus asset + conversion plan descriptors in `src-tauri/src/ipc/dto.rs` and exposed `create_project_with_assets_v2` command stub in `projects_v2.rs`, wiring it through `ipc::mod`, `lib.rs`, and the Tauri invoke handler.
- Added TypeScript counterparts (`CreateProjectWithAssetsInput/Response`, asset + conversion types) and the `createProjectWithAssets` IPC helper in `src/core/ipc/db/projects.ts`, including mapping utilities for nested data.
- Frontend wizard now leverages shared folder slug utilities from `utils/projectFolder.ts` (from Step 1.3), ensuring payload alignment with new DTO contract.
- Verification: `pnpm typecheck`, `cargo check`.

## Step 2.2 (Validate destination folder)
- Updated `create_project_with_assets_v2` to resolve the projects root via `SettingsManager`, validate the provided slug, and check for existing directories using `tokio::task::spawn_blocking` before any filesystem writes.
- Added backend folder-name validation that mirrors frontend constraints (length, forbidden characters, separators) and surfaces consistent `IpcError::Validation` messages when the slug is invalid or already present.
- Verification: `cargo check`.

## Step 2.3 (Create directory scaffold)
- Implemented `create_project_scaffold` which creates the project root plus `Translations`, `References`, and `Instructions` subdirectories in a blocking task, returning a `DirectoryCreationGuard` that rolls back on failure.
- Integrated the scaffold helper into `create_project_with_assets_v2` so directory creation runs immediately after validation; guard will persist for later steps to commit once the pipeline succeeds.
- Verification: `cargo check`.

## Step 2.4 (Persist project record)
- Added mapping from `CreateProjectWithAssetsPayload` to `NewProjectArgs`, validating UUID fields and cloning subjects/language pairs for the DB layer.
- `create_project_with_assets_v2` now invokes `DbManager::create_project_bundle` to insert the project/subjects/pairs and returns the mapped bundle payload in the response.
- Verification: `cargo check`.

## Step 2.5 (Copy role-based assets)
- Implemented `copy_project_assets` to move uploaded files into role-specific subdirectories (`Translations`, `References`, `Instructions`) using blocking fs ops wrapped in `spawn_blocking`, with cleanup on failure.
- File metadata (draft id, generated UUID, stored relative path, role) is captured and included in the IPC response to feed the upcoming DB attachment step.
- Verification: `cargo check`.

## Step 2.6 (Attach files to database)
- After copying, the orchestration command now builds `NewFileInfoArgs`/`NewProjectFileArgs` per asset, calls `DbManager::attach_project_file`, and refreshes the project bundle so the response includes attached files.
- Processable assets inherit the project language pairs; non-processable assets attach with an empty pair list while maintaining role-specific type strings.
- Verification: `cargo check`.

## Step 2.7 (Translation directories & jobs)
- Project creation now materialises `Translations/{src}_{tgt}` directories for every language pair and seeds pending XLIFF artifact/job records per processable file/pair combination.
- Conversion plan DTOs returned to the renderer include the generated artifact UUID alongside absolute/relative paths for the queued work.
- Verification: `cargo check`.

## Step 2.8 (Command finalization & events)
- Emitted structured progress events for each pipeline phase plus a completion event once the response is ready; scaffold guard still handles rollback on failure.
- Response now ships the optional conversion plan so the frontend can skip local derivation and align with seeded jobs.
- Verification: `cargo check`.

## Step 3.1 (IPC finalize adapter)
- Wizard finalize flow now invokes `createProjectWithAssets`, using a new `buildCreateProjectWithAssetsInput` helper to map sanitized wizard payloads into the DTO (including folder slug, roles, and absolute paths).
- Added structured logging around the command call and routed `onProjectCreated` through the bundle returned by the orchestration response while updating user-facing toast copy.
- Verification: `pnpm typecheck`.

## Step 3.2 (Finalize progress stream)
- Register the wizard finalize flow for `"project:create:progress"` events, filtering by folder slug and updating the overlay to mirror backend phases as progress events arrive.
- Added a progress-event payload contract plus a phase guard to ensure only recognised phases trigger UI changes; listeners are disposed safely after completion or failure.
- Verification: `pnpm typecheck`.

## Step 3.3 (Finalize resolution)
- Refresh the projects resource after a successful creation (with fallback logging) so the workspace reflects the new entry without a manual reload, while continuing to invoke the parent `onProjectCreated` callback.
- Rely on the existing clear routine to reset wizard state, close the dialog, and show a polished success toast once the orchestration command completes.
- Verification: `pnpm typecheck`.

## Step 3.4 (Finalize error UX)
- Enhanced the feedback overlay to show backend error details and hints, added a retry control that replays finalize without losing wizard state, and styled the action row to accommodate multiple buttons.
- Updated event payload types to support richer error messages while keeping the dismiss action accessible when progress is inactive.
- Verification: `pnpm typecheck`.

## Step 4.1 (Conversion plan derivation)
- Introduced wizard-level conversion plan/task types plus path utilities for cross-platform joining and file-stem extraction (`types.ts`, `utils.ts`).
- Wizard now consumes the backend-supplied conversion plan when present, falling back to local derivation only if necessary while still logging task mismatches.
- Verification: `pnpm typecheck`.

## Step 4.2 (Conversion execution)
- Wizard finalize flow now runs conversion tasks sequentially using `convertStream`, updating the overlay with per-file progress and surfacing stderr/stdout logs for debugging.
- Conversion failures bubble through as structured errors (`CONVERSION_STREAM_FAILED`), aborting the finalize flow with actionable feedback; success leaves the plan cached for subsequent validation steps.
- Verification: `pnpm typecheck` *(fails due to unrelated layout-sidebar-two regressions)*, `cargo check`.

## Step 4.3 (Validation & status updates)
- After conversion each task now runs `validateStream`, updates the associated job status (`running`/`failed`/`completed`), and surfaces validation errors via the finalize overlay.
- Backend conversion plan payloads include the seeded job type so the wizard can persist results through `updateJobStatus`, maintaining DB state in sync with execution.
- Verification: `pnpm typecheck`, `cargo check`.

## Step 4.4 (Persist artifacts)
- Successful conversions now mark the related artifact rows as `GENERATED` via `upsertArtifactRecord`, keeping artifact/job tables aligned with the produced XLIFF outputs.
- Artifact updates run only when the backend provided persistent identifiers; fallbacks log and continue without breaking the finalize flow.
- Verification: `pnpm typecheck`, `cargo check`.

## Step 5.1 (Wizard finalize tests)
- Added `finalize-utils.test.ts` covering payload assembly, error classification, conversion plan mapping, and user-facing task descriptions.
- Tests rely on exported helpers from `CreateProjectWizardV2`, ensuring validation logic stays regressed; executed with Vitest.
- Verification: `pnpm test src/modules/projects/components/wizard-v2/__tests__/finalize-utils.test.ts`.

## Step 5.2 (Command rollback tests)
- Extracted the project creation pipeline into `create_project_with_assets_impl` so the command can be exercised with both Wry and `MockRuntime` handles; wired rollback guards to guarantee database cleanup on every early exit.
- Augmented `rollback_project_creation` and error branches inside `create_project_with_assets_impl` to delete project rows when asset copy, attachment, or conversion planning fail.
- Registered Tauri's `test` feature in `Cargo.toml`, expanded `ipc_test` exports, and introduced `build_settings_manager` for repeatable test scaffolds.
- Authored `command_rollback_removes_db_entries_on_copy_failure` in `tests/project_creation_rollback.rs`, using `tauri::test::mock_app` to simulate the command and asserting both filesystem and SQLite state are restored.
- Verification: `cargo test command_rollback_removes_db_entries_on_copy_failure`.

## Step 5.4 (User profile synchronization)
- Hooked `AuthProvider` into the user IPC adapters so every Supabase session ensures a matching SQLite user profile, creating or updating the record with deterministic owner roles.
- Added guarded logging around the sync to capture creation/update failures without breaking the UI, and memoized the last synced UUID to prevent redundant IPC calls.
- Updated the wizard to consume the authenticated user's UUID, blocking finalize attempts when no user is present and surfacing an actionable toast.
- Refreshed finalize utility tests to expect real UUID values, aligning with the backend validation rules.
- Verification: `pnpm typecheck`.
