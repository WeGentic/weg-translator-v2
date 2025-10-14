# Step 26.1 Artifact Registration Report

## Summary
- Implemented a filesystem backfill to register legacy XLIFF/JLIFF artifacts into the new metadata tables without relocating any files.

## Implementation Details
- Added `DbManager::backfill_artifacts_from_disk` to traverse legacy artifact directories, reconcile language pairs/file targets, compute SHA-256 hashes, and upsert artifact rows with `LegacyImport` provenance (`src-tauri/src/db/operations/file_targets.rs`).
- Introduced `FilesystemArtifactBackfillSummary` for reporting and re-exported the type for CLI consumption alongside artifact registration helpers (`src-tauri/src/db/types/file_target.rs`, `src-tauri/src/lib.rs`).
- Extended the `backfill-legacy-data` CLI to run the artifact indexer after conversion bridging, emitting operator-facing metrics for successful registrations and skips (`src-tauri/src/bin/backfill_legacy_data.rs`).
- Added unit coverage verifying on-disk artifacts are indexed with correct relative paths, sizes, and checksums while creating any missing file targets (`register_existing_artifacts_records_files`, `src-tauri/tests/project_conversions.rs`).

## Testing
- `cargo test -p weg-translator register_existing_artifacts_records_files`
