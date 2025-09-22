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

export type ProjectType = "translation" | "rag";

export type ProjectStatus = "active" | "archived";

export interface CreateProjectRequest {
  name: string;
  projectType: ProjectType;
  defaultSrcLang: string;
  defaultTgtLang: string;
  files: string[];
}

export interface CreateProjectResponse {
  projectId: string;
  slug: string;
  folder: string;
  fileCount: number;
}

export interface ProjectListItem {
  projectId: string;
  name: string;
  slug: string;
  projectType: ProjectType;
  status: ProjectStatus;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  appFolder: string;
  appFolderExists: boolean;
  databasePath: string;
  databaseExists: boolean;
  projectsPath: string;
  projectsPathExists: boolean;
  settingsFile: string;
  settingsFileExists: boolean;
  defaultAppFolder: string;
  isUsingDefaultLocation: boolean;
  autoConvertOnOpen: boolean;
}

// ===== Project Details & Conversions =====

export type ProjectFileImportStatus = "imported" | "failed";
export type ProjectFileConversionStatus = "pending" | "running" | "completed" | "failed";

export interface ProjectFileDto {
  id: string;
  originalName: string;
  storedRelPath: string;
  ext: string;
  sizeBytes?: number;
  importStatus: ProjectFileImportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFileConversionDto {
  id: string;
  projectFileId: string;
  srcLang: string;
  tgtLang: string;
  version: string;
  paragraph: boolean;
  embed: boolean;
  xliffRelPath?: string;
  status: ProjectFileConversionStatus;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFileWithConversionsDto {
  file: ProjectFileDto;
  conversions: ProjectFileConversionDto[];
}

export interface ProjectDetails {
  id: string;
  name: string;
  slug: string;
  defaultSrcLang?: string;
  defaultTgtLang?: string;
  rootPath: string;
  files: ProjectFileWithConversionsDto[];
}

export interface AddFilesResponse {
  inserted: ProjectFileDto[];
  insertedCount: number;
}

export interface EnsureConversionsTask {
  conversionId: string;
  projectFileId: string;
  inputAbsPath: string;
  outputAbsPath: string;
  srcLang: string;
  tgtLang: string;
  version: string;
  paragraph: boolean;
  embed: boolean;
}

export interface EnsureConversionsPlan {
  projectId: string;
  srcLang: string;
  tgtLang: string;
  version: string;
  tasks: EnsureConversionsTask[];
}

export const IPC_EVENT = {
  translationProgress: "translation://progress",
  translationCompleted: "translation://completed",
  translationFailed: "translation://failed",
} as const;
