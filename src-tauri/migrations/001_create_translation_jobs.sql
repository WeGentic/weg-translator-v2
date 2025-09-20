-- Create table to track translation job lifecycle and metadata
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS translation_jobs (
    id TEXT PRIMARY KEY,
    source_language TEXT NOT NULL,
    target_language TEXT NOT NULL,
    input_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT NOT NULL DEFAULT 'received',
    progress REAL NOT NULL DEFAULT 0.0,
    queued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    started_at TEXT,
    completed_at TEXT,
    failed_at TEXT,
    failure_reason TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK(progress >= 0.0 AND progress <= 1.0),
    CHECK(status IN ('queued', 'running', 'completed', 'failed')),
    CHECK(stage IN ('received', 'preparing', 'translating', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_translation_jobs_status ON translation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_created_at ON translation_jobs(created_at);
