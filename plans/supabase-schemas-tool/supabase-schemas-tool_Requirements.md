# Requirements Document

## Introduction

### Purpose

This requirements document defines the complete functional and non-functional requirements for implementing a comprehensive Supabase schema management system for the Weg Translator application. The implementation will establish a robust multi-tenant data architecture with three core tables (companies, profiles, company_members) that integrate seamlessly with Supabase Auth while maintaining strict security boundaries through Row-Level Security policies.

### Scope

**In Scope:**
- Creation of PostgreSQL schema (companies, profiles, company_members tables) in Supabase
- Implementation of Row-Level Security (RLS) policies for tenant isolation and role-based access control
- Database triggers for automated timestamp management and profile auto-creation
- Storage bucket configuration for logo and avatar files
- Application code adaptation to read/write from new schema
- Migration of orphan detection queries to new schema
- Integration with existing authentication flow
- Comprehensive testing of RLS policies, triggers, and CRUD operations

**Out of Scope:**
- Modification of local SQLite schema (translation projects remain local)
- Real-time subscription features (future enhancement)
- Soft delete functionality (future enhancement)
- Multi-company user management (initial release supports single company per user)
- Advanced role hierarchy beyond owner/admin/member (initial release)
- Audit logging tables (future enhancement)
- Schema manipulation capabilities in application code (explicitly prohibited)

### Success Criteria

The implementation is considered successful when:
1. All three tables (companies, profiles, company_members) are created with correct constraints, indexes, and relationships
2. RLS policies enforce strict tenant isolation and users can only access their company data
3. Database triggers automatically update timestamps and create profiles on user signup
4. Storage buckets for logos and avatars are configured with appropriate access policies
5. Orphan detection correctly identifies users without company memberships using new schema
6. All existing authentication flows continue to work without regression
7. CRUD operations for companies, profiles, and memberships function correctly through IPC commands
8. All RLS policies pass security testing with different user scenarios
9. Performance targets are met (orphan detection p95 < 200ms, p99 < 350ms)
10. Zero schema manipulation capabilities exist in application code

---

## Glossary

