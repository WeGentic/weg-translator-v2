use std::fs;

use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;
use tempfile::tempdir;
use uuid::Uuid;

use weg_translator_lib::{
    ArtifactKind, DbManager, LOCAL_OWNER_USER_ID, MIGRATOR, NewProject, NewProjectFile,
    ProjectFileConversionRequest, ProjectFileConversionStatus as CStatus,
    ProjectFileImportStatus as FStatus, ProjectFileRole as PFileRole,
    ProjectFileStorageState as PFileState, ProjectLifecycleStatus as PLStatus,
    ProjectStatus as PStatus, ProjectType as PType, build_original_stored_rel_path,
};

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
        owner_user_id: LOCAL_OWNER_USER_ID.to_string(),
        client_id: None,
        domain_id: None,
        lifecycle_status: PLStatus::Ready,
        archived_at: None,
        default_src_lang: Some("en-US".into()),
        default_tgt_lang: Some("it-IT".into()),
        metadata: None,
    };
    let stored_rel_path = build_original_stored_rel_path(file_id, "file.docx");

    let file = NewProjectFile {
        id: file_id,
        project_id,
        original_name: "file.docx".into(),
        original_path: "/abs/file.docx".into(),
        stored_rel_path,
        ext: "docx".into(),
        size_bytes: Some(1024),
        checksum_sha256: None,
        import_status: FStatus::Imported,
        role: PFileRole::Source,
        storage_state: PFileState::Copied,
        mime_type: None,
        hash_sha256: None,
        importer: None,
    };
    manager
        .insert_project_with_files(&project, &[file])
        .await
        .expect("seed project and file");

    // Create or find conversion entry (should insert)
    let request = ProjectFileConversionRequest::new("en-US", "it-IT", "2.0");
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
            Some(format!("artifacts/xliff/en-US__it-IT/{}.xlf", file_id)),
            Some(format!(
                "artifacts/xjliff/en-US__it-IT/{}.jliff.json",
                file_id
            )),
            Some(format!(
                "artifacts/xjliff/en-US__it-IT/{}.tags.json",
                file_id
            )),
            None,
            None,
            Some(now()),
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
        owner_user_id: LOCAL_OWNER_USER_ID.to_string(),
        client_id: None,
        domain_id: None,
        lifecycle_status: PLStatus::Ready,
        archived_at: None,
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
            stored_rel_path: build_original_stored_rel_path(f_docx, "a.docx"),
            ext: "docx".into(),
            size_bytes: None,
            checksum_sha256: None,
            import_status: FStatus::Imported,
            role: PFileRole::Source,
            storage_state: PFileState::Copied,
            mime_type: None,
            hash_sha256: None,
            importer: None,
        },
        NewProjectFile {
            id: f_xlf,
            project_id,
            original_name: "b.xliff".into(),
            original_path: "/abs/b.xliff".into(),
            stored_rel_path: build_original_stored_rel_path(f_xlf, "b.xliff"),
            ext: "xliff".into(),
            size_bytes: None,
            checksum_sha256: None,
            import_status: FStatus::Imported,
            role: PFileRole::Other,
            storage_state: PFileState::Copied,
            mime_type: None,
            hash_sha256: None,
            importer: None,
        },
        NewProjectFile {
            id: f_html,
            project_id,
            original_name: "c.html".into(),
            original_path: "/abs/c.html".into(),
            stored_rel_path: build_original_stored_rel_path(f_html, "c.html"),
            ext: "html".into(),
            size_bytes: None,
            checksum_sha256: None,
            import_status: FStatus::Imported,
            role: PFileRole::Source,
            storage_state: PFileState::Copied,
            mime_type: None,
            hash_sha256: None,
            importer: None,
        },
    ];
    manager
        .insert_project_with_files(&project, &files)
        .await
        .expect("seed project files");

    // Mark one conversion as failed to include in pending
    let request = ProjectFileConversionRequest::new("en-US", "it-IT", "2.0");
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

#[tokio::test]
async fn backfill_legacy_conversions_creates_file_targets() {
    let manager = new_manager().await;

    let project_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let project = NewProject {
        id: project_id,
        name: "Legacy Project".into(),
        slug: "legacy-project".into(),
        project_type: PType::Translation,
        root_path: "/tmp/legacy-project".into(),
        status: PStatus::Active,
        owner_user_id: LOCAL_OWNER_USER_ID.to_string(),
        client_id: None,
        domain_id: None,
        lifecycle_status: PLStatus::Ready,
        archived_at: None,
        default_src_lang: Some("en-US".into()),
        default_tgt_lang: Some("de-DE".into()),
        metadata: None,
    };

    let stored_rel_path = build_original_stored_rel_path(file_id, "legacy.docx");
    let file = NewProjectFile {
        id: file_id,
        project_id,
        original_name: "legacy.docx".into(),
        original_path: "/abs/legacy.docx".into(),
        stored_rel_path: stored_rel_path.clone(),
        ext: "docx".into(),
        size_bytes: Some(2048),
        checksum_sha256: None,
        import_status: FStatus::Imported,
        role: PFileRole::Source,
        storage_state: PFileState::Copied,
        mime_type: None,
        hash_sha256: None,
        importer: None,
    };

    manager
        .insert_project_with_files(&project, &[file])
        .await
        .expect("seed legacy project");

    let request = ProjectFileConversionRequest::new("en-US", "de-DE", "2.0");
    manager
        .find_or_create_conversion_for_file(file_id, &request)
        .await
        .expect("create legacy conversion row");

    let language_summary = manager
        .backfill_project_language_pairs("en-US", "de-DE")
        .await
        .expect("backfill language pairs");
    assert_eq!(language_summary.inserted_pairs, 1);

    let summary = manager
        .backfill_file_targets_from_legacy(None)
        .await
        .expect("run legacy backfill");

    assert_eq!(summary.scanned_projects, 1);
    assert_eq!(summary.bridged_conversions, 1);
    assert_eq!(summary.newly_created_language_pairs, 0);
    assert_eq!(summary.newly_created_file_targets, 1);
    assert_eq!(summary.updated_statuses, 0);
    assert_eq!(summary.xliff_artifacts_upserted, 0);
    assert_eq!(summary.jliff_artifacts_upserted, 0);

    let targets = manager
        .list_file_targets_for_file(file_id)
        .await
        .expect("fetch file targets after backfill");
    assert_eq!(targets.len(), 1);
    assert_eq!(targets[0].file_id, file_id);
}

