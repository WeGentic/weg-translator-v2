# Weg Translator Desktop

Tauri 2.8.5 desktop application with a **React 19.1** frontend and **Rust 1.89** backend that wraps the OpenXLIFF command-line tools as sidecars. The app ships a minimal Java 21 runtime, exposes convert/merge/validate flows in the UI, and showcases secured IPC between React and Tauri.

## Highlights

- Project is based on the Tauri + React + TypeScript + TailwindCSS, with npm workspaces.
- React UI (ShadCN v3.3.1 + TailwindCSS 4.1.1) with streaming logs, file pickers, and OpenXLIFF controls.
- Tauri sidecars bundle OpenXLIFF CLI scripts (`convert`, `merge`, `xliffchecker`) plus a slimmed Java runtime for offline operation.
- Rust IPC layer exposes translation job simulation, path validation, structured logging, and SQLite-backed job persistence via `tauri-plugin-sql`.
- Capability hardening: shell sidecars limited to an allowlisted flag set; opener/dialog permissions scoped to user actions.
- CI workflow builds macOS/Windows bundles, caches vendored OpenXLIFF dists, and uploads artifacts.

## Release Notes – Domain-First Refactor (2025-03-01)

- Swapped legacy `src/features`/`src/components` tree for domain-aligned modules under `src/modules`, `src/core`, `src/shared`, and `src/app`; update local branches by rebasing before committing new work.
- TypeScript, Vite, ESLint, and ShadCN generators now rely on refreshed aliases (`@/modules`, `@/shared`, `@/core`, `@/app`); run `pnpm format:fix` after rebases to realign imports if conflicts surface.
- Tests and helpers live beside their domains or under `src/test/utils`; ensure new specs follow this layout and use the provided router-aware render utilities.
- ShadCN scaffolding outputs to `src/shared/ui`; re-run `pnpm shadcn:init` after pulling if your local generator cache predates the alias update.
- Follow-up backlog: theme token extraction, OpenXLIFF wizard polish, and workspace layout telemetry capture remain tracked in `docs/domain-refactor-journal.md`.

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
```

## Prerequisites

- Node.js 20+
- Rust toolchain (`rustup`, `cargo`) matching Tauri requirements
- Tauri CLI dependencies (see [Tauri docs](https://v2.tauri.app/start/prerequisites/))
- Java 21 + Gradle if you need to rebuild OpenXLIFF (`scripts/fetch-openxliff.sh`)

## Getting started

```bash
pnpm install
pnpm tauri dev
```

> Prefer `pnpm` for development to stay aligned with the workspace lockfile. If you must
> use npm, run `npm install` and adjust the scripts accordingly.

During development `tauri dev` launches Vite together with the Tauri backend. Logs are streamed to the in-app console (powered by `tauri-plugin-log`).

## Building

Debug build (bundles the macOS `.app` / `.dmg` or Windows `.msi`/`.exe` depending on host):

```bash
pnpm tauri build -- --debug
```

Artifacts land in `src-tauri/target/debug/bundle/…`. Example macOS output:

- `bundle/macos/weg-translator.app`
- `bundle/dmg/weg-translator_0.1.0_aarch64.dmg`

The `Resources/resources/openxliff/<platform>` directory inside the bundle carries the vendored CLI + jlink runtime. Wrapper scripts were validated to resolve this location automatically.

## Testing

Frontend and IPC surface tests rely on Vitest + Testing Library:

```bash
pnpm test            # watch mode
pnpm test:run        # single run (CI friendly)
pnpm test:coverage   # collect coverage via c8
```

Rust integration tests exercise the SQLite persistence layer:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

## SQLite persistence

- Database file lives under the platform-specific app config directory (via
  `BaseDirectory::AppConfig`) as `weg_translator.db`.
- Migrations reside in `src-tauri/migrations/*.sql` and are embedded at build time; the
  `DbManager` helper applies them during setup.
- The SQLite plugin is registered through `src-tauri/src/lib.rs` and gated by the
  `src-tauri/capabilities/sqlite.json` manifest to avoid arbitrary URI access from the frontend.
- In-memory integration tests (`src-tauri/tests/db_integration.rs`) verify migrations, duplicate
  insert handling, status updates, and the clear-history path.

## OpenXLIFF integration

- Vendored assets live under `vendor/openxliff/` (built via `scripts/fetch-openxliff.sh`).
- `scripts/sync-openxliff-resources.sh` mirrors the dist into `src-tauri/resources/openxliff/<platform>`.
- `scripts/normalize-openxliff-resources.sh` replaces JRE symlinks with real files to avoid macOS codesign/EACCES issues.
- Sidecar wrapper scripts (`src-tauri/sidecars/openxliff/bin/*.sh|*.cmd`) resolve the correct resource path in both dev tree and packaged app; macOS-specific copies are emitted with the host triple suffix.
- Shell permissions (`src-tauri/capabilities/default.json`) allow only approved flags (e.g. `-file`, `-srcLang`, `-xliff`, `-2.0|2.1|2.2`).

### CLI quick checks

Run scripts from the dev tree:

```bash
src-tauri/sidecars/openxliff/bin/convert.sh -help
src-tauri/sidecars/openxliff/bin/merge.sh -help
src-tauri/sidecars/openxliff/bin/xliffchecker.sh -help
```

Run from inside the packaged app:

```bash
APP=src-tauri/target/debug/bundle/macos/weg-translator.app/Contents/MacOS
"$APP/convert.sh" -help
```

### Sample conversion

```bash
APP=src-tauri/target/debug/bundle/macos/weg-translator.app/Contents/MacOS/convert.sh
"$APP" \
  -file "$PWD/Test.docx" \
  -srcLang en-US \
  -tgtLang it-IT \
  -xliff "$PWD/Test.en-it.xlf" \
  -type OFF \
  -2.1

# Produces Test.en-it.xlf (~540 KB) using the bundled Java runtime
```

`-type OFF` matches the “Microsoft Office 2007 Document” type reported by `convert.sh -types`.

## Frontend components

- `src/app/providers`: composes logging, auth, toast, and error boundaries for the React tree.
- `src/router/routes/__root.tsx`: root layout wiring `MainLayout`, navigation dispatch, and workspace footer.
- `src/modules/workspace/WorkspacePage.tsx`: orchestrates workspace panels and registers global navigation event listeners.
- `src/modules/projects`: domain surface for project listing, wizard, artifacts overview, and OpenXLIFF tooling.
- `src/modules/projects/ui/tools/OpenXliffPanel.tsx`: convert/validate/merge UI backed by the Tauri sidecars.
- `src/core/ipc/openxliff.ts`: typed wrappers over `@tauri-apps/plugin-shell` for OpenXLIFF commands.
- `src/core/ipc/fs.ts`: path validation helper invoking the Rust `path_exists` command.
- `src/shared/logging/LogConsole.tsx`: live log viewer fed by `LogProvider` streaming events from the backend.

## IPC / backend

- `src-tauri/src/lib.rs`: Tauri builder wiring (`tauri-plugin-log`, `dialog`, `opener`, `shell`), registers commands including `path_exists`.
- `src-tauri/src/ipc/commands.rs`: health checks, job simulation, new file-existence command.
- `src-tauri/src/ipc/state.rs`: in-memory job registry used by the sample translation flow.
- Logs emitted via JSON formatter for ingestion by the in-app console.

## Continuous Integration

`.github/workflows/ci.yml` runs on macOS + Windows:

1. Checkout, setup Node/Rust/Java.
2. Install Gradle (brew/choco).
3. Cache `vendor/openxliff/dist-*` per OS.
4. `./scripts/fetch-openxliff.sh` then `./scripts/sync-openxliff-resources.sh`.
5. `npm ci`, `npm run build`, `npm run tauri build -- --debug`.
6. Upload bundles from `src-tauri/target/**/bundle`. 

Extend the workflow with release notarization/signing as Phase 18/19 of `Plan.md` progresses.

## Troubleshooting

- **Unknown file format** when converting Office docs → include `-type OFF`.
- **macOS build “Permission denied”** while scanning JRE legal files → ensure `scripts/normalize-openxliff-resources.sh` has been run (replaces symlinks with files).
- **New sidecar flags** → update `src-tauri/capabilities/default.json` to whitelist them before invoking from the frontend.

## Next steps

- Implement real translation pipelines / LLM agents in place of the simulated job runner.
- Expand capability separation per window and tighten argument validation (see `Phase 20` in `Plan.md`).
- Produce Windows x64 / macOS x64 OpenXLIFF dist snapshots and wire them into CI releases.

Refer to `Plan.md` for the full roadmap and remaining tasks.
