ALTER TABLE projects ADD COLUMN default_src_lang TEXT;
ALTER TABLE projects ADD COLUMN default_tgt_lang TEXT;

UPDATE projects
SET default_src_lang = COALESCE(default_src_lang, 'en-US'),
    default_tgt_lang = COALESCE(default_tgt_lang, 'it-IT')
WHERE default_src_lang IS NULL OR default_tgt_lang IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_default_lang
  ON projects(default_src_lang, default_tgt_lang);