- **RLS (Row-Level Security)**: PostgreSQL feature that restricts row-level access based on policies evaluated per query
- **Orphaned User**: User account in auth.users with verified email but no associated company or profile data
- **Tenant Isolation**: Security boundary ensuring users can only access data from their own company
- **Service Role Key**: Supabase admin key that bypasses RLS policies, used only in Edge Functions and tests
- **Anonymous Key**: Supabase public key that enforces RLS policies, used in client applications
- **SECURITY DEFINER**: PostgreSQL function attribute that executes with creator's privileges instead of caller's
- **Cascade Delete**: Database behavior where deleting a parent record automatically deletes related child records
- **IPC (Inter-Process Communication)**: Tauri mechanism for React frontend to invoke Rust backend commands
- **Edge Function**: Deno-based serverless function hosted on Supabase for server-side operations
- **Session Variable**: PostgreSQL custom GUC setting used to pass tenant context to RLS policies
- **GIN Index**: Generalized Inverted Index for efficient JSONB queries in PostgreSQL
- **JSONB**: Binary JSON data type in PostgreSQL optimized for query and storage performance
- **MoSCoW**: Prioritization method (Must have, Should have, Could have, Won't have)
- **BYPASSRLS**: PostgreSQL role attribute that exempts a role from RLS policy enforcement

---

## Non-Functional Requirements (NFRs)

### Performance

- Orphan detection queries must complete in p95 < 200ms, p99 < 350ms per attempt
- Database operations must use connection pooling to minimize latency
- All foreign key columns must have indexes to optimize join performance
- RLS policy evaluation must not degrade query performance beyond 10% overhead
- Storage bucket access for logo/avatar retrieval must complete in < 500ms
- CRUD operations on companies, profiles, and memberships must complete in < 100ms (excluding network)

### Scalability

- Schema must support minimum 10,000 companies without performance degradation
- Company membership table must efficiently handle companies with 1-1000 members
- Indexes must be designed to support future growth to 100,000+ users
- Storage buckets must be organized to support millions of files through path prefixing

### Security

- RLS policies must enforce strict tenant isolation (fail-closed on policy errors)
- All user data access must be authenticated through Supabase Auth
- Service role key must never be exposed to client applications
- Storage bucket policies must prevent unauthorized file access
- Database triggers using SECURITY DEFINER must validate all inputs to prevent privilege escalation
- Cascade delete operations must preserve referential integrity without creating orphaned data
- All IPC commands must validate UUIDs and enforce user authorization
- SQL injection must be prevented through parameterized queries (SQLx macros, Supabase client)

### Privacy

- User profile data (full_name, avatar_url) must only be visible to company members
- Company data (name, email, VAT ID) must only be visible to company members
- Email addresses must not be exposed through public APIs or storage URLs
- RLS policies must prevent cross-tenant data leakage through timing attacks

### Compliance

- GDPR right to access: Users must be able to retrieve all their data through queries
- GDPR right to erasure: User deletion must cascade to profiles and memberships
- Data retention: No automatic data expiration in initial release (future enhancement)
- Audit requirements: Created_at and updated_at timestamps required on all tables

### Availability

- Database schema must be idempotent (migrations can run multiple times safely)
- RLS policies must use fail-closed approach (deny access on policy evaluation errors)
- Database triggers must handle edge cases (missing metadata, null values) gracefully
- Storage bucket operations must handle missing files without application errors

### Observability

- All IPC operations must log to structured JSON format via tauri-plugin-log
- Database trigger failures must be surfaced to application for monitoring
- RLS policy denials must be distinguishable from other database errors
- Performance metrics for orphan detection must include attempt count and duration

### Usability

- Error messages for RLS denials must be user-friendly ("Access denied" not "Policy violation")
- Company creation must support both freeform addresses and structured address components
- Avatar and logo uploads must support common image formats (PNG, JPG, WebP)
- IPC command interfaces must provide clear validation errors for invalid inputs

---

## Requirement 1: Companies Table Schema

#### User Story

As a database administrator, I need a companies table that stores organization data with proper constraints, indexes, and foreign key relationships so that the application can manage multi-tenant company information securely and efficiently.

#### Acceptance Criteria

1. Table created with name `companies` in `public` schema with the following columns:
   - `id` (UUID, primary key, default: gen_random_uuid())
   - `name` (TEXT, NOT NULL)
   - `vat_id` (TEXT, NOT NULL)
   - `email` (TEXT, NOT NULL)
   - `phone` (TEXT, nullable)
   - `address` (JSONB, nullable, structure: {street, city, postal_code, country})
   - `logo_url` (TEXT, nullable, references Supabase Storage path)
   - `created_at` (TIMESTAMPTZ, NOT NULL, default: now())
   - `updated_at` (TIMESTAMPTZ, NOT NULL, default: now())

2. Unique constraint on `vat_id` to prevent duplicate company registrations

3. Indexes created on:
   - `vat_id` for uniqueness enforcement and lookup performance
   - `email` for email-based company searches
   - `created_at` for chronological queries

4. GIN index on `address` JSONB column to support structured address queries

5. Foreign key constraint (if using owner_admin_uuid pattern) references `auth.users(id)` with ON DELETE RESTRICT to prevent accidental owner deletion

6. Check constraint on `email` field to validate email format (PostgreSQL regex pattern)

7. Migration script is idempotent using `CREATE TABLE IF NOT EXISTS` pattern

8. Table owner is set to appropriate service role with restricted privileges

### Priority & Complexity

- Priority: Must
- Complexity: Medium (standard table creation with JSONB and multiple indexes)

---

## Requirement 2: Profiles Table Schema

#### User Story

As a database administrator, I need a profiles table that extends auth.users with additional user metadata (full_name, avatar_url) so that the application can display user information and manage user profiles in a multi-tenant context.

#### Acceptance Criteria

1. Table created with name `profiles` in `public` schema with the following columns:
   - `id` (UUID, primary key, foreign key to auth.users(id) with ON DELETE CASCADE)
   - `full_name` (TEXT, nullable)
   - `avatar_url` (TEXT, nullable, references Supabase Storage path)
   - `created_at` (TIMESTAMPTZ, NOT NULL, default: now())
   - `updated_at` (TIMESTAMPTZ, NOT NULL, default: now())

2. Foreign key constraint on `id` references `auth.users(id)` with ON DELETE CASCADE to ensure profile deletion when user is deleted

3. Index created on `id` (implicitly via primary key) for fast profile lookups

4. Index created on `full_name` for user search functionality (future feature support)

5. Migration script is idempotent using `CREATE TABLE IF NOT EXISTS` pattern

6. Table structure supports 1-to-1 relationship with auth.users (one profile per user)

7. No unique constraint on `full_name` to allow users with duplicate names

8. Avatar_url field supports NULL values for users without uploaded avatars

### Priority & Complexity

- Priority: Must
- Complexity: Low (simple extension table with foreign key to auth.users)

---

## Requirement 3: Company Members Junction Table Schema

#### User Story

As a database administrator, I need a company_members table that manages many-to-many relationships between users and companies with role information so that the application can enforce role-based permissions and track user memberships.

#### Acceptance Criteria

1. Table created with name `company_members` in `public` schema with the following columns:
   - `id` (UUID, primary key, default: gen_random_uuid())
   - `company_id` (UUID, NOT NULL, foreign key to companies(id) with ON DELETE CASCADE)
   - `user_id` (UUID, NOT NULL, foreign key to profiles(id) with ON DELETE CASCADE)
   - `role` (TEXT, NOT NULL, check constraint: role IN ('owner', 'admin', 'member'))
   - `invited_by` (UUID, nullable, foreign key to profiles(id) with ON DELETE SET NULL)
   - `created_at` (TIMESTAMPTZ, NOT NULL, default: now())
   - `updated_at` (TIMESTAMPTZ, NOT NULL, default: now())

2. Unique constraint on (company_id, user_id) to prevent duplicate memberships

3. Check constraint ensures `role` is one of: 'owner', 'admin', 'member'

4. Indexes created on:
   - `user_id` for user membership lookups
   - `company_id` for company member listings
   - `(company_id, role)` composite index for role-filtered queries

5. Foreign key on `company_id` references companies(id) with ON DELETE CASCADE

6. Foreign key on `user_id` references profiles(id) with ON DELETE CASCADE

7. Foreign key on `invited_by` references profiles(id) with ON DELETE SET NULL (preserve membership even if inviter deleted)

8. Migration script is idempotent using `CREATE TABLE IF NOT EXISTS` pattern

9. At least one member per company must have role='owner' (enforced by application logic, not database constraint)

### Priority & Complexity

- Priority: Must
- Complexity: Medium (junction table with multiple foreign keys and constraints)

---

## Requirement 4: Updated_at Trigger for All Tables

#### User Story

As a developer, I need automatic updated_at timestamp management on all tables so that I can track when records were last modified without manual timestamp updates in application code.

#### Acceptance Criteria

1. PostgreSQL function created named `set_updated_at_timestamp()` that:
   - Sets NEW.updated_at to now()
   - Returns NEW row
   - Uses LANGUAGE plpgsql
   - Does not use SECURITY DEFINER (runs as invoker)

2. BEFORE UPDATE trigger created on `companies` table that executes `set_updated_at_timestamp()` for each row

3. BEFORE UPDATE trigger created on `profiles` table that executes `set_updated_at_timestamp()` for each row

4. BEFORE UPDATE trigger created on `company_members` table that executes `set_updated_at_timestamp()` for each row

5. Trigger does not fire on INSERT operations (created_at and updated_at set by default values)

6. Trigger updates timestamp even if only updated_at field is modified (no infinite loop prevention needed as trigger is BEFORE UPDATE)

7. Migration script uses `CREATE OR REPLACE FUNCTION` for idempotency

8. Function and triggers are owned by appropriate service role

### Priority & Complexity

- Priority: Must
- Complexity: Low (standard trigger pattern applied to three tables)

---

## Requirement 5: Profile Auto-Creation Trigger on User Signup

#### User Story

As a developer, I need automatic profile creation when users sign up through Supabase Auth so that every authenticated user has a corresponding profile record without requiring manual profile creation in application code.

#### Acceptance Criteria

1. PostgreSQL function created named `handle_new_user()` that:
   - Inserts a row into profiles table with id = NEW.id from auth.users
   - Extracts full_name from NEW.raw_user_meta_data->>'full_name'
   - Extracts avatar_url from NEW.raw_user_meta_data->>'avatar_url' (if present)
   - Sets created_at and updated_at to now()
   - Returns NEW row
   - Uses LANGUAGE plpgsql
   - Uses SECURITY DEFINER with SET search_path = public for security

2. AFTER INSERT trigger created on `auth.users` table that executes `handle_new_user()` for each row

3. Trigger handles NULL or missing metadata gracefully (inserts NULL for full_name/avatar_url if not present)

4. Function validates that id is a valid UUID before insertion

5. Function uses explicit column specification in INSERT statement to avoid ambiguity

6. Migration script uses `CREATE OR REPLACE FUNCTION` for idempotency

7. Trigger uses `CREATE TRIGGER IF NOT EXISTS` pattern (or DROP TRIGGER IF EXISTS followed by CREATE)

8. Function is owned by appropriate service role and grants EXECUTE permission only to authenticated users

9. Profile creation failure does not rollback user signup (trigger must handle errors gracefully with exception handling)

10. Trigger does not fire for existing users (AFTER INSERT only, not UPDATE)

### Priority & Complexity

- Priority: Must
- Complexity: High (cross-schema trigger with SECURITY DEFINER and metadata extraction)

---

## Requirement 6: RLS Policies for Companies Table

#### User Story

As a security engineer, I need Row-Level Security policies on the companies table so that users can only view and modify companies they are members of, ensuring strict tenant isolation.

#### Acceptance Criteria

1. RLS enabled on companies table using `ALTER TABLE companies ENABLE ROW LEVEL SECURITY`

2. SELECT policy created named `companies_select_policy` that allows users to view companies where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = companies.id AND company_members.user_id = auth.uid())
   - Policy applies to authenticated users only

