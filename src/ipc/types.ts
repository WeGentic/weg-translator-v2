export type TranslationStage =
  | "received"
  | "preparing"
  | "translating"
  | "completed"
  | "failed";

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
