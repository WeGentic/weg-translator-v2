/**
 * IPC adapters for client CRUD operations using the refactored schema.
 */
import {
  ClientRecord,
  CreateClientInput,
  UpdateClientInput,
} from "@/shared/types/database";

import { safeInvoke } from "../request";

interface ClientDto {
  clientUuid?: string | null;
  client_uuid?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  vatNumber?: string | null;
  vat_number?: string | null;
  note?: string | null;
}

const COMMAND = {
  create: "create_client_record_v2",
  update: "update_client_record_v2",
  remove: "delete_client_record_v2",
  get: "get_client_record_v2",
  list: "list_client_records_v2",
} as const;

const includeIfDefined = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> =>
  value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, Value>>);

export async function createClientRecord(input: CreateClientInput): Promise<ClientRecord> {
  const payload = mapCreateClientInput(input);
  const dto = await safeInvoke<ClientDto>(COMMAND.create, { payload });
  return mapClientDto(dto);
}

export async function updateClientRecord(
  input: UpdateClientInput,
): Promise<ClientRecord | null> {
  const payload = mapUpdateClientInput(input);
  const dto = await safeInvoke<ClientDto | null>(COMMAND.update, { payload });
  return dto ? mapClientDto(dto) : null;
}

export async function deleteClientRecord(clientUuid: string): Promise<void> {
  await safeInvoke<void>(COMMAND.remove, { client_uuid: clientUuid, clientUuid });
}

export async function getClientRecord(clientUuid: string): Promise<ClientRecord | null> {
  const dto = await safeInvoke<ClientDto | null>(COMMAND.get, { client_uuid: clientUuid, clientUuid });
  return dto ? mapClientDto(dto) : null;
}

export async function listClientRecords(): Promise<ClientRecord[]> {
  const dtos = await safeInvoke<ClientDto[]>(COMMAND.list);
  return dtos.map(mapClientDto);
}

function mapCreateClientInput(input: CreateClientInput) {
  return {
    name: input.name,
    ...includeIfDefined("clientUuid", input.clientUuid),
    ...includeIfDefined("email", input.email),
    ...includeIfDefined("phone", input.phone),
    ...includeIfDefined("address", input.address),
    ...includeIfDefined("vatNumber", input.vatNumber),
    ...includeIfDefined("note", input.note),
  };
}

function mapUpdateClientInput(input: UpdateClientInput) {
  return {
    clientUuid: input.clientUuid,
    ...includeIfDefined("name", input.name),
    ...includeIfDefined("email", input.email),
    ...includeIfDefined("phone", input.phone),
    ...includeIfDefined("address", input.address),
    ...includeIfDefined("vatNumber", input.vatNumber),
    ...includeIfDefined("note", input.note),
  };
}

function mapClientDto(dto: ClientDto): ClientRecord {
  const clientUuid = dto.clientUuid ?? dto.client_uuid ?? null;
  if (!clientUuid) {
    throw new Error("[IPC] list_client_records_v2 returned a client without an id");
  }
  const toNullable = (value?: string | null) => value ?? null;

  return {
    clientUuid,
    name: dto.name,
    email: toNullable(dto.email),
    phone: toNullable(dto.phone),
    address: toNullable(dto.address),
    vatNumber: toNullable(dto.vatNumber ?? dto.vat_number),
    note: toNullable(dto.note),
  };
}
