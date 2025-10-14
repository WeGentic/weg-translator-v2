//! Constants and configuration values for project management
//!
//! This module contains all the constants used throughout the project management
//! system, including validation limits, file extensions, and default values.

/// Minimum allowed length for project names
///
/// Project names must be at least 2 characters to ensure meaningful identification
pub const PROJECT_NAME_MIN_LEN: usize = 2;

/// Maximum allowed length for project names
///
/// Project names are limited to 120 characters to prevent database issues
/// and ensure reasonable display in UI components
pub const PROJECT_NAME_MAX_LEN: usize = 120;

/// Name of the projects directory within the app folder
///
/// All project directories are created under this subdirectory to keep
/// the app folder organized
pub const PROJECTS_DIR_NAME: &str = "projects";

/// Default local owner user identifier used until user management is implemented.
pub const LOCAL_OWNER_USER_ID: &str = "local-user";
/// Default email used for the local owner placeholder user.
pub const LOCAL_OWNER_EMAIL: &str = "local@localhost";
/// Default display name used for the local owner placeholder user.
pub const LOCAL_OWNER_DISPLAY_NAME: &str = "Local Owner";

/// Subdirectory under each project where original uploaded files are stored.
pub const PROJECT_DIR_ORIGINAL: &str = "original";

/// Temporary staging directory used while importing files.
pub const PROJECT_DIR_STAGING: &str = ".staging";

/// Directory within the staging area where original files are placed.
pub const PROJECT_DIR_STAGING_ORIGINAL: &str = ".staging/original";

/// Root folder for generated artifacts under each project.
pub const PROJECT_DIR_ARTIFACTS: &str = "artifacts";

/// Subfolder for generated XLIFF artifacts.
pub const PROJECT_DIR_ARTIFACTS_XLIFF: &str = "xliff";

/// Subfolder for generated JLIFF artifacts.
pub const PROJECT_DIR_ARTIFACTS_XJLIFF: &str = "xjliff";

/// Subfolder for generated QA reports.
pub const PROJECT_DIR_ARTIFACTS_QA: &str = "qa";

/// File extensions that are accepted for project import
///
/// This list includes:
/// - Convertible document formats that can be processed by OpenXLIFF
/// - XLIFF-like formats that are treated as already-converted files
///
/// Document formats:
/// - Microsoft Office: doc, docx, ppt, pptx, xls, xlsx
/// - OpenDocument: odt, odp, ods
/// - Web/Markup: html, xml, dita, md
///
/// XLIFF formats:
/// - Standard XLIFF: xlf, xliff
/// - Tool-specific XLIFF variants: mqxliff, sdlxliff
pub const ALLOWED_PROJECT_EXTENSIONS: &[&str] = &[
    // Convertible document formats
    "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods", "html", "xml", "dita", "md",
    // XLIFF-like formats (treated as already-converted)
    "xlf", "xliff", "mqxliff", "sdlxliff",
];

/// Default source language when none is specified
///
/// Used as fallback when creating projects or conversions without
/// explicit source language configuration
pub const DEFAULT_SOURCE_LANGUAGE: &str = "en-US";

/// Default target language when none is specified
///
/// Used as fallback when creating projects or conversions without
/// explicit target language configuration
pub const DEFAULT_TARGET_LANGUAGE: &str = "it-IT";

/// Default XLIFF version for conversions
///
/// XLIFF 2.0 is used as the default version as it's well-supported
/// by the OpenXLIFF toolchain and database schema
pub const DEFAULT_XLIFF_VERSION: &str = "2.0";

/// Default fallback name for projects when slug generation fails
///
/// Used when the project name contains no alphanumeric characters
/// that can be converted to a valid slug
pub const DEFAULT_PROJECT_SLUG: &str = "project";

/// Default fallback name for files without proper names
///
/// Used when determining file stems for output naming when the
/// original filename cannot be properly parsed
pub const DEFAULT_FILE_STEM: &str = "file";
