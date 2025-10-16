# SQLite Refactor Summary

_Last updated: 2025-02-14_

This document captures the post-refactor database landscape for the Weg Translator application. The legacy project-centric schema and IPC flows have been superseded by the v2 schema described below. All new development must target these constructs.

---

## 1. Schema Overview

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

Runbook:
```bash
# Backend
cargo test db_manager_v2 --tests

# Frontend
pnpm test src/modules/projects/components/wizard-v2/utils/__tests__/languagePairs.test.ts
pnpm typecheck
pnpm lint
```

---

## 5. Cleanup Checklist

- [x] Remove legacy schema documentation.
- [x] Route project list/delete to v2 commands.
- [x] Validate language pair requirements before IPC invocation.
- [ ] (Follow-up) Replace legacy `create_project_with_files` flow with v2 project/file APIs.
- [ ] (Follow-up) Deprecate `ProjectService` and the remaining legacy operations once renderer migration is complete.
