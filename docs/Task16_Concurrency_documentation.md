# Task 16.3 Concurrency Guard

## Summary
- Added an async mutex registry to serialize JLIFF read/modify/write cycles per file.
- Exposed `with_project_file_lock` so IPC and tests share the same locking primitive.

## Implementation Details
- The registry lives in `src-tauri/src/ipc/commands.rs` and caches a `tokio::sync::Mutex` per canonical path.
- `update_jliff_segment_impl` now performs all I/O inside `with_project_file_lock`, ensuring single-flight updates.

## Validation
- Added `update_jliff_segment_respects_file_lock` integration test to assert that concurrent updates wait for active writers.
- Ran `cargo test update_jliff_segment_respects_file_lock`.
