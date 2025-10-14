import { invoke } from "@tauri-apps/api/core";

import type {
  AppHealthReport,
  AppSettings,
  AddFilesResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  JobAccepted,
  JobRecord,
  EnsureConversionsPlan,
  ProjectDetails,
  ProjectListItem,
  TranslationHistoryRecord,
  TranslationRequest,
  JliffConversionResult,
  UpdateJliffSegmentResult,
} from "./types";

function hasCustomToString(value: { toString?: unknown }): value is { toString: () => string } {
  return typeof value.toString === "function" && value.toString !== Object.prototype.toString;
}

function normalizeIpcError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  if (err && typeof err === "object") {
    const candidate = err as { message?: unknown; toString?: unknown };

    if (typeof candidate.message === "string") {
      return candidate.message;
    }

    if (hasCustomToString(candidate)) {
      try {
        return candidate.toString();
      } catch {
        // fall through to JSON serialization
      }
    }

    try {
      return JSON.stringify(candidate);
    } catch {
      // ignore JSON serialization errors
    }
  }

  return "Unknown error calling backend";
}

async function safeInvoke<T>(command: string, payload?: Record<string, unknown>) {
  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    const message = normalizeIpcError(error);
    throw new Error(`[IPC] ${command} failed: ${message}`);
  }
}

export async function healthCheck() {
  return safeInvoke<AppHealthReport>("health_check");
}

export async function startTranslation(request: TranslationRequest) {
  return safeInvoke<JobAccepted>("start_translation", { request });
}

export async function createProject(request: CreateProjectRequest) {
  return safeInvoke<CreateProjectResponse>("create_project_with_files", { req: request });
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
  const payload: Record<string, unknown> = {};
  if (typeof query.limit === "number") {
    payload.limit = query.limit;
  }
  if (typeof query.offset === "number") {
    payload.offset = query.offset;
  }
  return safeInvoke<ProjectListItem[]>("list_projects", payload);
}

export async function deleteProject(projectId: string) {
  return safeInvoke<number>("delete_project", { project_id: projectId, projectId });
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

export async function getProjectDetails(projectId: string) {
  return safeInvoke<ProjectDetails>("get_project_details", { project_id: projectId, projectId });
}

export async function addFilesToProject(projectId: string, files: string[]) {
  return safeInvoke<AddFilesResponse>("add_files_to_project", { project_id: projectId, projectId, files });
}

export async function removeProjectFile(projectId: string, projectFileId: string) {
  return safeInvoke<number>("remove_project_file", { project_id: projectId, projectId, project_file_id: projectFileId, projectFileId });
}

export async function ensureProjectConversionsPlan(projectId: string) {
  return safeInvoke<EnsureConversionsPlan>("ensure_project_conversions_plan", { project_id: projectId, projectId });
}

export interface ConversionValidationSummary {
  validator?: string;
  passed?: boolean;
  skipped?: boolean;
  message?: string;
  schemaPath?: string;
}

export async function updateConversionStatus(
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
  const xliff_rel_path = payload?.xliffRelPath;
  const jliff_rel_path = payload?.jliffRelPath;
  const tag_map_rel_path = payload?.tagMapRelPath;
  const error_message = payload?.errorMessage;
  const xliff_validation_payload = payload?.validation
    ? {
        validator: payload.validation.validator,
        passed: payload.validation.passed,
        skipped: payload.validation.skipped,
        message: payload.validation.message,
        schemaPath: payload.validation.schemaPath,
      }
    : undefined;
  return safeInvoke<void>("update_conversion_status", {
    // send both snake_case and camelCase for compatibility
    conversion_id: conversionId,
    conversionId,
    status,
    xliff_rel_path,
    xliffRelPath: xliff_rel_path,
    jliff_rel_path,
    jliffRelPath: jliff_rel_path,
    tag_map_rel_path,
    tagMapRelPath: tag_map_rel_path,
    error_message,
    errorMessage: error_message,
    ...(xliff_validation_payload !== undefined && {
      xliff_validation: xliff_validation_payload,
      xliffValidation: xliff_validation_payload,
    }),
  });
}

export interface ConvertXliffToJliffArgs {
  projectId: string;
  conversionId: string;
  xliffAbsPath: string;
  operator?: string;
  schemaAbsPath?: string;
}

export async function convertXliffToJliff(args: ConvertXliffToJliffArgs) {
  const payload: Record<string, unknown> = {
    project_id: args.projectId,
    projectId: args.projectId,
    conversion_id: args.conversionId,
    conversionId: args.conversionId,
    xliff_abs_path: args.xliffAbsPath,
    xliffAbsPath: args.xliffAbsPath,
  };

  if (typeof args.operator === "string" && args.operator.trim().length > 0) {
    payload.operator = args.operator;
  }
  if (typeof args.schemaAbsPath === "string" && args.schemaAbsPath.trim().length > 0) {
    payload.schema_abs_path = args.schemaAbsPath;
    payload.schemaAbsPath = args.schemaAbsPath;
  }

  return safeInvoke<JliffConversionResult>("convert_xliff_to_jliff", payload);
}

export async function readProjectArtifact(projectId: string, relPath: string) {
  return safeInvoke<string>("read_project_artifact", {
    project_id: projectId,
    projectId,
    rel_path: relPath,
    relPath,
  });
}

export interface UpdateJliffSegmentArgs {
  projectId: string;
  jliffRelPath: string;
  transunitId: string;
  newTarget: string;
}

export async function updateJliffSegment(args: UpdateJliffSegmentArgs) {
  return safeInvoke<UpdateJliffSegmentResult>("update_jliff_segment", {
    project_id: args.projectId,
    projectId: args.projectId,
    jliff_rel_path: args.jliffRelPath,
    jliffRelPath: args.jliffRelPath,
    transunit_id: args.transunitId,
    transunitId: args.transunitId,
    new_target: args.newTarget,
    newTarget: args.newTarget,
  });
}
