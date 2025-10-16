/**
 * Thin IPC adapters for the schema-aligned project commands.
 *
 * Each helper maps between the Tauri side (camelCase DTOs) and the shared
 * TypeScript domain types so callers can interact with the new SQLite schema
 * without duplicating conversion logic.
 */
import {
  AttachProjectFileInput,
  CreateProjectInput,
  FileLanguagePair,
  ProjectBundle,
  ProjectFileBundle,
  ProjectFileLink,
  ProjectLanguagePair,
  ProjectRecord,
  UpdateProjectInput,
  FileInfoRecord,
  ArtifactRecord,
  JobRecord,
} from "@/shared/types/database";

import { safeInvoke } from "../request";

type ProjectLanguagePairDto = ProjectLanguagePair;
type FileLanguagePairDto = FileLanguagePair;

interface ProjectRecordDto {
  projectUuid: string;
  projectName: string;
  creationDate: string;
  updateDate: string;
  projectStatus: string;
  userUuid: string;
  clientUuid?: string | null;
  type: string;
  notes?: string | null;
}

type FileInfoDto = FileInfoRecord;

type ProjectFileLinkDto = ProjectFileLink;

type ArtifactDto = ArtifactRecord;

type JobDto = JobRecord;

interface ProjectFileBundleDto {
  file: ProjectFileLinkDto;
  info: FileInfoDto;
  languagePairs: FileLanguagePairDto[];
  artifacts: ArtifactDto[];
}

interface ProjectBundleDto {
  project: ProjectRecordDto;
  subjects: string[];
  languagePairs: ProjectLanguagePairDto[];
  files: ProjectFileBundleDto[];
  jobs: JobDto[];
}

const COMMAND = {
  create: "create_project_bundle_v2",
  update: "update_project_bundle_v2",
  remove: "delete_project_bundle_v2",
  get: "get_project_bundle_v2",
  list: "list_project_records_v2",
  attach: "attach_project_file_v2",
  detach: "detach_project_file_v2",
} as const;

/**
 * Creates a project and eagerly returns the full bundle (subjects, language
 * pairs, files, jobs). The caller must supply the `userUuid` responsible for
 * the project because the legacy local owner seed has been retired.
 */
export async function createProjectBundle(
  input: CreateProjectInput,
): Promise<ProjectBundle> {
  if (!input.userUuid) {
    throw new Error("createProjectBundle requires userUuid");
  }
  if (input.languagePairs.length === 0) {
    throw new Error("createProjectBundle requires at least one language pair");
  }

  const payload = mapCreateProjectInput(input);
  const dto = await safeInvoke<ProjectBundleDto>(COMMAND.create, { payload });
  return mapProjectBundleDto(dto);
}

/**
 * Applies partial updates to a project bundle. Optional relationship arrays
 * can be supplied to replace the existing subjects or language pairs.
 */
export async function updateProjectBundle(
  input: UpdateProjectInput,
): Promise<ProjectBundle | null> {
  if (input.languagePairs && input.languagePairs.length === 0) {
    throw new Error("updateProjectBundle languagePairs cannot be empty");
  }

  const payload = mapUpdateProjectInput(input);
  const dto = await safeInvoke<ProjectBundleDto | null>(COMMAND.update, { payload });
  return dto ? mapProjectBundleDto(dto) : null;
}

/**
 * Deletes a project and all attached child records.
 */
export async function deleteProjectBundle(projectUuid: string): Promise<void> {
  await safeInvoke<void>(COMMAND.remove, { project_uuid: projectUuid, projectUuid });
}

/**
 * Fetches the full project bundle for the given identifier.
 */
export async function getProjectBundle(projectUuid: string): Promise<ProjectBundle | null> {
  const dto = await safeInvoke<ProjectBundleDto | null>(COMMAND.get, {
    project_uuid: projectUuid,
    projectUuid,
  });
  return dto ? mapProjectBundleDto(dto) : null;
}

export async function listProjectRecords(): Promise<ProjectRecord[]> {
  const dtos = await safeInvoke<ProjectRecordDto[]>(COMMAND.list);
  return dtos.map(mapProjectRecordDto);
}

export async function attachProjectFile(
  input: AttachProjectFileInput,
): Promise<ProjectFileBundle> {
  const payload = mapAttachProjectFileInput(input);
  const dto = await safeInvoke<ProjectFileBundleDto>(COMMAND.attach, { payload });
  return mapProjectFileBundleDto(dto);
}

export async function detachProjectFile(projectUuid: string, fileUuid: string): Promise<void> {
  await safeInvoke<void>(COMMAND.detach, {
    project_uuid: projectUuid,
    projectUuid,
    file_uuid: fileUuid,
    fileUuid,
  });
}

