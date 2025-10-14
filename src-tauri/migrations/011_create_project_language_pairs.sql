PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project_language_pairs (
  pair_id     TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL
    REFERENCES projects(id) ON DELETE CASCADE,
  src_lang    TEXT NOT NULL,
  trg_lang    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id, src_lang, trg_lang)
);
