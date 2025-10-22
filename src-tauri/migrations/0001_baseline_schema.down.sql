-- Baseline rollback: drop objects created in 0001 in reverse dependency order.

DROP TRIGGER IF EXISTS flp_must_be_subset_of_plp_update;
DROP TRIGGER IF EXISTS flp_must_be_subset_of_plp_insert;
DROP TRIGGER IF EXISTS projects_set_update_date;

DROP INDEX IF EXISTS ux_artifacts_project_artifact;
DROP INDEX IF EXISTS idx_artifacts_project;
DROP INDEX IF EXISTS idx_project_files_project;
DROP INDEX IF EXISTS idx_project_language_pairs_project;

DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS artifacts;
DROP TABLE IF EXISTS file_language_pairs;
DROP TABLE IF EXISTS project_files;
DROP TABLE IF EXISTS file_info;
DROP TABLE IF EXISTS project_language_pairs;
DROP TABLE IF EXISTS project_subjects;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS user_permission_overrides;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
