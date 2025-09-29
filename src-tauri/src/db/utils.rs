//! Assorted helper utilities shared across the database modules.

use sqlx::Error;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

/// Returns the current UTC timestamp encoded as RFC 3339.
pub fn now_iso8601() -> String {
    let now = OffsetDateTime::now_utc();
    now.format(&Rfc3339).unwrap_or_else(|_| now.to_string())
}

/// Detects whether a SQLite error corresponds to a translation job identifier conflict.
pub fn is_translation_job_unique_violation(error: &Error) -> bool {
    match error {
        Error::Database(database_error) => database_error.message().contains("translation_jobs.id"),
        _ => false,
    }
}
