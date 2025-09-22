# Project-Specific Page & Auto-Conversion Plan

Goal: Implement a project-specific page with file management and automatic XLIFF conversion on open, plus wizard language selectors and SQLite persistence for file/conversion status. Uses React 19.1.1, ShadCN v3.3.1, TailwindCSS 4.1.1, and Tauri 2.8.5 sidecars.

Progress (Sep 22):
- [ ] Fix plan
   - [x] 1) Provision OpenXLIFF per platform: scripts present (`scripts/fetch-openxliff.sh`, `scripts/sync-openxliff-resources.sh`); `src-tauri/resources/openxliff/macos-arm64` committed. Action: fetch/build for other platforms in CI/dev envs before packaging.
   - [x] 2) Harden sidecar wrappers: wrappers standardized to emit "[<tool> wrapper] Could not locate OpenXLIFF resources..." across `.sh`/`.cmd` (see `src-tauri/sidecars/openxliff/bin`).
   - [x] 3) Ensure bundling: `src-tauri/tauri.conf.json` already bundles `resources/openxliff`; local macOS arm64 layout verified. Build-time verification required on Windows/Linux.
   - [x] 4) Error propagation: updated `src/lib/openxliff.ts` to detect missing-resources patterns and surface a clear message to UI/DB.
   - [ ] Acceptance criteria
- [x] 1–2 Migrations added (006, 007)
- [x] 3–4 DbManager structs + CRUD + helpers
- [x] 5–7 IPC DTOs + commands + capabilities
- [x] 8–10 Wizard language fields + validation + request wiring
- [x] 11 Frontend IPC wrappers
- [x] 12–15 Project page (details, file table, add/remove, auto‑conversion modal + statuses)
- [x] 16–20 Paths/UX: implemented as described; minor refinements applied
- [x] 21–22 Unit tests added (Rust + TS)
- [x] 25 Feature flag: Auto-convert on open (default enabled)
- [x] UX polish: banner + tooltip when auto-convert is disabled
- [x] 23–24, 26 Docs/rollout finalized (added rollout doc; checklist documented; migration order verified)

Note on sidecars: We will execute the packaged OpenXLIFF sidecar from the frontend via `@tauri-apps/plugin-shell` (`Command.sidecar`), which is already wired in `src/lib/openxliff.ts`. This aligns with the existing capabilities config and avoids duplicating process control on the backend.


## Fix Plan — New‑Project→XLIFF conversion flow

Root cause summary
- Sidecar wrappers start but exit immediately with a non‑zero code when resources are missing. The wrapper prints a helpful line, but the distribution for the current platform is not present under `src-tauri/resources/openxliff/<platform>`, causing early failure. Mac ARM64 exists; other platforms are missing.
- Unknown failure messages are not consistently propagated to the DB/UI. Orphan conversions may appear if foreign keys are not enforced at runtime.

Actions
1) Provision OpenXLIFF distributions per platform
   - Build or fetch OpenXLIFF for each target OS/arch (macOS x64/arm64, Linux x64/arm64, Windows x64/arm64).
   - Use existing scripts:
     - `scripts/fetch-openxliff.sh [--version vX.Y.Z]` to clone/build upstream and mirror `dist` to `vendor/openxliff/dist-<platform>`.
     - `scripts/sync-openxliff-resources.sh` to place the built `dist-<platform>` under `src-tauri/resources/openxliff/<platform>`.
     - `scripts/build-jre.sh` if a local jlink image is needed (kept under `resources/jre`, already included in bundle resources).
   - Platform folder names must match wrappers: `macos-<uname -m>` (e.g., `macos-arm64`), `linux-<uname -m>` (e.g., `linux-x86_64`), and `win-x64` for Windows.
   - Ensure `convert.sh`/`merge.sh`/`xliffchecker.sh` (or `.cmd`) inside each platform folder are executable and runnable.
   - Commit platform resources or document a pre‑packaging fetch step in CI.

2) Harden sidecar wrappers
   - Extend search paths for packaged and dev layouts where needed (Windows/Linux): ensure the wrappers check a path relative to the executable directory for `resources/openxliff/<platform>`.
   - Keep current macOS candidates in `src-tauri/sidecars/openxliff/bin/*.sh`; extend Windows `.cmd` counterparts to support `win-arm64` if we later add it and to probe both `..\resources\openxliff\%ARCH%` and `resources\openxliff\%ARCH%` plus one level up if needed.
   - Preserve and standardize the error line when resources are missing (e.g., `[convert wrapper] Could not locate OpenXLIFF resources for <platform>`), so the JS helper can surface it.

