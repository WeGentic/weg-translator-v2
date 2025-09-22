# Backend Groundwork Documentation

## Completed Work

- Added migration `006_add_project_languages.sql` to extend the `projects` table with optional `default_src_lang` / `default_tgt_lang` defaults and an index for lookup efficiency.
- Added migration `007_create_project_file_conversions.sql` introducing the `project_file_conversions` table, enforcing sidecar-friendly defaults, status checks, and timestamp metadata.
- Extended `src-tauri/src/db/mod.rs` with conversion domain types (`ProjectFileConversionStatus`, `NewProjectFileConversion`, `ProjectDetails`, etc.) plus helpers for:
  - Batch inserting conversion records (`insert_project_file_conversions`).
  - Updating conversion lifecycle fields (`upsert_conversion_status`).
  - Fetching full project details with nested conversions (`list_project_details`).
  - Managing project files (`add_files_to_project`, `remove_project_file`) and conversion queues (`find_or_create_conversion_for_file`, `list_pending_conversions`).
  - Resolving filesystem targets (`project_root_path`, `ensure_subdir`).

## IPC Layer – Next Updates

Target files: `src-tauri/src/ipc/dto.rs`, `src-tauri/src/ipc/commands.rs`, `src/ipc/types.ts`, `src/ipc/client.ts`.

1. **DTOs**
   - Map new DB structs into IPC-friendly shapes (`ProjectDetailsDto`, `ProjectFileDto`, `ProjectFileConversionDto`, `EnsureConversionsPlanDto`, `AddFilesResponseDto`).
   - Handle UUID/string conversions and propagate conversion status enums consistently.
2. **Commands**
   - `get_project_details` returning full project payload for the project view.
   - `add_files_to_project` / `remove_project_file` coordinating filesystem copy/delete plus DB helpers.
   - `ensure_project_conversions_plan` and `update_conversion_status` wiring queue preparation to `DbManager::list_pending_conversions` and status persistence.
   - Capabilities updates for new commands if needed.
3. **Frontend IPC wrappers**
   - Extend `src/ipc/client.ts` & `src/ipc/types.ts` with the new command contracts and conversion status types.

## Frontend – Upcoming Tasks

Target areas: `src/components/projects/**`, new project-specific route, and supporting hooks/stores.

1. **Routing & Data Loading**
   - Create a dedicated TanStack Router route (e.g., `/projects/$projectId`) that calls `get_project_details` and stores the response in state.
   - Introduce React Query (or TanStack Router loaders) for caching project details and conversion plans.
2. **Project Page UI**
   - Build file list and conversion status table using ShadCN badges, modals, and dropdowns; reuse `cn` utilities for Tailwind 4 classes.
   - Provide actions for adding/removing files, retrying failed conversions, and opening converted XLIFF paths.
3. **Conversion Queue UX**
   - Implement queue modal/log (per plan §§13–19) consuming `ensure_project_conversions_plan` and streaming updates.
   - Surface status changes via badges and toasts; allow cancellation and retry flows.
4. **Validators & Wizards**
   - Update the project creation wizard with default language selectors and BCP-47 validation helpers.
5. **Testing**
   - Add Rust unit tests for new DB paths and IPC command behaviour.
   - Add TypeScript tests for wizard validation and project page rendering.

This outline keeps upcoming IPC/frontend milestones in sync with the new database primitives landed in this milestone.
