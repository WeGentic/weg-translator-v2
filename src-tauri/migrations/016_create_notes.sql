PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notes (
  note_id        TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL
    REFERENCES projects(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL
    REFERENCES users(user_id) ON DELETE RESTRICT,
  body           TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
