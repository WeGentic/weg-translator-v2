//! Shared database constants and SQL fragments.

/// SQLite database file name stored inside the application data directory.
pub const SQLITE_DB_FILE: &str = "weg_translator.db";

/// Projection used when selecting project file conversion rows.
pub const PROJECT_FILE_CONVERSION_COLUMNS: &str = "id, project_file_id, src_lang, tgt_lang, version, paragraph, embed, xliff_rel_path, jliff_rel_path, tag_map_rel_path, status, started_at, completed_at, failed_at, error_message, created_at, updated_at";

/// Extensions that indicate we should skip conversion because the file is already an XLIFF variant.
pub const SKIP_CONVERSION_EXTENSIONS: &[&str] = &["xlf", "xliff", "mqxliff", "sdlxliff"];

/// Extensions that we currently support for automatic conversion workflows.
pub const CONVERTIBLE_EXTENSIONS: &[&str] = &[
    "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods", "html", "xml", "dita", "md",
];
