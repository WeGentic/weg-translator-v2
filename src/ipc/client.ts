import { invoke } from "@tauri-apps/api/core";

import type {
  AppHealthReport,
  JobAccepted,
  JobRecord,
  TranslationHistoryRecord,
  TranslationRequest,
} from "./types";

async function safeInvoke<T>(command: string, payload?: Record<string, unknown>) {
  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error calling backend";
    throw new Error(`[IPC] ${command} failed: ${message}`);
  }
}

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

export async function clearTranslationHistory() {
  return safeInvoke<number>("clear_translation_history");
}

export async function getTranslationJob(jobId: string) {
  return safeInvoke<TranslationHistoryRecord | null>("get_translation_job", { job_id: jobId });
}
