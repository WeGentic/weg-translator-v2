use sqlx::sqlite::SqlitePoolOptions;
use uuid::Uuid;

use weg_translator_lib::{
    DbError, DbManager, FileLanguagePairInput, NewClientArgs, NewFileInfoArgs, NewProjectArgs,
    NewProjectFileArgs, NewUserArgs, PermissionOverrideInput, ProjectLanguagePairInput,
    ProjectSubjectInput, UpdateProjectArgs, initialise_schema,
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
        username: "demo-user".into(),
        email: "demo@example.com".into(),
        phone: None,
        address: None,
        roles: vec!["owner".into()],
        permission_overrides: vec![PermissionOverrideInput {
            permission: "projects:create".into(),
            is_allowed: true,
        }],
    }
}

fn sample_client_args(client_uuid: Uuid) -> NewClientArgs {
    NewClientArgs {
        client_uuid,
        name: "Acme Corp".into(),
        email: Some("contact@acme.example".into()),
        phone: None,
        address: None,
        vat_number: None,
        note: Some("Enterprise account".into()),
    }
}

fn sample_project_args(project_uuid: Uuid, user_uuid: Uuid, client_uuid: Uuid) -> NewProjectArgs {
    NewProjectArgs {
        project_uuid,
        project_name: "Marketing localization".into(),
        project_status: "active".into(),
        user_uuid,
        client_uuid: Some(client_uuid),
        r#type: "translation".into(),
        notes: Some("Priority launch".into()),
        subjects: vec![ProjectSubjectInput {
            subject: "marketing".into(),
        }],
        language_pairs: vec![ProjectLanguagePairInput {
            source_lang: "en-US".into(),
            target_lang: "it-IT".into(),
        }],
    }
}

#[tokio::test]
async fn project_bundle_round_trip_v2() {
    let manager = memory_manager().await;

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
    let bundle = manager
        .create_project_bundle(sample_project_args(project_uuid, user_uuid, client_uuid))
        .await
        .expect("project creation should succeed");

    assert_eq!(bundle.language_pairs.len(), 1);
    assert_eq!(bundle.subjects.len(), 1);
    assert_eq!(bundle.project.project_uuid, project_uuid);

    let file_uuid = Uuid::new_v4();
    manager
        .attach_project_file(
            NewFileInfoArgs {
                file_uuid,
                ext: "xliff".into(),
                r#type: "source".into(),
                size_bytes: Some(2048),
                segment_count: Some(42),
                token_count: Some(1024),
                notes: Some("Initial upload".into()),
            },
            NewProjectFileArgs {
                project_uuid,
                file_uuid,
                filename: "launch.xliff".into(),
                stored_at: "2024-01-01T00:00:00Z".into(),
                r#type: "source".into(),
                language_pairs: vec![FileLanguagePairInput {
                    source_lang: "en-US".into(),
                    target_lang: "it-IT".into(),
                }],
            },
        )
        .await
        .expect("file attachment should succeed");

    let refreshed = manager
        .get_project_bundle(project_uuid)
        .await
        .expect("bundle fetch should succeed")
        .expect("bundle should exist");
    assert_eq!(refreshed.files.len(), 1);

    manager
        .detach_project_file(project_uuid, file_uuid)
        .await
        .expect("detaching file should succeed");

    let after_detach = manager
        .get_project_bundle(project_uuid)
        .await
        .expect("bundle fetch should succeed")
        .expect("bundle should exist");
    assert!(
        after_detach.files.is_empty(),
        "files should be removed after detach"
    );
}

#[tokio::test]
async fn updating_language_pairs_requires_non_empty_list() {
    let manager = memory_manager().await;

    let user_uuid = Uuid::new_v4();
    manager
        .create_user_profile(sample_user_args(user_uuid))
        .await
        .expect("user creation should succeed");

    let project_uuid = Uuid::new_v4();
    manager
        .create_project_bundle(NewProjectArgs {
            project_uuid,
            project_name: "Validation project".into(),
            project_status: "active".into(),
            user_uuid,
            client_uuid: None,
            r#type: "translation".into(),
            notes: None,
            subjects: vec![],
            language_pairs: vec![ProjectLanguagePairInput {
                source_lang: "en-US".into(),
                target_lang: "fr-FR".into(),
            }],
        })
        .await
        .expect("project creation should succeed");

    let result = manager
        .update_project_bundle(UpdateProjectArgs {
            project_uuid,
            project_name: None,
            project_status: None,
            user_uuid: None,
            client_uuid: None,
            r#type: None,
            notes: None,
            subjects: None,
            language_pairs: Some(vec![]),
        })
        .await;

    match result {
        Err(DbError::ConstraintViolation(message)) => {
            assert!(
                message.contains("language pair"),
                "expected constraint message mentioning language pair, got {message}"
            );
        }
        other => panic!("expected constraint violation, got {other:?}"),
    }
}