3) Ensure bundling
   - `src-tauri/tauri.conf.json` already includes `bundle.resources: ["resources/jre", "resources/openxliff"]` and sidecar binaries in `externalBin`. After adding platform folders, run a build and verify the packaged app contains `resources/openxliff/<platform>` for the current OS/arch.
   - Do not add the JRE or OpenXLIFF binaries to `externalBin`; the upstream scripts locate their own runtime inside `resources`.

4) Improve error handling and propagation
   - Frontend: `src/lib/openxliff.ts` already normalizes results and captures the first non‑empty stderr/stdout line. Add a known‑error pattern for missing resources to provide a clear message in the UI/DB:
     - Change: extend `detectKnownError(stdout, stderr)` to match `/\[(convert|merge|xliffchecker) wrapper\].*Could not locate OpenXLIFF resources/i` and return `{ type: 'missing_resources', message: 'OpenXLIFF components are missing; reinstall or run scripts/fetch-openxliff.sh', detail: '<first-line>' }`.
     - Ensure `convertStream/mergeStream/validateStream` return this `message` and that `ProjectOverview` forwards it to `updateConversionStatus(..., 'failed', { errorMessage: message })`.
   - UI: `src/components/projects/overview/ProjectOverview.tsx` forwards `errorMessage` to `updateConversionStatus` on failures. Keep this path and display the message in the modal log and conversion badges.
   - Backend: `update_conversion_status` already persists `error_message`. No change required there; ensure we do not drop unknown error text.

5) Database integrity and cleanup
   - Schema: `project_file_conversions.project_file_id` already has `ON DELETE CASCADE` in `src-tauri/migrations/007_create_project_file_conversions.sql`. Keep as is.
   - Connection: enforce foreign keys on every connection by enabling `PRAGMA foreign_keys = ON` during pool setup in `DbManager::connect_pool` (`src-tauri/src/db/mod.rs`).
     - Change: configure the pool with `SqlitePoolOptions::new().after_connect(|conn| Box::pin(async move { sqlx::query("PRAGMA foreign_keys = ON").execute(conn).await?; Ok(()) }))` before `.connect(...)`, or append `?_foreign_keys=on` to the SQLite URL.
   - Add a lightweight cleanup routine that removes conversions whose files no longer exist on disk (use existing path/FS helpers) and/or whose `project_files` row is missing (defensive in case foreign keys were previously off).

6) Windows .cmd wrappers and ARM64
   - Extend `src-tauri/sidecars/openxliff/bin/*.cmd` to detect architecture and probe additional candidate paths.
     - Change: detect ARM64 and set `%ARCH%` accordingly:
       - `set ARCH=win-x64`
       - `if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set ARCH=win-arm64`
     - Add extra candidates mirroring `.sh` wrappers, e.g. `..\..\resources\openxliff\%ARCH%` and `..\..\..\resources\openxliff\%ARCH%`.
     - Keep the standardized error line: `[convert wrapper] Could not locate OpenXLIFF resources for %ARCH% relative to %DIR%` so the JS pattern matches.
     - Ensure CR/LF line endings are preserved (normalize during fetch/sync if needed).

6) Cross‑platform QA and tests
   - Add integration checks that run `convert`+`xliffchecker` for a tiny sample (`Test.docx`) on macOS, Windows, Linux. In CI, fetch the correct `resources/openxliff/<platform>` snapshot for each runner.
   - Verify Windows `.cmd` line endings and quoting; normalize in `scripts/fetch-openxliff.sh` if necessary.
   - Validate that paths with spaces are handled (arguments are already passed as separate array elements via `Command.sidecar`).

7) Documentation and recovery UX
   - Update `README.md` and `OpenXLIFF-Plan.md` to document: building/fetching OpenXLIFF, platform folder names, wrapper lookup strategy, and troubleshooting missing resources.
   - Add a “Reinstall Components” action in settings that triggers a small orchestrator to refresh resources (runs `fetch-openxliff.sh` + `sync-openxliff-resources.sh` or downloads CI artifacts), then prompts to restart.

Acceptance criteria
- A new project with a DOCX import triggers conversions that succeed on supported platforms with resources present.
- When resources are missing, the UI shows a clear error (e.g., “OpenXLIFF components are missing; reinstall or run scripts/fetch-openxliff.sh”), and the same message is stored in `project_file_conversions.error_message`.
- Deleting a project file removes its conversions (with foreign keys enforced) and no orphan tasks run.
- CI verifies convert+validate on macOS, Windows, and Linux.

