CREATE TABLE IF NOT EXISTS project_file_conversions (
  id               TEXT PRIMARY KEY,
  project_file_id  TEXT NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  src_lang         TEXT NOT NULL,
  tgt_lang         TEXT NOT NULL,
  version          TEXT NOT NULL DEFAULT '2.1' CHECK (version IN ('2.0','2.1','2.2')),
  paragraph        INTEGER NOT NULL DEFAULT 1 CHECK (paragraph IN (0,1)),
  embed            INTEGER NOT NULL DEFAULT 1 CHECK (embed IN (0,1)),
  xliff_rel_path   TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  started_at       TEXT,
  completed_at     TEXT,
  failed_at        TEXT,
  error_message    TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE(project_file_id, src_lang, tgt_lang, version)
);

CREATE INDEX IF NOT EXISTS idx_project_file_conversions_status
  ON project_file_conversions(status);

CREATE INDEX IF NOT EXISTS idx_project_file_conversions_file
  ON project_file_conversions(project_file_id);