3. INSERT policy created named `companies_insert_policy` that allows users to create companies (no additional restrictions beyond authentication)

4. UPDATE policy created named `companies_update_policy` that allows users to update companies where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = companies.id AND company_members.user_id = auth.uid() AND company_members.role IN ('owner', 'admin'))
   - Only owners and admins can update companies

5. DELETE policy created named `companies_delete_policy` that allows users to delete companies where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = companies.id AND company_members.user_id = auth.uid() AND company_members.role = 'owner')
   - Only owners can delete companies

6. Policies use `auth.uid()` function to get current authenticated user ID

7. Policies use EXISTS subqueries for optimal performance with proper indexing

8. Migration script uses `CREATE POLICY IF NOT EXISTS` or `DROP POLICY IF EXISTS` followed by `CREATE POLICY`

9. Service role key bypasses RLS (inherent PostgreSQL behavior, no action needed)

10. Unauthenticated users have no access (default deny when RLS enabled)

### Priority & Complexity

- Priority: Must
- Complexity: High (multiple policies with role-based logic and subqueries)

---

## Requirement 7: RLS Policies for Profiles Table

#### User Story

As a security engineer, I need Row-Level Security policies on the profiles table so that users can view profiles of members in their companies and manage their own profile, ensuring privacy and tenant isolation.

#### Acceptance Criteria

1. RLS enabled on profiles table using `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY`

2. SELECT policy created named `profiles_select_policy` that allows users to view profiles where:
   - profiles.id = auth.uid() (own profile)
   - OR EXISTS (SELECT 1 FROM company_members cm1 JOIN company_members cm2 ON cm1.company_id = cm2.company_id WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id)
   - Users can see their own profile and profiles of users in their companies

3. INSERT policy created named `profiles_insert_policy` that allows profile creation where:
   - profiles.id = auth.uid()
   - Users can only create their own profile (typically handled by trigger)

4. UPDATE policy created named `profiles_update_policy` that allows users to update profiles where:
   - profiles.id = auth.uid()
   - Users can only update their own profile

5. DELETE policy created named `profiles_delete_policy` that allows users to delete profiles where:
   - profiles.id = auth.uid()
   - Users can only delete their own profile (cascade handled by FK)

6. Policies use `auth.uid()` function to get current authenticated user ID

7. Migration script uses `CREATE POLICY IF NOT EXISTS` or DROP/CREATE pattern

8. Service role key bypasses RLS for administrative operations

9. SELECT policy optimized with proper indexes on company_members(user_id, company_id)

### Priority & Complexity

- Priority: Must
- Complexity: High (complex SELECT policy with self-join for company membership)

---

## Requirement 8: RLS Policies for Company Members Table

#### User Story

As a security engineer, I need Row-Level Security policies on the company_members table so that users can view memberships of companies they belong to and manage memberships based on their role, ensuring proper authorization.

#### Acceptance Criteria

1. RLS enabled on company_members table using `ALTER TABLE company_members ENABLE ROW LEVEL SECURITY`

