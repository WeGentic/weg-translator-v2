# Architecture Overview (2025-03 refactor)

## Folder structure

- `src/app/` – Application shell and global providers. `providers/` wraps the tree with `LogProvider`, `AppErrorBoundary`, the Supabase-backed `AuthProvider`, and the ShadCN `ToastProvider`. `shell/` hosts `MainLayout` primitives (layout store, controller, backgrounds, sidebars, footer, screen guard) plus co-located layout CSS under `shared/styles/layout/`. `hooks/` and `state/` expose app-level helpers such as `useAppHealth` and the main-view key utilities.
- `src/core/` – Infrastructure services. `config/` surfaces feature flags and Supabase clients, `ipc/` consolidates typed Tauri command wrappers (`client.ts`, `events.ts`, `openxliff.ts`, `jliff/*`), and `logging/` bridges frontend logs to `tauri-plugin-log`.
- `src/modules/` – Domain feature packages (auth, dashboard, editor, history, projects, resources, settings, workspace). Each module co-locates `routes/`, `view/`, `ui/`, `state/`, `data/`, `actions/`, and `__tests__/` directories as needed, replacing the legacy `src/features` tree.
- `src/shared/` – Cross-cutting primitives: ShadCN v3.3.1 components under `ui/`, reusable hooks, guards (e.g., `ResolutionGuard`), tokenized styles (`styles/theme.css`, `styles/layout/*`), icons, logging helpers, and general utilities.
- `src/router/` – TanStack Router entrypoints. Generated `routeTree.gen.ts` is re-exported alongside file-based routes (e.g., `routes/__root.tsx`, `routes/dashboard/index.tsx`, `routes/login.tsx`) that delegate to module barrels.
- `src/test/` – Vitest setup (`setup/index.ts`), shared providers (`utils/providers.tsx`), and testing utilities. Domain suites now live beside their modules inside `__tests__/` folders.
- `src-tauri/` – Rust backend containing `db/` (sqlx managers, operations, builders), `ipc/` (commands split into `projects/`, `translations.rs`, `settings.rs`, `shared.rs`, plus DTO/state), `jliff/` converters, and `settings/` (YAML manager). `lib.rs` wires plugins, managed state, and IPC handlers; `main.rs` defers to the library entrypoint.
- `packages/` – Reusable layout packages consumed by the desktop shell (`layout-projects-host`, `layout-three-zone`).
- `scripts/` – Workspace automation and OpenXLIFF helper scripts.
- `docs/` – Architecture notes, migration logs, reviewer guidance (this overview accompanies the refactor journals).
- Legacy directories `src/features`, `src/components`, and `src/lib` have been fully retired; see `docs/domain-refactor-journal.md` for migration history.

### Frontend (React 19.1 + TypeScript)

