PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS translation_outputs (
    job_id TEXT PRIMARY KEY,
    output_text TEXT NOT NULL,
    model_name TEXT,
    input_token_count INTEGER DEFAULT 0,
    output_token_count INTEGER DEFAULT 0,
    total_token_count INTEGER DEFAULT 0,
    duration_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(job_id) REFERENCES translation_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_translation_outputs_created_at ON translation_outputs(created_at);