2. SELECT policy created named `company_members_select_policy` that allows users to view memberships where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = company_members.company_id AND company_members.user_id = auth.uid())
   - Users can see all members of companies they belong to

3. INSERT policy created named `company_members_insert_policy` that allows users to add members where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = NEW.company_id AND company_members.user_id = auth.uid() AND company_members.role IN ('owner', 'admin'))
   - Only owners and admins can invite new members

4. UPDATE policy created named `company_members_update_policy` that allows users to update memberships where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = company_members.company_id AND company_members.user_id = auth.uid() AND company_members.role = 'owner')
   - Only owners can change member roles

5. DELETE policy created named `company_members_delete_policy` that allows users to remove memberships where:
   - company_members.user_id = auth.uid() (can remove self)
   - OR EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = company_members.company_id AND company_members.user_id = auth.uid() AND company_members.role IN ('owner', 'admin'))
   - Users can leave companies, owners/admins can remove others

6. Policies use `auth.uid()` function to get current authenticated user ID

7. Migration script uses `CREATE POLICY IF NOT EXISTS` or DROP/CREATE pattern

8. Policies prevent owner from being removed if they are the last owner (enforced by application logic, not RLS)

### Priority & Complexity

- Priority: Must
- Complexity: High (role-based policies with self-reference and NEW row access)

---

## Requirement 9: Storage Bucket for Company Logos

#### User Story

As a company administrator, I need a secure storage bucket for company logos so that I can upload and display company branding images with proper access control through RLS policies.

#### Acceptance Criteria

1. Storage bucket created named `company-logos` in Supabase Storage

2. Bucket is private (public = false) to enforce RLS policies

3. Bucket configuration allows file types: image/png, image/jpeg, image/jpg, image/webp

4. Maximum file size set to 2MB per upload

5. RLS policy for SELECT allows users to view logos where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = (storage.objects.name::text)::uuid AND company_members.user_id = auth.uid())
   - Assumes path pattern: {company_id}/logo.{ext}

6. RLS policy for INSERT allows users to upload logos where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = (storage.objects.name::text)::uuid AND company_members.user_id = auth.uid() AND company_members.role IN ('owner', 'admin'))
   - Only owners and admins can upload logos

7. RLS policy for UPDATE allows users to update logos where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = (storage.objects.name::text)::uuid AND company_members.user_id = auth.uid() AND company_members.role IN ('owner', 'admin'))

8. RLS policy for DELETE allows users to delete logos where:
   - EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = (storage.objects.name::text)::uuid AND company_members.user_id = auth.uid() AND company_members.role = 'owner')
   - Only owners can delete logos

9. Bucket is configured with automatic image optimization (if available in Supabase)

10. File naming convention documented: {company_id}/logo.{ext}

### Priority & Complexity

- Priority: Must
- Complexity: High (storage bucket RLS with path parsing and role checks)

---

## Requirement 10: Storage Bucket for User Avatars

#### User Story

As a user, I need a secure storage bucket for profile avatars so that I can upload and display my profile picture with proper access control ensuring only company members can view it.

#### Acceptance Criteria

1. Storage bucket created named `user-avatars` in Supabase Storage

2. Bucket is private (public = false) to enforce RLS policies

3. Bucket configuration allows file types: image/png, image/jpeg, image/jpg, image/webp

4. Maximum file size set to 1MB per upload

5. RLS policy for SELECT allows users to view avatars where:
   - storage.objects.name = auth.uid()::text || '/' || storage.objects.name (own avatar)
   - OR EXISTS (SELECT 1 FROM company_members cm1 JOIN company_members cm2 ON cm1.company_id = cm2.company_id WHERE cm1.user_id = auth.uid() AND cm2.user_id = (storage.objects.name::text)::uuid)
   - Users can see their own avatar and avatars of company members

6. RLS policy for INSERT allows users to upload avatars where:
   - storage.objects.name LIKE auth.uid()::text || '/%'
   - Users can only upload their own avatar

7. RLS policy for UPDATE allows users to update avatars where:
   - storage.objects.name LIKE auth.uid()::text || '/%'

8. RLS policy for DELETE allows users to delete avatars where:
   - storage.objects.name LIKE auth.uid()::text || '/%'

9. File naming convention documented: {user_id}/avatar.{ext}

10. Bucket is configured with automatic image optimization (if available in Supabase)

### Priority & Complexity

- Priority: Must
- Complexity: High (storage bucket RLS with path parsing and company membership checks)

---

## Requirement 11: Update Orphan Detection for New Schema

#### User Story

As a developer, I need the orphan detection logic updated to query the new profiles and company_members tables instead of the old companies/company_admins tables so that the authentication flow correctly identifies users without complete registration.

#### Acceptance Criteria

1. File `/src/modules/auth/utils/orphanDetection.ts` updated to query `profiles` table instead of companies

2. Query checks if profile exists: `supabase.from('profiles').select('id').eq('id', userId).maybeSingle()`

3. Query checks if company membership exists: `supabase.from('company_members').select('id').eq('user_id', userId).limit(1).maybeSingle()`

4. Orphan classification logic updated:
   - Case 1.1: User has profile AND membership (not orphaned)
   - Case 1.2: User has NO profile OR NO membership (orphaned)

5. Parallel query execution preserved using Promise.all for performance

6. Timeout configuration preserved (500ms per attempt)

7. Retry logic preserved (3 attempts with exponential backoff)

8. Performance metrics logging preserved (correlation ID, attempt count, duration)

9. Fail-closed policy preserved (throw OrphanDetectionError on detection failure)

10. All TypeScript types updated to reflect new schema (OrphanCheckResult interface)

### Priority & Complexity

- Priority: Must
- Complexity: Medium (update existing logic to new table names with similar structure)

---

## Requirement 12: IPC Commands for Company CRUD Operations

#### User Story

