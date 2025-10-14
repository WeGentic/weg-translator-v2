PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS jobs (
  job_id         TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL
    REFERENCES projects(id) ON DELETE CASCADE,
  job_type       TEXT NOT NULL
    CHECK (job_type IN ('COPY_FILE','EXTRACT_XLIFF','CONVERT_JLIFF','VALIDATE')),
  file_target_id TEXT
    REFERENCES file_targets(file_target_id) ON DELETE CASCADE,
  artifact_id    TEXT
    REFERENCES artifacts(artifact_id) ON DELETE CASCADE,
  state          TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  attempts       INTEGER NOT NULL DEFAULT 0,
  error          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  started_at     TEXT,
  finished_at    TEXT
);

CREATE INDEX IF NOT EXISTS ix_jobs_project_state
  ON jobs(project_id, state);
