// Shared interfaces for database-backed IPC contracts.
// These types mirror the new SQLite schema exposed through the Tauri commands.

export type Uuid = string;

export type Nullable<T> = T | null;
export type OptionalNullable<T> = T | null | undefined;

// ===== Users =====

export interface PermissionOverride {
  permission: string;
  isAllowed: boolean;
}

export interface UserProfile {
  userUuid: Uuid;
  username: string;
  email: string;
  phone?: Nullable<string>;
  address?: Nullable<string>;
  roles: string[];
  permissionOverrides: PermissionOverride[];
}

export interface CreateUserInput {
  userUuid?: Uuid;
  username: string;
  email: string;
  phone?: OptionalNullable<string>;
  address?: OptionalNullable<string>;
  roles?: string[];
  permissionOverrides?: PermissionOverride[];
}

export interface UpdateUserInput {
  userUuid: Uuid;
  username?: string;
  email?: string;
  phone?: OptionalNullable<string>;
  address?: OptionalNullable<string>;
  roles?: string[];
  permissionOverrides?: PermissionOverride[];
}

// ===== Clients =====

export interface ClientRecord {
  clientUuid: Uuid;
  name: string;
  email?: Nullable<string>;
  phone?: Nullable<string>;
  address?: Nullable<string>;
  vatNumber?: Nullable<string>;
  note?: Nullable<string>;
}

export interface CreateClientInput {
  clientUuid?: Uuid;
  name: string;
  email?: OptionalNullable<string>;
  phone?: OptionalNullable<string>;
  address?: OptionalNullable<string>;
  vatNumber?: OptionalNullable<string>;
  note?: OptionalNullable<string>;
}

export interface UpdateClientInput {
  clientUuid: Uuid;
  name?: string;
  email?: OptionalNullable<string>;
  phone?: OptionalNullable<string>;
  address?: OptionalNullable<string>;
  vatNumber?: OptionalNullable<string>;
  note?: OptionalNullable<string>;
}

// ===== Projects =====

export type ProjectStatus = string;
export type ProjectType = string;
export type ProjectSubject = string;

export interface ProjectLanguagePair {
  sourceLang: string;
  targetLang: string;
}

export interface FileLanguagePair {
  sourceLang: string;
  targetLang: string;
}

export type ProjectAssetRole = "processable" | "reference" | "instructions" | "image";

export interface ProjectAssetDescriptor {
  draftId: string;
  name: string;
  extension: string;
  role: ProjectAssetRole;
  path: string;
}

export interface ProjectAssetResult {
  draftId: string;
  fileUuid?: Nullable<Uuid>;
  storedRelPath?: Nullable<string>;
  role: ProjectAssetRole;
}

export interface ConversionTask {
  draftId: string;
  fileUuid?: Nullable<Uuid>;
  artifactUuid?: Nullable<Uuid>;
  jobType?: Nullable<string>;
  sourceLang: string;
  targetLang: string;
  sourcePath: string;
  xliffRelPath: string;
}

export interface ConversionPlan {
  projectUuid: Uuid;
  tasks: ConversionTask[];
}

export interface ProjectRecord {
  projectUuid: Uuid;
  projectName: string;
  creationDate: string;
  updateDate: string;
  projectStatus: ProjectStatus;
  userUuid: Uuid;
  clientUuid?: Nullable<Uuid>;
  type: ProjectType;
  notes?: Nullable<string>;
}

export type ProjectListItem = ProjectRecord;

export interface FileInfoRecord {
  fileUuid: Uuid;
  ext: string;
  type: string;
  sizeBytes?: Nullable<number>;
  segmentCount?: Nullable<number>;
  tokenCount?: Nullable<number>;
  notes?: Nullable<string>;
}

export interface ProjectFileLink {
  projectUuid: Uuid;
  fileUuid: Uuid;
  filename: string;
  storedAt: string;
  type: string;
}

