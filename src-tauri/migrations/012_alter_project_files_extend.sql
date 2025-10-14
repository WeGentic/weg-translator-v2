PRAGMA foreign_keys = ON;

ALTER TABLE project_files
  ADD COLUMN role TEXT NOT NULL DEFAULT 'source'
    CHECK (role IN ('source','reference','tm','termbase','styleguide','other'));

ALTER TABLE project_files
  ADD COLUMN mime_type TEXT;

ALTER TABLE project_files
  ADD COLUMN hash_sha256 TEXT;

ALTER TABLE project_files
  ADD COLUMN storage_state TEXT NOT NULL DEFAULT 'COPIED'
    CHECK (storage_state IN ('STAGED','COPIED','MISSING','DELETED'));

ALTER TABLE project_files
  ADD COLUMN importer TEXT;

UPDATE project_files
SET hash_sha256 = checksum_sha256
WHERE checksum_sha256 IS NOT NULL
  AND hash_sha256 IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_project_files_rel_path
  ON project_files(project_id, stored_rel_path);
