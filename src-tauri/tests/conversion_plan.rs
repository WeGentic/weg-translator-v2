use std::path::{Path, PathBuf};
use std::{env, fs};

use tempfile::TempDir;
use uuid::Uuid;

use sqlx::query;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

use weg_translator_lib::ipc_test::build_conversions_plan;
use weg_translator_lib::{
    DbManager, FileTargetStatus as FTStatus, LOCAL_OWNER_USER_ID, NewProject, NewProjectFile,
    ProjectFileConversionRequest, ProjectFileImportStatus as FileImportStatus,
    ProjectFileRole as FileRole, ProjectFileStorageState as FileStorageState,
    ProjectLifecycleStatus as LifecycleStatus, ProjectStatus, ProjectType,
    build_original_stored_rel_path, initialise_schema,
};

#[tokio::test]
async fn build_conversions_plan_generates_expected_tasks() {
    let temp_dir = scoped_tempdir();
    let db_dir = temp_dir.path().join("db");
    fs::create_dir_all(&db_dir).expect("create db dir");
    let db_dir = db_dir.canonicalize().expect("canonicalize db dir");
    let manager = create_manager(&db_dir).await;

    let project_root = temp_dir.path().join("project-root");
    fs::create_dir_all(&project_root).expect("create project root");

    let (project_id, file_id, stored_rel_path) =
        seed_project_with_file(&manager, &project_root, "welcome.docx").await;

    let request = ProjectFileConversionRequest::new("en-US", "it-IT", "2.0");
    let conversion = manager
        .find_or_create_conversion_for_file(file_id, &request)
        .await
        .expect("create conversion row");
    assert!(conversion.xliff_rel_path.is_none());

    manager
        .list_project_details(project_id)
        .await
        .expect("list project details");

    let pair = manager
        .ensure_language_pair(project_id, "en-US", "it-IT")
        .await
        .expect("ensure language pair");
    manager
        .ensure_file_target(file_id, pair.pair_id, FTStatus::Pending)
        .await
        .expect("create file target");

    let plan = build_conversions_plan(&manager, project_id)
        .await
        .expect("build conversions plan");

    assert_eq!(plan.project_id, project_id.to_string());
    assert_eq!(plan.src_lang, "en-US");
    assert_eq!(plan.tgt_lang, "it-IT");
    assert_eq!(plan.version, "2.0");
    assert_eq!(plan.tasks.len(), 1, "expected one conversion task");

    let task = &plan.tasks[0];
    assert_eq!(task.project_file_id, file_id.to_string());
    assert_eq!(task.src_lang, "en-US");
    assert_eq!(task.tgt_lang, "it-IT");
    assert!(
        task.paragraph,
        "paragraph mode should be enabled by default"
    );
    assert!(task.embed, "embed mode should be enabled by default");

    let expected_input = project_root.join(&stored_rel_path);
    assert_eq!(
        PathBuf::from(&task.input_abs_path),
        expected_input,
        "input_abs_path should reference original file location"
    );

    let expected_output = project_root
        .join("artifacts")
        .join("xliff")
        .join("en-US__it-IT")
        .join(format!("{file_id}.xlf"));
    assert_eq!(
        PathBuf::from(&task.output_abs_path),
        expected_output,
        "output_abs_path should target artifact directory"
    );

    assert!(
        project_root
            .join("artifacts")
            .join("xliff")
            .join("en-US__it-IT")
            .exists(),
        "conversion planning should prepare xliff directory structure"
    );

    let file_targets = manager
        .list_file_targets_for_file(file_id)
        .await
        .expect("fetch file targets");
    assert_eq!(
        file_targets.len(),
        1,
        "expected a single file target for the language pair"
    );
}

