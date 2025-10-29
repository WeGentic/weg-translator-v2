# Codebase Analysis: Supabase Integration in Weg Translator

## Executive Summary

This analysis covers the existing Supabase integration in the Weg Translator application, specifically focusing on how authentication, user profiles, company management, and database operations are currently implemented. The codebase uses a hybrid approach: Supabase for authentication and cloud features (Edge Functions, Storage), while maintaining a separate SQLite database for local translation project data.

---

## File Tree Structure

```
/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/
├── src/
│   ├── core/
│   │   ├── config/
│   │   │   ├── supabaseClient.ts              # Supabase client initialization
│   │   │   └── index.ts
│   │   └── ipc/
│   │       ├── db/
│   │       │   ├── users.ts                   # User profile CRUD operations
│   │       │   ├── clients.ts                 # Client/company CRUD operations
│   │       │   └── index.ts
│   │       ├── client.ts                      # Main IPC command facade
│   │       └── request.ts
│   ├── app/
│   │   └── providers/
│   │       └── auth/
│   │           ├── AuthProvider.tsx           # Auth state management & context
│   │           └── index.ts
│   ├── modules/
│   │   └── auth/
│   │       ├── components/
│   │       │   ├── forms/
│   │       │   │   ├── RegistrationCompanyStep.tsx  # Company info form
│   │       │   │   └── ...
│   │       │   ├── LoginForm.tsx
│   │       │   ├── RegistrationForm.tsx
│   │       │   └── ...
│   │       ├── hooks/
│   │       │   └── controllers/
│   │       │       └── useRegistrationSubmission.ts  # Registration state machine
│   │       ├── utils/
│   │       │   ├── orphanDetection.ts         # Check if user has company data
│   │       │   ├── cleanupInitiation.ts
│   │       │   ├── cleanupOrphanedUser.ts
│   │       │   └── ...
│   │       └── errors/
│   │           └── ...
│   ├── shared/
│   │   └── types/
│   │       └── database.ts                    # Type definitions (UserProfile, ClientRecord, etc.)
│   └── test/
│       └── utils/
│           └── supabaseTestHelpers.ts         # Test utilities for user/company creation
├── supabase/
│   ├── functions/                             # Edge Functions (Deno)
│   │   ├── register-organization/             # Main registration flow
│   │   │   └── index.ts
│   │   ├── check-email-status/
│   │   │   └── index.ts
│   │   ├── cleanup-orphaned-user/
│   │   │   └── index.ts
│   │   ├── address-autocomplete/
│   │   │   └── index.ts
│   │   └── _shared/
│   │       └── verificationCode.ts
│   ├── migrations/                            # SQL migrations
│   │   ├── 20251027000001_create_auth_cleanup_log.sql
│   │   ├── 20251027000002_create_cleanup_log_retention_policy.sql
│   │   ├── 20251027210000_create_verification_codes.sql
│   │   ├── 20251027210100_create_rate_limits.sql
│   │   ├── 20251027210200_create_rate_limit_function.sql
│   │   └── 20251027210300_create_advisory_lock_helpers.sql
│   ├── sql/
│   │   └── register_organization_schema.sql   # Company & company_admins schema
│   └── config.toml
├── .env.example                               # Environment variable template
├── .env.local                                 # (gitignored) local config
└── README.md
```

---

## Entry Points

### 1. **Supabase Client Initialization**
- **File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/config/supabaseClient.ts`
- **Lines**: 1-31
- **Purpose**: Creates and exports a singleton Supabase client with authentication configuration
- **Key Details**:
  - Uses `@supabase/supabase-js` v2.57.4
  - Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` environment variables
  - Configured with session persistence, auto-refresh, and URL detection
  - Storage key: `"weg-translator-auth"`

### 2. **Authentication Provider**
- **File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/app/providers/auth/AuthProvider.tsx`
- **Lines**: 62-394
- **Purpose**: React Context provider managing auth state, login, logout, and user profile syncing
- **Key Methods**:
  - `bootstrap()` (line 73): Loads initial auth session on mount
  - `login()` (line 107): Authenticates user and checks orphan status
  - `logout()` (line 292): Signs out user
  - `ensureDomainUserProfile()` (line 317): Syncs user profile to local database

### 3. **Registration Submission Hook**
- **File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/auth/hooks/controllers/useRegistrationSubmission.ts`
- **Lines**: 280-720
- **Purpose**: Manages the entire registration workflow including email verification and company persistence
- **Key Methods**:
  - `submit()` (line 615): Initiates user sign-up with Supabase Auth
  - `runVerificationCheck()` (line 422): Polls for email verification status
  - `persistRegistration()` (line 337): Calls Edge Function to create company & admin records

