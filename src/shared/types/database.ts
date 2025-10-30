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

// ===== Supabase Schema - B2B Multi-tenant Account Management =====

/**
 * User role within an account.
 * Defines permission level for account operations and RLS policy enforcement.
 * - owner: Full administrative control, can delete account and manage all resources
 * - admin: Can manage members, update account settings, but cannot delete account
 * - member: Standard user with application access, no management capabilities
 * - viewer: Read-only access across entire application
 */
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Subscription status enum.
 * Indicates current state of account subscription lifecycle.
 * - trialing: Account in 14-day trial period, trial_ends_at defines expiration
 * - active: Paid subscription active with valid payment method
 * - past_due: Payment failed, grace period active
 * - canceled: Subscription canceled, may have remaining access until period end
 * - unpaid: Payment failed and grace period expired
 */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

// Account entity types

/**
 * Account record from the accounts table.
 * Represents the top-level tenant entity in the B2B multi-tenant system.
 * Each account serves as the RLS filtering boundary for all related data.
 *
 * @remarks
 * - account_uuid is the primary tenant identifier used in RLS policies
 * - All users, subscriptions, and resources filter by account_uuid for tenant isolation
 * - Soft delete pattern: deleted_at timestamp marks inactive accounts
 * - RLS policies filter by account_uuid from JWT claims for optimal performance
 */
export interface Account {
  /** UUID primary key and tenant identifier for RLS filtering */
  account_uuid: string;
  /** Organization name displayed in UI and account management */
  company_name: string;
  /** Primary contact email, must match first admin user email during creation */
  company_email: string;
  /** ISO 8601 timestamp of account creation */
  created_at: string;
  /** ISO 8601 timestamp of last modification, auto-updated by database trigger */
  modified_at: string;
  /** Soft delete timestamp, null for active accounts. All queries filter by deleted_at IS NULL */
  deleted_at: string | null;
}

/**
 * Payload for creating a new account.
 * Account creation must use create_account_with_admin() database function for atomic transaction.
 * Direct INSERT operations should not be used to ensure data consistency.
 */
export interface AccountCreatePayload {
  /** Organization name, minimum 2 characters */
  company_name: string;
  /** Primary contact email, must match admin user email for create_account_with_admin() */
  company_email: string;
}

/**
 * Payload for updating an existing account.
 * All fields except account_uuid are optional for partial updates.
 * modified_at timestamp is automatically updated by database trigger.
 */
export interface AccountUpdatePayload {
  /** Account UUID to update */
  account_uuid: string;
  /** Updated organization name */
  company_name?: string;
  /** Updated primary contact email */
  company_email?: string;
}

// User entity types

/**
 * User record from the users table (public.users, not auth.users).
 * Sits on top of Supabase Auth with one-to-one relationship via user_uuid.
 * Contains account membership and role for RLS enforcement and permission checks.
 *
 * @remarks
 * - user_uuid matches auth.users.id via foreign key with CASCADE delete
 * - account_uuid establishes tenant membership, used by RLS policies for filtering
 * - user_email is globally unique across all accounts (enforced by UNIQUE constraint)
 * - user_email synced from auth.users.email via sync_user_email trigger
 * - role exposed in JWT claims via custom_access_token_hook for efficient RLS filtering
 * - Soft delete pattern: deleted_at timestamp marks inactive users
 */
export interface User {
  /** UUID primary key matching auth.users.id (one-to-one relationship) */
  user_uuid: string;
  /** Foreign key to accounts table, establishes tenant membership for RLS filtering */
  account_uuid: string;
  /** User email synchronized from auth.users.email, globally unique across all accounts */
  user_email: string;
  /** User's first name, optional */
  first_name: string | null;
  /** User's last name, optional */
  last_name: string | null;
  /** Avatar image URL, optional */
  avatar_url: string | null;
  /** Permission level within account, enforced by RLS policies and exposed in JWT claims */
  role: UserRole;
  /** ISO 8601 timestamp of user creation */
  created_at: string;
  /** ISO 8601 timestamp of last modification, auto-updated by database trigger */
  modified_at: string;
  /** Soft delete timestamp, null for active users. All queries filter by deleted_at IS NULL */
  deleted_at: string | null;
}

/**
 * Payload for updating a user profile.
 * User records are created via create_account_with_admin() or invitation flows.
 * Only profile fields and role can be updated after creation.
 * modified_at timestamp is automatically updated by database trigger.
 */
export interface UserUpdatePayload {
  /** User UUID to update */
  user_uuid: string;
  /** Updated first name */
  first_name?: string | null;
  /** Updated last name */
  last_name?: string | null;
  /** Updated avatar URL */
  avatar_url?: string | null;
  /** Updated role (owner/admin only can change roles via RLS policies) */
  role?: UserRole;
}

// Subscription entity types

/**
 * Subscription record from the subscriptions table.
 * Represents account subscription status for trial management and plan enforcement.
 * Typically one active subscription per account (most recent non-deleted).
 *
 * @remarks
 * - Created automatically by create_account_with_admin() with 14-day trial
 * - trial_ends_at calculated as now() + interval '14 days' for new accounts
 * - Soft delete pattern: deleted_at timestamp marks canceled/replaced subscriptions
 * - Frontend caches subscription status with 5-minute TTL to reduce database load
 * - Fail-closed enforcement: missing/failed subscription query blocks premium features
 */
