use std::fs;
use serde_json::json;
use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use tempfile::{TempDir, tempdir};
use uuid::Uuid;
use weg_translator_lib::DbManager;
use weg_translator_lib::NewProject;
use weg_translator_lib::ProjectStatus as PStatus;
use weg_translator_lib::ProjectType as PType;
use weg_translator_lib::ipc_test::{
    read_project_artifact_impl,
    update_jliff_segment_impl,
};

const MIGRATIONS: &[&str] = &[
    include_str!("../migrations/004_create_projects.sql"),
    include_str!("../migrations/005_create_project_files.sql"),
    include_str!("../migrations/006_add_project_languages.sql"),
    include_str!("../migrations/007_create_project_file_conversions.sql"),
    include_str!("../migrations/008_add_jliff_columns.sql"),
];

#[tokio::test]
async fn read_project_artifact_returns_contents() {
    let (manager, project_id, _temp, root) = seed_project().await;
    let artifact_rel = "jliff/sample.jliff.json";
    let artifact_path = root.join(artifact_rel);
    fs::create_dir_all(artifact_path.parent().unwrap()).expect("create artifact dir");
    fs::write(&artifact_path, "{\"hello\":\"world\"}").expect("write artifact");

    let contents = read_project_artifact_impl(&manager, project_id, artifact_rel)
        .await
        .expect("read artifact");

    assert_eq!(contents, "{\"hello\":\"world\"}");
}

#[tokio::test]
async fn update_jliff_segment_updates_target() {
    let (manager, project_id, _temp, root) = seed_project().await;
    let jliff_rel = "jliff/demo.jliff.json";
    let jliff_path = root.join(jliff_rel);
    fs::create_dir_all(jliff_path.parent().unwrap()).expect("create jliff dir");
    let jliff_doc = json!({
        "Project_name": "Demo",
        "Project_ID": "proj-1",
        "File": "demo.xlf",
        "User": "tester",
        "Source_language": "en-US",
        "Target_language": "fr-FR",
        "Transunits": [json!({
            "unit id": "u1",
            "transunit_id": "seg-1",
            "Source": "Hello",
            "Target_translation": "Bonjour",
        })],
    });
    fs::write(&jliff_path, serde_json::to_string_pretty(&jliff_doc).unwrap()).expect("seed jliff");

    let result = update_jliff_segment_impl(
        &manager,
        project_id,
        jliff_rel,
        "seg-1",
        "Salut".to_string(),
    )
    .await
    .expect("update segment");

    assert_eq!(result.updated_count, 1);
    assert!(!result.updated_at.is_empty());

    let updated = fs::read_to_string(jliff_path).expect("read updated jliff");
    assert!(updated.contains("Salut"));
}

#[tokio::test]
async fn update_jliff_segment_rejects_unknown_transunit() {
    let (manager, project_id, _temp, root) = seed_project().await;
    let jliff_rel = "jliff/demo.jliff.json";
    let jliff_path = root.join(jliff_rel);
    fs::create_dir_all(jliff_path.parent().unwrap()).expect("create jliff dir");
    let jliff_doc = json!({
        "Project_name": "Demo",
        "Project_ID": "proj-1",
        "File": "demo.xlf",
        "User": "tester",
        "Source_language": "en-US",
        "Target_language": "fr-FR",
        "Transunits": [],
    });
    fs::write(&jliff_path, serde_json::to_string_pretty(&jliff_doc).unwrap()).expect("seed jliff");

    let err = update_jliff_segment_impl(
        &manager,
        project_id,
        jliff_rel,
        "seg-404",
        "Salut".to_string(),
    )
    .await
    .expect_err("missing transunit should error");

    assert!(err.to_string().contains("was not found"));
}

async fn seed_project() -> (DbManager, Uuid, TempDir, std::path::PathBuf) {
    let manager = new_manager().await;
    let project_id = Uuid::new_v4();
    let temp = tempdir().expect("tempdir");
    let root = temp.path().join("project-root");
    fs::create_dir_all(&root).expect("create project root");

    let project = NewProject {
        id: project_id,
        name: "Demo".into(),
        slug: "demo".into(),
        project_type: PType::Translation,
        root_path: root.to_string_lossy().to_string(),
        status: PStatus::Active,
        default_src_lang: Some("en-US".into()),
        default_tgt_lang: Some("fr-FR".into()),
        metadata: None,
    };

    manager
        .insert_project_with_files(&project, &[])
        .await
        .expect("insert project");

    (manager, project_id, temp, root)
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