## Prerequisites
- Ensure sidecars are present (scripts under `src-tauri/sidecars/openxliff`) and capabilities allow `convert`, `merge`, `xliffchecker` (already configured in `src-tauri/capabilities/default.json`).
- SQLite is already integrated with migrations and `DbManager`.


## Data Model: Migrations (Single‑scope steps)
1) Add default languages to projects
   - Create migration `006_add_project_languages.sql`:
     - `ALTER TABLE projects ADD COLUMN default_src_lang TEXT;`
     - `ALTER TABLE projects ADD COLUMN default_tgt_lang TEXT;`
     - Backfill existing rows with sensible defaults (`'en'`/`'it'` or `NULL`).
     - Optional index: `CREATE INDEX IF NOT EXISTS idx_projects_default_lang ON projects(default_src_lang, default_tgt_lang);`

2) Create project file conversions table
   - Create migration `007_create_project_file_conversions.sql` with:
     - `id TEXT PRIMARY KEY`
     - `project_file_id TEXT NOT NULL REFERENCES project_files(id) ON DELETE CASCADE`
     - `src_lang TEXT NOT NULL`
     - `tgt_lang TEXT NOT NULL`
     - `version TEXT NOT NULL DEFAULT '2.1'` (values: '2.0' | '2.1' | '2.2')
     - `paragraph INTEGER NOT NULL DEFAULT 1` (bool)
     - `embed INTEGER NOT NULL DEFAULT 1` (bool)
     - `xliff_rel_path TEXT` (relative to project root)
     - `status TEXT NOT NULL DEFAULT 'pending'` (enum: pending | running | completed | failed)
     - `started_at TEXT`, `completed_at TEXT`, `failed_at TEXT`
     - `error_message TEXT`
     - Unique constraint to avoid duplicates per file/language/version: `UNIQUE(project_file_id, src_lang, tgt_lang, version)`
     - Indexes on `(status)`, `(project_file_id)`


## Backend: Rust types + DbManager (Single‑scope steps)
3) Add new structs and DTO bridges
   - In `src-tauri/src/db/mod.rs`:
     - Add `ProjectFileConversionStatus` enum with `as_str()`/`from_str()` for: pending, running, completed, failed.
     - Add `NewProjectFileConversion { id, project_file_id, src_lang, tgt_lang, version, paragraph, embed, xliff_rel_path: Option<String>, status }`.
     - Add `ProjectFileDetails { id, original_name, stored_rel_path, ext, size_bytes, import_status }`.
     - Add `ProjectDetails { id, name, slug, default_src_lang, default_tgt_lang, root_path, files: Vec<ProjectFileWithConversions> }` where `ProjectFileWithConversions { file: ProjectFileDetails, conversions: Vec<ProjectFileConversionRow> }`.

4) DbManager: conversions CRUD + project details
   - Implement `insert_project_file_conversions(&self, rows: &[NewProjectFileConversion], tx: &mut Transaction)`
   - Implement `upsert_conversion_status(&self, conversion_id, status, xliff_rel_path: Option<String>, error_message: Option<String>, timestamps...)`
   - Implement `find_or_create_conversion_for_file(&self, project_file_id, {src,tgt,version,paragraph,embed}) -> ProjectFileConversionRow`
   - Implement `list_project_details(&self, project_id: Uuid) -> DbResult<ProjectDetails>` joining `projects`, `project_files`, `project_file_conversions`.
   - Implement `add_files_to_project(&self, project_id: Uuid, new_files: &[NewProjectFile])` (reuse copy logic from `create_project_with_files`) and return inserted file rows.
   - Implement `remove_project_file(&self, project_id: Uuid, project_file_id: Uuid)`: delete row(s) and cascade conversions; return affected rows.
   - Implement `list_pending_conversions(&self, project_id: Uuid, src_lang: &str, tgt_lang: &str) -> Vec<ProjectFileConversionRow>` that identifies missing/failed conversions for doc-like inputs.
   - Implement helpers: `project_root_path(&self, project_id) -> PathBuf` and `ensure_subdir(root, "xliff")`.


