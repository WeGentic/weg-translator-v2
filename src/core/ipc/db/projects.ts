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
  CreateProjectWithAssetsInput,
  CreateProjectWithAssetsResponse,
  FileLanguagePair,
  ProjectBundle,
  ProjectAssetDescriptor,
  ProjectAssetResult,
  ProjectAssetRole,
  ConversionPlan,
  ConversionTask,
  FileIntegrityAlert,
  ProjectFileBundle,
  ProjectFileLink,
  ProjectLanguagePair,
  ProjectRecord,
  UpdateProjectInput,
  FileInfoRecord,
  ArtifactRecord,
  JobRecord,
} from "@/shared/types/database";
import { ProjectStatistics } from "@/shared/types/statistics";

import { safeInvoke } from "../request";

type ProjectLanguagePairDto = ProjectLanguagePair;
type FileLanguagePairDto = FileLanguagePair;
type ProjectAssetRoleDto = ProjectAssetRole;

export interface UpdateConversionStatusInput {
  artifactUuid: string;
  status: string;
  sizeBytes?: number;
  segmentCount?: number;
  tokenCount?: number;
  xliffRelPath?: string;
  xliffAbsPath?: string;
  jliffRelPath?: string;
  tagMapRelPath?: string;
  errorMessage?: string;
  validationMessage?: string;
  validator?: string;
}

export interface ConvertXliffToJliffInput {
  projectUuid: string;
  conversionId: string;
  xliffAbsPath: string;
  operator?: string;
  schemaAbsPath?: string;
  }

interface ProjectAssetDescriptorDto {
  draftId: string;
  name: string;
  extension: string;
  role: ProjectAssetRoleDto;
  path: string;
}

interface ProjectAssetResultDto {
  draftId: string;
  fileUuid?: string | null;
  storedRelPath?: string | null;
  role: ProjectAssetRoleDto;
}

interface ConversionTaskDto {
  draftId: string;
  fileUuid?: string | null;
  artifactUuid?: string | null;
  jobType?: string | null;
  sourceLang: string;
  targetLang: string;
  sourcePath: string;
  xliffRelPath: string;
  xliffAbsPath?: string | null;
  version?: string | null;
  paragraph?: boolean | null;
  embed?: boolean | null;
}

interface ConversionPlanDto {
  projectUuid: string;
  tasks: ConversionTaskDto[];
  integrityAlerts: FileIntegrityAlertDto[];
}

interface FileIntegrityAlertDto {
  fileUuid: string;
  fileName: string;
  expectedHash?: string | null;
  actualHash?: string | null;
}

interface ProjectFileTotalsDto {
  total: number;
  processable: number;
  reference: number;
  instructions: number;
  image: number;
  other: number;
}

interface ProjectConversionStatsDto {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
  other: number;
  segments: number;
  tokens: number;
}

interface ProjectJobStatsDto {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
  other: number;
}

interface ProjectProgressStatsDto {
  processableFiles: number;
  filesReady: number;
  filesWithErrors: number;
  percentComplete: number;
}

interface ProjectWarningStatsDto {
  total: number;
  failedArtifacts: number;
  failedJobs: number;
}

interface ProjectStatisticsDto {
  totals: ProjectFileTotalsDto;
  conversions: ProjectConversionStatsDto;
  jobs: ProjectJobStatsDto;
  progress: ProjectProgressStatsDto;
  warnings: ProjectWarningStatsDto;
  lastActivity?: string | null;
}

interface EnsureConversionPlanPayloadDto {
  projectUuid: string;
  fileUuids?: string[] | null;
}

interface UpdateConversionStatusPayloadDto {
  artifactUuid: string;
  status: string;
  sizeBytes?: number | null;
  segmentCount?: number | null;
  tokenCount?: number | null;
  xliffRelPath?: string | null;
  xliffAbsPath?: string | null;
  jliffRelPath?: string | null;
  tagMapRelPath?: string | null;
  errorMessage?: string | null;
  validationMessage?: string | null;
  validator?: string | null;
}

interface ConvertXliffToJliffPayloadDto {
  projectUuid: string;
  conversionId: string;
  xliffAbsPath: string;
  operator?: string | null;
  schemaAbsPath?: string | null;
}

interface JliffConversionResultDto {
  fileId: string;
  jliffAbsPath: string;
  jliffRelPath: string;
  tagMapAbsPath: string;
  tagMapRelPath: string;
}

