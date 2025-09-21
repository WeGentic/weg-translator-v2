# Project Creation Wizard — Detailed Plan

This plan designs and specifies a create-project Wizard integrated with `ProjectsPanel`, using React 19.1.1 (new Compiler), ShadCN UI v3.3.1, TailwindCSS 4.1.x, and Tauri 2.8.x (Rust 1.89 backend). It covers UX, UI components, IPC, SQLite schema, file handling, security, testing, and rollout.

## Goals & Scope
- Provide a multi-step Wizard to create a new Project in a new folder.
- Inputs:
  - Project name (required)
  - Project type: Translation | RAG (required)
  - Add File(s) button (DOCX/DOC/XLIFF/MQXLIFF/SDLXLIFF)
- Temporary “datagrid” (table) shows files selected during the wizard.
- Actions: Cancel, Create Project.
- Create Project performs atomically:
  - Create SQLite entries (project + file rows).
  - Create a project-specific folder.
  - Copy selected files into the project folder.
- Integrate with `ProjectsPanel` so the new project appears in the list after creation.

## UX Flow
- Entry point: `Create new project` button in the Projects view.
  - Source: `src/components/projects/ProjectsPanel.tsx` button at the bottom.
- Wizard opens as a modal dialog (keyboard and screen-reader accessible):
  1) Details step: Project name + type (select).
  2) Files step: “Add Files” opens OS dialog, selected files displayed in a table with remove controls.
  3) Review step: Summary with Create/Cancel.
- Validation blocks forward navigation until required fields are valid and at least one file is selected.
- On Create: optimistic UI (loading state), disable controls, call IPC to create the project; on success, close dialog and refresh project list.

## UI Architecture
- New components under `src/components/projects/`:
  - `wizard/CreateProjectWizard.tsx` – Modal wrapper, state bridge, and dialog control logic.
  - `wizard/steps/ProjectDetailsStep.tsx` – Step 1 form (name, type).
  - `wizard/steps/ProjectFilesStep.tsx` – Step 2 file selection and table.
  - `wizard/steps/ProjectReviewStep.tsx` – Step 3 summary.
  - `ProjectsPanel` consumes the wizard (internal state) and refreshes list post-create.
- ShadCN components to (add/use):
  - `ui/dialog.tsx` (Modal) – if not present, add via shadcn.
  - `ui/input.tsx`, `ui/label.tsx`, `ui/button.tsx` – already present.
  - `ui/select.tsx` – add via shadcn for type picker.
  - `ui/table.tsx` – present; use for the file list.
  - Optional: `ui/separator.tsx` for visual grouping; `ui/alert.tsx` for errors.
- Layout: responsive, minimal; use tokens (`bg-background`, `text-foreground`, `border-border`).

## Frontend Implementation Blueprint

### Types
```ts
// src/components/projects/wizard/types.ts
export type ProjectType = "translation" | "rag";

export interface NewProjectForm {
  name: string;
  type: ProjectType;
  files: string[]; // absolute file paths returned by dialog
}
```

### State & Validation
- React 19 Compiler-friendly:
  - Use object state for wizard form; keep derived state memoized.
  - Keep validation pure functions (no effects).
- Validation rules:
  - name: trimmed, 2–120 chars; must not be only punctuation; will be slugified server-side.
  - type: required; enum("translation","rag").
  - files: at least one, unique paths, extensions in allowlist.
- Allowlist: `docx`, `doc`, `xliff`, `mqxliff`, `sdlxliff`.

### File Picker (Tauri v2)
- Use `@tauri-apps/plugin-dialog` open with filters and multi-select.
```ts
import { open } from "@tauri-apps/plugin-dialog";

async function pickFiles(): Promise<string[]> {
  const selection = await open({
    multiple: true,
    filters: [
      { name: "Supported", extensions: ["docx","doc","xliff","mqxliff","sdlxliff"] },
    ],
  });
  if (!selection) return [];
  return Array.isArray(selection) ? selection : [selection];
}
```
- Enforce the same extension allowlist in the UI and again in the backend for safety.

### Wizard Controls
- Stepper can be implemented with Tabs or internal step index.
- Buttons:
  - Cancel: close dialog and reset state.
  - Back/Next: navigate steps, blocked by validation.
  - Create Project: disabled while submitting.
