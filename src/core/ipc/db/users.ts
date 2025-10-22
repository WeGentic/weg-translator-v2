/**
 * IPC adapters for user CRUD backed by the v2 SQLite schema.
 */
import {
  CreateUserInput,
  UpdateUserInput,
  UserProfile,
  PermissionOverride,
} from "@/shared/types/database";

import { safeInvoke } from "../request";

type PermissionOverrideDto = PermissionOverride;

interface UserProfileDto {
  userUuid: string;
  username: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  roles: string[];
  permissionOverrides: PermissionOverrideDto[];
}

const COMMAND = {
  create: "create_user_profile_v2",
  update: "update_user_profile_v2",
  remove: "delete_user_profile_v2",
  get: "get_user_profile_v2",
  list: "list_user_profiles_v2",
} as const;

const includeIfDefined = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> =>
  value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, Value>>);

export async function createUserProfile(input: CreateUserInput): Promise<UserProfile> {
  const payload = mapCreateUserInput(input);
  const dto = await safeInvoke<UserProfileDto>(COMMAND.create, { payload });
  return mapUserProfileDto(dto);
}

export async function updateUserProfile(
  input: UpdateUserInput,
): Promise<UserProfile | null> {
  const payload = mapUpdateUserInput(input);
  const dto = await safeInvoke<UserProfileDto | null>(COMMAND.update, { payload });
  return dto ? mapUserProfileDto(dto) : null;
}

export async function deleteUserProfile(userUuid: string): Promise<void> {
  await safeInvoke<void>(COMMAND.remove, { user_uuid: userUuid, userUuid });
}

export async function getUserProfile(userUuid: string): Promise<UserProfile | null> {
  const dto = await safeInvoke<UserProfileDto | null>(COMMAND.get, { user_uuid: userUuid, userUuid });
  return dto ? mapUserProfileDto(dto) : null;
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  const dtos = await safeInvoke<UserProfileDto[]>(COMMAND.list);
  return dtos.map(mapUserProfileDto);
}

function mapCreateUserInput(input: CreateUserInput) {
  return {
    ...includeIfDefined("userUuid", input.userUuid),
    username: input.username,
    email: input.email,
    roles: input.roles ?? [],
    permissionOverrides: (input.permissionOverrides ?? []).map(mapPermissionOverrideInput),
    ...includeIfDefined("phone", input.phone),
    ...includeIfDefined("address", input.address),
  };
}

function mapUpdateUserInput(input: UpdateUserInput) {
  return {
    userUuid: input.userUuid,
    ...includeIfDefined("username", input.username),
    ...includeIfDefined("email", input.email),
    ...includeIfDefined("phone", input.phone),
    ...includeIfDefined("address", input.address),
    ...includeIfDefined("roles", input.roles),
    ...includeIfDefined(
      "permissionOverrides",
      input.permissionOverrides?.map(mapPermissionOverrideInput),
    ),
  };
}

function mapPermissionOverrideInput(override: PermissionOverride): PermissionOverrideDto {
  return {
    permission: override.permission,
    isAllowed: override.isAllowed,
  };
}

function mapUserProfileDto(dto: UserProfileDto): UserProfile {
  return {
    userUuid: dto.userUuid,
    username: dto.username,
    email: dto.email,
    phone: dto.phone ?? null,
    address: dto.address ?? null,
    roles: [...dto.roles],
    permissionOverrides: dto.permissionOverrides.map(mapPermissionOverrideInput),
  };
}
