# Step 21.2 Completion Report

## Summary
- Startup now runs a read-only scan of the pipeline `jobs` ledger for `PENDING` or `FAILED` entries, logging a count breakdown and per-job context so operators can see which tasks require manual intervention (`src-tauri/src/lib.rs:171`).
- Introduced `PipelineJobSummary` DTO and `pipeline://jobs_need_attention` event, emitting the job digest to the renderer without mutating state or auto-retrying work (`src-tauri/src/ipc/dto.rs:37`, `src-tauri/src/ipc/events.rs:5`).
- Added a dedicated `DbManager::list_pipeline_jobs_needing_attention` helper to keep the query centralized and maintain reuse for future UI surfaces (`src-tauri/src/db/operations/jobs.rs:151`).

## Validation
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --lib --manifest-path src-tauri/Cargo.toml`

## Notes
- The emitted event provides job identifiers, attempts, and related resource IDs so the React side can render retry controls when implemented, while avoiding any automatic state transitions.