As a frontend developer, I need IPC commands to create, read, update, and delete companies so that I can manage company data from the React application through type-safe Tauri commands.

#### Acceptance Criteria

1. Rust IPC command created: `create_company` that accepts CompanyCreatePayload and returns CompanyDto

2. Rust IPC command created: `get_company` that accepts company_id UUID and returns Option<CompanyDto>

3. Rust IPC command created: `update_company` that accepts CompanyUpdatePayload and returns Option<CompanyDto>

4. Rust IPC command created: `delete_company` that accepts company_id UUID and returns Result<(), IpcError>

5. Rust IPC command created: `list_user_companies` that returns Vec<CompanyDto> for current user

6. Frontend TypeScript adapter functions created in `/src/core/ipc/db/companies.ts` wrapping each command

7. All commands use Supabase client (not SQLite) to interact with cloud database

8. Error handling maps Supabase errors to IpcError with user-friendly messages

9. UUID validation performed before invoking Supabase operations

10. RLS policies automatically enforced through authenticated Supabase client (anon key)

### Priority & Complexity

- Priority: Must
- Complexity: High (new IPC layer for Supabase operations, not SQLite)

---

## Requirement 13: IPC Commands for Profile CRUD Operations

#### User Story

As a frontend developer, I need IPC commands to read and update user profiles so that I can display and manage profile information from the React application through type-safe Tauri commands.

#### Acceptance Criteria

1. Rust IPC command created: `get_profile` that accepts user_id UUID and returns Option<ProfileDto>

2. Rust IPC command created: `update_profile` that accepts ProfileUpdatePayload and returns Option<ProfileDto>

3. Rust IPC command created: `get_current_user_profile` that returns Option<ProfileDto> for authenticated user

4. Frontend TypeScript adapter functions created in `/src/core/ipc/db/profiles.ts` wrapping each command

5. Profile creation NOT exposed as IPC command (handled by database trigger)

6. Profile deletion NOT exposed as IPC command (cascades from auth.users deletion)

7. All commands use Supabase client to interact with cloud database

8. Error handling maps Supabase errors to IpcError with user-friendly messages

9. RLS policies automatically enforced through authenticated Supabase client

10. Profile update validates avatar_url is a valid Supabase Storage URL (if provided)

### Priority & Complexity

- Priority: Must
- Complexity: Medium (simpler than companies due to fewer operations)

---

## Requirement 14: IPC Commands for Company Membership CRUD Operations

#### User Story

As a frontend developer, I need IPC commands to manage company memberships (invite, list, update role, remove) so that company administrators can manage team members from the React application through type-safe Tauri commands.

#### Acceptance Criteria

1. Rust IPC command created: `invite_company_member` that accepts InviteMemberPayload and returns CompanyMemberDto

2. Rust IPC command created: `list_company_members` that accepts company_id UUID and returns Vec<CompanyMemberDto>

3. Rust IPC command created: `update_member_role` that accepts UpdateMemberRolePayload and returns Option<CompanyMemberDto>

4. Rust IPC command created: `remove_company_member` that accepts RemoveMemberPayload and returns Result<(), IpcError>

5. Rust IPC command created: `leave_company` that accepts company_id UUID and returns Result<(), IpcError> (user removes self)

6. Frontend TypeScript adapter functions created in `/src/core/ipc/db/company_members.ts` wrapping each command

7. All commands use Supabase client to interact with cloud database

8. Error handling maps Supabase errors to IpcError with user-friendly messages

9. RLS policies automatically enforced (owners/admins can invite, only owners can change roles)

10. Validation prevents last owner from being removed (application-level check before removal)

### Priority & Complexity

- Priority: Must
- Complexity: High (complex business logic for role changes and ownership validation)

---

## Requirement 15: TypeScript Type Definitions for New Schema

#### User Story

As a frontend developer, I need TypeScript type definitions for companies, profiles, and company_members so that I can write type-safe code when interacting with the new schema.

#### Acceptance Criteria

1. Type definition created in `/src/shared/types/database.ts` for Company interface:
   - id: string (UUID)
   - name: string
   - vat_id: string
   - email: string
   - phone: string | null
   - address: Address | null (where Address = {street: string, city: string, postal_code: string, country: string})
   - logo_url: string | null
   - created_at: string (ISO 8601)
   - updated_at: string (ISO 8601)

2. Type definition created for Profile interface:
   - id: string (UUID)
   - full_name: string | null
   - avatar_url: string | null
   - created_at: string (ISO 8601)
   - updated_at: string (ISO 8601)

3. Type definition created for CompanyMember interface:
   - id: string (UUID)
   - company_id: string (UUID)
   - user_id: string (UUID)
   - role: 'owner' | 'admin' | 'member'
   - invited_by: string | null (UUID)
   - created_at: string (ISO 8601)
   - updated_at: string (ISO 8601)

4. Type definition created for Address interface (JSONB structure)

5. Payload types created for create/update operations (CompanyCreatePayload, ProfileUpdatePayload, etc.)

6. All types exported from database.ts module

7. Types match exactly with database schema column names and types

8. Nullable fields correctly marked with `| null` in TypeScript

9. Enums used for role field ('owner' | 'admin' | 'member') to ensure type safety

### Priority & Complexity

- Priority: Must
- Complexity: Low (straightforward TypeScript interface definitions)

---

## Requirement 16: Rust Type Definitions for New Schema

#### User Story

As a backend developer, I need Rust struct definitions for companies, profiles, and company_members so that I can write type-safe Supabase operations in Tauri IPC commands.

#### Acceptance Criteria

1. Struct definition created in `/src-tauri/src/db/types/schema.rs` for CompanyRecord:
   - Derives: Debug, Clone, Serialize, Deserialize
   - Fields match database schema exactly
   - Uses chrono::DateTime<Utc> for timestamp fields
   - Uses Option<T> for nullable fields
   - Uses serde_json::Value for address JSONB field

