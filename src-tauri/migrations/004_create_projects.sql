CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  project_type  TEXT NOT NULL CHECK (project_type IN ('translation','rag')),
  root_path     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  metadata      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
