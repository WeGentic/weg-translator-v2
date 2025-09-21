# Wizard Language Selectors (Steps 8–10)

This milestone adds default language selection to the Create Project wizard and persists defaults to the database.

What changed
- Types: `src/components/projects/wizard/types.ts`
  - Added `srcLang`, `tgtLang` to `NewProjectForm` and `INITIAL_PROJECT_FORM` (defaults: en-US → it-IT).
  - Extended `ProjectFormErrors` with `srcLang`, `tgtLang`.
- Validation: `src/components/projects/wizard/utils/validation.ts`
  - Enforces well‑formed BCP‑47 tags via `src/lib/validators.ts`.
  - Requires source/target to differ (case‑insensitive).
- UI: `src/components/projects/wizard/steps/ProjectDetailsStep.tsx`
  - Added two inputs (Source/Target language) with inline validation feedback.
- IPC Types: `src/ipc/types.ts` and `src/ipc/client.ts`
  - `CreateProjectRequest` now carries `defaultSrcLang` and `defaultTgtLang`.
- Wizard submit: `src/components/projects/wizard/state/useProjectWizard.ts`
  - Sends `defaultSrcLang` / `defaultTgtLang` in `createProject`.
- Backend DTO: `src-tauri/src/ipc/dto.rs`
  - `CreateProjectRequest` extended with optional `default_src_lang` / `default_tgt_lang`.
- DB insertion: `src-tauri/src/db/mod.rs`
  - `NewProject` extended with optional defaults; `insert_project` writes them to `projects` table.
- IPC create: `src-tauri/src/ipc/commands.rs`
  - Persists provided defaults (falling back to en-US / it-IT).

Notes
- Migrations `006` and `007` were already present; this milestone wires the new columns into project creation.