#[tokio::test]
async fn register_existing_artifacts_records_files() {
    let manager = new_manager().await;

    let temp_dir = tempdir().expect("temp dir");
    let project_root = temp_dir.path().join("project-root");
    fs::create_dir_all(project_root.join("artifacts/xliff/en-US__de-DE"))
        .expect("create xliff dir");
    fs::create_dir_all(project_root.join("artifacts/xjliff/en-US__de-DE"))
        .expect("create xjliff dir");

    let project_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let project = NewProject {
        id: project_id,
        name: "Artifact Project".into(),
        slug: "artifact-project".into(),
        project_type: PType::Translation,
        root_path: project_root.to_string_lossy().to_string(),
        status: PStatus::Active,
        owner_user_id: LOCAL_OWNER_USER_ID.to_string(),
        client_id: None,
        domain_id: None,
        lifecycle_status: PLStatus::Ready,
        archived_at: None,
        default_src_lang: Some("en-US".into()),
        default_tgt_lang: Some("de-DE".into()),
        metadata: None,
    };

    let stored_rel_path = build_original_stored_rel_path(file_id, "legacy.docx");
    let file = NewProjectFile {
        id: file_id,
        project_id,
        original_name: "legacy.docx".into(),
        original_path: "/abs/legacy.docx".into(),
        stored_rel_path,
        ext: "docx".into(),
        size_bytes: Some(1024),
        checksum_sha256: None,
        import_status: FStatus::Imported,
        role: PFileRole::Source,
        storage_state: PFileState::Copied,
        mime_type: None,
        hash_sha256: None,
        importer: None,
    };

    manager
        .insert_project_with_files(&project, &[file])
        .await
        .expect("seed project for artifact registration");

    manager
        .ensure_language_pair(project_id, "en-US", "de-DE")
        .await
        .expect("ensure language pair");

    let xliff_path = project_root
        .join("artifacts/xliff/en-US__de-DE")
        .join(format!("{}.xlf", file_id));
    fs::write(&xliff_path, b"<xliff sample>").expect("write xliff");

    let jliff_path = project_root
        .join("artifacts/xjliff/en-US__de-DE")
        .join(format!("{}.jliff.json", file_id));
    fs::write(&jliff_path, br#"{"jliff":"sample"}"#).expect("write jliff");

    let summary = manager
        .backfill_artifacts_from_disk(None)
        .await
        .expect("run filesystem artifact backfill");

    assert_eq!(summary.projects_scanned, 1);
    assert_eq!(summary.xliff_registered, 1);
    assert_eq!(summary.jliff_registered, 1);
    assert_eq!(summary.already_indexed, 0);
    assert_eq!(summary.skipped_unknown_language, 0);
    assert_eq!(summary.skipped_invalid_name, 0);
    assert_eq!(summary.checksum_failures, 0);

    let targets = manager
        .list_file_targets_for_file(file_id)
        .await
        .expect("list file targets after artifact indexing");
    assert_eq!(targets.len(), 1);
    let target = &targets[0];

    let artifacts = manager
        .list_artifacts_for_target(target.file_target_id)
        .await
        .expect("list artifacts for target");
    assert_eq!(artifacts.len(), 2);

    let xliff_artifact = artifacts
        .iter()
        .find(|artifact| artifact.kind == ArtifactKind::Xliff)
        .expect("xliff artifact present");
    let jliff_artifact = artifacts
        .iter()
        .find(|artifact| artifact.kind == ArtifactKind::Jliff)
        .expect("jliff artifact present");

    let xliff_rel = xliff_artifact.rel_path.replace('\\', "/");
    assert!(xliff_rel.ends_with(&format!("artifacts/xliff/en-US__de-DE/{}.xlf", file_id)));
    let jliff_rel = jliff_artifact.rel_path.replace('\\', "/");
    assert!(jliff_rel.ends_with(&format!(
        "artifacts/xjliff/en-US__de-DE/{}.jliff.json",
        file_id
    )));

    let mut xliff_hasher = Sha256::new();
    xliff_hasher.update(b"<xliff sample>");
    let expected_xliff_hash = format!("{:x}", xliff_hasher.finalize());
    assert_eq!(
        xliff_artifact.checksum.as_deref(),
        Some(expected_xliff_hash.as_str())
    );

    let mut jliff_hasher = Sha256::new();
    jliff_hasher.update(br#"{"jliff":"sample"}"#);
    let expected_jliff_hash = format!("{:x}", jliff_hasher.finalize());
    assert_eq!(
        jliff_artifact.checksum.as_deref(),
        Some(expected_jliff_hash.as_str())
    );
}

async fn new_manager() -> DbManager {
    let pool = new_test_pool().await;
    MIGRATOR.run(&pool).await.expect("apply migrations");
    DbManager::from_pool(pool)
}

async fn new_test_pool() -> SqlitePool {
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect(":memory:")
        .await
        .expect("open memory db")
}

fn now() -> String {
    // ISO-8601 string acceptable for tests
    "2024-01-01T00:00:00Z".to_string()
}
