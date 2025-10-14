PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (user_id, email, display_name)
VALUES ('local-user', 'local@localhost', 'Local Owner');

ALTER TABLE projects
  ADD COLUMN owner_user_id TEXT
    REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT;

UPDATE projects
  SET owner_user_id = 'local-user'
WHERE owner_user_id IS NULL;

ALTER TABLE projects
  ADD COLUMN client_id TEXT
    REFERENCES clients(client_id) ON DELETE SET NULL;

ALTER TABLE projects
  ADD COLUMN domain_id TEXT
    REFERENCES domains(domain_id) ON DELETE SET NULL;

ALTER TABLE projects
  ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'CREATING'
    CHECK (lifecycle_status IN ('CREATING','READY','IN_PROGRESS','COMPLETED','ERROR'));

ALTER TABLE projects
  ADD COLUMN archived_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_owner_name
  ON projects(owner_user_id, name COLLATE NOCASE)
  WHERE archived_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
  UPDATE projects
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.id
    AND updated_at = OLD.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_owner_not_null_insert
BEFORE INSERT ON projects
FOR EACH ROW
WHEN NEW.owner_user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'owner_user_id is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_owner_not_null_update
BEFORE UPDATE OF owner_user_id ON projects
FOR EACH ROW
WHEN NEW.owner_user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'owner_user_id is required');
END;
