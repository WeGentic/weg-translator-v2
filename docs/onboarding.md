# Contributor Onboarding

Welcome to the Weg Translator desktop project. This guide summarises the day-to-day commands and guardrails for contributors working on the Rust/React + SQLite stack.

## Environment setup

1. Install prerequisites:
   - Node.js 20+
   - pnpm 10+
   - Rust toolchain (Rust 1.89 via `rustup toolchain install 1.89.0`)
   - Tauri prerequisites per platform ([docs](https://v2.tauri.app/start/prerequisites/)).
2. Install dependencies and start the dev shell:

   ```bash
   pnpm install
   pnpm tauri dev
   ```

   This command boots the Vite dev server and the Tauri backend with log streaming.

## Running tests

- **Frontend/IPC:** `pnpm test` (watch), `pnpm test:run` (single pass), `pnpm test:coverage` (c8 report).
- **Rust integration:** `cargo test --manifest-path src-tauri/Cargo.toml` exercises SQLite migrations and DbManager helpers in-memory.
- **Linting:** `pnpm lint` (JS/TS) and `cargo fmt -- --check && cargo clippy -- -D warnings` (Rust).

## Database operations

- The SQLite file lives under the OS-specific `AppConfig` directory (`weg_translator.db`). Use `App -> Clear History` or delete the file to start from a clean slate.
- All migrations must be added to `src-tauri/migrations` with numeric prefixes (e.g., `004_add_tokens.sql`), then referenced in `sqlite_migrations()` in `src-tauri/src/lib.rs`.
- Run `cargo test` to validate migrations end-to-end. Tests automatically apply migrations to an in-memory database before assertions.
- `DbManager` serialises writes with a Tokio mutex. Avoid adding ad-hoc connection pools—reuse `DbManager` via Tauri `State`.

## Adding new migrations

1. Create a SQL file under `src-tauri/migrations/` with the next version number.
2. Append the migration to `sqlite_migrations()` in `src-tauri/src/lib.rs`.
3. Update `docs/data-model.md` with any schema changes.
4. Add/extend Rust tests in `src-tauri/tests/` to cover the new behaviour.

## Resetting the workspace

If you need to wipe the local database and cached builds:

```bash
pnpm clean
cargo clean --manifest-path src-tauri/Cargo.toml
```

Then remove the platform-specific app data directory:

- macOS: `rm -rf ~/Library/Application\ Support/weg-translator`
- Windows (PowerShell): `Remove-Item -Recurse -Force "$env:APPDATA\weg-translator"`

Re-launching `pnpm tauri dev` will recreate the SQLite file and repopulate seed data.

## Troubleshooting

- **Vitest cannot resolve `@/` imports** → ensure `vite.config.ts` aliases are in place and `pnpm install` has been run.
- **SQLite locking errors** → confirm you are using the shared `DbManager` instance and not spawning manual connections; the manager serialises writes to avoid `SQLITE_BUSY`.
- **IPC errors show generic messages** → backend now emits user-friendly strings; check the Tauri log console for the structured `db::jobs` entries when debugging.

Feel free to extend this document with additional tips as the project evolves.
