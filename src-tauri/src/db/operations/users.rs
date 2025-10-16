//! Standalone user operations for the refactored schema.

use sqlx::{QueryBuilder, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::db::error::DbResult;
use crate::db::types::{
    NewUserArgs, PermissionOverrideInput, UpdateUserArgs, UserPermissionOverrideRecord,
    UserProfile, UserRecord, UserRoleRecord,
};

/// Creates a user with roles and permission overrides.
pub async fn create_user(pool: &SqlitePool, args: NewUserArgs) -> DbResult<UserProfile> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO users (user_uuid, username, email, phone, address)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
    )
    .bind(args.user_uuid)
    .bind(&args.username)
    .bind(&args.email)
    .bind(&args.phone)
    .bind(&args.address)
    .execute(&mut *tx)
    .await?;

    replace_roles(&mut tx, args.user_uuid, &args.roles).await?;
    replace_permission_overrides(&mut tx, args.user_uuid, &args.permission_overrides).await?;

    let profile = fetch_user_profile(&mut tx, args.user_uuid).await?;
    tx.commit().await?;

    profile.ok_or_else(|| sqlx::Error::RowNotFound.into())
}

/// Updates a user and optionally replaces list relationships.
pub async fn update_user(pool: &SqlitePool, args: UpdateUserArgs) -> DbResult<Option<UserProfile>> {
    let mut tx = pool.begin().await?;

    if args.username.is_some()
        || args.email.is_some()
        || args.phone.is_some()
        || args.address.is_some()
    {
        let mut builder = QueryBuilder::<Sqlite>::new("UPDATE users SET ");
        let mut first = true;

        if let Some(username) = args.username.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("username = ");
            builder.push_bind(username);
            first = false;
        }

        if let Some(email) = args.email.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("email = ");
            builder.push_bind(email);
            first = false;
        }

        if let Some(phone) = args.phone.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("phone = ");
            builder.push_bind(phone.clone());
            first = false;
        }

        if let Some(address) = args.address.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("address = ");
            builder.push_bind(address.clone());
        }

        builder.push(" WHERE user_uuid = ");
        builder.push_bind(args.user_uuid);
        builder.build().execute(&mut *tx).await?;
    }

    if let Some(roles) = args.roles.as_ref() {
        replace_roles(&mut tx, args.user_uuid, roles).await?;
    }

    if let Some(overrides) = args.permission_overrides.as_ref() {
        replace_permission_overrides(&mut tx, args.user_uuid, overrides).await?;
    }

    let profile = fetch_user_profile(&mut tx, args.user_uuid).await?;
    tx.commit().await?;

    Ok(profile)
}

/// Deletes a user.
pub async fn delete_user(pool: &SqlitePool, user_uuid: Uuid) -> DbResult<()> {
    sqlx::query("DELETE FROM users WHERE user_uuid = ?1")
        .bind(user_uuid)
        .execute(pool)
        .await?;
    Ok(())
}

/// Retrieves a user profile.
pub async fn get_user(pool: &SqlitePool, user_uuid: Uuid) -> DbResult<Option<UserProfile>> {
    let mut tx = pool.begin().await?;
    let profile = fetch_user_profile(&mut tx, user_uuid).await?;
    tx.commit().await?;
    Ok(profile)
}

/// Lists all user profiles.
pub async fn list_users(pool: &SqlitePool) -> DbResult<Vec<UserProfile>> {
    let mut tx = pool.begin().await?;
    let rows: Vec<UserRecord> =
        sqlx::query_as("SELECT * FROM users ORDER BY username COLLATE NOCASE ASC")
            .fetch_all(&mut *tx)
            .await?;
    let mut profiles = Vec::with_capacity(rows.len());
    for user in rows {
        let roles = fetch_roles(&mut tx, user.user_uuid).await?;
        let overrides = fetch_overrides(&mut tx, user.user_uuid).await?;
        profiles.push(UserProfile {
            user,
            roles,
            permission_overrides: overrides,
        });
    }
    tx.commit().await?;
    Ok(profiles)
}

async fn replace_roles(
    tx: &mut Transaction<'_, Sqlite>,
    user_uuid: Uuid,
    roles: &[String],
) -> DbResult<()> {
    sqlx::query("DELETE FROM user_roles WHERE user_uuid = ?1")
        .bind(user_uuid)
        .execute(&mut **tx)
        .await?;

    for role in roles {
        sqlx::query(
            "INSERT INTO user_roles (user_uuid, role)
             VALUES (?1, ?2)",
        )
        .bind(user_uuid)
        .bind(role)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn replace_permission_overrides(
    tx: &mut Transaction<'_, Sqlite>,
    user_uuid: Uuid,
    overrides: &[PermissionOverrideInput],
) -> DbResult<()> {
    sqlx::query("DELETE FROM user_permission_overrides WHERE user_uuid = ?1")
        .bind(user_uuid)
        .execute(&mut **tx)
        .await?;

    for entry in overrides {
        sqlx::query(
            "INSERT INTO user_permission_overrides (user_uuid, permission, is_allowed)
             VALUES (?1, ?2, ?3)",
        )
        .bind(user_uuid)
        .bind(&entry.permission)
        .bind(entry.is_allowed)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn fetch_user_profile(
    tx: &mut Transaction<'_, Sqlite>,
    user_uuid: Uuid,
) -> DbResult<Option<UserProfile>> {
    let user = sqlx::query_as::<_, UserRecord>("SELECT * FROM users WHERE user_uuid = ?1 LIMIT 1")
        .bind(user_uuid)
        .fetch_optional(&mut **tx)
        .await?;

    if let Some(user) = user {
        let roles = fetch_roles(tx, user_uuid).await?;
        let overrides = fetch_overrides(tx, user_uuid).await?;
        Ok(Some(UserProfile {
            user,
            roles,
            permission_overrides: overrides,
        }))
    } else {
        Ok(None)
    }
}

async fn fetch_roles(
    tx: &mut Transaction<'_, Sqlite>,
    user_uuid: Uuid,
) -> DbResult<Vec<UserRoleRecord>> {
    let rows = sqlx::query_as::<_, UserRoleRecord>(
        "SELECT * FROM user_roles WHERE user_uuid = ?1 ORDER BY role ASC",
    )
    .bind(user_uuid)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows)
}

async fn fetch_overrides(
    tx: &mut Transaction<'_, Sqlite>,
    user_uuid: Uuid,
) -> DbResult<Vec<UserPermissionOverrideRecord>> {
    let rows = sqlx::query_as::<_, UserPermissionOverrideRecord>(
        "SELECT * FROM user_permission_overrides WHERE user_uuid = ?1 ORDER BY permission ASC",
    )
    .bind(user_uuid)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows)
}
