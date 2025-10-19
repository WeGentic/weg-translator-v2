import type {
  AppHealthReport,
  AppSettings,
  AddFilesResponse,
  EnsureConversionsPlan,
  JobAccepted,
  JobRecord,
  ProjectDetails,
  ProjectListItem,
  TranslationHistoryRecord,
  TranslationRequest,
  JliffConversionResult,
  UpdateJliffSegmentResult,
} from "./types";
import { safeInvoke } from "./request";
import { listProjectRecords, deleteProjectBundle } from "./db/projects";
import type { ProjectRecord } from "@/shared/types/database";

export async function healthCheck() {
  return safeInvoke<AppHealthReport>("health_check");
}

export async function startTranslation(request: TranslationRequest) {
  return safeInvoke<JobAccepted>("start_translation", { request });
}

export async function listActiveJobs() {
  return safeInvoke<JobRecord[]>("list_active_jobs");
}

export async function failTranslation(jobId: string, reason?: string) {
  return safeInvoke<void>("fail_translation", { job_id: jobId, reason });
}

export interface TranslationHistoryQuery {
  limit?: number;
  offset?: number;
}

export async function listTranslationHistory(query: TranslationHistoryQuery = {}) {
  const payload: Record<string, unknown> = {};
  if (typeof query.limit === "number") {
    payload.limit = query.limit;
  }
  if (typeof query.offset === "number") {
    payload.offset = query.offset;
  }
  return safeInvoke<TranslationHistoryRecord[]>("list_translation_history", payload);
}

export interface ProjectListQuery {
  limit?: number;
  offset?: number;
}

export async function listProjects(query: ProjectListQuery = {}) {
  const records = await listProjectRecords();
  const sorted = [...records].sort((a, b) => b.updateDate.localeCompare(a.updateDate));
  const mapped = sorted.map(mapProjectRecordToListItem);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? mapped.length;

  return mapped.slice(offset, offset + limit);
}

export async function deleteProject(projectId: string) {
  await deleteProjectBundle(projectId);
  return 1;
}

export async function clearTranslationHistory() {
  return safeInvoke<number>("clear_translation_history");
}

export async function getTranslationJob(jobId: string) {
  return safeInvoke<TranslationHistoryRecord | null>("get_translation_job", { job_id: jobId });
}

export async function getAppSettings() {
  return safeInvoke<AppSettings>("get_app_settings");
}

export async function updateAppFolder(newFolder: string) {
  return safeInvoke<AppSettings>("update_app_folder", { new_folder: newFolder });
}

export async function updateAutoConvertOnOpen(enabled: boolean) {
  return safeInvoke<AppSettings>("update_auto_convert_on_open", { enabled });
}

export async function updateTheme(theme: string) {
  return safeInvoke<AppSettings>("update_theme", { theme });
}

export async function updateUiLanguage(language: string) {
  return safeInvoke<AppSettings>("update_ui_language", { language });
}

export async function updateDefaultLanguages(sourceLanguage: string, targetLanguage: string) {
  return safeInvoke<AppSettings>("update_default_languages", {
    source_language: sourceLanguage,
    target_language: targetLanguage
  });
}

export async function updateXliffVersion(version: string) {
  return safeInvoke<AppSettings>("update_xliff_version", { version });
}

export async function updateNotifications(showNotifications: boolean, enableSound: boolean) {
  return safeInvoke<AppSettings>("update_notifications", {
    show_notifications: showNotifications,
    enable_sound: enableSound
  });
}

export async function updateMaxParallelConversions(maxParallel: number) {
  return safeInvoke<AppSettings>("update_max_parallel_conversions", { max_parallel: maxParallel });
}

// ===== Project: Details & Conversions IPC =====

export function getProjectDetails(projectId: string): Promise<ProjectDetails> {
  return Promise.reject(
    new Error(`TODO: Implement project details fetch using the v2 schema (requested ${projectId})`),
  );
}

export function addFilesToProject(
  projectId: string,
  files: string[],
): Promise<AddFilesResponse> {
  return Promise.reject(
    new Error(
      `TODO: Implement file attachments using the v2 schema (requested ${projectId}, files=${files.length})`,
    ),
  );
}

export function removeProjectFile(projectId: string, projectFileId: string): Promise<number> {
  return Promise.reject(
    new Error(
      `TODO: Implement file removal using the v2 schema (project=${projectId}, file=${projectFileId})`,
    ),
  );
}

export function ensureProjectConversionsPlan(
  projectId: string,
): Promise<EnsureConversionsPlan> {
  return Promise.reject(
    new Error(`TODO: Rebuild conversion planning against the new schema (project=${projectId})`),
  );
}

export interface ConversionValidationSummary {
  validator?: string;
  passed?: boolean;
  skipped?: boolean;
  message?: string;
  schemaPath?: string;
}

export function updateConversionStatus(
  conversionId: string,
  status: "pending" | "running" | "completed" | "failed",
  payload?: {
    xliffRelPath?: string;
    jliffRelPath?: string;
    tagMapRelPath?: string;
    errorMessage?: string;
    validation?: ConversionValidationSummary;
  },
) {
  return Promise.reject(
    new Error(
      `TODO: Persist conversion status updates using the new schema (conversion=${conversionId}, status=${status}, payload=${JSON.stringify(
        payload ?? {},
      )})`,
    ),
  );
}

export interface ConvertXliffToJliffArgs {
  projectId: string;
  conversionId: string;
  xliffAbsPath: string;
  operator?: string;
  schemaAbsPath?: string;
}

export function convertXliffToJliff(
  args: ConvertXliffToJliffArgs,
): Promise<JliffConversionResult> {
  return Promise.reject(
    new Error(
      `TODO: Reintroduce JLIFF conversion with v2 IPC (project=${args.projectId}, conversion=${args.conversionId})`,
    ),
  );
}

export function readProjectArtifact(projectId: string, relPath: string): Promise<string> {
  return Promise.reject(
    new Error(
      `TODO: Fetch project artifacts once the new pipeline lands (project=${projectId}, rel=${relPath})`,
    ),
  );
}

export interface UpdateJliffSegmentArgs {
  projectId: string;
  jliffRelPath: string;
  transunitId: string;
  newTarget: string;
}

export function updateJliffSegment(
  args: UpdateJliffSegmentArgs,
): Promise<UpdateJliffSegmentResult> {
  return Promise.reject(
    new Error(
      `TODO: Update JLIFF segments after the new pipeline is implemented (project=${args.projectId}, transunit=${args.transunitId})`,
    ),
  );
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapProjectRecordToListItem(record: ProjectRecord): ProjectListItem {
  const normalizedProjectStatus = record.projectStatus?.toUpperCase() ?? "READY";
  return {
    projectId: record.projectUuid,
    name: record.projectName,
    slug: slugify(record.projectName || record.projectUuid),
    projectType: record.type,
    status: normalizedProjectStatus,
    activityStatus: "pending",
    fileCount: record.fileCount ?? 0,
    subjects: record.subjects ?? [],
    createdAt: record.creationDate,
    updatedAt: record.updateDate,
    clientId: record.clientUuid ?? null,
    clientName: record.clientName ?? null,
    notes: record.notes ?? null,
  };
}