- Error surface: top-level Alert in the dialog body, plus inline input hints.

### File Table
- Columns: File name, Directory, Size (optional), Actions (Remove).
- Use `ui/table.tsx` with simple mapping; avoid data virtualization unless needed.

### Integration into ProjectsPanel
- `ProjectsPanel` opens `CreateProjectWizard` via internal state.
- After success: refresh projects list (via IPC query) and show toast.
- Reference points:
  - Trigger button: `src/components/projects/ProjectsPanel.tsx:52` (Create new project button onClick).

## IPC & Commands (Rust)

### Command: `create_project_with_files`
- Input DTO:
```rust
// src-tauri/src/ipc/dto.rs
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
  pub name: String,
  pub project_type: String, // "translation" | "rag"
  pub files: Vec<String>,   // absolute paths from dialog
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectResponse {
  pub project_id: String,     // UUID
  pub slug: String,
  pub folder: String,         // absolute path to project folder
  pub file_count: usize,
}
```
- Command signature:
```rust
#[tauri::command]
pub async fn create_project_with_files(
  app: tauri::AppHandle,
  db: tauri::State<'_, crate::db::DbManager>,
  req: CreateProjectRequest,
)-> Result<CreateProjectResponse, crate::ipc::error::IpcError> { /* ... */ }
```
- Behavior:
  1) Validate `name`, `project_type`, `files` (non-empty, allowed extensions).
  2) Generate `project_id = Uuid::new_v4()`, slugify name (`[a-z0-9-]`, collapse dashes, trim).
  3) Resolve base dir: `app.path().app_data_dir()`.
  4) Create folder: `<appData>/projects/<project_id>-<slug>` (mkdir -p).
  5) Begin DB transaction.
  6) Insert into `projects` table with metadata, timestamps.
  7) For each file:
     - Compute dest filename (handle collisions: append `-1`, `-2`, … before extension).
     - Copy using `std::fs::copy` to dest inside project folder.
     - Insert into `project_files` table with original path, relative stored path, size, ext, checksum(optional SHA-256), timestamps.
  8) Commit transaction; return response.
- Atomicity: folder creation and DB entries happen in a structured order; if any step fails, roll back DB and remove the partially created folder (best-effort) to avoid orphaned state.

### Optional Alternative (Frontend FS)
- If desired later, the same flow can be done from JS using `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-path` (createDir, copyFile, appDataDir, join). This requires granting capabilities for fs/path plugins. Default recommendation here is backend-managed for atomicity and reduced capability surface.

## SQLite Schema & Migrations
- New migration files under `src-tauri/migrations/`:
  - `004_create_projects.sql`
  - `005_create_project_files.sql`

### 004_create_projects.sql
```sql
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,            -- uuid string
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  project_type  TEXT NOT NULL CHECK (project_type IN ('translation','rag')),
  root_path     TEXT NOT NULL,               -- absolute path
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  metadata      TEXT                         -- JSON string (optional)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
```

### 005_create_project_files.sql
```sql
CREATE TABLE IF NOT EXISTS project_files (
  id               TEXT PRIMARY KEY,        -- uuid
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_name    TEXT NOT NULL,
  original_path    TEXT NOT NULL,           -- absolute path at import time
  stored_rel_path  TEXT NOT NULL,           -- relative path within project folder
  ext              TEXT NOT NULL,
  size_bytes       INTEGER,
  checksum_sha256  TEXT,                    -- optional
  import_status    TEXT NOT NULL DEFAULT 'imported' CHECK (import_status IN ('imported','failed')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
```

### Rust DB Layer
- Extend `DbManager` with:
  - `insert_project(&NewProject) -> DbResult<()>`
  - `insert_project_file(&NewProjectFile) -> DbResult<()>`
  - `list_projects(limit, offset) -> DbResult<Vec<ProjectListItem>>`
- Use the existing `SqlitePool` and transaction pattern already present for jobs.
- Migrations wired through `sqlite_migrations()` in `src-tauri/src/lib.rs` (append versions 4 and 5).

