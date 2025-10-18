# clients-sqlite

## Current User Request Analysis
- The user reports that client records vanish after reloading the app, implying SQLite persistence issues for the `clients` table.
- Inspection shows `src-tauri/src/db/manager.rs:58-78` unconditionally deletes the existing database file inside `DbManager::connect_pool`, causing data loss on each startup.

## Problem Breakdown
- Existing database bootstrap removes the SQLite file before reconnecting, so all tables, including `clients`, reset every launch.
- Fix requires updating the pool bootstrap to reuse the database file while still applying migrations via `initialise_schema`.
- Need to ensure no other code paths re-trigger file deletion (e.g., `reopen_with_base_dir`) and that concurrency locks remain safe.
- Tests should confirm clients persist across manager reinitialisation to prevent regression.
- Maintainability: prefer minimal changes scoped to manager bootstrap and add test coverage for persistence guarantees.

## User Request
S1: Check current SQLite implementation regarding Clients, Clients DOES NOT GET CORRECTLY stored/read from SQLite database; the just vanish after reloading the app
Completed: COMPLETED

## Coding implementation
- Removed the destructive `fs::remove_file` call from `DbManager::connect_pool` so existing SQLite data is preserved (`src-tauri/src/db/manager.rs`).
- Re-exported `DatabasePerformanceConfig` from the library facade for integration tests (`src-tauri/src/lib.rs`).
- Added an integration test proving client records persist after reopening the manager with the same base directory (`src-tauri/tests/db_manager_v2.rs`).

## Notes
- Tests: `cargo test clients_persist_across_manager_reopen` (within `src-tauri`).
