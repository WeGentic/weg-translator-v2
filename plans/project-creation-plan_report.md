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