export interface Subscription {
  /** UUID primary key for subscription record */
  subscription_uuid: string;
  /** Foreign key to accounts table, one account typically has one active subscription */
  account_uuid: string;
  /** Current subscription status, determines feature access and trial UI */
  status: SubscriptionStatus;
  /** Plan identifier (e.g., 'trial', 'basic', 'pro'), 'trial' for new accounts */
  plan_id: string;
  /** Trial expiration timestamp, set for status='trialing'. Used to calculate days remaining */
  trial_ends_at: string | null;
  /** Current billing period start timestamp, null for trial subscriptions */
  current_period_start: string | null;
  /** Current billing period end timestamp, null for trial subscriptions */
  current_period_end: string | null;
  /** ISO 8601 timestamp of subscription creation */
  created_at: string;
  /** ISO 8601 timestamp of last modification, auto-updated by database trigger */
  modified_at: string;
  /** Soft delete timestamp, null for active subscriptions. All queries filter by deleted_at IS NULL */
  deleted_at: string | null;
}

/**
 * Payload for updating subscription status.
 * Subscriptions are created via create_account_with_admin() or payment provider webhooks.
 * Only status, plan, and period timestamps can be updated after creation.
 */
export interface SubscriptionUpdatePayload {
  /** Subscription UUID to update */
  subscription_uuid: string;
  /** Updated subscription status */
  status?: SubscriptionStatus;
  /** Updated plan identifier */
  plan_id?: string;
  /** Updated trial expiration timestamp */
  trial_ends_at?: string | null;
  /** Updated billing period start */
  current_period_start?: string | null;
  /** Updated billing period end */
  current_period_end?: string | null;
}

// ===== LEGACY TYPES - DEPRECATED =====
// The following types are deprecated and will be removed in v2.0
// Migration: Use Account/User/Subscription types instead

/**
 * Address structure for JSONB storage in PostgreSQL.
 * Supports flexible international address formats.
 *
 * @deprecated This type is part of the legacy schema.
 * Will be removed in v2.0. Consider migrating to Account-based schema.
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
 *
 * @deprecated Use UserRole instead. Legacy MemberRole type will be removed in v2.0.
 * Migration: MemberRole maps to UserRole. Note: UserRole adds 'viewer' role not present in legacy schema.
 */
export type MemberRole = 'owner' | 'admin' | 'member';

// Company entity types

/**
 * Company record from the companies table.
 * Represents an organization/business entity in the multi-tenant system.
 *
 * @deprecated Use Account interface instead. Company type will be removed in v2.0.
 * Migration guide:
 * - Company.id → Account.account_uuid
 * - Company.name → Account.company_name
 * - Company.email → Account.company_email
 * - Company.vat_id → No direct mapping (removed in new schema)
 * - Company.phone → No direct mapping (removed in new schema)
 * - Company.address → No direct mapping (removed in new schema)
 * - Company.logo_url → No direct mapping (removed in new schema)
 * - Company.created_at → Account.created_at
 * - Company.updated_at → Account.modified_at
 * - Add Account.deleted_at for soft delete pattern
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
 *
 * @deprecated Use AccountCreatePayload instead. CompanyCreatePayload will be removed in v2.0.
 * Migration: Use create_account_with_admin() database function instead of direct INSERT operations.
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
 *
 * @deprecated Use AccountUpdatePayload instead. CompanyUpdatePayload will be removed in v2.0.
 * Migration: Map Company fields to Account fields as documented in Company interface deprecation.
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
 *
 * @deprecated Use User interface instead. Profile type will be removed in v2.0.
 * Migration guide:
 * - Profile.id → User.user_uuid
 * - Profile.full_name → User.first_name + User.last_name (split into separate fields)
 * - Profile.avatar_url → User.avatar_url
 * - Profile.created_at → User.created_at
 * - Profile.updated_at → User.modified_at
 * - Add User.account_uuid (required, establishes tenant membership)
 * - Add User.user_email (required, globally unique email)
 * - Add User.role (required, permission level within account)
 * - Add User.deleted_at for soft delete pattern
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
 *
 * @deprecated Use UserUpdatePayload instead. ProfileUpdatePayload will be removed in v2.0.
 * Migration: Map Profile.full_name to separate User.first_name and User.last_name fields.
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
 *
 * @deprecated The company_members junction table is replaced by User.account_uuid foreign key.
 * CompanyMember type will be removed in v2.0.
 * Migration guide:
 * - New schema uses one-to-one user-account relationship via User.account_uuid
 * - CompanyMember.role → User.role
 * - CompanyMember.user_id → User.user_uuid
 * - CompanyMember.company_id → User.account_uuid
 * - No multi-account membership in new schema (one user belongs to one account)
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
 *
 * @deprecated User invitation flow will be redesigned for Account-based schema.
 * InviteMemberPayload will be removed in v2.0.
 */
export interface InviteMemberPayload {
  company_id: string;
  user_id: string;
  role: MemberRole;
}

/**
 * Payload for updating a member's role within a company.
 * Only owners can change member roles.
 *
 * @deprecated Use UserUpdatePayload with role field instead.
 * UpdateMemberRolePayload will be removed in v2.0.
 */
export interface UpdateMemberRolePayload {
  member_id: string;
  new_role: MemberRole;
}

/**
 * Payload for removing a member from a company.
 * Owners and admins can remove others, users can remove themselves.
 *
 * @deprecated Use soft delete pattern via User.deleted_at instead.
 * RemoveMemberPayload will be removed in v2.0.
 */
export interface RemoveMemberPayload {
  member_id: string;
  company_id: string;
}
