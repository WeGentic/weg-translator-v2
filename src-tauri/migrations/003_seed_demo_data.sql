PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO translation_jobs (
    id,
    source_language,
    target_language,
    input_text,
    status,
    stage,
    progress,
    queued_at,
    started_at,
    completed_at,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'en',
    'it',
    'Welcome to Weg Translator!',
    'completed',
    'completed',
    1.0,
    '2025-01-01T10:00:00Z',
    '2025-01-01T10:00:05Z',
    '2025-01-01T10:00:07Z',
    '2025-01-01T10:00:00Z',
    '2025-01-01T10:00:07Z'
);

INSERT OR IGNORE INTO translation_outputs (
    job_id,
    output_text,
    model_name,
    input_token_count,
    output_token_count,
    total_token_count,
    duration_ms,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Benvenuto su Weg Translator!',
    'demo-llm',
    18,
    19,
    37,
    2000,
    '2025-01-01T10:00:07Z',
    '2025-01-01T10:00:07Z'
);
