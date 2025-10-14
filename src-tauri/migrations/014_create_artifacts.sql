PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id    TEXT PRIMARY KEY,
  file_target_id TEXT NOT NULL
    REFERENCES file_targets(file_target_id) ON DELETE CASCADE,
  kind           TEXT NOT NULL
    CHECK (kind IN ('xliff','jliff','qa_report','preview')),
  rel_path       TEXT NOT NULL,
  size_bytes     INTEGER,
  checksum       TEXT,
  tool           TEXT,
  status         TEXT NOT NULL DEFAULT 'GENERATED'
    CHECK (status IN ('GENERATED','FAILED')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(file_target_id, kind)
);

CREATE INDEX IF NOT EXISTS ix_artifacts_kind_path
  ON artifacts(kind, rel_path);

CREATE TRIGGER IF NOT EXISTS trg_artifacts_updated_at
AFTER UPDATE ON artifacts
FOR EACH ROW
BEGIN
  UPDATE artifacts
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE artifact_id = NEW.artifact_id
    AND updated_at = OLD.updated_at;
END;
