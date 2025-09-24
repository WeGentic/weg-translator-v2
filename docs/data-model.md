# Data Model

The Weg Translator desktop app persists translation metadata in a bundled SQLite database (`weg_translator.db`). Migrations live in `src-tauri/migrations` and are embedded at build time. The schema contains two tables with a 1-to-1 relationship.

## `translation_jobs`

Stores the lifecycle state for every translation request that enters the system.

| Column           | Type    | Notes |
| ---------------- | ------- | ----- |
| `id`             | TEXT PK | UUID v4 identifying the job. |
| `source_language`| TEXT    | Required ISO/BCP-47 code supplied by the user. |
| `target_language`| TEXT    | Required ISO/BCP-47 code supplied by the user. |
| `input_text`     | TEXT    | Raw text payload queued for translation. |
| `status`         | TEXT    | Enum `queued\|running\|completed\|failed`; mirrors progress. |
| `stage`          | TEXT    | Enum `received\|preparing\|translating\|completed\|failed`; fine-grained pipeline stage. |
| `progress`       | REAL    | Normalised value `0.0`–`1.0`; database constraint enforces bounds. |
| `queued_at`      | TEXT    | ISO-8601 timestamp (UTC) of enqueue event. |
| `started_at`     | TEXT    | Nullable ISO-8601 timestamp when work began. |
| `completed_at`   | TEXT    | Nullable ISO-8601 timestamp when job succeeded. |
| `failed_at`      | TEXT    | Nullable ISO-8601 timestamp when job failed. |
| `failure_reason` | TEXT    | Optional human-friendly failure description. |
| `metadata`       | TEXT    | Optional JSON blob (stored as string) for client-supplied metadata. |
| `created_at`     | TEXT    | Insert timestamp (UTC). |
| `updated_at`     | TEXT    | Last mutation timestamp (UTC). |

**Indexes**

- `idx_translation_jobs_status` accelerates dashboard filters by status.
- `idx_translation_jobs_created_at` backs time-based ordering queries.

## `translation_outputs`

Captures the generated artefact for completed jobs.

| Column             | Type    | Notes |
| ------------------ | ------- | ----- |
| `job_id`           | TEXT PK | Foreign key to `translation_jobs(id)` (cascade delete). |
| `output_text`      | TEXT    | Persisted translation output. |
| `model_name`       | TEXT    | Optional hint about the LLM/engine that produced the output. |
| `input_token_count`| INTEGER | Optional usage metrics (defaults to `0`). |
| `output_token_count`| INTEGER| Optional usage metrics (defaults to `0`). |
| `total_token_count`| INTEGER | Optional usage metrics (defaults to `0`). |
| `duration_ms`      | INTEGER | End-to-end processing duration in milliseconds. |
| `created_at`       | TEXT    | Insert timestamp (UTC). |
| `updated_at`       | TEXT    | Last mutation timestamp (UTC). |

**Indexes**

- `idx_translation_outputs_created_at` supports quick sorting by newest output.

## Seed data

Migration `003_seed_demo_data.sql` ships a single sample record to populate the UI on first launch. The seed can safely run multiple times thanks to `INSERT OR IGNORE` guards on the known UUID. Remove the seed migration when shipping production builds that rely solely on live translation traffic.

## Query patterns

- Active queue snapshots read from `translation_jobs` (status `queued`/`running`).
- History views join `translation_jobs` with `translation_outputs` to display completion data and aggregate usage metrics.
- `DbManager::clear_history` removes rows where `status` is `completed` or `failed`, cascading into `translation_outputs` via the foreign key.

Refer to `src-tauri/src/db/mod.rs` for the authoritative query implementations and helper structs returned over IPC.

## JLIFF artifact flow

1. `convert_xliff_to_jliff` (Rust) writes `project/<id>/jliff/*.jliff` alongside a `tag_map.json`, then stamps `project_file_conversions.jliff_rel_path`/`tag_map_rel_path` so the UI can resolve them relative to `ProjectDetails.root_path`.
2. The frontend requests the stored artefacts through IPC (`read_project_artifact`, `update_jliff_segment`) exposed in `src-tauri/src/ipc/commands.rs`; `src/ipc/client.ts` wraps these calls for React components.
3. `ProjectEditor` loads both documents, then pipes them into `normalizeJliffArtifacts` in `src/lib/jliff/normalize.ts`, which produces `SegmentRow` records with token metadata, placeholder chips, and parity counts.
4. `SegmentsTable` (TanStack v8 + `@tanstack/react-virtual`) renders the rows, while `TokenLine`, `PlaceholderParityBadge`, and `PlaceholderInspector` present inline placeholders, parity status, and original tag metadata respectively.
5. User edits are submitted via React 19 actions in `TargetEditor`; on success the JLIFF JSON is persisted through IPC and the local row cache is reconciled to keep the table in sync.

This path keeps the backend authoritative for artefact storage while allowing the virtualized table to operate entirely on memoized, type-safe `SegmentRow` data.