## Backend: IPC commands (Single‑scope steps)
5) DTOs for IPC
   - In `src-tauri/src/ipc/dto.rs`, add:
     - `ProjectFileDto`, `ProjectFileConversionDto`, `ProjectDetailsDto`, `EnsureConversionsPlanDto` (below), `AddFilesResponseDto`.
   - Map from DB rows (stringly typed) and enforce UUID parsing; convert enums to strings.

6) Add ‘project’ commands in `src-tauri/src/ipc/commands.rs`
   - `get_project_details(project_id: Uuid) -> IpcResult<ProjectDetailsDto>`
   - `add_files_to_project(app, settings, db, project_id: Uuid, files: Vec<String>) -> IpcResult<AddFilesResponseDto>`
     - Copy + insert using existing `create_project_with_files` logic (dedupe names, copy to project dir, insert rows, return inserted summaries).
   - `remove_project_file(db, project_id: Uuid, project_file_id: Uuid) -> IpcResult<u64>`
     - Remove DB rows; also delete physical file(s) (original and generated xliff if present) from project folder; return removed count.
   - `ensure_project_conversions_plan(db, project_id: Uuid) -> IpcResult<EnsureConversionsPlanDto>`
     - Compute list of files needing conversion based on project default languages and current conversions:
       - For each `project_file` with extensions in `[doc,docx,ppt,pptx,xlsx,odt,...]` and without a completed conversion row matching `(src_lang=project.default_src_lang, tgt_lang=project.default_tgt_lang, version='2.1')`, return a task item `{ conversion_id, project_file_id, abs_input_path, abs_output_xliff_path, src_lang, tgt_lang, version: '2.1', paragraph: true, embed: true }`.
       - For files already in XLIFF (`.xlf`, `.xliff`, `.mqxliff`, `.sdlxliff`): mark as `skipped` (no conversion needed) but allow a validation task if desired.
     - Ensure the `xliff` subfolder exists under the project root, and build `output_xliff_path = <root>/xliff/<stem>.<src>-<tgt>.xlf`.
   - Optional: `mark_conversion_running/mark_conversion_completed/mark_conversion_failed` commands if JS needs granular updates (alternatively expose a single `update_conversion_status`).

7) Capabilities review
   - Existing `shell:allow-spawn`/`shell:allow-execute` already whitelists sidecars and arguments; no change required.
   - No additional FS plugin permissions required (filesystem is handled in backend via `tokio::fs`).


## Frontend: Wizard language selectors (Single‑scope steps)
8) Extend types for project creation
   - In `src/components/projects/wizard/types.ts`:
     - Add `srcLang: string`, `tgtLang: string` to `NewProjectForm` and `INITIAL_PROJECT_FORM`.
   - In `src/components/projects/wizard/state/useProjectWizard.ts`:
     - Include `srcLang`, `tgtLang` in the payload sent to `createProject`.
   - In `src/ipc/types.ts`:
     - Extend `CreateProjectRequest` with `defaultSrcLang: string; defaultTgtLang: string;` and `CreateProjectResponse` unchanged.
     - Update Rust DTO to accept/store these fields.

9) UI for language selectors
   - In `ProjectDetailsStep.tsx` add two controls:
     - `Source language` (ShadCN `Input` or `Select`): default `en-US`. Validate with `isWellFormedBcp47` and inline error.
     - `Target language` (ShadCN `Input` or `Select`): default `it-IT`. Validate similarly and ensure different from source.
   - Keep minimal curated options with a searchable `Select` (ShadCN) and allow free-text fallback via `Input` if needed later.

10) Update wizard validation
   - In `validation.ts` (wizard utils):
     - Require non-empty `srcLang` and `tgtLang`, both well-formed by BCP‑47 regex (`src/lib/validators.ts`).
     - Enforce `srcLang.toLowerCase() !== tgtLang.toLowerCase()`.


## Frontend: IPC surface (Single‑scope steps)
11) Add new IPC functions in `src/ipc/client.ts`
   - `getProjectDetails(projectId: string): Promise<ProjectDetails>`
   - `addFilesToProject(projectId: string, files: string[]): Promise<AddFilesResponse>`
   - `removeProjectFile(projectId: string, projectFileId: string): Promise<number>`
   - `ensureProjectConversionsPlan(projectId: string): Promise<EnsureConversionsPlan>`
   - `updateConversionStatus(conversionId: string, status: 'running'|'completed'|'failed', payload?)`


