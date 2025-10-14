# Step 25.2 Data Migration CLI Report

## Summary
- Delivered a backfill pathway so deployed installations can promote legacy `project_file_conversions` into the new `file_targets`/`artifacts` schema without manual intervention.

## Implementation Details
- Added `FileTargetBackfillSummary` to capture migration metrics and exposed `DbManager::backfill_file_targets_from_legacy` for idempotent bridging with optional project filters (`src-tauri/src/db/types/file_target.rs`, `src-tauri/src/db/operations/file_targets.rs`).
- Introduced the `backfill-legacy-data` CLI binary which canonicalises the app directory, optionally ensures the placeholder owner, backfills language pairs, and runs the conversion bridge summarising results for operators (`src-tauri/src/bin/backfill_legacy_data.rs`, `src-tauri/Cargo.toml`).
- Re-exported the summary + constants through `weg_translator_lib` for reuse and added a regression test verifying pending conversions yield file targets via the helper (`src-tauri/src/lib.rs`, `src-tauri/tests/project_conversions.rs`).

## Testing
- `cargo test -p weg-translator backfill_legacy_conversions_creates_file_targets`