### 4. **Orphan Detection**
- **File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/auth/utils/orphanDetection.ts`
- **Purpose**: Checks if authenticated user has associated company data
- **Called by**: AuthProvider login flow (line 139)

---

## Codebase Structure Relevant to the Feature/Request

### A. Database Topology

The application uses a **dual-database** strategy:

1. **Supabase PostgreSQL** (Cloud)
   - Handles authentication (auth.users)
   - Stores company data (companies table)
   - Stores company admin relationships (company_admins table)
   - Manages verification codes and rate limits
   - Runs Edge Functions for complex operations

2. **Local SQLite** (Tauri managed)
   - Stores user profiles (local user records synced from Supabase)
   - Stores projects and translation artifacts
   - Manages local file references and conversion jobs
   - Never connected directly to Supabase

### B. Current Supabase Schema

**File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/supabase/sql/register_organization_schema.sql`

#### `companies` Table (lines 9-31)
```sql
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_uuid uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  tax_id text NOT NULL,
  tax_country_code text CHECK (char_length(tax_country_code) = 2),
  address_freeform text NOT NULL,
  address_line1 text,
  address_line2 text,
  address_city text,
  address_state text,
  address_postal_code text,
  address_country_code text CHECK (char_length(address_country_code) = 2),
  account_type text,
  subscription_plan text,
  email_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  account_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Key Observations**:
- `id` is UUID primary key (matches requirement)
- `owner_admin_uuid` links to Supabase auth.users
- Address stored as separate columns (not JSONB)
- No `logo_url` field yet (will need to be added)
- Unique index on `owner_admin_uuid` ensures 1-to-1 with primary admin

#### `company_admins` Table (lines 37-47)
```sql
CREATE TABLE IF NOT EXISTS public.company_admins (
  admin_uuid uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  admin_email text NOT NULL,
  phone text,
  email_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  account_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Key Observations**:
- Acts as junction table between auth.users and companies
- Stores denormalized admin_email for queries
- Cascade delete on both foreign keys
- One admin can be in multiple companies (admin_uuid not globally unique)
- No explicit `role` field (differs from schema spec which requires role enum)

#### RLS Policies (lines 74-109)
- `company_admins_manage_own_company`: Users access only their linked companies
- `company_admins_manage_self`: Users can view/update their own admin record
- Authenticated users only

#### Indexes (lines 54-70)
- `companies_owner_unique`: One company per owner
- `companies_email_unique`: Email uniqueness (case-insensitive)
- `companies_tax_id_country_unique`: Tax ID uniqueness per country
- `company_admins_email_unique`: Email uniqueness per admin
- `company_admins_company_idx`: Lookup admins by company

### C. Edge Functions (Deno-based)

#### `register-organization`
**File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/supabase/functions/register-organization/index.ts`

**Purpose**: Atomically creates company and admin records within a transaction after email verification.

**Input Schema** (lines 25-43):
```typescript
{
  attemptId: string (optional UUID),
  company: {
    name: string,
    email: string (valid email),
    phone: string,
    taxId: string,
    taxCountryCode?: string (ISO 3166-1 alpha-2),
    address: {
      freeform: string,
      line1?: string,
      line2?: string,
      city?: string,
      state?: string,
      postalCode?: string,
      countryCode?: string (ISO 3166-1 alpha-2)
    }
  }
}
```

**Flow**:
1. Validates authorization token (line 61-87)
2. Verifies email is confirmed (line 77)
3. Validates email matches company email (line 201-212)
4. Creates transaction with postgres (line 220)
5. Inserts company record (line 221-250)
6. Inserts company_admin record (line 251+)
7. Returns company ID and admin UUID (line 47)

**Error Handling** (lines 107-165):
- 23505 (duplicate key): Returns 409 Conflict
- 23503/23514 (FK violation): Returns 422 Unprocessable Entity
- 40001/40P01 (deadlock): Returns 503 Service Unavailable
- Other: Returns 500 Internal Server Error

#### `check-email-status`
**File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/supabase/functions/check-email-status/index.ts`

**Purpose**: Verifies if user's email is confirmed (used during registration polling).

#### `cleanup-orphaned-user`
**File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/supabase/functions/cleanup-orphaned-user/index.ts`

**Purpose**: Initiates cleanup flow when user attempts to login with incomplete registration.

#### `address-autocomplete`
**File**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/supabase/functions/address-autocomplete/index.ts`

**Purpose**: Provides address suggestions using Google Maps API during registration.

---

## Codebase Analysis

### 1. Supabase Client Configuration

**Location**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/config/supabaseClient.ts`

```typescript
// Client initialization (lines 21-28)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,                    // Stores session in localStorage
    autoRefreshToken: true,                  // Auto-refreshes expired tokens
    detectSessionInUrl: true,                // Detects session from URL params
    storageKey: "weg-translator-auth",
  },
});
```

**Configuration Details**:
- Uses **anonymous key** (public, safe for frontend)
- Session persisted in browser storage
- Auto-refresh enabled for seamless UX
- Storage key namespaced to avoid conflicts

**Limitations**:
- No server-side Supabase client (for backend operations)
- All operations use authenticated user context
- Edge Functions use service role key (server-side only)

### 2. Authentication Flow

**Overall Architecture**:

```
[User]
  ↓