interface ProjectRecordDto {
  projectUuid: string;
  projectName: string;
  creationDate: string;
  updateDate: string;
  projectStatus: string;
  userUuid: string;
  clientUuid?: string | null;
  clientName?: string | null;
  type: string;
  notes?: string | null;
  subjects?: string[];
  fileCount?: number | null;
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

interface CreateProjectWithAssetsPayloadDto {
  projectName: string;
  projectFolderName: string;
  projectStatus: string;
  userUuid: string;
  clientUuid?: string | null;
  type: string;
  notes?: string | null;
  subjects: string[];
  languagePairs: ProjectLanguagePairDto[];
  assets: ProjectAssetDescriptorDto[];
}

interface CreateProjectWithAssetsResponseDto {
  project: ProjectBundleDto;
  projectDir: string;
  assets: ProjectAssetResultDto[];
  conversionPlan?: ConversionPlanDto;
}

const COMMAND = {
  createWithAssets: "create_project_with_assets_v2",
  create: "create_project_bundle_v2",
  update: "update_project_bundle_v2",
  remove: "delete_project_bundle_v2",
  get: "get_project_bundle_v2",
  list: "list_project_records_v2",
  attach: "attach_project_file_v2",
  detach: "detach_project_file_v2",
  ensureConversions: "ensure_project_conversions_plan_v2",
  updateConversionStatus: "update_conversion_status_v2",
  convertXliffToJliff: "convert_xliff_to_jliff_v2",
  stats: "get_project_statistics_v2",
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

export async function createProjectWithAssets(
  input: CreateProjectWithAssetsInput,
): Promise<CreateProjectWithAssetsResponse> {
  if (!input.userUuid) {
    throw new Error("createProjectWithAssets requires userUuid");
  }
  if (input.languagePairs.length === 0) {
    throw new Error("createProjectWithAssets requires at least one language pair");
  }

  const payload = mapCreateProjectWithAssetsInput(input);
  const dto = await safeInvoke<CreateProjectWithAssetsResponseDto>(COMMAND.createWithAssets, {
    payload,
  });
  return mapCreateProjectWithAssetsResponse(dto);
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

export async function fetchProjectStatistics(projectUuid: string): Promise<ProjectStatistics | null> {
  const dto = await safeInvoke<ProjectStatisticsDto | null>(COMMAND.stats, {
    project_uuid: projectUuid,
    projectUuid,
  });
  return dto ? mapProjectStatisticsDto(dto) : null;
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

export async function ensureProjectConversionPlanDto(
  projectUuid: string,
  fileUuids: string[] = [],
): Promise<ConversionPlan> {
  const payload: EnsureConversionPlanPayloadDto = {
    projectUuid,
    fileUuids: fileUuids.length > 0 ? fileUuids : undefined,
  };
  const dto = await safeInvoke<ConversionPlanDto>(COMMAND.ensureConversions, { payload });
  return mapConversionPlanDto(dto);
}

export async function updateConversionStatusDto(
  input: UpdateConversionStatusInput,
): Promise<ArtifactRecord> {
  const payload: UpdateConversionStatusPayloadDto = {
    artifactUuid: input.artifactUuid,
    status: input.status,
    sizeBytes: input.sizeBytes,
    segmentCount: input.segmentCount,
    tokenCount: input.tokenCount,
    xliffRelPath: input.xliffRelPath,
    xliffAbsPath: input.xliffAbsPath,
    jliffRelPath: input.jliffRelPath,
    tagMapRelPath: input.tagMapRelPath,
    errorMessage: input.errorMessage,
    validationMessage: input.validationMessage,
    validator: input.validator,
  };
  const dto = await safeInvoke<ArtifactDto>(COMMAND.updateConversionStatus, { payload });
  return mapArtifactDto(dto);
}

export async function convertXliffToJliffDto(
  input: ConvertXliffToJliffInput,
): Promise<JliffConversionResultDto> {
  const payload: ConvertXliffToJliffPayloadDto = {
    projectUuid: input.projectUuid,
    conversionId: input.conversionId,
    xliffAbsPath: input.xliffAbsPath,
    operator: input.operator ?? undefined,
    schemaAbsPath: input.schemaAbsPath ?? undefined,
  };

  return safeInvoke<JliffConversionResultDto>(COMMAND.convertXliffToJliff, { payload });
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

function mapProjectStatisticsDto(dto: ProjectStatisticsDto): ProjectStatistics {
  return {
    totals: {
      total: dto.totals.total,
      processable: dto.totals.processable,
      reference: dto.totals.reference,
      instructions: dto.totals.instructions,
      image: dto.totals.image,
      other: dto.totals.other,
    },
    conversions: {
      total: dto.conversions.total,
      completed: dto.conversions.completed,
      failed: dto.conversions.failed,
      pending: dto.conversions.pending,
      running: dto.conversions.running,
      other: dto.conversions.other,
      segments: dto.conversions.segments,
      tokens: dto.conversions.tokens,
    },
    jobs: {
      total: dto.jobs.total,
      completed: dto.jobs.completed,
      failed: dto.jobs.failed,
      pending: dto.jobs.pending,
      running: dto.jobs.running,
      other: dto.jobs.other,
    },
    progress: {
      processableFiles: dto.progress.processableFiles,
      filesReady: dto.progress.filesReady,
      filesWithErrors: dto.progress.filesWithErrors,
      percentComplete: dto.progress.percentComplete,
    },
    warnings: {
      total: dto.warnings.total,
      failedArtifacts: dto.warnings.failedArtifacts,
      failedJobs: dto.warnings.failedJobs,
    },
    lastActivity: dto.lastActivity ?? null,
  };
}

function mapCreateProjectWithAssetsInput(
  input: CreateProjectWithAssetsInput,
): CreateProjectWithAssetsPayloadDto {
  return {
    projectName: input.projectName,
    projectFolderName: input.projectFolderName,
    projectStatus: input.projectStatus ?? "active",
    userUuid: input.userUuid,
    clientUuid: input.clientUuid ?? undefined,
    type: input.type,
    notes: input.notes ?? undefined,
    subjects: input.subjects ?? [],
    languagePairs: input.languagePairs.map(mapProjectLanguagePairInput),
    assets: input.assets.map(mapProjectAssetDescriptorInput),
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

function mapCreateProjectWithAssetsResponse(
  dto: CreateProjectWithAssetsResponseDto,
): CreateProjectWithAssetsResponse {
  return {
    project: mapProjectBundleDto(dto.project),
    projectDir: dto.projectDir,
    assets: dto.assets.map(mapProjectAssetResultDto),
    conversionPlan: dto.conversionPlan ? mapConversionPlanDto(dto.conversionPlan) : undefined,
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
    clientName: dto.clientName ?? null,
    type: dto.type,
    notes: dto.notes ?? null,
    subjects: dto.subjects ?? [],
    fileCount: dto.fileCount ?? 0,
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

function mapProjectAssetDescriptorInput(
  asset: ProjectAssetDescriptor,
): ProjectAssetDescriptorDto {
  return {
    draftId: asset.draftId,
    name: asset.name,
    extension: asset.extension,
    role: asset.role,
    path: asset.path,
  };
}

function mapProjectAssetResultDto(asset: ProjectAssetResultDto): ProjectAssetResult {
  return {
    draftId: asset.draftId,
    fileUuid: asset.fileUuid ?? null,
    storedRelPath: asset.storedRelPath ?? null,
    role: asset.role,
  };
}

function mapConversionPlanDto(plan: ConversionPlanDto): ConversionPlan {
  return {
    projectUuid: plan.projectUuid,
    tasks: plan.tasks.map(mapConversionTaskDto),
    integrityAlerts: (plan.integrityAlerts ?? []).map(mapIntegrityAlertDto),
  };
}

function mapConversionTaskDto(task: ConversionTaskDto): ConversionTask {
  return {
    draftId: task.draftId,
    fileUuid: task.fileUuid ?? null,
    artifactUuid: task.artifactUuid ?? null,
    jobType: task.jobType ?? null,
    sourceLang: task.sourceLang,
    targetLang: task.targetLang,
    sourcePath: task.sourcePath,
    xliffRelPath: task.xliffRelPath,
    xliffAbsPath: task.xliffAbsPath ?? null,
    version: task.version ?? null,
    paragraph: task.paragraph ?? null,
    embed: task.embed ?? null,
  };
}

function mapIntegrityAlertDto(alert: FileIntegrityAlertDto): FileIntegrityAlert {
  return {
    fileUuid: alert.fileUuid,
    fileName: alert.fileName,
    expectedHash: alert.expectedHash ?? null,
    actualHash: alert.actualHash ?? null,
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
