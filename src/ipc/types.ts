export type TranslationStage =
  | "received"
  | "preparing"
  | "translating"
  | "completed"
  | "failed";

export type TranslationStatus = "queued" | "running" | "completed" | "failed";

export interface TranslationRequest {
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
  metadata?: Record<string, unknown> | null;
}

export interface JobAccepted {
  jobId: string;
  queued: boolean;
}

export interface TranslationProgressPayload {
  jobId: string;
  progress: number;
  stage: TranslationStage;
  message?: string;
}

export interface TranslationCompletedPayload {
  jobId: string;
  outputText: string;
  durationMs: number;
}

export interface TranslationFailedPayload {
  jobId: string;
  reason: string;
}

export interface JobRecord {
  jobId: string;
  request: TranslationRequest;
  stage: TranslationStage;
  progress: number;
}

export interface StoredTranslationJob {
  jobId: string;
  sourceLanguage: string;
  targetLanguage: string;
  inputText: string;
  status: TranslationStatus;
  stage: TranslationStage;
  progress: number;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  metadata?: unknown;
  updatedAt: string;
}

export interface TranslationOutputSnapshot {
  outputText: string;
  modelName?: string;
  inputTokenCount?: number;
  outputTokenCount?: number;
  totalTokenCount?: number;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationHistoryRecord {
  job: StoredTranslationJob;
  output?: TranslationOutputSnapshot | null;
}

export interface AppHealthReport {
  appVersion: string;
  tauriVersion: string;
  buildProfile: string;
}

export const IPC_EVENT = {
  translationProgress: "translation://progress",
  translationCompleted: "translation://completed",
  translationFailed: "translation://failed",
} as const;
