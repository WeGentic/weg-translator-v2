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
} from "./types";

function normalizeIpcError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    if (typeof anyErr.message === "string") return anyErr.message as string;
    if (typeof (anyErr as any).toString === "function") return String(err);
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

export async function updateConversionStatus(
  conversionId: string,
  status: "pending" | "running" | "completed" | "failed",
  payload?: { xliffRelPath?: string; errorMessage?: string },
) {
  const xliff_rel_path = payload?.xliffRelPath;
  const error_message = payload?.errorMessage;
  return safeInvoke<void>("update_conversion_status", {
    // send both snake_case and camelCase for compatibility
    conversion_id: conversionId,
    conversionId,
    status,
    xliff_rel_path,
    xliffRelPath: xliff_rel_path,
    error_message,
    errorMessage: error_message,
  });
}