- **Routing**: `src/main.tsx` builds a TanStack Router v1.132+ instance from `src/router/routeTree.gen.ts`, injects auth context, and renders it inside `<RouterProvider>`. `ScreenGuard` (`src/app/shell/screen-guard.ts`) blocks viewports smaller than 768×600 to protect the desktop layout.
- **App providers & auth**: `src/app/providers/index.tsx` layers `LogProvider`, `AppErrorBoundary`, the Supabase `AuthProvider`, and the ShadCN `ToastProvider`. Supabase clients are instantiated in `src/core/config/supabaseClient.ts` with strict env var checks. `src/core/logging/LogProvider.tsx` streams backend logs into React state via `tauri-plugin-log`, while `logger.ts` forwards frontend events to the same plugin.
- **Layout shell**: `src/app/shell/MainLayout.tsx` exposes an object-style API (`MainLayout.Root`, `.SidebarOne`, `.SidebarTwo`, `.Main`, `.Footer`, `.Background`, `.Controller`). Layout configuration and slot state live in a vanilla Zustand store (`layout-store.ts`, `layout-context.tsx`) so hooks like `useLayoutSelector` stay compiler-friendly. Background treatments and footer/sidebar elements reside under `shell/backgrounds` and `shell/main_elements`, with grid rules in `src/shared/styles/layout/*`.
- **Workspace orchestration**: `src/modules/workspace/WorkspacePage.tsx` composes the shell, coordinates navigation via `useWorkspaceShell` (`workspace/state/useWorkspaceShell.ts`), listens for global `app:navigate` events (`workspace/hooks/useGlobalNavigationEvents.ts`), and wires module views (`projects`, `dashboard`, `resources`, `settings`, `editor`). Layout defaults are applied through `MainLayout.Root` config objects.
- **Projects (Project Manager v2)**: `src/modules/projects` now owns the refactored manager. Table state helpers (`state/types.ts`, `state/filterProjects.ts`, `state/useSidebarTwoContentSync.tsx`) synchronize selections with the secondary sidebar via the layout store. Data fetching and cache invalidation live in `data/projectsResource.ts`, preparing for Suspense integration. UI slices split across `ProjectManagerHeader`, `ProjectManagerToolbar`, `ProjectManagerContent`, and `ui/table/*` components powered by TanStack Table; IPC calls rely on the typed wrappers in `@/core/ipc`.
- **Other modules**: `src/modules/dashboard` and `src/modules/resources` expose route components through `view/` folders; `src/modules/editor` provides the `EditorPanel` scaffold used when projects open files; `src/modules/settings` renders the enhanced settings surface; `src/modules/auth` supplies the login route and form. Each module exports a barrel (`index.ts`) for routes and shared UI.
- **State management**: React 19 compiler support allows hooks to stay simple—`useWorkspaceShell` and the layout store rely on vanilla Zustand, resource caches expose subscription APIs, and filters/selectors are pure utilities. Auth context supports Suspense-ready consumption, and feature flags (`src/core/config/feature-flags.ts`) gate domain toggles like `projectManagerV2`.
- **UI & styling**: TailwindCSS 4.1.1 loads through `src/App.css`, which imports theme/motion layers and declares `@source` directives for `./src/modules` and `./src/shared`. `src/shared/styles/theme.css` centralizes WeGentic palette tokens and semantic variables for both light/dark themes. ShadCN primitives live in `src/shared/ui` with generator aliases defined in `components.json`. Layout-specific CSS formerly under `src/app/layout/*` now resides in `src/app/shell` and `src/shared/styles/layout`.
- **Testing**: `src/test/setup/index.ts` registers Testing Library, matchMedia shims, and re-exports shared providers. `renderWithRouter` (`src/test/utils/providers.tsx`) spins up a TanStack router backed by memory history and mocked auth state. Modules co-locate their suites under `__tests__/`, keeping expectations near implementations.

### Backend (Rust + Tauri 2.8.5)

- **Entry point**: `src-tauri/src/lib.rs` configures `tauri_plugin_log`, `tauri_plugin_opener`, `tauri_plugin_dialog`, and `tauri_plugin_shell`, ensures config/app directories exist, initializes `SettingsManager`, `DbManager`, and the in-memory `TranslationState`, and registers all IPC handlers. `src-tauri/src/main.rs` simply calls `weg_translator_lib::run()`.
- **Database layer**: `src-tauri/src/db/manager.rs` applies embedded migrations (`src-tauri/migrations/*.sql`) and exposes connection pools. Domain-specific operations live under `db/operations/` (projects, project_files, conversions, translation_jobs), with `builders.rs`, `constants.rs`, and `utils.rs` keeping queries type-safe through `sqlx`.
- **IPC commands**: `src-tauri/src/ipc/commands/` groups handlers per domain. Projects functionality is split across `commands.rs`, `service.rs`, `artifacts.rs`, `file_operations.rs`, `validation.rs`, and `dto_mappers.rs`; translations, settings, and shared utilities have dedicated modules. DTOs and the runtime job tracker live in `ipc/dto.rs` and `ipc/state.rs`, respectively.
- **Settings**: `src-tauri/src/settings/mod.rs` manages YAML persistence, providing atomic setters for the app folder, auto-convert flag, theming, language defaults, notifications, and conversion concurrency caps.
- **JLIFF converter**: `src-tauri/src/jliff/` handles parsing, normalization, and schema validation for XLIFF → JLIFF conversions invoked by the OpenXLIFF sidecar.
- **Tests**: Integration suites under `src-tauri/tests/` (`db_integration.rs`, `ipc_artifacts.rs`, `project_conversions.rs`) use temp dirs and in-memory sqlite to validate migrations, IPC flows, and artifact handling.

### OpenXLIFF sidecars

- Executable shims live in `src-tauri/sidecars/openxliff/bin` (`.sh` for macOS/Linux, `.cmd` for Windows).
- Bundled resources reside in `src-tauri/resources/openxliff/<platform>/` alongside the trimmed JRE.
- `scripts/fetch-openxliff.sh`, `scripts/sync-openxliff-resources.sh`, and `scripts/normalize-openxliff-resources.sh` manage fetching, staging, and symlink normalization.
- Security constraints remain enforced via `src-tauri/capabilities/default.json`, which whitelists flags and validates arguments.

## Key patterns

### IPC command flow

Frontend modules call typed wrappers from `@/core/ipc/client.ts`, which normalize errors through `safeInvoke` before invoking Tauri commands. DTOs live in `src/core/ipc/types.ts`, and consumers avoid raw `invoke` usage to keep logging/error handling centralized.