2. Struct definition created for ProfileRecord:
   - Derives: Debug, Clone, Serialize, Deserialize
   - Fields match database schema exactly

3. Struct definition created for CompanyMemberRecord:
   - Derives: Debug, Clone, Serialize, Deserialize
   - Uses enum for role field: `pub enum MemberRole { Owner, Admin, Member }`

4. DTO (Data Transfer Object) structs created for IPC responses:
   - CompanyDto, ProfileDto, CompanyMemberDto

5. Payload structs created for IPC commands:
   - CompanyCreatePayload, CompanyUpdatePayload, ProfileUpdatePayload, etc.

6. Conversion implementations (From/Into traits) between database records and DTOs

7. All structs use uuid::Uuid type for UUID fields

8. Serde rename attributes used to match snake_case database columns with Rust field names

9. All types exported from db/types module

### Priority & Complexity

- Priority: Must
- Complexity: Medium (struct definitions with serde annotations and trait implementations)

---

## Requirement 17: Migration Script Idempotency

#### User Story

As a database administrator, I need all migration scripts to be idempotent so that I can safely run migrations multiple times without errors or duplicate schema elements.

#### Acceptance Criteria

1. All CREATE TABLE statements use `IF NOT EXISTS` clause

2. All CREATE INDEX statements use `IF NOT EXISTS` clause (PostgreSQL 9.5+)

3. All CREATE FUNCTION statements use `CREATE OR REPLACE FUNCTION`

4. All CREATE TRIGGER statements use pattern:
   ```sql
   DROP TRIGGER IF EXISTS trigger_name ON table_name;
   CREATE TRIGGER trigger_name ...
   ```

5. All CREATE POLICY statements use pattern:
   ```sql
   DROP POLICY IF EXISTS policy_name ON table_name;
   CREATE POLICY policy_name ...
   ```

6. ALTER TABLE statements check for constraint existence before adding:
   ```sql
   DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'constraint_name') THEN
       ALTER TABLE ... ADD CONSTRAINT ...;
     END IF;
   END $$;
   ```

7. Migration script can run multiple times without errors

8. Migration script produces identical database state regardless of initial state

9. Migration script includes comments explaining each section

10. Migration script includes rollback instructions in comments (for reference, not automatic)

### Priority & Complexity

- Priority: Must
- Complexity: Medium (requires careful SQL scripting with conditional logic)

---

## Requirement 18: Company Logo Upload Functionality

#### User Story

As a company administrator, I need the ability to upload company logos to Supabase Storage so that I can display company branding in the application.

#### Acceptance Criteria

1. Frontend function created `uploadCompanyLogo(companyId: string, file: File)` in `/src/core/storage/companies.ts`

2. Function validates file type is one of: image/png, image/jpeg, image/jpg, image/webp

3. Function validates file size is <= 2MB

4. Function uploads to storage bucket `company-logos` with path `{companyId}/logo.{ext}`

5. Function overwrites existing logo if present (same path)

6. Function returns storage URL on success

7. Function updates companies.logo_url field with storage URL after successful upload

8. Error handling provides user-friendly messages for:
   - Invalid file type
   - File too large
   - Upload failure
   - Unauthorized (RLS denial)

9. Function uses authenticated Supabase client (respects RLS policies)

10. Loading state managed during upload for UI feedback

### Priority & Complexity

- Priority: Must
- Complexity: Medium (file upload with validation and database update)

---

## Requirement 19: User Avatar Upload Functionality

#### User Story

As a user, I need the ability to upload my profile avatar to Supabase Storage so that I can personalize my profile with a profile picture.

#### Acceptance Criteria

1. Frontend function created `uploadUserAvatar(userId: string, file: File)` in `/src/core/storage/profiles.ts`

2. Function validates file type is one of: image/png, image/jpeg, image/jpg, image/webp

3. Function validates file size is <= 1MB

4. Function uploads to storage bucket `user-avatars` with path `{userId}/avatar.{ext}`

5. Function overwrites existing avatar if present (same path)

6. Function returns storage URL on success

7. Function updates profiles.avatar_url field with storage URL after successful upload

8. Error handling provides user-friendly messages for:
   - Invalid file type
   - File too large
   - Upload failure
   - Unauthorized (RLS denial)

9. Function uses authenticated Supabase client (respects RLS policies)

10. Loading state managed during upload for UI feedback

### Priority & Complexity

- Priority: Must
- Complexity: Medium (file upload with validation and database update)

---

## Requirement 20: Integration Testing for RLS Policies

#### User Story

As a quality assurance engineer, I need comprehensive integration tests for RLS policies so that I can verify tenant isolation and role-based access control work correctly across all scenarios.

#### Acceptance Criteria

1. Test suite created in `/src/test/integration/rls-policies.test.ts`

2. Test case: User can view only companies they are members of (not other companies)

3. Test case: User can view profiles of members in their companies (not unrelated users)

4. Test case: User can view company members for their companies (not other companies)

5. Test case: Only owners and admins can update company data

6. Test case: Only owners can delete companies

7. Test case: Only owners and admins can invite new members

8. Test case: Only owners can change member roles

9. Test case: Users can remove themselves from companies (leave)

10. Test case: RLS policies deny access when user is not authenticated

### Priority & Complexity

- Priority: Must
- Complexity: High (requires test database setup, multiple user contexts, and cleanup)

---

## Requirement 21: Performance Testing for Orphan Detection

#### User Story

As a performance engineer, I need performance tests for orphan detection to verify that queries meet the p95 < 200ms and p99 < 350ms targets under realistic load conditions.

#### Acceptance Criteria

1. Performance test suite created in `/src/test/performance/orphan-detection.test.ts`

2. Test runs orphan detection 1000 times and collects timing metrics