#[tokio::test]
async fn artifact_upsert_updates_existing_record() {
    let temp_dir = scoped_tempdir();
    let db_dir = temp_dir.path().join("db");
    fs::create_dir_all(&db_dir).expect("create db dir");
    let db_dir = db_dir.canonicalize().expect("canonicalize db dir");
    let manager = create_manager(&db_dir).await;

    let project_root = temp_dir.path().join("project-root");
    fs::create_dir_all(&project_root).expect("create project root");

    let (project_id, file_id, stored_rel_path) =
        seed_project_with_file(&manager, &project_root, "brochure.docx").await;

    let request = ProjectFileConversionRequest::new("en-US", "it-IT", "2.0");
    manager
        .find_or_create_conversion_for_file(file_id, &request)
        .await
        .expect("create conversion");

    manager
        .list_project_details(project_id)
        .await
        .expect("list project details");

    let pair = manager
        .ensure_language_pair(project_id, "en-US", "it-IT")
        .await
        .expect("ensure language pair");
    manager
        .ensure_file_target(file_id, pair.pair_id, FTStatus::Pending)
        .await
        .expect("create file target");

    // Ensure conversion planning uses the existing file target.
    let plan = build_conversions_plan(&manager, project_id)
        .await
        .expect("build plan for bridging");
    assert_eq!(
        plan.tasks.len(),
        1,
        "expected conversion task after bridging"
    );
    let task = &plan.tasks[0];
    assert_eq!(
        PathBuf::from(&task.input_abs_path),
        project_root.join(&stored_rel_path),
        "plan should reference stored_rel_path within project root"
    );

    let targets = manager
        .list_file_targets_for_file(file_id)
        .await
        .expect("list file targets");
    let target = targets
        .first()
        .expect("expected a file target for conversion planning");

    let first_rel_path = format!("artifacts/xliff/en-US__it-IT/{}-draft.xlf", file_id);
    let artifact_id = manager
        .upsert_artifact_row(
            target.file_target_id,
            "xliff",
            &first_rel_path,
            Some(4_096),
            Some("hash-v1"),
            Some("OpenXLIFF 2.0"),
            "GENERATED",
        )
        .await
        .expect("initial artifact insert");

    let second_rel_path = format!("artifacts/xliff/en-US__it-IT/{}-final.xlf", file_id);
    manager
        .upsert_artifact_row(
            target.file_target_id,
            "xliff",
            &second_rel_path,
            Some(8_192),
            Some("hash-v2"),
            Some("OpenXLIFF 2.1"),
            "FAILED",
        )
        .await
        .expect("artifact upsert should update existing row");

    let artifacts = manager
        .list_artifacts_for_target(target.file_target_id)
        .await
        .expect("list artifacts for target");
    assert_eq!(artifacts.len(), 1);

    let artifact = &artifacts[0];
    assert_eq!(artifact.artifact_id, artifact_id);
    assert_eq!(artifact.rel_path, second_rel_path);
    assert_eq!(artifact.size_bytes, Some(8_192));
    assert_eq!(artifact.checksum.as_deref(), Some("hash-v2"));
    assert_eq!(artifact.tool.as_deref(), Some("OpenXLIFF 2.1"));
    assert_eq!(artifact.status.as_str(), "FAILED");
    assert!(
        Path::new(&artifact.rel_path).is_relative(),
        "rel_path should remain project-relative"
    );

    // Ensure the artifact output path aligns with the project root structure.
    let expected_output = project_root
        .join("artifacts")
        .join("xliff")
        .join("en-US__it-IT")
        .join(format!("{}-final.xlf", file_id));
    assert_eq!(
        expected_output,
        project_root.join(&second_rel_path),
        "artifact rel_path should be resolvable relative to project root"
    );
}

async fn create_manager(db_dir: &Path) -> DbManager {
    let db_file = db_dir.join("weg-translator.db");
    let connect_options = SqliteConnectOptions::new()
        .filename(&db_file)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await
        .expect("open sqlite database");

    query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .expect("enable foreign keys");
    query("PRAGMA journal_mode = WAL;")
        .execute(&pool)
        .await
        .expect("set WAL journal mode");
    query("PRAGMA synchronous = NORMAL;")
        .execute(&pool)
        .await
        .expect("set synchronous mode");

    initialise_schema(&pool).await.expect("apply schema");

    DbManager::from_pool(pool)
}

fn scoped_tempdir() -> TempDir {
    let mut base = env::current_dir().expect("resolve workspace directory");
    base.push("target");
    base.push("tmp-tests");
    fs::create_dir_all(&base).expect("prepare tmp-tests directory");
    TempDir::new_in(&base).expect("create scoped temp dir")
}

async fn seed_project_with_file(
    manager: &DbManager,
    project_root: &Path,
    file_name: &str,
) -> (Uuid, Uuid, String) {
    let project_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();

    let project = NewProject {
        id: project_id,
        name: "Conversion Demo".into(),
        slug: "conversion-demo".into(),
        project_type: ProjectType::Translation,
        root_path: project_root.to_string_lossy().to_string(),
        status: ProjectStatus::Active,
        owner_user_id: LOCAL_OWNER_USER_ID.to_string(),
        client_id: None,
        domain_id: None,
        lifecycle_status: LifecycleStatus::Ready,
        archived_at: None,
        default_src_lang: Some("en-US".into()),
        default_tgt_lang: Some("it-IT".into()),
        metadata: None,
    };

    let stored_rel_path = build_original_stored_rel_path(file_id, file_name);
    let project_file = NewProjectFile {
        id: file_id,
        project_id,
        original_name: file_name.into(),
        original_path: project_root.join(file_name).to_string_lossy().to_string(),
        stored_rel_path: stored_rel_path.clone(),
        ext: Path::new(file_name)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase(),
        size_bytes: Some(1_024),
        checksum_sha256: None,
        import_status: FileImportStatus::Imported,
        role: FileRole::Source,
        storage_state: FileStorageState::Copied,
        mime_type: None,
        hash_sha256: None,
        importer: None,
    };

    manager
        .insert_project_with_files(&project, &[project_file])
        .await
        .expect("insert project and file");

    (project_id, file_id, stored_rel_path)
}