[LoginForm.tsx] → input email/password
  ↓
[AuthProvider.login()] → supabase.auth.signInWithPassword()
  ↓
[Verify Email Confirmed] → check email_confirmed_at
  ↓
[checkIfOrphaned()] → query companies & company_admins tables
  ↓
[If Orphaned] → throw OrphanedUserError → redirect to recovery
[If Normal] → setSession() → proceed to dashboard
```

**Key Code** (AuthProvider.tsx, lines 107-290):

```typescript
const login = async (email: string, password: string) => {
  // 1. Guard against concurrent login attempts (line 109-114)
  if (loginInProgress.current) return;
  loginInProgress.current = true;

  try {
    // 2. Sign in with Supabase (line 118-125)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // 3. Verify email is confirmed (line 128-135)
    const verified = Boolean(supabaseUser?.email_confirmed_at);
    if (!verified) {
      await supabase.auth.signOut();
      throw new Error("Please verify your email...");
    }

    // 4. Check orphan status (line 137-206)
    const orphanCheck = await checkIfOrphaned(supabaseUser.id);
    if (orphanCheck.isOrphaned) {
      throw new OrphanedUserError(email, correlationId);
    }

    // 5. Set authenticated state (line 209)
    setSession(data.session);
    setUser(mapUser(supabaseUser));
  } finally {
    loginInProgress.current = false;
  }
};
```

**User Mapping** (lines 43-60):
- Extracts minimal user data from Supabase
- Maps `full_name` from user_metadata
- Derives email from primary email field
- Checks `email_confirmed_at` for verification status

### 3. Registration Flow

**Overall Architecture**:

```
[RegistrationForm.tsx]
  ↓
[useRegistrationSubmission.ts]
  ├→ Step 1: supabase.auth.signUp() [lines 626-647]
  │   (Email verification link sent)
  │
  ├→ Step 2: Poll verification [scheduleVerificationPoll, line 314-335]
  │   (Check every 5-60 seconds if email confirmed)
  │
  ├→ Step 3: Once confirmed, call register-organization Edge Function [line 364]
  │   (Creates companies + company_admins in transaction)
  │
  └→ Step 4: Emit success event & redirect
```

**Key State Machine** (useRegistrationSubmission.ts):

```typescript
type SubmissionPhase =
  | "idle"              // Initial state
  | "signingUp"         // Calling supabase.auth.signUp()
  | "awaitingVerification"  // Waiting for email confirmation
  | "verifying"         // Checking if email confirmed
  | "persisting"        // Calling Edge Function
  | "succeeded"         // Registration complete
  | "failed"            // Error occurred