### Layout & navigation orchestration

`MainLayout` components share a vanilla Zustand store so selectors (`useLayoutSelector`, `useLayoutStoreApi`) stay stable for the React Compiler. `useSidebarTwoContentSync` updates the secondary sidebar based on project selections, while global navigation relies on custom `app:navigate` events dispatched from the root route and handled by `useGlobalNavigationEvents`.

### Project file locking

Rust-side project file reads/writes run through `with_project_file_lock()` (`src-tauri/src/ipc/commands/projects/utils.rs`), which wraps operations with advisory `flock` locks on Unix platforms to prevent concurrent modifications.

### XLIFF to JLIFF conversion

Project creation triggers OpenXLIFF conversions via the sidecar (`ensure_project_conversions_plan`), with results piped into the Rust converter (`src-tauri/src/jliff`). Artifacts are stored under `<app-folder>/projects/<uuid>/artifacts/*.jliff` and exposed through `read_project_artifact`.

### React 19.1 features

React Compiler support lets components rely on direct function definitions (e.g., `"use no memo"` directives in table renderers) while Zustand stores and selector utilities replace manual `useMemo`/`useCallback`. Hooks such as `useLayoutSelector` and `useWorkspaceShell` keep render bodies side-effect free, and server-composable providers (`LogProvider`, `AuthProvider`) use the `use` API for context consumption.

## SQLite schema

```sql
-- projects: top-level translation projects
CREATE TABLE IF NOT EXISTS projects (...);

-- project_files: source files within a project (original + generated artifacts)
CREATE TABLE IF NOT EXISTS project_files (...);

-- translation_jobs: historical record of translation runs
CREATE TABLE IF NOT EXISTS translation_jobs (...);

-- translation_outputs: translated segments for each job
CREATE TABLE IF NOT EXISTS translation_outputs (...);
```

Migrations ship under `src-tauri/migrations/*.sql` and are applied during `DbManager::new_with_base_dir`.

## Testing notes

- **Frontend**: Use `renderWithRouter` (`@/test/utils/providers`) to mount components with TanStack Router and mocked auth context. Tests should import UI primitives from `@/shared/ui` and domain exports from module barrels; colocate domain suites in `__tests__/`.
- **Rust**: Prefer in-memory sqlite (`sqlite::memory:`) and `tempfile::tempdir()` for filesystem tests. Integration suites under `src-tauri/tests/` validate migrations, IPC flows, and artifact lifecycles.

## Troubleshooting

- **"Unknown file format" (OpenXLIFF)** – Ensure the `-type` flag matches the document (e.g., `-type OFF` for Office files) before invoking sidecars.
- **macOS “Permission denied” during build** – Run `scripts/normalize-openxliff-resources.sh` to rewrite symlinks within the packaged JRE.
- **Tauri IPC errors** – Inspect JSON-formatted logs streamed through `LogProvider` (frontend) or the console/stdout output from `tauri-plugin-log`.
- **Supabase auth failures** – Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present; the client factory throws eagerly if either is missing.

## Security considerations

- Sidecar argument validation remains in `src-tauri/capabilities/default.json`; update allowlists before introducing new flags.
- File-system access uses normalized paths via the `path_exists` IPC command to prevent directory traversal.
- Database layer relies on `sqlx` macros for compile-time query checking—avoid raw SQL strings.
- Supabase credentials are stored in environment variables; the auth provider persists sessions via the configured storage key (`weg-translator-auth`).

## CI/CD

`.github/workflows/ci.yml` builds macOS and Windows bundles by caching `vendor/openxliff/dist-*`, running the OpenXLIFF sync scripts, executing `npm run build`, and invoking `npm run tauri build -- --debug`. Artifacts are uploaded from `src-tauri/target/**/bundle/`. Notarization (macOS) and Windows code-signing remain future tasks (see `Plan.md`).

## Important conventions

- Prefer module barrels and aliases (`@/app`, `@/core`, `@/modules`, `@/shared`, `@/test`) over deep relative paths.
- Keep UI work within ShadCN/Tailwind primitives; additions should respect palette tokens defined in `src/shared/styles/theme.css`.
- New code should align with React 19 compiler guidance (see `docs/react19-guidelines.md`), avoiding manual memoization unless profiling proves necessary.
- Avoid recreating legacy folders (`src/features`, `src/components`); all new features belong under `src/modules`, shared primitives under `src/shared`, and infrastructure under `src/core`.
- Error surfaces should lean on `IpcError::message` for user feedback and funnel structured logs through `logger.error`.