function mapCreateProjectInput(input: CreateProjectInput) {
  return {
    projectUuid: input.projectUuid,
    projectName: input.projectName,
    projectStatus: input.projectStatus ?? "active",
    userUuid: input.userUuid,
    clientUuid: input.clientUuid ?? undefined,
    type: input.type,
    notes: input.notes ?? undefined,
    subjects: input.subjects ?? [],
    languagePairs: input.languagePairs.map(mapProjectLanguagePairInput),
  };
}

function mapUpdateProjectInput(input: UpdateProjectInput) {
  return {
    projectUuid: input.projectUuid,
    projectName: input.projectName ?? undefined,
    projectStatus: input.projectStatus ?? undefined,
    userUuid: input.userUuid ?? undefined,
    clientUuid: input.clientUuid ?? undefined,
    type: input.type ?? undefined,
    notes: input.notes ?? undefined,
    subjects: input.subjects ?? undefined,
    languagePairs: input.languagePairs?.map(mapProjectLanguagePairInput),
  };
}

function mapAttachProjectFileInput(input: AttachProjectFileInput) {
  return {
    projectUuid: input.projectUuid,
    fileUuid: input.fileUuid ?? undefined,
    filename: input.filename,
    storedAt: input.storedAt,
    type: input.type,
    ext: input.ext,
    sizeBytes: input.sizeBytes ?? undefined,
    segmentCount: input.segmentCount ?? undefined,
    tokenCount: input.tokenCount ?? undefined,
    notes: input.notes ?? undefined,
    languagePairs: input.languagePairs.map(mapFileLanguagePairInput),
  };
}

function mapProjectBundleDto(dto: ProjectBundleDto): ProjectBundle {
  return {
    project: mapProjectRecordDto(dto.project),
    subjects: [...dto.subjects],
    languagePairs: dto.languagePairs.map(mapProjectLanguagePairDto),
    files: dto.files.map(mapProjectFileBundleDto),
    jobs: dto.jobs.map(mapJobDto),
  };
}

function mapProjectRecordDto(dto: ProjectRecordDto): ProjectRecord {
  return {
    projectUuid: dto.projectUuid,
    projectName: dto.projectName,
    creationDate: dto.creationDate,
    updateDate: dto.updateDate,
    projectStatus: dto.projectStatus,
    userUuid: dto.userUuid,
    clientUuid: dto.clientUuid ?? null,
    type: dto.type,
    notes: dto.notes ?? null,
  };
}

function mapProjectFileBundleDto(dto: ProjectFileBundleDto): ProjectFileBundle {
  return {
    file: mapProjectFileLinkDto(dto.file),
    info: mapFileInfoDto(dto.info),
    languagePairs: dto.languagePairs.map(mapFileLanguagePairDto),
    artifacts: dto.artifacts.map(mapArtifactDto),
  };
}

function mapProjectFileLinkDto(dto: ProjectFileLinkDto): ProjectFileLink {
  return {
    projectUuid: dto.projectUuid,
    fileUuid: dto.fileUuid,
    filename: dto.filename,
    storedAt: dto.storedAt,
    type: dto.type,
  };
}

function mapFileInfoDto(dto: FileInfoDto): FileInfoRecord {
  return {
    fileUuid: dto.fileUuid,
    ext: dto.ext,
    type: dto.type,
    sizeBytes: dto.sizeBytes ?? null,
    segmentCount: dto.segmentCount ?? null,
    tokenCount: dto.tokenCount ?? null,
    notes: dto.notes ?? null,
  };
}

function mapProjectLanguagePairInput(pair: ProjectLanguagePair): ProjectLanguagePairDto {
  return {
    sourceLang: pair.sourceLang,
    targetLang: pair.targetLang,
  };
}

function mapProjectLanguagePairDto(pair: ProjectLanguagePairDto): ProjectLanguagePair {
  return {
    sourceLang: pair.sourceLang,
    targetLang: pair.targetLang,
  };
}

function mapFileLanguagePairInput(pair: FileLanguagePair): FileLanguagePairDto {
  return {
    sourceLang: pair.sourceLang,
    targetLang: pair.targetLang,
  };
}

function mapFileLanguagePairDto(pair: FileLanguagePairDto): FileLanguagePair {
  return {
    sourceLang: pair.sourceLang,
    targetLang: pair.targetLang,
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

function mapJobDto(dto: JobDto): JobRecord {
  return {
    artifactUuid: dto.artifactUuid,
    jobType: dto.jobType,
    projectUuid: dto.projectUuid,
    jobStatus: dto.jobStatus,
    errorLog: dto.errorLog ?? null,
  };
}