```

**Detailed Flow** (lines 615-681):

```typescript
const submit = async (payload: NormalizedRegistrationPayload) => {
  // 1. Sign up with Supabase Auth (line 626)
  const { data, error } = await supabase.auth.signUp({
    email: payload.admin.email,
    password: payload.admin.password,
    options: {
      data: {  // Store company metadata
        company_name: payload.company.name,
        company_phone: payload.company.phone,
        tax_id: payload.company.taxId,
      },
    },
  });

  // 2. Schedule verification polling (line 647)
  dispatch({ type: "await-verification", adminUuid: data.user?.id });
  scheduleVerificationPoll();
};
```

**Verification Check Loop** (lines 422-598):

```typescript
const runVerificationCheck = useCallback(
  async (manual: boolean) => {
    // Get session or try password login if no session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (!sessionUser) {
      // Try password sign-in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: payload.admin.email,
        password: payload.admin.password,
      });
    }

    // Check if email confirmed (line 510)
    const emailConfirmed = Boolean(supabaseUser.email_confirmed_at);

    if (!emailConfirmed) {
      // Reschedule polling
      scheduleVerificationPoll();
      return;
    }

    // Email confirmed - persist registration (line 532)
    const persistence = await persistRegistration(
      payload,
      currentState.attemptId,
      supabaseUser.id,
    );
  },
  [...]
);
```

**Persistence** (lines 337-420):

```typescript
const persistRegistration = useCallback(
  async (
    payload: NormalizedRegistrationPayload,
    attemptId: string | null,
    adminUuid: string,
  ): Promise<PersistenceResult> => {
    // Call register-organization Edge Function (line 364)
    const { data, error } = await supabase.functions.invoke(
      "register-organization",
      {
        body: {
          attemptId,
          company: {
            name: payload.company.name,
            email: payload.company.email,
            phone: payload.company.phone,
            taxId: payload.company.taxId,
            taxCountryCode: payload.company.taxCountryCode,
            address: { ... },
          },
        },
        headers: attemptId ? { "x-correlation-id": attemptId } : undefined,
      }
    );

    // Parse response and extract companyId (line 377-408)
    const resultCompanyId = parsed?.data?.companyId;
    return {
      kind: "success",
      companyId: resultCompanyId,
      adminUuid: parsed?.data?.adminUuid ?? adminUuid,
    };
  },
  []
);
```

### 4. Type Definitions

**Location**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/shared/types/database.ts`

**Current Types** (not specific to companies yet):

```typescript
// User Profile (lines 16-24)
export interface UserProfile {
  userUuid: Uuid;          // UUID from auth.users
  username: string;
  email: string;
  phone?: Nullable<string>;
  address?: Nullable<string>;
  roles: string[];         // Local roles
  permissionOverrides: PermissionOverride[];
}

// Client record (similar to company concept) (lines 48-56)
export interface ClientRecord {
  clientUuid: Uuid;
  name: string;
  email?: Nullable<string>;
  phone?: Nullable<string>;
  address?: Nullable<string>;  // Single string field
  vatNumber?: Nullable<string>;
  note?: Nullable<string>;
}
```

**Observations**:
- Address stored as single string (different from requirements)
- No company-specific types yet
- ClientRecord exists but not used for Supabase companies
- Types are backend-oriented (IPC layer), not frontend models

### 5. Test Utilities

**Location**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/test/utils/supabaseTestHelpers.ts`

**Key Functions**:

1. **createTestSupabaseClient()** (lines 19-39)
   - Creates admin client with service role key
   - Uses test environment variables

2. **createOrphanedUser()** (lines 93-148)
   - Creates user in auth.users
   - Intentionally does NOT create company/admin records
   - Simulates incomplete registration

3. **createTestCompanyForUser()** (lines 247-281)
   - Creates company record
   - Creates company_admin entry
   - Converts orphaned user to complete user

4. **cleanupTestUser()** (lines 162-206)
   - Deletes from companies, company_admins, verification_codes
   - Removes user from auth.users

5. **isUserOrphaned()** (lines 289-300)
   - Checks if user has no company/admin data

---

## Query Patterns and Error Handling

### A. IPC Command Pattern

**Location**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/ipc/db/users.ts`

