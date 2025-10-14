# Step 21.1 Completion Report

## Summary
- Added migration `018_alter_jobs_add_job_key.sql` that backfills a deterministic `job_key`, enforces uniqueness, and guards inserts/updates with triggers so retries cannot create duplicate ledger rows (`src-tauri/migrations/018_alter_jobs_add_job_key.sql:1`).
- Refactored job persistence to upsert on `job_key` and introduced deterministic key generation in staging/conversion flows (`src-tauri/src/db/operations/jobs.rs:17`, `src-tauri/src/ipc/commands/projects/service.rs:214`, `src-tauri/src/ipc/commands/projects/artifacts.rs:341`), aligning job retries with logical idempotency (e.g., `COPY_FILE::{project_id}::{file_id}`).

## Validation
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --lib --manifest-path src-tauri/Cargo.toml`

## Notes
- Future retries can also increment `attempts` before re-dispatching; the new upsert preserves existing timestamps unless explicitly provided, so resubmission handlers should set state/attempts as needed.
