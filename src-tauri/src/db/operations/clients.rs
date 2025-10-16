//! Standalone client operations for the refactored schema.

use sqlx::{QueryBuilder, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::db::error::DbResult;
use crate::db::types::{ClientRecord, NewClientArgs, UpdateClientArgs};

/// Inserts a new client record.
pub async fn create_client(pool: &SqlitePool, args: NewClientArgs) -> DbResult<ClientRecord> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO clients (client_uuid, name, email, phone, address, vat_number, note)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
    )
    .bind(args.client_uuid)
    .bind(&args.name)
    .bind(&args.email)
    .bind(&args.phone)
    .bind(&args.address)
    .bind(&args.vat_number)
    .bind(&args.note)
    .execute(&mut *tx)
    .await?;

    let record = fetch_client(&mut tx, args.client_uuid).await?;
    tx.commit().await?;

    record.ok_or_else(|| sqlx::Error::RowNotFound.into())
}

/// Updates mutable fields for a client.
pub async fn update_client(
    pool: &SqlitePool,
    args: UpdateClientArgs,
) -> DbResult<Option<ClientRecord>> {
    let mut tx = pool.begin().await?;

    if args.name.is_some()
        || args.email.is_some()
        || args.phone.is_some()
        || args.address.is_some()
        || args.vat_number.is_some()
        || args.note.is_some()
    {
        let mut builder = QueryBuilder::<Sqlite>::new("UPDATE clients SET ");
        let mut first = true;

        if let Some(name) = args.name.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("name = ");
            builder.push_bind(name);
            first = false;
        }

        if let Some(email) = args.email.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("email = ");
            builder.push_bind(email.clone());
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
            first = false;
        }

        if let Some(vat_number) = args.vat_number.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("vat_number = ");
            builder.push_bind(vat_number.clone());
            first = false;
        }

        if let Some(note) = args.note.as_ref() {
            if !first {
                builder.push(", ");
            }
            builder.push("note = ");
            builder.push_bind(note.clone());
        }

        builder.push(" WHERE client_uuid = ");
        builder.push_bind(args.client_uuid);
        builder.build().execute(&mut *tx).await?;
    }

    let record = fetch_client(&mut tx, args.client_uuid).await?;
    tx.commit().await?;

    Ok(record)
}

/// Deletes a client.
pub async fn delete_client(pool: &SqlitePool, client_uuid: Uuid) -> DbResult<()> {
    sqlx::query("DELETE FROM clients WHERE client_uuid = ?1")
        .bind(client_uuid)
        .execute(pool)
        .await?;
    Ok(())
}

/// Retrieves a client by identifier.
pub async fn get_client(pool: &SqlitePool, client_uuid: Uuid) -> DbResult<Option<ClientRecord>> {
    let mut tx = pool.begin().await?;
    let record = fetch_client(&mut tx, client_uuid).await?;
    tx.commit().await?;
    Ok(record)
}

/// Lists clients ordered by name.
pub async fn list_clients(pool: &SqlitePool) -> DbResult<Vec<ClientRecord>> {
    let records: Vec<ClientRecord> =
        sqlx::query_as("SELECT * FROM clients ORDER BY name COLLATE NOCASE ASC")
            .fetch_all(pool)
            .await?;
    Ok(records)
}

async fn fetch_client(
    tx: &mut Transaction<'_, Sqlite>,
    client_uuid: Uuid,
) -> DbResult<Option<ClientRecord>> {
    let record =
        sqlx::query_as::<_, ClientRecord>("SELECT * FROM clients WHERE client_uuid = ?1 LIMIT 1")
            .bind(client_uuid)
            .fetch_optional(&mut **tx)
            .await?;
    Ok(record)
}