```typescript
// Example: Create user profile (local SQLite, not Supabase)
export async function createUserProfile(
  input: CreateUserInput
): Promise<UserProfile> {
  const payload = mapCreateUserInput(input);
  const dto = await safeInvoke<UserProfileDto>(
    "create_user_profile_v2",  // Tauri command name
    { payload }
  );
  return mapUserProfileDto(dto);
}

// Mapping layers:
// CreateUserInput (frontend)
//   → mapCreateUserInput()
//   → IPC command via safeInvoke()
//   → Rust backend handles
//   → Returns UserProfileDto
//   → mapUserProfileDto()
//   → UserProfile (frontend)
```

**Error Handling Pattern** (via safeInvoke):
- All Tauri IPC errors wrapped in consistent IpcError type
- Frontend displays user-friendly error messages from error.message property
- Logging via logger service (JSON formatted)

### B. Supabase Query Pattern

**Location**: AuthProvider.tsx, useRegistrationSubmission.ts

```typescript
// Pattern 1: Direct Supabase client calls (Frontend)
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error) {
  throw error;  // Throw and handle in catch block
}

// Pattern 2: Edge Function invocation
const { data, error } = await supabase.functions.invoke("register-organization", {
  body: { ... },
  headers: { "x-correlation-id": attemptId }
});

if (error) {
  return { kind: "error", error: mapFunctionInvokeError(error) };
}

// Pattern 3: RLS-protected table access (not yet used in frontend)
// This would work in Edge Functions or authenticated clients
const { data, error } = await supabase
  .from('companies')
  .select('*')
  .eq('owner_admin_uuid', auth.uid());
```

### C. Orphan Detection

**Location**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/auth/utils/orphanDetection.ts`

**Pattern**:
```typescript
export async function checkIfOrphaned(
  userId: string
): Promise<{
  isOrphaned: boolean;
  classification: string;
  metrics?: { totalDurationMs: number; ... };
}> {
  // Queries Supabase for company data
  // Returns classification: "Case 1.1", "Case 1.2", etc.
  // Includes performance metrics for monitoring
}
```

---

## Storage Integration

### Current Status
- **No Supabase Storage usage yet** in the codebase
- Logo and avatar URLs will reference Storage buckets per schema requirements
- Storage buckets would need to be created and configured with:
  - RLS policies restricting access to company members
  - Public URL generation for logo/avatar retrieval
  - MIME type restrictions

### Pattern (from registration form metadata):
```typescript
// RegistrationCompanyStep.tsx suggests logo_url field will be added
// Future pattern:
const logoUrl = await supabase.storage
  .from('company-logos')
  .upload(`${companyId}/logo.png`, file);

// Access:
const { data } = supabase.storage
  .from('company-logos')
  .getPublicUrl(`${companyId}/logo.png`);
