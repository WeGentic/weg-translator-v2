//! Operations for persisting validation results on artifacts.

use uuid::Uuid;

use crate::db::builders::build_validation;
use crate::db::error::DbResult;
use crate::db::manager::DbManager;
use crate::db::types::Validation;
use crate::db::utils::now_iso8601;

impl DbManager {
    /// Inserts a validation record for an artifact.
    pub async fn insert_validation_record(
        &self,
        artifact_id: Uuid,
        validator: &str,
        passed: bool,
        result_json: Option<&serde_json::Value>,
    ) -> DbResult<Uuid> {
        let _guard = self.write_lock.lock().await;
        let pool = self.pool().await;
        let validation_id = Uuid::new_v4();
        let now = now_iso8601();

        sqlx::query(
            "INSERT INTO validations (
                 validation_id,
                 artifact_id,
                 validator,
                 passed,
                 result_json,
                 created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&validation_id.to_string())
        .bind(&artifact_id.to_string())
        .bind(validator)
        .bind(passed as i64)
        .bind(result_json.map(|value| value.to_string()))
        .bind(&now)
        .execute(&pool)
        .await?;

        Ok(validation_id)
    }

    /// Lists validation records for an artifact.
    pub async fn list_validations_for_artifact(
        &self,
        artifact_id: Uuid,
    ) -> DbResult<Vec<Validation>> {
        let pool = self.pool().await;
        let rows = sqlx::query(
            "SELECT validation_id, artifact_id, validator, passed, result_json, created_at
             FROM validations
             WHERE artifact_id = ?1
             ORDER BY created_at DESC",
        )
        .bind(&artifact_id.to_string())
        .fetch_all(&pool)
        .await?;

        let mut records = Vec::with_capacity(rows.len());
        for row in rows {
            records.push(build_validation(&row)?);
        }

        Ok(records)
    }
}
