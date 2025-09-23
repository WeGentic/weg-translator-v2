use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;
use uuid::Uuid;

use weg_translator_lib::DbError;
use weg_translator_lib::DbManager;
use weg_translator_lib::NewProject;
use weg_translator_lib::NewProjectFile;
use weg_translator_lib::ProjectFileConversionRequest;
use weg_translator_lib::ProjectFileConversionStatus as CStatus;
use weg_translator_lib::ProjectFileImportStatus as FStatus;
use weg_translator_lib::ProjectStatus as PStatus;
use weg_translator_lib::ProjectType as PType;

const MIGRATIONS: &[&str] = &[
    include_str!("../migrations/004_create_projects.sql"),
    include_str!("../migrations/005_create_project_files.sql"),
    include_str!("../migrations/006_add_project_languages.sql"),
    include_str!("../migrations/007_create_project_file_conversions.sql"),
];

#[tokio::test]
async fn conversions_unique_and_status_transitions() {
    let manager = new_manager().await;

    // Seed one project with one file (docx)
    let project_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let project = NewProject {
        id: project_id,
        name: "Demo".into(),
        slug: "demo".into(),
        project_type: PType::Translation,
        root_path: "/tmp/demo".into(),
        status: PStatus::Active,
        default_src_lang: Some("en-US".into()),
        default_tgt_lang: Some("it-IT".into()),
        metadata: None,
    };
    let file = NewProjectFile {
        id: file_id,
        project_id,
        original_name: "file.docx".into(),
        original_path: "/abs/file.docx".into(),
        stored_rel_path: "file.docx".into(),
        ext: "docx".into(),
        size_bytes: Some(1024),
        checksum_sha256: None,
        import_status: FStatus::Imported,
    };
    manager
        .insert_project_with_files(&project, &[file])
        .await
        .expect("seed project and file");

    // Create or find conversion entry (should insert)
    let request = ProjectFileConversionRequest::new("en-US", "it-IT", "2.1");
    let conv1 = manager
        .find_or_create_conversion_for_file(file_id, &request)
        .await
        .expect("create conversion");
    assert_eq!(conv1.status, CStatus::Pending);

    // Calling again should return the same conversion (unique constraint)
    let conv2 = manager
        .find_or_create_conversion_for_file(file_id, &request)
        .await
        .expect("find existing conversion");
    assert_eq!(conv1.id, conv2.id);

    // Status transitions: running -> completed with xliff path
    manager
        .upsert_conversion_status(
            conv1.id,
            CStatus::Running,
            None,
            None,
            None,
            None,
            Some(now()),
            None,
            None,
        )
        .await
        .expect("set running");
    manager
        .upsert_conversion_status(
            conv1.id,
            CStatus::Completed,
            Some("xliff/file.en-US-it-IT.xlf".into()),
            Some("jliff/file.en-US-it-IT.jliff.json".into()),
            Some("jliff/file.en-US-it-IT.tags.json".into()),
            None,
            None,
            Some(now()),
            None,
            None,
        )
        .await
        .expect("set completed");

    // No pending conversions after completion
    let pending = manager
        .list_pending_conversions(project_id, "en-US", "it-IT")
        .await
        .expect("list pending conversions");
    assert!(pending.is_empty());
}

#[tokio::test]
async fn list_pending_skips_non_convertible_and_failed_only() {
    let manager = new_manager().await;

    // Seed project with 3 files: convertible(docx), xliff(skip), html(convertible)
    let project_id = Uuid::new_v4();
    let f_docx = Uuid::new_v4();
    let f_xlf = Uuid::new_v4();
    let f_html = Uuid::new_v4();
    let project = NewProject {
        id: project_id,
        name: "Demo2".into(),
        slug: "demo2".into(),
        project_type: PType::Translation,
        root_path: "/tmp/demo2".into(),
        status: PStatus::Active,
        default_src_lang: Some("en-US".into()),
        default_tgt_lang: Some("it-IT".into()),
        metadata: None,
    };
    let files = [
        NewProjectFile {
            id: f_docx,
            project_id,
            original_name: "a.docx".into(),
            original_path: "/abs/a.docx".into(),
            stored_rel_path: "a.docx".into(),
            ext: "docx".into(),
            size_bytes: None,
            checksum_sha256: None,
            import_status: FStatus::Imported,
        },
        NewProjectFile {
            id: f_xlf,
            project_id,
            original_name: "b.xliff".into(),
            original_path: "/abs/b.xliff".into(),
            stored_rel_path: "b.xliff".into(),
            ext: "xliff".into(),
            size_bytes: None,
            checksum_sha256: None,
            import_status: FStatus::Imported,
        },
        NewProjectFile {
            id: f_html,
            project_id,
            original_name: "c.html".into(),
            original_path: "/abs/c.html".into(),
            stored_rel_path: "c.html".into(),
            ext: "html".into(),
            size_bytes: None,
            checksum_sha256: None,
            import_status: FStatus::Imported,
        },
    ];
    manager
        .insert_project_with_files(&project, &files)
        .await
        .expect("seed project files");

    // Mark one conversion as failed to include in pending
    let request = ProjectFileConversionRequest::new("en-US", "it-IT", "2.1");
    let conv_docx = manager
        .find_or_create_conversion_for_file(f_docx, &request)
        .await
        .expect("docx conv");
    // Set failed to be included in pending
    manager
        .upsert_conversion_status(
            conv_docx.id,
            CStatus::Failed,
            None,
            None,
            None,
            Some("error".into()),
            None,
            None,
            Some(now()),
        )
        .await
        .expect("set failed");

    // HTML is convertible and missing conversion -> should be pending; XLIFF skipped
    let pending = manager
        .list_pending_conversions(project_id, "en-US", "it-IT")
        .await
        .expect("pending");
    let ids: Vec<_> = pending.into_iter().map(|p| p.project_file_id).collect();
    assert!(ids.contains(&f_docx));
    assert!(ids.contains(&f_html));
    assert!(!ids.contains(&f_xlf));
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
        .expect("open memory db")
}

async fn apply_migrations(pool: &SqlitePool) {
    for sql in MIGRATIONS {
        sqlx::query(sql)
            .execute(pool)
            .await
            .expect("migration execution failed");
    }
}

fn now() -> String {
    // ISO-8601 string acceptable for tests
    "2024-01-01T00:00:00Z".to_string()
}
