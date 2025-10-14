PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS file_targets (
  file_target_id TEXT PRIMARY KEY,
  file_id        TEXT NOT NULL
    REFERENCES project_files(id) ON DELETE CASCADE,
  pair_id        TEXT NOT NULL
    REFERENCES project_language_pairs(pair_id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','EXTRACTED','FAILED')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(file_id, pair_id)
);

CREATE TRIGGER IF NOT EXISTS trg_file_targets_updated_at
AFTER UPDATE ON file_targets
FOR EACH ROW
BEGIN
  UPDATE file_targets
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE file_target_id = NEW.file_target_id
    AND updated_at = OLD.updated_at;
END;