```

---

## Key Findings and Observations

### 1. Current Architecture Strengths

**Separation of Concerns**:
- Supabase handles auth and company tenancy
- Local SQLite handles project/translation data
- Edge Functions handle complex server-side logic

**Transaction Safety**:
- register-organization Edge Function uses SQL transaction
- Ensures atomic company + admin creation or rollback

**Security**:
- RLS policies on companies and company_admins tables
- Users can only access their own data
- Anonymous key used frontend (no secrets exposed)
- Service role key only in Edge Functions and test utilities

**Error Handling**:
- Postgres error codes mapped to HTTP status codes (409, 422, 503)
- Detailed error messages for debugging
- Correlation IDs for tracing requests

### 2. Gaps vs. New Schema Requirements

**Missing Fields**:
- `profiles` table doesn't exist (only companies & company_admins)
  - Requirement: Extend auth.users with full_name, avatar_url
  - Current: Profile data stored in local SQLite only

- `company_members` table doesn't exist (only company_admins)
  - Requirement: Support multiple roles (owner, admin, member, guest)
  - Current: company_admins is 1-to-1 admin table

- `logo_url` field missing from companies
  - Requirement: Reference Supabase Storage
  - Current: Not planned

- `address` as JSONB not implemented
  - Current: Separate columns (address_line1, address_city, etc.)
  - Requirement: Flexible JSONB format OR separate columns (decision needed)

**Missing Triggers**:
- No auto-creation of profile on auth.users signup
  - Currently: Auth user created → registration polling → manual profile creation
  - Requirement: Database trigger to create profile automatically

**Missing RLS Policies**:
- No policies on `profiles` table
- No policies on `company_members` table
- Current RLS only covers companies and company_admins

### 3. Integration Patterns Observations

**Type Generation**:
- Types are **manually maintained** (not generated from schema)
- Database.ts (lines 16-76) mirrors schema but is maintained separately
- Risk: Types can drift from actual database schema

**Error Classification**:
- Clear mapping of Postgres error codes to domain errors
- Correlation IDs for distributed tracing
- Performance metrics in logging (helpful for monitoring)

**Testing Strategy**:
- Test helpers create orphaned users and full users
- Cleanup utilities prevent test data leakage
- Service role key used only in tests and Edge Functions

### 4. Configuration Management

**Environment Variables** (`.env.example`):
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Additionally needed for tests**:
- `VITE_SUPABASE_SERVICE_ROLE_KEY` (not in example, but used in test helpers)

**Missing in .env.example**:
- No mention of Edge Function URLs or configuration
- No database URL for backend operations (if added later)

### 5. Edge Function Architecture

**Deno-based** (not Node.js):
- Uses Deno standard library and npm packages
- Imports from esm.sh for npm compatibility
- Type safety with Zod validation

**Authentication**:
- Verifies JWT token from Authorization header
- Uses Supabase admin client (service role key)
- Falls back to connection errors if env vars missing

**Database Access**:
- Uses postgresjs library for direct connection
- Runs within transaction for atomicity
- Connection pooling with 10s idle timeout

---

## Clarifications Needed

### 1. **Profile Auto-Creation**
   - Should profiles table be auto-created from auth.users via trigger?
   - Or created manually during registration via Edge Function?
   - Or synced from auth.users metadata in real-time?

### 2. **Address Storage Format**
   - User input spec shows JSONB OR separate columns
   - Current implementation uses separate columns
   - Recommendation: Continue with separate columns (easier to query)
   - But allow JSONB for flexible additional fields?

### 3. **Company Member Roles**
   - Current company_admins is 1-to-1 (one admin per company)
   - New spec requires company_members with multiple roles
   - Should company_admins table be:
     - Deprecated and replaced with company_members?
     - Kept as a view over company_members with role='admin'?
     - Deprecated but kept for backward compatibility?

### 4. **Storage Bucket Configuration**
   - No Supabase Storage implementation yet
   - Buckets needed:
     - `company-logos` for logo_url
     - `user-avatars` for avatar_url
   - RLS policies required?
   - Public or private URLs?

### 5. **Migration Path for Existing Data**
   - Current companies table uses `owner_admin_uuid` reference
   - New schema requires `profiles` table
   - Migration strategy:
     - Create profiles from auth.users automatically?
     - Create profiles from companies.owner_admin_uuid?
     - Manual migration script?

### 6. **Type Generation Strategy**
   - Currently manual type maintenance (risk of drift)
   - Should we implement:
     - Supabase CLI type generation (`supabase gen types`)?
     - Runtime validation with Zod?
     - Both?

---

## Recommendations

### Short-term (For New Schema)

1. **Create `profiles` table** with auto-creation trigger on auth.users
2. **Extend `company_members` table** to replace company_admins
3. **Add `logo_url` field** to companies table
4. **Create storage buckets** for logos and avatars with RLS policies
5. **Update type definitions** in database.ts to include Company, CompanyMember, Profile types

### Medium-term (For Robustness)

1. **Implement Supabase CLI type generation** to auto-generate types
2. **Add audit logging** for all company/member changes
3. **Implement soft deletes** for compliance and recovery
4. **Create view functions** for common queries (e.g., user's companies)

### Long-term (For Scale)

1. **Consider Event Sourcing** for company/member operations
2. **Implement webhook handlers** for auth events
3. **Add multi-tenancy middleware** to Edge Functions
4. **Implement real-time subscriptions** for company changes (optional)

---

## Conclusion

The Supabase integration is well-structured with clear separation between authentication, company management, and local data. The registration flow is robust with email verification, orphan detection, and transaction safety. However, the new schema requirements introduce new tables (profiles, company_members) and fields (logo_url, avatar_url) that will require careful migration and RLS policy updates. Type definitions should be automated to prevent drift from the database schema.
