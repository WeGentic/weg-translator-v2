use tauri::State;
use uuid::Uuid;

use crate::db::DbManager;
use crate::db::types::{NewUserArgs, PermissionOverrideInput, UpdateUserArgs, UserProfile};
use crate::ipc::dto::{
    CreateUserPayload, PermissionOverrideDto, UpdateUserPayload, UserProfileDto,
};
use crate::ipc::error::{IpcError, IpcResult};

#[tauri::command]
pub async fn create_user_profile_v2(
    db: State<'_, DbManager>,
    payload: CreateUserPayload,
) -> IpcResult<UserProfileDto> {
    let args = map_new_user_args(payload)?;
    let profile = db.create_user_profile(args).await.map_err(IpcError::from)?;
    Ok(map_user_profile(profile))
}

#[tauri::command]
pub async fn update_user_profile_v2(
    db: State<'_, DbManager>,
    payload: UpdateUserPayload,
) -> IpcResult<Option<UserProfileDto>> {
    let args = map_update_user_args(payload)?;
    let profile = db.update_user_profile(args).await.map_err(IpcError::from)?;
    Ok(profile.map(map_user_profile))
}

#[tauri::command]
pub async fn delete_user_profile_v2(db: State<'_, DbManager>, user_uuid: String) -> IpcResult<()> {
    let uuid = parse_uuid(&user_uuid, "userUuid")?;
    db.delete_user_profile(uuid).await.map_err(IpcError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn get_user_profile_v2(
    db: State<'_, DbManager>,
    user_uuid: String,
) -> IpcResult<Option<UserProfileDto>> {
    let uuid = parse_uuid(&user_uuid, "userUuid")?;
    let profile = db.get_user_profile(uuid).await.map_err(IpcError::from)?;
    Ok(profile.map(map_user_profile))
}

#[tauri::command]
pub async fn list_user_profiles_v2(db: State<'_, DbManager>) -> IpcResult<Vec<UserProfileDto>> {
    let profiles = db.list_user_profiles().await.map_err(IpcError::from)?;
    Ok(profiles.into_iter().map(map_user_profile).collect())
}

fn map_new_user_args(payload: CreateUserPayload) -> Result<NewUserArgs, IpcError> {
    let user_uuid = payload
        .user_uuid
        .as_deref()
        .map(|value| parse_uuid(value, "userUuid"))
        .transpose()?
        .unwrap_or_else(Uuid::new_v4);

    Ok(NewUserArgs {
        user_uuid,
        username: payload.username,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        roles: payload.roles,
        permission_overrides: payload
            .permission_overrides
            .into_iter()
            .map(map_permission_override_input)
            .collect(),
    })
}

fn map_update_user_args(payload: UpdateUserPayload) -> Result<UpdateUserArgs, IpcError> {
    let user_uuid = parse_uuid(&payload.user_uuid, "userUuid")?;
    Ok(UpdateUserArgs {
        user_uuid,
        username: payload.username,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        roles: payload.roles,
        permission_overrides: payload.permission_overrides.map(|list| {
            list.into_iter()
                .map(map_permission_override_input)
                .collect()
        }),
    })
}

fn map_permission_override_input(dto: PermissionOverrideDto) -> PermissionOverrideInput {
    PermissionOverrideInput {
        permission: dto.permission,
        is_allowed: dto.is_allowed,
    }
}

fn map_user_profile(profile: UserProfile) -> UserProfileDto {
    UserProfileDto {
        user_uuid: profile.user.user_uuid.to_string(),
        username: profile.user.username,
        email: profile.user.email,
        phone: profile.user.phone,
        address: profile.user.address,
        roles: profile.roles.into_iter().map(|role| role.role).collect(),
        permission_overrides: profile
            .permission_overrides
            .into_iter()
            .map(|override_record| PermissionOverrideDto {
                permission: override_record.permission,
                is_allowed: override_record.is_allowed,
            })
            .collect(),
    }
}

fn parse_uuid(value: &str, field: &str) -> Result<Uuid, IpcError> {
    Uuid::parse_str(value)
        .map_err(|_| IpcError::Validation(format!("invalid {field}: expected UUID, got '{value}'")))
}
