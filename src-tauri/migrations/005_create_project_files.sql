CREATE TABLE IF NOT EXISTS project_files (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_name    TEXT NOT NULL,
  original_path    TEXT NOT NULL,
  stored_rel_path  TEXT NOT NULL,
  ext              TEXT NOT NULL,
  size_bytes       INTEGER,
  checksum_sha256  TEXT,
  import_status    TEXT NOT NULL DEFAULT 'imported' CHECK (import_status IN ('imported','failed')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