export interface ArtifactRecord {
  artifactUuid: Uuid;
  projectUuid: Uuid;
  fileUuid: Uuid;
  artifactType: string;
  sizeBytes?: Nullable<number>;
  segmentCount?: Nullable<number>;
  tokenCount?: Nullable<number>;
  status: string;
}

export interface JobRecord {
  artifactUuid: Uuid;
  jobType: string;
  projectUuid: Uuid;
  jobStatus: string;
  errorLog?: Nullable<string>;
}

export interface ProjectFileBundle {
  file: ProjectFileLink;
  info: FileInfoRecord;
  languagePairs: FileLanguagePair[];
  artifacts: ArtifactRecord[];
}

export interface ProjectBundle {
  project: ProjectRecord;
  subjects: ProjectSubject[];
  languagePairs: ProjectLanguagePair[];
  files: ProjectFileBundle[];
  jobs: JobRecord[];
}

export interface CreateProjectWithAssetsResponse {
  project: ProjectBundle;
  projectDir: string;
  assets: ProjectAssetResult[];
  conversionPlan?: ConversionPlan;
}

export interface CreateProjectInput {
  projectUuid?: Uuid;
  projectName: string;
  projectStatus?: ProjectStatus;
  userUuid?: Uuid;
  clientUuid?: OptionalNullable<Uuid>;
  type: ProjectType;
  notes?: OptionalNullable<string>;
  subjects?: ProjectSubject[];
  languagePairs: ProjectLanguagePair[];
}

export interface CreateProjectWithAssetsInput {
  projectName: string;
  projectFolderName: string;
  projectStatus?: ProjectStatus;
  userUuid: Uuid;
  clientUuid?: OptionalNullable<Uuid>;
  type: ProjectType;
  notes?: OptionalNullable<string>;
  subjects?: ProjectSubject[];
  languagePairs: ProjectLanguagePair[];
  assets: ProjectAssetDescriptor[];
}

export interface UpdateProjectInput {
  projectUuid: Uuid;
  projectName?: string;
  projectStatus?: ProjectStatus;
  userUuid?: Uuid;
  clientUuid?: OptionalNullable<Uuid>;
  type?: ProjectType;
  notes?: OptionalNullable<string>;
  subjects?: ProjectSubject[];
  languagePairs?: ProjectLanguagePair[];
}

export interface AttachProjectFileInput {
  projectUuid: Uuid;
  fileUuid?: Uuid;
  filename: string;
  storedAt: string;
  type: string;
  ext: string;
  sizeBytes?: OptionalNullable<number>;
  segmentCount?: OptionalNullable<number>;
  tokenCount?: OptionalNullable<number>;
  notes?: OptionalNullable<string>;
  languagePairs: FileLanguagePair[];
}

// ===== Artifacts =====

export type ArtifactStatus = string;

export interface UpsertArtifactInput {
  artifactUuid?: Uuid;
  projectUuid: Uuid;
  fileUuid: Uuid;
  artifactType: string;
  sizeBytes?: OptionalNullable<number>;
  segmentCount?: OptionalNullable<number>;
  tokenCount?: OptionalNullable<number>;
  status: ArtifactStatus;
}

export interface UpdateArtifactStatusInput {
  artifactUuid: Uuid;
  status: ArtifactStatus;
  sizeBytes?: OptionalNullable<number>;
  segmentCount?: OptionalNullable<number>;
  tokenCount?: OptionalNullable<number>;
}

// ===== Jobs =====

export type JobStatus = string;

export interface UpsertJobInput {
  artifactUuid: Uuid;
  jobType: string;
  projectUuid: Uuid;
  jobStatus: JobStatus;
  errorLog?: OptionalNullable<string>;
}

export interface UpdateJobStatusInput {
  artifactUuid: Uuid;
  jobType: string;
  jobStatus: JobStatus;
  errorLog?: OptionalNullable<string>;
}
