use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;
use uuid::Uuid;

use weg_translator_lib::{
    DbError, DbManager, NewTranslationRecord, PersistedTranslationOutput, TranslationHistoryRecord,
    TranslationRequest, TranslationStage,
};

const MIGRATIONS: &[&str] = &[
    include_str!("../migrations/001_create_translation_jobs.sql"),
    include_str!("../migrations/002_create_translation_outputs.sql"),
    include_str!("../migrations/003_seed_demo_data.sql"),
];

#[tokio::test]
async fn migrations_apply_successfully() {
    let pool = new_test_pool().await;
    apply_migrations(&pool).await;

    let table_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('translation_jobs', 'translation_outputs')",
    )
    .fetch_one(&pool)
    .await
    .expect("expected sqlite_master query to succeed");

    assert_eq!(
        table_count.0, 2,
        "expected both translation tables to exist"
    );
}

#[tokio::test]
async fn insert_and_fetch_history_round_trip() {
    let manager = new_manager().await;
    let job_id = Uuid::new_v4();
    let request = sample_request();

    manager
        .insert_job(&NewTranslationRecord {
            job_id,
            request: request.clone(),
        })
        .await
        .expect("expected job insertion to succeed");

    manager
        .update_progress(job_id, TranslationStage::Preparing, 0.25)
        .await
        .expect("expected progress update to succeed");

    manager
        .store_output(&PersistedTranslationOutput {
            job_id,
            output_text: "Translated text".into(),
            model_name: Some("demo".into()),
            input_token_count: Some(128),
            output_token_count: Some(256),
            total_token_count: Some(384),
            duration_ms: Some(512),
        })
        .await
        .expect("expected output storage to succeed");

    let history = manager
        .list_history(50, 0)
        .await
        .expect("expected history query to succeed");

    let record = history
        .into_iter()
        .find(|record| record.job.job_id == job_id)
        .expect("history should contain the completed job");

    assert_snapshot_matches(&record, &request);
}

#[tokio::test]
async fn duplicate_job_insertion_is_rejected() {
    let manager = new_manager().await;
    let job_id = Uuid::new_v4();
    let request = sample_request();

    manager
        .insert_job(&NewTranslationRecord {
            job_id,
            request: request.clone(),
        })
        .await
        .expect("initial insertion should succeed");

    let duplicate_result = manager
        .insert_job(&NewTranslationRecord { job_id, request })
        .await;

    let error = duplicate_result.expect_err("duplicate insert should fail");
    assert!(matches!(error, DbError::DuplicateJob(id) if id == job_id));
}

#[tokio::test]
async fn clear_history_removes_completed_jobs_only() {
    let manager = new_manager().await;

    // Completed job should be removed by clear_history.
    let completed_job = Uuid::new_v4();
    manager
        .insert_job(&NewTranslationRecord {
            job_id: completed_job,
            request: sample_request(),
        })
        .await
        .expect("expected completed job insert to succeed");
    manager
        .store_output(&PersistedTranslationOutput {
            job_id: completed_job,
            output_text: "done".into(),
            model_name: None,
            input_token_count: None,
            output_token_count: None,
            total_token_count: None,
            duration_ms: Some(42),
        })
        .await
        .expect("expected output insert to succeed");

    // Running job should remain.
    let running_job = Uuid::new_v4();
    manager
        .insert_job(&NewTranslationRecord {
            job_id: running_job,
            request: sample_request(),
        })
        .await
        .expect("expected running job insert to succeed");

    let cleared = manager
        .clear_history()
        .await
        .expect("expected clear_history to succeed");
    assert!(cleared >= 1, "at least one completed job should be removed");

    let remaining_jobs = manager
        .list_jobs(100, 0)
        .await
        .expect("expected job listing to succeed");
    assert!(
        remaining_jobs
            .into_iter()
            .any(|job| job.job_id == running_job),
        "running job should still exist after clear_history",
    );
}

async fn new_manager() -> DbManager {
    let pool = new_test_pool().await;
    apply_migrations(&pool).await;
    DbManager::from_pool(pool)
}

async fn new_test_pool() -> SqlitePool {
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect(":memory:")
        .await
        .expect("expected SQLite memory database to open")
}

fn sample_request() -> TranslationRequest {
    TranslationRequest {
        source_language: "en".into(),
        target_language: "it".into(),
        text: "hello".into(),
        metadata: None,
    }
}

fn assert_snapshot_matches(record: &TranslationHistoryRecord, request: &TranslationRequest) {
    assert_eq!(record.job.source_language, request.source_language);
    assert_eq!(record.job.target_language, request.target_language);
    assert_eq!(record.job.input_text, request.text);
    assert_eq!(record.job.status, "completed");
    assert!(matches!(record.job.stage, TranslationStage::Completed));
    assert!(record.job.completed_at.is_some());

    let output = record
        .output
        .as_ref()
        .expect("completed job should have an output snapshot");
    assert_eq!(output.output_text, "Translated text");
    assert_eq!(output.duration_ms, Some(512));
}

async fn apply_migrations(pool: &SqlitePool) {
    // Running migrations synchronously guarantees deterministic schema state
    // for each test.
    for sql in MIGRATIONS {
        sqlx::query(sql)
            .execute(pool)
            .await
            .expect("migration execution failed");
    }
}