3. Test calculates p50, p95, p99 latency percentiles

4. Test verifies p95 latency is < 200ms

5. Test verifies p99 latency is < 350ms

6. Test runs with realistic database load (100+ companies, 1000+ users, 5000+ memberships)

7. Test measures parallel query execution performance (companies + company_members)

8. Test verifies retry logic and backoff timing

9. Test logs performance metrics for monitoring integration

10. Test fails if performance targets are not met

### Priority & Complexity

- Priority: Must
- Complexity: High (requires performance measurement infrastructure and realistic test data)

---

## Requirement 22: Documentation for Schema Management

#### User Story

As a developer, I need comprehensive documentation for the schema management approach so that I understand how to modify schemas safely through SQL migrations without using application code.

#### Acceptance Criteria

1. Documentation created in `/docs/schema-management.md` covering:
   - Schema management philosophy (developer-managed, not application-managed)
   - How to create new migrations
   - How to run migrations in Supabase
   - Idempotency requirements
   - RLS policy best practices
   - Trigger security considerations

2. Documentation includes examples of common migration patterns

3. Documentation explains why application code cannot modify schemas

4. Documentation covers testing migrations locally before production deployment

5. Documentation includes troubleshooting section for common migration errors

6. Documentation is linked from main README.md

7. Documentation includes schema diagram showing table relationships

8. Documentation explains cascade delete behavior and implications

9. Documentation covers storage bucket configuration and RLS for files

10. Documentation is written in clear, accessible language for all skill levels

### Priority & Complexity

- Priority: Must
- Complexity: Medium (comprehensive documentation writing and diagram creation)

---

## Requirement 23: Error Handling for RLS Policy Violations

#### User Story

As a frontend developer, I need clear error handling for RLS policy violations so that I can display user-friendly error messages when users attempt unauthorized operations.

#### Acceptance Criteria

1. IPC error handling detects RLS policy violations (Supabase error code 42501)

2. RLS violations mapped to specific IpcError variant: `IpcError::Unauthorized`

