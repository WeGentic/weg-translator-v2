# Sentic Club Data Pipeline Notes

## Schema checkpoints
- `project_language_pairs` modelises per-project directions used throughout the conversion pipeline (`src-tauri/migrations/011_create_project_language_pairs.sql`).
- `file_targets` records the file × language pair work queue and lifecycle status (`src-tauri/migrations/013_create_file_targets.sql`).
- `artifacts` persists the generated XLIFF/JLIFF paths plus metadata such as size and checksum (`src-tauri/migrations/014_create_artifacts.sql`).
- `project_files` stores SHA-256 hashes alongside storage state so staging can validate integrity after promotion (`src-tauri/migrations/012_alter_project_files_extend.sql`).

## Staging flow snapshot
- Project seeding inserts the project, files, initial pairs, and file targets in one transaction (`src-tauri/src/ipc/commands/projects/service.rs:94`).
- Originals are streamed into `.staging` while `compute_sha256_streaming` records bytes + checksum (`src-tauri/src/ipc/commands/projects/file_operations.rs:281`).
- `promote_staged_project` atomically renames the staging folder and updates paths/storage state in the database, ensuring lifecycle transitions (`src-tauri/src/ipc/commands/projects/service.rs:244`).

## Path & directory policy
- `DbManager::ensure_subdir` only permits single-segment names when creating artifact folders (`src-tauri/src/db/operations/project_files.rs:102`).
- `build_language_directory_name` sanitises language codes to safe folder segments so lookups are deterministic (`src-tauri/src/ipc/commands/projects/utils.rs:297`).
- `join_within_project` validates any stored relative path before resolving to an absolute filesystem location (`src-tauri/src/ipc/commands/projects/utils.rs:220`).

## Recovery & backfill playbook
- Legacy conversions are bridged into the new file target model via `backfill_file_targets_from_legacy`, which promotes status and artifacts while staying idempotent (`src-tauri/src/db/operations/file_targets.rs:241`).
- The new filesystem indexer `backfill_artifacts_from_disk` computes hashes for existing XLIFF/JLIFF outputs and upserts artifact rows without relocating files (`src-tauri/src/db/operations/file_targets.rs:312`).
- `backfill-legacy-data` CLI orchestrates owner/language backfill, conversion bridging, and filesystem registration for deployed installations (`src-tauri/src/bin/backfill_legacy_data.rs:71`).
- Regression coverage in `register_existing_artifacts_records_files` ensures checksum capture and path recording stay stable (`src-tauri/tests/project_conversions.rs:362`).