## Frontend: Project page (Single‑scope steps)
12) Replace placeholder with real page
   - Create `src/components/projects/overview/ProjectOverview.tsx`:
     - Props: `{ projectId: string }` or `{ project: ProjectListItem }`.
     - On mount: call `getProjectDetails(projectId)`; display project name, slug, default languages.
     - Render files table: name, ext, size, import status, available conversions (badge per `(src,tgt,version)`), and actions.

13) Add/Remove file actions
   - “Add files” button:
     - Use `@tauri-apps/plugin-dialog.open({ multiple: true, filters: ALLOWED_EXTENSIONS })`.
     - Call `addFilesToProject(projectId, selectedPaths)`; refresh table.
   - Per-row “Remove” button:
     - Confirm (ShadCN Dialog). Invoke `removeProjectFile(projectId, fileId)`; refresh table.

14) Auto-conversion on open
   - On initial load (after details fetched): call `ensureProjectConversionsPlan(projectId)`.
   - If response includes tasks, open a modal (`EnsureArtifactsModal`) with a progress bar and log area.
   - For each task (sequentially):
     - Call `updateConversionStatus(conversionId, 'running')`.
     - Invoke `convertStream({ file: abs_input_path, srcLang, tgtLang, xliff: abs_output_xliff_path, version: '2.1', paragraph: true, embed: true }, { onStdout, onStderr })`.
     - If success, run `validateStream({ xliff: abs_output_xliff_path })`.
       - If validation fails, mark as failed with message.
     - Call `updateConversionStatus(conversionId, 'completed', { xliff_rel_path: relative_path })` on success; otherwise `'failed'` with `error_message`.
   - Close modal when queue completes; refresh project details.

15) Display statuses
   - Use ShadCN `Badge` for file and conversion statuses: imported, pending, running, completed, failed.
   - Show “Retry conversion” action on failed items.


## Paths & Conventions (Single‑scope steps)
16) XLIFF output path
   - Ensure `<project.root_path>/xliff/` exists.
   - Output filename: `<stem>.<src>-<tgt>.xlf` (e.g., `Report.en-US-it-IT.xlf`), stored as `xliff_rel_path` relative to project root.

17) Supported inputs
   - Convert only for non-XLIFF formats: `doc, docx, ppt, pptx, xls, xlsx, odt, odp, ods, html, xml, dita, md` (adjust per sidecar support).
   - For `.xlf/.xliff/.mqxliff/.sdlxliff`: treat as already-converted; optionally run validation only.


## Error handling & UX (Single‑scope steps)
18) Loader & logs
   - “Preparing project…” modal shows a progress bar and a collapsible log view fed by `convertStream`/`validateStream` line handlers.

19) Resilience
   - If a conversion fails, do not block opening the project; show partial results and a banner summarizing failures.
   - Store `error_message` in DB for later review.

20) Cancellation
   - Provide a “Cancel” button to stop the conversion queue (skip remaining tasks); already completed items remain persisted.


## Validation & Testing (Single‑scope steps)
21) Unit tests (Rust)
   - Db: insert/list conversions; unique constraint per file/lang/version; status transitions.
   - IPC: `ensure_project_conversions_plan` creates tasks only for missing/failed conversions.

22) Unit tests (TS)
   - Wizard validation for BCP‑47 and distinct languages.
   - Project page: renders file rows and badges; add/remove handlers call IPC.

23) Manual verification checklist
   - Create a project with `en-US` → `it-IT`, add `.docx` and `.xlf`.
   - Open project: see auto-conversion start for `.docx`; `.xlf` bypassed; XLIFF validates; statuses update to completed.
   - Remove a file: entry and artifacts disappear; DB reflects removal.


## Rollout & Backward compatibility (Single‑scope steps)
24) Migration order
   - Add migrations 006, 007; verify on a fresh DB and an existing DB.

25) Feature flags (optional)
   - Behind a boolean in app settings: “Auto-convert on open”. Default enabled.

26) Docs
   - Update `docs/ProjectCreation.md` with new wizard fields and screenshots.
   - Add `docs/ProjectSpecificPagePlan.md` (this file) to track implementation.


## Implementation Notes
- Keep conversions single-threaded initially for stability; batch/sequential progress UI is simpler and safer for sidecars.
- Use existing `src/lib/openxliff.ts` streaming helpers for robust stdout/stderr capture and normalized errors.
- Persist only relative paths in DB; compute absolute with `project.root_path` on demand.
- Enforce BCP‑47 well-formedness with `src/lib/validators.ts`; do not over-constrain (accept well-formed tags, not only ISO pairs).
