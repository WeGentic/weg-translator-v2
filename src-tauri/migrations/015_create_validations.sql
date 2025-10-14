PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS validations (
  validation_id TEXT PRIMARY KEY,
  artifact_id   TEXT NOT NULL
    REFERENCES artifacts(artifact_id) ON DELETE CASCADE,
  validator     TEXT NOT NULL,
  passed        INTEGER NOT NULL
    CHECK (passed IN (0,1)),
  result_json   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
