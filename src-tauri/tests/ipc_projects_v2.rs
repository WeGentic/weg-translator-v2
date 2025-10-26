use sqlx::sqlite::SqlitePoolOptions;
use tauri::Manager;
use tauri::test::{mock_builder, mock_context, noop_assets};
use uuid::Uuid;

use weg_translator_lib::ipc_test::{get_project_bundle_v2, get_project_statistics_v2};
use weg_translator_lib::{
    DbManager, NewClientArgs, NewProjectArgs, NewUserArgs, ProjectLanguagePairInput,
    ProjectSubjectInput, initialise_schema,
};

async fn memory_manager() -> DbManager {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(":memory:")
        .await
        .expect("failed to open in-memory SQLite");
    initialise_schema(&pool)
        .await
        .expect("schema bootstrap should succeed");
    DbManager::from_pool(pool)
}

fn sample_user_args(user_uuid: Uuid) -> NewUserArgs {
    NewUserArgs {
        user_uuid,
        username: "ipc-command-user".into(),
        email: "ipc.user@example.com".into(),
        phone: None,
        address: None,
        roles: vec!["owner".into()],
        permission_overrides: vec![],
    }
}

fn sample_client_args(client_uuid: Uuid) -> NewClientArgs {
    NewClientArgs {
        client_uuid,
        name: "IPC Corp".into(),
        email: Some("ipc@example.com".into()),
        phone: None,
        address: None,
        vat_number: None,
        note: Some("Client used for IPC command coverage.".into()),
    }
}

fn sample_project_args(project_uuid: Uuid, user_uuid: Uuid, client_uuid: Uuid) -> NewProjectArgs {
    NewProjectArgs {
        project_uuid,
        project_name: "IPC Project Validation".into(),
        project_status: "active".into(),
        user_uuid,
        client_uuid: Some(client_uuid),
        r#type: "translation".into(),
        notes: Some("Created for IPC command coverage.".into()),
        subjects: vec![ProjectSubjectInput {
            subject: "demo".into(),
        }],
        language_pairs: vec![ProjectLanguagePairInput {
            source_lang: "en-US".into(),
            target_lang: "es-ES".into(),
        }],
    }
}

async fn seed_project(manager: &DbManager) -> Uuid {
    let user_uuid = Uuid::new_v4();
    manager
        .create_user_profile(sample_user_args(user_uuid))
        .await
        .expect("user creation should succeed");

    let client_uuid = Uuid::new_v4();
    manager
        .create_client_record(sample_client_args(client_uuid))
        .await
        .expect("client creation should succeed");

    let project_uuid = Uuid::new_v4();
    manager
        .create_project_bundle(sample_project_args(project_uuid, user_uuid, client_uuid))
        .await
        .expect("project creation should succeed");

    project_uuid
}

#[tokio::test]
async fn get_project_bundle_command_returns_payload() {
    let manager = memory_manager().await;
    let project_uuid = seed_project(&manager).await;

    let app = mock_builder()
        .manage(manager)
        .build(mock_context(noop_assets()))
        .expect("mock app should build");

    let state = app.state::<DbManager>();
    let result = get_project_bundle_v2(state, project_uuid.to_string())
        .await
        .expect("command should succeed");
    let bundle = result.expect("bundle should exist");

    assert_eq!(bundle.project.project_uuid, project_uuid.to_string());
    assert_eq!(bundle.language_pairs.len(), 1);
}

#[tokio::test]
async fn get_project_bundle_command_handles_missing_project() {
    let manager = memory_manager().await;

    let app = mock_builder()
        .manage(manager)
        .build(mock_context(noop_assets()))
        .expect("mock app should build");

    let missing_id = Uuid::new_v4().to_string();
    let state = app.state::<DbManager>();
    let result = get_project_bundle_v2(state, missing_id)
        .await
        .expect("command should succeed");
    assert!(result.is_none(), "missing project should yield None");
}

#[tokio::test]
async fn get_project_bundle_command_rejects_invalid_uuid() {
    let manager = memory_manager().await;

    let app = mock_builder()
        .manage(manager)
        .build(mock_context(noop_assets()))
        .expect("mock app should build");

    let state = app.state::<DbManager>();
    let error = get_project_bundle_v2(state, "not-a-uuid".into())
        .await
        .expect_err("invalid uuid should surface as an error");
    let message = error.0.to_string();
    assert!(
        message.contains("projectUuid"),
        "expected invalid UUID message, got: {message}"
    );
}

#[tokio::test]
async fn get_project_statistics_command_handles_missing_project() {
    let manager = memory_manager().await;

    let app = mock_builder()
        .manage(manager)
        .build(mock_context(noop_assets()))
        .expect("mock app should build");

    let missing_id = Uuid::new_v4().to_string();
    let state = app.state::<DbManager>();
    let result = get_project_statistics_v2(state, missing_id)
        .await
        .expect("statistics command should succeed");
    assert!(result.is_none(), "no stats expected for missing project");
}
