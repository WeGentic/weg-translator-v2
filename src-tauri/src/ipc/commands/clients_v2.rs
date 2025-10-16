use tauri::State;
use uuid::Uuid;

use crate::db::DbManager;
use crate::db::types::{ClientRecord, NewClientArgs, UpdateClientArgs};
use crate::ipc::dto::{ClientDto, CreateClientPayload, UpdateClientPayload};
use crate::ipc::error::{IpcError, IpcResult};

#[tauri::command]
pub async fn create_client_record_v2(
    db: State<'_, DbManager>,
    payload: CreateClientPayload,
) -> IpcResult<ClientDto> {
    let args = map_new_client_args(payload)?;
    let record = db
        .create_client_record(args)
        .await
        .map_err(IpcError::from)?;
    Ok(map_client_record(record))
}

#[tauri::command]
pub async fn update_client_record_v2(
    db: State<'_, DbManager>,
    payload: UpdateClientPayload,
) -> IpcResult<Option<ClientDto>> {
    let args = map_update_client_args(payload)?;
    let record = db
        .update_client_record(args)
        .await
        .map_err(IpcError::from)?;
    Ok(record.map(map_client_record))
}

#[tauri::command]
pub async fn delete_client_record_v2(
    db: State<'_, DbManager>,
    client_uuid: String,
) -> IpcResult<()> {
    let uuid = parse_uuid(&client_uuid, "clientUuid")?;
    db.delete_client_record(uuid)
        .await
        .map_err(IpcError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn get_client_record_v2(
    db: State<'_, DbManager>,
    client_uuid: String,
) -> IpcResult<Option<ClientDto>> {
    let uuid = parse_uuid(&client_uuid, "clientUuid")?;
    let record = db.get_client_record(uuid).await.map_err(IpcError::from)?;
    Ok(record.map(map_client_record))
}

#[tauri::command]
pub async fn list_client_records_v2(db: State<'_, DbManager>) -> IpcResult<Vec<ClientDto>> {
    let records = db.list_client_records().await.map_err(IpcError::from)?;
    Ok(records.into_iter().map(map_client_record).collect())
}

fn map_new_client_args(payload: CreateClientPayload) -> Result<NewClientArgs, IpcError> {
    let client_uuid = payload
        .client_uuid
        .as_deref()
        .map(|value| parse_uuid(value, "clientUuid"))
        .transpose()?
        .unwrap_or_else(Uuid::new_v4);

    Ok(NewClientArgs {
        client_uuid,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        vat_number: payload.vat_number,
        note: payload.note,
    })
}

fn map_update_client_args(payload: UpdateClientPayload) -> Result<UpdateClientArgs, IpcError> {
    let client_uuid = parse_uuid(&payload.client_uuid, "clientUuid")?;
    Ok(UpdateClientArgs {
        client_uuid,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        vat_number: payload.vat_number,
        note: payload.note,
    })
}

fn map_client_record(record: ClientRecord) -> ClientDto {
    ClientDto {
        client_uuid: record.client_uuid.to_string(),
        name: record.name,
        email: record.email,
        phone: record.phone,
        address: record.address,
        vat_number: record.vat_number,
        note: record.note,
    }
}

fn parse_uuid(value: &str, field: &str) -> Result<Uuid, IpcError> {
    Uuid::parse_str(value)
        .map_err(|_| IpcError::Validation(format!("invalid {field}: expected UUID, got '{value}'")))
}
