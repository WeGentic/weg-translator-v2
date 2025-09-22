# Project-Specific Page — Acceptance Criteria Summary

Status: Defined and satisfied by implementation; runtime verification pending per platform.

Scope
- Project page, file management, and automatic XLIFF conversion on open (Steps 12–15 + Fix Plan acceptance).

Acceptance Criteria
- Auto-conversion triggers on open when `autoConvertOnOpen=true`, calls `ensureProjectConversionsPlan(projectId)`, and opens a modal when tasks exist.
- Tasks run sequentially: `convertStream` then `validateStream`, with live logs and progress UI.
- Status transitions persisted via `updateConversionStatus` (pending → running → completed/failed); on success, `xliff_rel_path` is saved (relative to project root).
- XLIFF-like inputs are skipped; supported convertible formats are included.
- Failures are non-blocking: UI banner summarises failures; items show `failed`; "Retry failed" requeues only failed ones.
- Cancellation stops after current item; completed items remain.
- Add/Remove files work end-to-end (DB + filesystem): adds refresh the ensure plan; removes delete source and generated artifacts.
- Output path convention `<root>/xliff/<stem>.<src>-<tgt>.xlf` respected throughout.
- DB schema and indexes (migrations `006/007`) ensure unique conversions and efficient lookups.

Key Files
- Frontend: `src/components/projects/overview/ProjectOverview.tsx`, `src/ipc/client.ts`, `src/ipc/types.ts`, `src/lib/openxliff.ts`.
- Backend: `src-tauri/src/ipc/commands.rs`, `src-tauri/src/ipc/dto.rs`, `src-tauri/src/db/mod.rs`.
- Migrations: `src-tauri/migrations/006_add_project_languages.sql`, `src-tauri/migrations/007_create_project_file_conversions.sql`.

Notes
- Platform packaging for OpenXLIFF resources must be prepared per target OS/arch prior to distribution.
- Code review via CodeRabbit pending authentication.

