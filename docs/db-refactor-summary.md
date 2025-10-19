# SQLite Refactor Summary

## 1. Schema Overview

Project
  - Project_uuid
  - Project_name
  - Creation_date
  - Update_date
  - Project_status [READY, IN_PROGRESS, COMPLETED, ON_HOLD, CANCELLED]
  - Project_files (see Project Files TABLE) (can be empty at some points)
  - User (see User TABLE)
  - Client (see Client TABLE) (optional)
  - Subjects (list) (optional)
  - Project_Language_pairs (list) (at least one entry)
  - Type
  - Jobs (see Jobs TABLE) (can be empty at some points) (optional)
  - Artifacts (see Artifacts TABLE) (can be empty at some points) (optional)
  - Notes (optional)

Client
  - Client_uuid
  - Client_name
  - Client_email (optional)
  - Client_phone (optional)
  - Client_address (optional)
  - Client_vat (optional)
  - Client_note (optional)
  
Project Files
  - Project_uuid
  - File_uuid
  - Filename
  - File info (see File info TABLE)
  - File_Language_pair (can be <= Project_Language_pair)
  - Stored_at
  - Type

File Info
  - File_uuid
  - Ext
  - Type
  - Size
  - Count
  - Token
  - Notes (optional)
  
User
  - User_uuid
  - Username
  - Email
  - Phone (optional)
  - Address (optional)
  - Role (list) (optional)
  - Permission_override (list) (optional)

Artifacts
  - Project_uuid
  - File_uuid
  - Artifact_uuid
  - Artifact_type
  - Size
  - Count (optional)
  - Token (optional)
  - Status

Jobs
  - Artifact_uuid
  - Project_uuid
  - Job_type
  - Job_status
  - Error_log (optional)
  
  



| Domain | Tables / Views | Notes |
| --- | --- | --- |
| Users & Permissions | `users`, `user_roles`, `user_permission_overrides` | UUID primary keys. Permission overrides represent explicit allow/deny decisions (`is_allowed` flag). |
| Clients | `clients` | Optional metadata (email, phone, VAT, note). Projects may reference clients but do not require one. |
| Projects | `projects`, `project_subjects`, `project_language_pairs` | `projects` carries status/type metadata plus auto-managed `creation_date`/`update_date`. Triggers enforce `update_date` refresh and language-pair subset rules. |
| Files | `file_info`, `project_files`, `file_language_pairs` | File metadata separated from project linkage; language pairs per file must exist in `project_language_pairs`. |
| Artifacts & Jobs | `artifacts`, `jobs` | Artifacts keyed by UUID, jobs keyed by `(artifact_uuid, job_type)` pair. |

**Triggers / Indices**
- `projects_set_update_date` maintains timestamps.
- `flp_must_be_subset_of_plp_{insert,update}` guard file language pairs.
- Indices on `project_language_pairs.project_uuid`, `project_files.project_uuid`, and `(project_uuid, artifact_uuid)` for artifacts.

PRAGMA defaults: `foreign_keys = ON`, `recursive_triggers = OFF`, journal/synchronous modes configurable through settings.

---

## 2. Rust Backend Entry Points

### Schema & Connection
- `src-tauri/src/db/schema.rs` — canonical table/index/trigger definitions.
- `DbManager::connect_pool` wipes the existing SQLite file then runs `initialise_schema` for every bootstrap (no migrations).

### Operations (v2 Modules)
- `db/operations/users.rs` — CRUD for `UserProfile` (user row + roles + permission overrides).
- `db/operations/clients.rs` — CRUD for clients.
- `db/operations/projects_v2.rs` — project bundles, subjects, language pairs, file linkage helpers.
- `db/operations/artifacts_v2.rs` — artifact upsert/status.
- `db/operations/jobs_v2.rs` — job upsert/status/list.

All multi-table mutations are wrapped in transactions (see `projects_v2::create_project` and friends).

### IPC Commands
- `ipc/commands/{users_v2,clients_v2,projects_v2,artifacts_v2,jobs_v2}.rs` expose single-purpose Tauri commands referenced by the renderer.
- Legacy IPC (`create_project_with_files`, etc.) remains temporarily for compatibility and is flagged for removal once the renderer switches fully to the v2 flows.

---

## 3. Frontend Integration

- Shared DTOs live in `src/shared/types/database.ts`, mirroring the schema and ensuring type-safe IPC responses.
- Renderer adapters:
  - `src/core/ipc/db/users.ts`, `clients.ts`, `projects.ts`, `artifacts.ts`, `jobs.ts` call the v2 commands and map DTOs ↔ shared types.
  - `src/core/ipc/client.ts` provides higher-level helpers consumed by Project Manager UI; project listing/deletion already funnels through v2 commands.
- Project creation UI (`CreateProjectWizardV2`) validates BCP‑47 language pairs before invoking backend commands via `buildLanguagePairs`.

---

## 4. Testing

- `src-tauri/tests/db_manager_v2.rs` — exercises `DbManager` CRUD flows, ensuring trigger/constraint behaviour.
- `src/modules/projects/components/wizard-v2/utils/__tests__/languagePairs.test.ts` — validates client-side language pair builder.
