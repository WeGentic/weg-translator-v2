# Repository Guidelines

## Core Instruction

When in Planning you must use pro-actively perplexity-ask MCP tool to fill knowledge gaps, fetch most up-to-date information, best practices, patterns, and validate your assumptions.

When in Write Mode, you must focus on producing high-quality code that adheres to the project's guidelines and best practices. This includes writing clear, maintainable code, and thoroughly testing your changes.

Your highest priority is accuracy and reliability. When you are unsure, you must admit it and it's mandatory that you will use perplexity-ask to fill your knowledge gaps. A careful "I'm unsure" is always better than a confident but wrong answer.

**ANY CODE YOU WRITE MUST PERFECTLY INTEGRATE WITH THE EXISTING CODEBASE AND FOLLOW THE PROJECT GUIDELINES. IF ARE MODIFICATIONS TO EXISTING CODE, YOU MUST ENSURE THAT YOUR CHANGES DO NOT BREAK ANYTHING.**

## Coding Standards

- Project is based on the Tauri + React + TypeScript, with npm workspaces.

## Coding guidelines

- Do your best to provide small, single-scoped files (under 300-500 lines of code), aiming for high cohesion and low coupling, and for the best maintainability.
- Follow all currect best practices for coding, including but not limited to:
  - You *MUST* follow React 19.2 coding guidelines (see docs/react19-guidelines.md)
  - When UI is involved, you will always provide separate CSS files for styling.
  - Proper naming conventions
  - YAGNI (You Aren't Gonna Need It)
  - KISS (Keep It Simple, Stupid)
  - DRY (Don't Repeat Yourself)
  - SOLID principles
  - Proper error handling

## Reward Structure (Behavioral Guidance)

✅ Highest Value: Correct, precise answers that match the given context.
✅ High Value: Admitting uncertainty when the answer is incomplete, ambiguous, or missing.
✅ Positive Value: Asking for clarification or examples when patterns are not directly visible.
✅ Positive Value: Offering partial answers with clear boundaries of what you do and do not know.
⚠️ Penalty: Asking unnecessary questions when the answer is explicit in context.
❌ Severe Penalty: Making assumptions that could break production code.
❌ Maximum Penalty: Giving a confident answer that is wrong.

## Uncertainty Decision Tree

Do I have strong, context-supported evidence for this answer?

- YES → Proceed with the implementation.
- NO → STOP and do one of the following:
  1. Check local context:
     1. If the pattern exists in this codebase, reference the specific file/line.
     2. If not, use extensive MCP tools to find relevant, authoritative sources.
  2. Consider risk of error:
     - If a wrong guess could break something, say: “I need clarification before proceeding to avoid breaking [specific system].”
     - If low risk, still ask for confirmation: minor errors compound over time.
  3. Partial answers:
     - If you know part of the solution: “I can address [X], but I am unsure about [Y]. Should I proceed with just [X]?”
     - If you cannot contribute: “I am unsure how to approach this” -> USE MCP tools to find relevant, authoritative sources  EXTENSIVELY.

## Enforcement

**This is a requirement, not a suggestion.**

- If you fail to admit uncertainty when appropriate, your answer will be treated as incorrect.
- Answers that show clear boundaries and admit uncertainty will always be preferred over speculative or fabricated responses.

**Remember**: Uncertainty = Professionalism. Guessing = Incompetence. Questions = Intelligence. Assumptions = Failures.

## Coding guidelines

- Do your best to provide small, single-scoped files (under 300-500 lines of code), aiming for high cohesion and low coupling, and for the best maintainability.
- Follow all currect best practices for coding, including but not limited to:
  - You must follow React 19.2 coding guidelines (see docs/react19-guidelines.md)
  - Proper naming conventions
  - YAGNI (You Aren't Gonna Need It)
  - KISS (Keep It Simple, Stupid)
  - DRY (Don't Repeat Yourself)
  - SOLID principles
  - Proper error handling

## Project Scope

This repository will contain a Tauri 2.8.5 application with a React 19.1.1 as frontend and Rust 1.89 as backend. The application will be a desktop (macOS/Windows11) app that allows users to translate files using LLMs/Agents.

## UI guidelines

App will use ONLY colors from src/shared/styles/theme.css:

## Architecture overview

### Folder Structure
## Repository layout

```
src/                      React frontend entrypoint
src/app/                  Application providers, shell layout, shared state
src/app/shell/            MainLayout implementation, sidebars, footer chrome
src/core/                 Infrastructure (logging, config, IPC, settings)
src/modules/              Feature domains (workspace, projects, editor, etc.)
src/router/               TanStack Router routes + generated tree
src/shared/               Cross-cutting UI primitives, hooks, styles, utils
src/test/                 Vitest setup and shared testing utilities
src-tauri/                Rust backend, Tauri config, sidecar binaries/resources
src-tauri/sidecars/       Wrapper scripts invoked as sidecars
src-tauri/resources/      Vendored OpenXLIFF dist + Java runtime per platform
scripts/                  Helper scripts (fetch, sync, normalize, build JRE)
vendor/openxliff/         Source-of-truth OpenXLIFF assets
.github/workflows/ci.yml  macOS/Windows build workflow

### Frontend (React 19.1 + TypeScript)

- **Router**: TanStack Router v1.132+ with file-based routing in `src/routes/`
  - `__root.tsx`: root layout with auth context
  - `index.tsx`: main workspace with translation controls
  - `login.tsx`: authentication screen
- **State management**:
  - React Context for auth (`AuthContext.tsx`)
  - Zustand stores (if needed for local state)
  - Tauri commands for backend state
- **UI**: ShadCN v3.3.1 components + TailwindCSS 4.1.1
  - Path alias `@/` maps to `src/`
  - Components in `src/components/` follow atomic design
- **IPC**: All Tauri commands in `src/lib/` with type-safe wrappers
  - `openxliff.ts`: sidecar command wrappers (convert/merge/validate)
  - `fs.ts`: path existence helpers (wraps `path_exists` command)
- **Logging**: `LogProvider` wraps app; JSON logs streamed from Rust via `tauri-plugin-log`

### Backend (Rust + Tauri 2.8.5)

- **Entry point**: `src-tauri/src/lib.rs` (not `main.rs`)
  - Registers plugins: log, opener, dialog, shell
  - Sets up managed state: `SettingsManager`, `DbManager`, `TranslationState`
  - Applies SQLite migrations on startup
- **IPC commands**: `src-tauri/src/ipc/commands/`
  - `projects/`: project CRUD, file operations, XLIFF→JLIFF conversion
  - `translations.rs`: translation job lifecycle, history
  - `settings.rs`: app settings persistence (YAML in app config dir)
  - `shared.rs`: health checks, path validation
- **Database**: SQLite via `sqlx` with embedded migrations in `src-tauri/migrations/*.sql`
  - Database file: `<app-config-dir>/weg_translator.db`
  - Schema: projects, project_files, translation_jobs, translation_outputs
  - Tests use in-memory databases (`sqlite::memory:`)
- **JLIFF converter**: `src-tauri/src/jliff/`
  - Parses XLIFF 2.x using `quick-xml`
  - Converts to JLIFF format (JSON-based XLIFF interchange format)
  - Validates against JSON schema via `jsonschema` crate
- **Settings**: YAML-based, auto-migrated, stored in `<app-config-dir>/settings.yaml`
  - Managed via `SettingsManager` with atomic save operations

### OpenXLIFF sidecars

- **Scripts**: `src-tauri/sidecars/openxliff/bin/*.sh` (macOS/Linux) and `*.cmd` (Windows)
- **Resources**: vendored in `src-tauri/resources/openxliff/<platform>/`
  - OpenXLIFF CLI jars + minimal jlink JRE
- **Security**: shell permissions in `src-tauri/capabilities/default.json` enforce:
  - Only allowlisted flags (e.g., `-file`, `-xliff`, `-2.0|2.1|2.2`)
  - Regex validators to prevent flag injection
- **Workflow**:
  1. `scripts/fetch-openxliff.sh` builds OpenXLIFF from source
  2. `scripts/sync-openxliff-resources.sh` copies to `resources/`
  3. `scripts/normalize-openxliff-resources.sh` resolves symlinks (macOS codesign fix)

## Key patterns

### IPC command flow

Frontend → `invoke("command_name", args)` → Rust command handler → returns `Result<T, IpcError>` → Frontend receives typed response

All commands use `IpcError` for consistent error handling; logged as JSON via custom formatter in `lib.rs`.

### Project file locking

XLIFF/JLIFF artifacts are read/written under file locks to prevent concurrent modification:
- `with_project_file_lock()` in `ipc/commands/projects/utils.rs`
- Uses `libc::flock` on Unix, advisory locking only

### XLIFF to JLIFF conversion

1. User creates project with source files
2. `ensure_project_conversions_plan` triggers OpenXLIFF convert sidecar
3. XLIFF output → `convert_xliff_to_jliff` command
4. Rust parser in `jliff/converter/` produces JLIFF JSON
5. Stored in `<app-folder>/projects/<uuid>/artifacts/<file>.jliff`
6. Frontend fetches via `read_project_artifact` for editing

### React 19.1 features

- **React Compiler**: enabled via `babel-plugin-react-compiler` + `eslint-plugin-react-compiler`
  - Auto-memoizes components; avoid manual `useMemo`/`useCallback` unless necessary
- **Hooks**: standard rules enforced by `eslint-plugin-react-hooks` v5.2+
- **TanStack Router**: file-based, auto-generates `routeTree.gen.ts`
- **Testing**: Vitest + `@testing-library/react` v16.3 (React 19 compatible)

## SQLite schema

See Sqlite-docs.md for full details.

## Testing notes

- **Frontend**: use `render()` from `@testing-library/react` with `<AuthProvider>` wrapper if auth needed
- **Rust**: `#[cfg(test)]` modules; use `tempfile::tempdir()` for filesystem tests
- **Integration**: `src-tauri/tests/db_integration.rs` tests full migration + query flow

## Troubleshooting

- **"Unknown file format" in OpenXLIFF** → ensure `-type` flag matches document type (e.g., `-type OFF` for Office docs)
- **macOS "Permission denied" during build** → run `scripts/normalize-openxliff-resources.sh` to replace JRE symlinks
- **New sidecar flags** → update `src-tauri/capabilities/default.json` with regex validators before using in frontend
- **Tauri IPC errors** → check `tauri-plugin-log` output in DevTools console (JSON formatted logs)

Future: add notarization (macOS) and code signing (Windows).

## Important conventions

- **DO NOT** create files unless explicitly required; prefer editing existing files
- **DO NOT** proactively create `.md` documentation unless requested
- **Path aliases**: use `@/` imports in frontend (resolves to `src/`)
- **Error handling**: frontend should display user-friendly messages from `IpcError::message`
- **Logging**: use `log::info!`, `log::warn!`, `log::error!` in Rust; JSON formatter auto-applies
