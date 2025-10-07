# Folder Structure Snapshot (2025-03-08)

- `src/app/` – Application providers, shell scaffolding, and auth/layout state.
- `src/core/` – Infrastructure services such as IPC clients, logging, and config.
- `src/modules/` – Domain features (projects, workspace, history, settings, editor).
- `src/shared/` – Cross-cutting UI primitives, hooks, utilities, and styles.
- `src/router/` – TanStack Router entrypoints and generated route tree.
- `src/test/` – Vitest setup files plus shared testing utilities.
- `src-tauri/` – Rust backend source, Tauri config, migrations, and sidecars.
- `packages/` – Reusable layout packages consumed by the desktop shell.
- `scripts/` – Helper scripts for OpenXLIFF assets and workspace tooling.
- `docs/` – Architecture notes, migration guides, and task documentation.