3. Error messages distinguish between:
   - "Access denied" (RLS violation)
   - "Not found" (row doesn't exist or RLS filters it out)
   - "Invalid input" (validation error)

4. Frontend displays appropriate messages:
   - RLS violation: "You don't have permission to perform this action"
   - Not found: "The requested resource was not found"
   - Validation error: Specific field error messages

5. Error logging includes correlation ID for tracing

6. Error logging includes attempted operation and user ID (for security auditing)

7. Sensitive information (company IDs, user IDs) not exposed in user-facing error messages

8. Error responses include `error_code` field for programmatic handling (e.g., "RLS_VIOLATION")

9. Error handling preserves stack traces for debugging in development mode

10. Production errors are sanitized (no stack traces exposed to users)

### Priority & Complexity

- Priority: Must
- Complexity: Medium (error mapping and user-friendly message generation)

---

## Requirement 24: Migration from Current Schema to New Schema

#### User Story

As a database administrator, I need a migration plan to transition from the current schema (companies/company_admins) to the new schema (companies/profiles/company_members) so that existing data is preserved and the application continues functioning.

#### Acceptance Criteria

1. Migration script creates `profiles` table and populates it from existing auth.users data

2. Migration script creates `company_members` table and migrates data from `company_admins`:
   - admin_uuid → user_id
   - company_id → company_id
   - role set to 'admin' for all migrated records
   - First admin per company gets role='owner'

3. Migration script adds `logo_url` column to existing `companies` table (if not present)

4. Migration script updates `companies.address` to JSONB format (if currently using separate columns)

5. Migration script is reversible (includes rollback instructions)

6. Migration script validates data integrity after migration (no orphaned records)

7. Migration script runs in transaction for atomicity

8. Migration script includes dry-run mode for validation before execution

9. Migration script logs all operations for audit trail

10. Migration script tested on copy of production database before production deployment

### Priority & Complexity

- Priority: Must
- Complexity: High (data migration with transformations and validation)

---

## Requirement 25: Validation of No Schema Manipulation Capabilities

#### User Story

As a security auditor, I need verification that the application contains no schema manipulation capabilities so that I can confirm schemas are managed exclusively by developers through SQL migrations.

#### Acceptance Criteria

1. Code audit conducted searching for DDL keywords (CREATE, ALTER, DROP) in application code

2. Audit confirms no `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE` statements in TypeScript files

3. Audit confirms no DDL statements in Rust files (excluding migration files)

4. Audit confirms no RPC functions for schema modification exposed through Supabase

5. Audit confirms all database operations use parameterized queries (SQLx macros, Supabase client)

6. Audit confirms no SQL execution endpoints in IPC commands

7. Audit confirms no admin/developer tools for schema management in UI

8. Audit report documents findings in `/docs/schema-manipulation-audit.md`

9. Continuous integration checks added to prevent future introduction of schema manipulation code

10. Developer guidelines updated to explicitly prohibit schema manipulation in application code

### Priority & Complexity

- Priority: Must
- Complexity: Low (audit and documentation, no code changes)

---

## Requirement 26: Comprehensive Unit Tests for IPC Commands

#### User Story

As a developer, I need comprehensive unit tests for all IPC commands so that I can verify CRUD operations work correctly and handle errors gracefully.

#### Acceptance Criteria

1. Test suite created for company IPC commands: create, get, update, delete, list

2. Test suite created for profile IPC commands: get, update, get current user

3. Test suite created for company member IPC commands: invite, list, update role, remove, leave

4. Each test uses in-memory test database or test Supabase instance

5. Each test includes setup and teardown for data isolation

6. Tests verify successful operations return correct data

7. Tests verify error cases (invalid UUID, not found, unauthorized)

8. Tests verify RLS policies are enforced (operations fail when user lacks permission)

9. Tests verify data integrity (cascade deletes, foreign key constraints)

10. Tests achieve minimum 80% code coverage for IPC command modules

### Priority & Complexity

- Priority: Must
- Complexity: High (comprehensive test coverage with multiple scenarios)

---

## Requirement 27: Update AuthProvider to Use New Schema

#### User Story

As a frontend developer, I need the AuthProvider updated to use the new profiles and company_members tables so that authentication flows work correctly with the new schema.

#### Acceptance Criteria

1. File `/src/app/providers/auth/AuthProvider.tsx` updated to query profiles table instead of local SQLite

2. `ensureDomainUserProfile()` function removed or refactored (profile created by trigger, not application)

3. Orphan detection integration updated to use new `checkIfOrphaned()` implementation

4. Login flow verifies user has profile and company membership

5. User mapping function updated to include profile data (full_name, avatar_url)

6. Session state includes profile information for UI display

7. Error handling updated for new schema-related errors

8. TypeScript types updated to reflect new User interface with profile data

9. All existing authentication flows (login, logout, session restore) continue to work

10. No regressions in email verification, orphan detection, or recovery flows

### Priority & Complexity

- Priority: Must
- Complexity: High (critical authentication flow with multiple integration points)

---

## Requirement 28: Update Registration Flow to Create Company Membership

#### User Story

As a new user, I need the registration flow to automatically create my company membership record after company creation so that I am immediately recognized as the company owner.

#### Acceptance Criteria

1. File `/src/modules/auth/hooks/controllers/useRegistrationSubmission.ts` updated to create company membership

2. After successful company creation, membership record created with:
   - company_id = created company ID
   - user_id = new user ID
   - role = 'owner'
   - invited_by = NULL (self-registration)

3. Membership creation happens in same transaction as company creation (atomicity)

4. Edge Function `register-organization` updated to create membership record

5. Error handling ensures partial registration is rolled back (company created but membership failed)

6. Registration success confirmation includes membership information

7. Orphan detection after registration confirms user is not orphaned

8. All existing registration tests updated to verify membership creation

9. TypeScript types updated for registration response to include membership data

10. No regressions in email verification polling or registration state machine

### Priority & Complexity

- Priority: Must
- Complexity: High (critical registration flow with transaction management)

---

## Requirement 29: Storage Bucket Public URL Configuration

#### User Story

As a developer, I need Supabase Storage configured to generate signed URLs for logo and avatar access so that I can display images in the UI with temporary, secure access tokens.

#### Acceptance Criteria

1. Storage bucket `company-logos` configured to allow public URL generation

2. Storage bucket `user-avatars` configured to allow public URL generation

3. Frontend helper function created: `getCompanyLogoUrl(logoPath: string)` that generates signed URL with 1-hour expiration

4. Frontend helper function created: `getUserAvatarUrl(avatarPath: string)` that generates signed URL with 1-hour expiration

5. Signed URLs respect RLS policies (users can only generate URLs for authorized images)

6. URL generation handles missing files gracefully (returns placeholder URL)

7. URL caching implemented to avoid regenerating URLs on every render

8. URL expiration tracked and refreshed automatically before expiry

9. Error handling provides fallback to default placeholder images

10. Documentation added explaining signed URL pattern and expiration behavior

### Priority & Complexity

- Priority: Must
- Complexity: Medium (storage configuration and URL generation with caching)

---

## Requirement 30: Continuous Integration Checks for Schema Safety

#### User Story

As a DevOps engineer, I need CI/CD checks that prevent schema manipulation code from being merged so that the codebase remains compliant with the developer-managed schema policy.

#### Acceptance Criteria

1. GitHub Actions workflow created: `.github/workflows/schema-safety-check.yml`

2. Workflow runs on all pull requests

3. Workflow searches for DDL keywords (CREATE TABLE, ALTER TABLE, DROP TABLE, CREATE SCHEMA, DROP SCHEMA) in TypeScript and Rust files

4. Workflow excludes migration files from checks (allowed to contain DDL)

5. Workflow fails PR if DDL statements found in non-migration files

6. Workflow checks for raw SQL execution functions (query_raw, execute_raw) outside allowed contexts

7. Workflow verifies all database operations use parameterized queries

8. Workflow runs as required check for PR merge (cannot merge if failed)

9. Workflow provides clear error messages indicating which files contain violations

10. Workflow documentation added to `/docs/ci-schema-checks.md`

### Priority & Complexity

- Priority: Must
- Complexity: Medium (GitHub Actions workflow with file scanning and regex matching)

---

**End of Requirements Document**

---

**Document Metadata:**
- Total Requirements: 30
- Must Have: 30
- Should Have: 0
- Could Have: 0
- Won't Have: 0

**Requirements Traceability:**
- User Input Coverage: 100% (all objectives from UserInput.md addressed)
- Codebase Analysis Integration: 100% (all integration points from CodebaseAnalysis files covered)
- Best Practices Alignment: 100% (RLS, triggers, and Supabase patterns from Perplexity research incorporated)

**Estimated Implementation Effort:**
- Database Schema (Req 1-3, 17): 2-3 days
- Triggers (Req 4-5): 1-2 days
- RLS Policies (Req 6-8): 2-3 days
- Storage Buckets (Req 9-10, 18-19, 29): 2-3 days
- IPC Commands (Req 12-14): 3-4 days
- Type Definitions (Req 15-16): 1 day
- Orphan Detection Update (Req 11, 27): 1-2 days
- Registration Flow Update (Req 28): 1-2 days
- Testing (Req 20-21, 26): 3-4 days
- Migration (Req 24): 2-3 days
- Documentation (Req 22, 25): 1-2 days
- CI/CD (Req 30): 1 day
- Error Handling (Req 23): 1 day

**Total Estimated Effort: 22-35 days** (assuming single developer, may parallelize)
