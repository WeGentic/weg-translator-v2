//! Operations for reference tables (users, clients, domains).

use crate::db::builders::{build_client, build_domain, build_user};
use crate::db::error::DbResult;
use crate::db::manager::DbManager;
use crate::db::types::{Client, Domain, User};
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Inserts or updates a user record.
    pub async fn upsert_user(
        &self,
        user_id: &str,
        email: &str,
        display_name: Option<&str>,
    ) -> DbResult<User> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let now = now_iso8601();

        let row = sqlx::query(
            "INSERT INTO users (user_id, email, display_name, created_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(user_id) DO UPDATE SET
                 email = excluded.email,
                 display_name = excluded.display_name
             RETURNING user_id, email, display_name, created_at",
        )
        .bind(user_id)
        .bind(email)
        .bind(display_name)
        .bind(&now)
        .fetch_one(&pool)
        .await?;

        build_user(&row)
    }

    /// Fetches a user record by identifier.
    pub async fn get_user_by_id(&self, user_id: &str) -> DbResult<Option<User>> {
        let pool = self.pool().await;
        let row = sqlx::query(
            "SELECT user_id, email, display_name, created_at
             FROM users
             WHERE user_id = ?1
             LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&pool)
        .await?;

        if let Some(row) = row {
            let user = build_user(&row)?;
            return Ok(Some(user));
        }

        Ok(None)
    }

    /// Ensures a client exists, returning the hydrated record.
    pub async fn ensure_client(&self, client_id: &str, name: &str) -> DbResult<Client> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;

        let row = sqlx::query(
            "INSERT INTO clients (client_id, name)
             VALUES (?1, ?2)
             ON CONFLICT(client_id) DO UPDATE SET name = excluded.name
             RETURNING client_id, name",
        )
        .bind(client_id)
        .bind(name)
        .fetch_one(&pool)
        .await?;

        build_client(&row)
    }

    /// Ensures a domain exists, returning the hydrated record.
    pub async fn ensure_domain(&self, domain_id: &str, name: &str) -> DbResult<Domain> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;

        let row = sqlx::query(
            "INSERT INTO domains (domain_id, name)
             VALUES (?1, ?2)
             ON CONFLICT(domain_id) DO UPDATE SET name = excluded.name
             RETURNING domain_id, name",
        )
        .bind(domain_id)
        .bind(name)
        .fetch_one(&pool)
        .await?;

        build_domain(&row)
    }

    /// Lists registered clients.
    pub async fn list_clients(&self) -> DbResult<Vec<Client>> {
        let pool = self.pool().await;
        let rows = sqlx::query("SELECT client_id, name FROM clients ORDER BY name ASC")
            .fetch_all(&pool)
            .await?;

        let mut clients = Vec::with_capacity(rows.len());
        for row in rows {
            clients.push(build_client(&row)?);
        }

        Ok(clients)
    }

    /// Lists registered domains.
    pub async fn list_domains(&self) -> DbResult<Vec<Domain>> {
        let pool = self.pool().await;
        let rows = sqlx::query("SELECT domain_id, name FROM domains ORDER BY name ASC")
            .fetch_all(&pool)
            .await?;

        let mut domains = Vec::with_capacity(rows.len());
        for row in rows {
            domains.push(build_domain(&row)?);
        }

        Ok(domains)
    }
}
