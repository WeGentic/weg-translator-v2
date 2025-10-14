PRAGMA foreign_keys = ON;

ALTER TABLE jobs
  ADD COLUMN job_key TEXT;

UPDATE jobs
   SET job_key = CASE
       WHEN job_key IS NOT NULL THEN job_key
       WHEN job_type = 'COPY_FILE' THEN job_id
       WHEN job_type IN ('EXTRACT_XLIFF','CONVERT_JLIFF','VALIDATE')
            AND file_target_id IS NOT NULL THEN
         printf('%s|%s|%s', job_type, project_id, file_target_id)
       WHEN artifact_id IS NOT NULL THEN
         printf('%s|%s|%s', job_type, project_id, artifact_id)
       ELSE job_id
     END
 WHERE job_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_jobs_job_key
  ON jobs(job_key)
  WHERE job_key IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_jobs_job_key_not_null_insert
BEFORE INSERT ON jobs
FOR EACH ROW
WHEN NEW.job_key IS NULL
BEGIN
  SELECT RAISE(ABORT, 'job_key is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_jobs_job_key_not_null_update
BEFORE UPDATE OF job_key ON jobs
FOR EACH ROW
WHEN NEW.job_key IS NULL
BEGIN
  SELECT RAISE(ABORT, 'job_key is required');
END;
