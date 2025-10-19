use std::fs;
use std::path::PathBuf;

use tauri::test::mock_app;
use tempfile::tempdir;
use uuid::Uuid;

use weg_translator_lib::ipc_test::{
    CreateProjectWithAssetsPayload, ProjectAssetDescriptorDto, ProjectAssetRoleDto,
    ProjectLanguagePairDto, create_project_with_assets_impl, test_support,
};
use weg_translator_lib::{
    DatabasePerformanceConfig, DbManager, NewUserArgs, PermissionOverrideInput,
};

#[tokio::test]
async fn copy_failure_cleans_up_project_scaffold() {
    let temp = tempdir().expect("tempdir should create project root");
    let project_root = temp.path().join("demo-project");

    let guard = test_support::create_scaffold(project_root.clone())
        .await
        .expect("scaffold creation should succeed");

    // Prepare an asset that references a missing source file to trigger the failure path.
    let missing_asset = ProjectAssetDescriptorDto {
        draft_id: "draft-1".into(),
        name: "missing.txt".into(),
        extension: "txt".into(),
        role: ProjectAssetRoleDto::Processable,
        path: temp
            .path()
            .join("missing.txt")
            .to_string_lossy()
            .into_owned(),
    };

    let result = test_support::copy_assets(guard.project_root(), &[missing_asset]).await;
    assert!(
        result.is_err(),
        "copy should fail for nonexistent source path"
    );

    drop(guard);

    assert!(
        !project_root.exists(),
        "project scaffold should be rolled back when copy fails"
    );

    // Ensure the parent temp directory remains for other assertions.
    assert!(temp.path().exists());
    assert!(fs::read_dir(temp.path()).unwrap().next().is_none());
}

#[tokio::test]
async fn command_rollback_removes_db_entries_on_copy_failure() {
    let temp = tempdir().expect("tempdir should allocate workspace");
    let app_folder = temp.path().join("app");
    let settings_manager = test_support::build_settings_manager(app_folder.clone());

    let db_manager = DbManager::new_with_base_dir_and_performance(
        &app_folder,
        DatabasePerformanceConfig::default(),
    )
    .await
    .expect("database initialization should succeed");

    let user_uuid = Uuid::new_v4();
    db_manager
        .create_user_profile(sample_user_args(user_uuid))
        .await
        .expect("user profile creation should succeed");

    let tauri_app = mock_app();
    let app_handle = tauri_app.handle().clone();

    let payload = CreateProjectWithAssetsPayload {
        project_name: "Demo Project".into(),
        project_folder_name: "demo-project".into(),
        project_status: "active".into(),
        user_uuid: user_uuid.to_string(),
        client_uuid: None,
        r#type: "translation".into(),
        notes: None,
        subjects: Vec::new(),
        language_pairs: vec![ProjectLanguagePairDto {
            source_lang: "en-US".into(),
            target_lang: "it-IT".into(),
        }],
        assets: vec![ProjectAssetDescriptorDto {
            draft_id: "draft-missing".into(),
            name: "missing.txt".into(),
            extension: "txt".into(),
            role: ProjectAssetRoleDto::Processable,
            path: missing_asset_path(&app_folder),
        }],
    };

    let result =
        create_project_with_assets_impl(app_handle, &db_manager, &settings_manager, payload).await;
    assert!(
        result.is_err(),
        "command should fail when the source asset does not exist"
    );

    let project_root = app_folder.join("projects").join("demo-project");
    assert!(
        !project_root.exists(),
        "project directory should be removed after command rollback"
    );

    let project_records = db_manager
        .list_project_records()
        .await
        .expect("listing project records should succeed");
    assert!(
        project_records.is_empty(),
        "database should not retain project rows after rollback"
    );
}

fn sample_user_args(user_uuid: Uuid) -> NewUserArgs {
    NewUserArgs {
        user_uuid,
        username: "wizard-user".into(),
        email: "wizard@example.com".into(),
        phone: None,
        address: None,
        roles: vec!["owner".into()],
        permission_overrides: vec![PermissionOverrideInput {
            permission: "projects:create".into(),
            is_allowed: true,
        }],
    }
}

fn missing_asset_path(app_folder: &PathBuf) -> String {
    app_folder
        .join("originals")
        .join("missing.txt")
        .to_string_lossy()
        .into_owned()
}