## Storage Layout & Naming
- Base dir: `app_data_dir()` to persist across app updates and avoid user directories.
- Project folder: `projects/<uuid>-<slug>`.
- Filenames: use original base name; sanitize dangerous characters; on collision append `-N` before extension.
- Slug rules (backend):
  - lowercase, ASCII only; replace non-alphanumerics with `-`; collapse multiple `-`; trim leading/trailing `-`.

## Security & Safety
- Never trust frontend inputs; backend re-validates:
  - Project type against enum; name length; files extensions.
  - All destination paths must be constructed from the project root; forbid `..` traversal by not using user input in path join.
- Use absolute → canonical checks where needed; ensure final dest is under project root.
- Drop privileges to minimum: prefer backend file ops to avoid enabling `plugin-fs`/`plugin-path` until necessary.
- Log with `tauri-plugin-log` at info/debug level; avoid leaking full paths in user-visible errors unless needed.

## Capabilities & Plugins
- Already present: `dialog:allow-open` in `src-tauri/capabilities/default.json` is sufficient for file selection.
- No need to add `plugin-fs`/`plugin-path` for backend approach.
- If frontend FS is later used, add capabilities for those plugins with scoped allowlists.

## IPC Client (Frontend)
- Add wrappers in `src/ipc/client.ts`:
```ts
export interface CreateProjectRequest {
  name: string;
  projectType: "translation" | "rag";
  files: string[];
}
export interface CreateProjectResponse {
  projectId: string;
  slug: string;
  folder: string;
  fileCount: number;
}
export async function createProject(req: CreateProjectRequest) {
  return safeInvoke<CreateProjectResponse>("create_project_with_files", { req });
}
```
- Add a `listProjects()` IPC for ProjectsPanel to render real data (follow existing patterns in `client.ts`).

## ProjectsPanel Integration
- `src/components/projects/ProjectsPanel.tsx`:
  - Replace `onCreateProject` logger with opening `CreateProjectWizard`.
  - After successful creation, call `listProjects()` and update rows.
  - Consider mapping DB fields to current columns (`languages` can be blank initially or derived later).

## Error Handling & UX
- Inline input errors; global alert for IPC failure.
- Create button shows spinner and disabled state; keep dialog open on error.
- On success, close the wizard, toast a success message, refresh list.

## Testing Plan
- Rust:
  - Unit tests for slugify and extension validation.
  - Integration test covering `create_project_with_files` with temp dirs and temp files.
  - Verify DB rows and file copies, collision behavior, rollback on failure.
- Frontend:
  - Unit tests for form validation (name/type/files) and allowlist filter.
  - Component tests for wizard steps and disabled states using Testing Library.
  - IPC client tests mirroring existing patterns in `src/ipc/client.test.ts`.

## Rollout & Verification
- Add migrations, build and run `pnpm tauri dev` to auto-apply.
- Manual test on macOS/Windows:
  - Create Translation project with multiple files; verify copied files exist and DB rows are present.
  - Repeat with duplicate filenames; confirm suffixing.
  - Create RAG project; confirm type recorded.
- Add a “Projects” list IPC query and wire `ProjectsPanel` to real data.

## Open Questions / Clarifications
- Project languages: `ProjectsPanel` shows “Languages”; should Wizard include source/target now or defer?
- Checksums: include SHA-256 at import time? Potential cost for large files.
- Max file size and count: any product limits to enforce?
- Where should we display project errors (e.g., copy failures) after creation? Toast vs. inline status.

## References
- Projects UI entry: `src/components/projects/ProjectsPanel.tsx` (Create button hook and table rendering).
- Existing SQLite integration patterns: `src-tauri/src/db/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/ipc/commands.rs`.
- Tauri v2 dialog API: `@tauri-apps/plugin-dialog` open with filters/multiple.
- Optional FS/Path APIs: `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-path` (backend approach recommended initially).

---

## Next Steps (Implementation Order)
1) Add migrations 004/005, wire into `sqlite_migrations()`.
2) Extend `DbManager` with project CRUD helpers.
3) Implement `create_project_with_files` command (copy + DB in a transaction).
4) Add IPC client wrapper and types.
5) Build Wizard UI components; integrate with `ProjectsPanel`.
6) Add `listProjects` IPC and render real data in table.
7) Tests: Rust integration + frontend validation; manual E2E on macOS/Windows.
