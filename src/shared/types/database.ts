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

export type ProjectAssetRole = "processable" | "reference" | "instructions" | "image" | "ocr";

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
  xliffAbsPath?: Nullable<string>;
  version?: Nullable<string>;
  paragraph?: Nullable<boolean>;
  embed?: Nullable<boolean>;
}

export interface ConversionPlan {
  projectUuid: Uuid;
  tasks: ConversionTask[];
  integrityAlerts: FileIntegrityAlert[];
}

export interface FileIntegrityAlert {
  fileUuid: Uuid;
  fileName: string;
  expectedHash?: Nullable<string>;
  actualHash?: Nullable<string>;
}

export interface ProjectRecord {
  projectUuid: Uuid;
  projectName: string;
  creationDate: string;
  updateDate: string;
  projectStatus: ProjectStatus;
  userUuid: Uuid;
  clientUuid?: Nullable<Uuid>;
  clientName?: Nullable<string>;
  type: ProjectType;
  notes?: Nullable<string>;
  subjects?: string[];
  fileCount?: number;
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

// ===== Supabase Schema - Multi-tenant Company Management =====

/**
 * Address structure for JSONB storage in PostgreSQL.
 * Supports flexible international address formats.
 */
export interface Address {
  street?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  state?: string;
  line1?: string;
  line2?: string;
}

/**
 * Member role within a company.
 * - owner: Full administrative control, can delete company
 * - admin: Can manage members and update company settings
 * - member: Standard user with read access
 */
export type MemberRole = 'owner' | 'admin' | 'member';

// Company entity types

/**
 * Company record from the companies table.
 * Represents an organization/business entity in the multi-tenant system.
 */
export interface Company {
  id: string;
  name: string;
  vat_id: string;
  email: string;
  phone: string | null;
  address: Address | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for creating a new company.
 * VAT ID must be unique across all companies.
 */
export interface CompanyCreatePayload {
  name: string;
  vat_id: string;
  email: string;
  phone?: string;
  address?: Address;
}

/**
 * Payload for updating an existing company.
 * All fields except ID are optional for partial updates.
 */
export interface CompanyUpdatePayload {
  id: string;
  name?: string;
  email?: string;
  phone?: string | null;
  address?: Address | null;
  logo_url?: string | null;
}

// Profile entity types

/**
 * User profile record from the profiles table.
 * Extends auth.users with application-specific user metadata.
 */
export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for updating a user profile.
 * Profiles are auto-created by trigger, only updates are exposed.
 */
export interface ProfileUpdatePayload {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

// Company membership types

/**
 * Company member record from the company_members junction table.
 * Represents a many-to-many relationship between users and companies.
 */
export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: MemberRole;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for inviting a new member to a company.
 * Requires owner or admin role to execute.
 */
export interface InviteMemberPayload {
  company_id: string;
  user_id: string;
  role: MemberRole;
}

/**
 * Payload for updating a member's role within a company.
 * Only owners can change member roles.
 */
export interface UpdateMemberRolePayload {
  member_id: string;
  new_role: MemberRole;
}

/**
 * Payload for removing a member from a company.
 * Owners and admins can remove others, users can remove themselves.
 */
export interface RemoveMemberPayload {
  member_id: string;
  company_id: string;
}
