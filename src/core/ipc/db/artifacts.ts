/**
 * IPC adapters for artifact CRUD/status management.
 */
import {
  ArtifactRecord,
  UpsertArtifactInput,
  UpdateArtifactStatusInput,
} from "@/shared/types/database";

import { safeInvoke } from "../request";

type ArtifactDto = ArtifactRecord;

const COMMAND = {
  upsert: "upsert_artifact_record_v2",
  updateStatus: "update_artifact_status_v2",
  remove: "delete_artifact_record_v2",
  listForFile: "list_artifacts_for_file_v2",
} as const;

export async function upsertArtifactRecord(
  input: UpsertArtifactInput,
): Promise<ArtifactRecord> {
  const payload = mapUpsertArtifactInput(input);
  const dto = await safeInvoke<ArtifactDto>(COMMAND.upsert, { payload });
  return mapArtifactDto(dto);
}

export async function updateArtifactStatus(
  input: UpdateArtifactStatusInput,
): Promise<ArtifactRecord | null> {
  const payload = mapUpdateArtifactStatusInput(input);
  const dto = await safeInvoke<ArtifactDto | null>(COMMAND.updateStatus, { payload });
  return dto ? mapArtifactDto(dto) : null;
}

export async function deleteArtifactRecord(artifactUuid: string): Promise<void> {
  await safeInvoke<void>(COMMAND.remove, { artifact_uuid: artifactUuid, artifactUuid });
}

export async function listArtifactsForFile(
  projectUuid: string,
  fileUuid: string,
): Promise<ArtifactRecord[]> {
  const dtos = await safeInvoke<ArtifactDto[]>(COMMAND.listForFile, {
    project_uuid: projectUuid,
    projectUuid,
    file_uuid: fileUuid,
    fileUuid,
  });
  return dtos.map(mapArtifactDto);
}

function mapUpsertArtifactInput(input: UpsertArtifactInput) {
  return {
    artifactUuid: input.artifactUuid ?? undefined,
    projectUuid: input.projectUuid,
    fileUuid: input.fileUuid,
    artifactType: input.artifactType,
    sizeBytes: input.sizeBytes ?? undefined,
    segmentCount: input.segmentCount ?? undefined,
    tokenCount: input.tokenCount ?? undefined,
    status: input.status,
  };
}

function mapUpdateArtifactStatusInput(input: UpdateArtifactStatusInput) {
  return {
    artifactUuid: input.artifactUuid,
    status: input.status,
    sizeBytes: input.sizeBytes ?? undefined,
    segmentCount: input.segmentCount ?? undefined,
    tokenCount: input.tokenCount ?? undefined,
  };
}

function mapArtifactDto(dto: ArtifactDto): ArtifactRecord {
  return {
    artifactUuid: dto.artifactUuid,
    projectUuid: dto.projectUuid,
    fileUuid: dto.fileUuid,
    artifactType: dto.artifactType,
    sizeBytes: dto.sizeBytes ?? null,
    segmentCount: dto.segmentCount ?? null,
    tokenCount: dto.tokenCount ?? null,
    status: dto.status,
  };
}
