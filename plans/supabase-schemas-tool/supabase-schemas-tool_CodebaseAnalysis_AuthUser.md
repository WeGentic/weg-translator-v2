# Codebase Analysis: Authentication and User Management Implementation

**Project**: supabase-schemas-tool
**Analysis Date**: 2025-10-29
**Scope**: Comprehensive authentication and user management system architecture

---

## Authentication and User Management Overview

The supabase-schemas-tool project implements a sophisticated multi-layer authentication and user management system that integrates Supabase Auth with a local SQLite database and Supabase PostgreSQL cloud database. The system handles user registration, email verification, orphaned user detection, company memberships, and role-based permissions.

### Key Components
- **Supabase Auth**: Cloud-hosted user authentication (`auth.users` table)
- **SQLite Local Database**: Local user profiles and role/permission data (for Tauri desktop app)
- **Supabase PostgreSQL**: Cloud database for company data, user profiles, and membership tracking
- **Frontend React**: Auth context, login/registration flows, orphan detection
- **Rust Backend**: IPC commands for user CRUD operations

---

## File Tree Structure

```
src/
├── app/
│   └── providers/
│       └── auth/
│           └── AuthProvider.tsx                    # Main auth context provider
├── core/
│   ├── config/
│   │   └── supabaseClient.ts                       # Supabase client initialization
│   └── ipc/
│       └── db/
│           └── users.ts                            # Frontend IPC adapters for user operations
├── modules/
│   └── auth/
│       ├── errors/
│       │   ├── OrphanedUserError.ts               # Error for detected orphaned users
│       │   └── OrphanDetectionError.ts            # Error for failed orphan detection
│       ├── utils/
│       │   ├── orphanDetection.ts                 # Orphan detection logic with fail-closed policy
│       │   ├── cleanupInitiation.ts               # Initiate cleanup flow
│       │   ├── cleanupOrphanedUser.ts             # Perform user cleanup
│       │   └── constants/
│       │       └── registration.ts                # Registration constants
│       ├── hooks/
│       │   ├── useAuth.ts                         # Auth hook export
│       │   └── controllers/
│       │       ├── useRegistrationForm.ts         # Registration form logic
│       │       ├── useRegistrationSubmission.ts   # Registration submission handler
│       │       ├── useUserAccountDialog.ts        # User account dialog controller
│       │       └── useEmailStatusProbe.ts         # Email status checking
│       └── routes/
│           └── (auth-related routes)
├── router/
│   └── routes/
│       ├── login.tsx                              # Login route
│       └── register.tsx                           # Registration route
└── shared/
    └── types/
        └── database.ts                            # Shared TypeScript types

src-tauri/
├── src/
│   ├── ipc/
│   │   ├── dto.rs                                 # IPC data transfer objects
│   │   ├── commands/
│   │   │   └── users_v2.rs                        # User management IPC commands
│   │   └── error.rs                               # IPC error handling
│   └── db/
│       ├── operations/
│       │   └── users.rs                           # User database operations
│       ├── types/
│       │   ├── schema.rs                          # Database type definitions
│       │   └── mod.rs                             # Type module exports
│       └── manager.rs                             # Database manager
└── migrations/
    └── 0001_baseline_schema.up.sql                # SQLite schema migrations

supabase/
└── migrations/
    ├── 20251027000001_create_auth_cleanup_log.sql              # Auth cleanup audit log
    ├── 20251027000002_create_cleanup_log_retention_policy.sql  # Cleanup log retention
    ├── 20251027210000_create_verification_codes.sql            # Verification codes table
    ├── 20251027210100_create_rate_limits.sql                   # Rate limiting table
    ├── 20251027210200_create_rate_limit_function.sql           # Rate limit enforcement
    └── 20251027210300_create_advisory_lock_helpers.sql         # Advisory lock helpers
```

---

## Entry Points

### 1. Frontend Authentication Entry Points

- **`/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/app/providers/auth/AuthProvider.tsx`** (Lines 62-386)
  - Main auth context provider component
  - Manages Supabase session state and user authentication lifecycle
  - Handles login, logout, and email verification checks
  - Implements orphan detection during login (lines 138-255)
  - Auto-syncs local user profiles (lines 314-383)

- **`/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/router/routes/login.tsx`** (Lines 1-24)
  - TanStack Router entry point for login page
  - Redirects authenticated users away from login

- **`/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/router/routes/register.tsx`** (Lines 1-7)
  - TanStack Router entry point for registration page

- **`/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/config/supabaseClient.ts`** (Lines 1-31)
  - Supabase client initialization with environment variables
  - Configured with persistent session, auto-refresh, and custom storage key

### 2. Backend IPC Entry Points

- **`/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src-tauri/src/ipc/commands/users_v2.rs`** (Lines 11-52)
  - `create_user_profile_v2` command
  - `update_user_profile_v2` command
  - `delete_user_profile_v2` command
  - `get_user_profile_v2` command
  - `list_user_profiles_v2` command

### 3. Supabase PostgreSQL Entry Points

- **Verification Codes**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/supabase/migrations/20251027210000_create_verification_codes.sql`
- **Auth Cleanup Log**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/supabase/migrations/20251027000001_create_auth_cleanup_log.sql`

---

## Current Auth Flow

### 1. Session Initialization (AuthProvider Mount)

**File**: `src/app/providers/auth/AuthProvider.tsx` (Lines 70-105)

```typescript
useEffect(() => {
  let isMounted = true;

  async function bootstrap() {
    const { data, error } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(mapUser(data.session?.user ?? null));
  }

  void bootstrap();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, nextSession) => {
      setSession(nextSession);
      setUser(mapUser(nextSession?.user ?? null));
    }
  );

  return () => {
    isMounted = false;
    subscription.unsubscribe();
  };
}, []);
```

**Flow**:
1. On AuthProvider mount, retrieve current session from Supabase
2. Subscribe to `onAuthStateChange` events for real-time updates
3. Map Supabase user to internal User interface
4. Cleanup subscription on unmount

### 2. Login Flow

**File**: `src/app/providers/auth/AuthProvider.tsx` (Lines 107-290)

```typescript
const login = async (email: string, password: string) => {
  // Guard against concurrent login attempts
  if (loginInProgress.current) return;

  loginInProgress.current = true;
  setIsLoading(true);

  try {
    // Step 1: Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Step 2: Verify email is confirmed
    const supabaseUser = data.user ?? data.session?.user ?? null;
    const verified = Boolean(supabaseUser?.email_confirmed_at);
    if (!verified || !supabaseUser) {
      await supabase.auth.signOut();
      throw new Error("Please verify your email...");
    }

    // Step 3: Check if user is orphaned (has no company data)
    const orphanCheck = await checkIfOrphaned(supabaseUser.id);

    // Step 4: If orphaned, initiate cleanup flow
    if (orphanCheck.isOrphaned) {
      await supabase.auth.signOut();
      throw new OrphanedUserError(email, correlationId);
    }

    // Step 5: Login successful
    setSession(data.session);
    setUser(mapUser(supabaseUser));
  } catch (error) {
    // Handle OrphanedUserError separately
    if (error instanceof OrphanedUserError) {
      void initiateCleanupFlow(error.email, error.correlationId);
      // Redirect to recovery route
      throw new Error("REDIRECT_TO_RECOVERY");
    }
    throw error;
  } finally {
    setIsLoading(false);
    loginInProgress.current = false;
  }
};
```

**Key Steps**:
1. **Supabase sign-in**: `supabase.auth.signInWithPassword(email, password)`
2. **Email verification check**: Verify `email_confirmed_at` is set
3. **Orphan detection**: Query Supabase PostgreSQL for company data
4. **Fail-closed on detection error**: Block login if orphan check fails
5. **Recovery flow**: If orphaned, send verification code and redirect

### 3. Orphan Detection with Fail-Closed Policy

**File**: `src/modules/auth/utils/orphanDetection.ts` (Lines 106-150)

```typescript
export async function checkIfOrphaned(
  userId: string,
  options?: OrphanDetectionOptions
): Promise<OrphanCheckResult> {
  const maxRetries = options?.maxRetries ?? 3;
  const timeoutMs = options?.timeoutMs ?? 500;
  const correlationId = crypto.randomUUID();

  let lastError: Error | null = null;
  let hasCompanyData = null;
  let hasAdminData = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Parallel queries with timeout
      const [companyResult, adminResult] = await Promise.all([
        withTimeout(
          supabase
            .from('companies')
            .select('*')
            .eq('owner_admin_uuid', userId)
            .limit(1),
          timeoutMs
        ),
        withTimeout(
          supabase
            .from('company_admins')
            .select('*')
            .eq('admin_uuid', userId)
            .limit(1),
          timeoutMs
        ),
      ]);

      hasCompanyData = (companyResult?.data?.length ?? 0) > 0;
      hasAdminData = (adminResult?.data?.length ?? 0) > 0;

      // User is orphaned if no company or admin data
      const isOrphaned = !hasCompanyData && !hasAdminData;
      const classification = isOrphaned ? 'case_1_2' : null;

      return {
        isOrphaned,
        classification,
        metrics: { /* metrics */ },
        hasCompanyData,
        hasAdminData,
      };
    } catch (error) {
      lastError = error;
      // Exponential backoff: 0ms, 200ms, 500ms
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt - 1) * 100);
      }
    }
  }

  // Failed all retries - fail-closed (block login)
  throw new OrphanDetectionError(
    'Orphan detection failed after all retry attempts',
    correlationId,
    metrics
  );
}
```

**Fail-Closed Policy**:
- **3 retry attempts** with exponential backoff (0ms, 200ms, 500ms)
- **500ms timeout** per attempt
- **On success**: Return orphan status
- **On failure**: Throw `OrphanDetectionError` (blocks login for security)
- **Performance targets**: p95 <200ms, p99 <350ms

### 4. User Profile Synchronization

**File**: `src/app/providers/auth/AuthProvider.tsx` (Lines 314-383)

```typescript
useEffect(() => {
  async function ensureDomainUserProfile(currentUser: User | null) {
    if (!currentUser || !currentUser.emailVerified) return;

    try {
      // Check if local profile exists
      const existingProfile = await getUserProfile(identifier);

      if (!existingProfile) {
        // Create new profile if doesn't exist
        await createUserProfile({
          userUuid: identifier,
          username: preferredName,
          email: currentUser.email,
          roles: ["owner"],
        });
      } else {
        // Update if name/email changed
        if (needsNameUpdate || needsEmailUpdate) {
          await updateUserProfile({
            userUuid: identifier,
            username: preferredName,
            email: currentUser.email,
          });
        }
      }
    } catch (error) {
      void logger.error("Failed to sync local user profile", error, context);
    }
  }

  void ensureDomainUserProfile(user);

  return () => { disposed = true; };
}, [user]);
```

**Synchronization**:
- Automatically create local profile when user logs in
- Update profile if name or email changed in Supabase Auth
- Only sync for verified, authenticated users

---

## User Data Model

### Frontend Type Definition

**File**: `src/shared/types/database.ts` (Lines 9-44)

```typescript
// User interface in React components
interface User {
  id: string;                    // Supabase auth.users.id
  email: string;                 // Email from Supabase Auth
  name?: string;                 // Derived from user_metadata.full_name
  emailVerified: boolean;        // Based on email_confirmed_at
}

// User profile in database
export interface UserProfile {
  userUuid: Uuid;               // UUID matching auth.users.id
  username: string;             // User's display name
  email: string;                // Email address
  phone?: Nullable<string>;      // Optional phone number
  address?: Nullable<string>;    // Optional address
  roles: string[];              // Array of role strings (e.g., ["owner"])
  permissionOverrides: PermissionOverride[];  // Permission overrides
}

// Permission override structure
export interface PermissionOverride {
  permission: string;           // Permission identifier
  isAllowed: boolean;          // Whether permission is allowed
}
```

### Rust Backend Type Definition

**File**: `src-tauri/src/db/types/schema.rs` (Lines 11-154)

```rust
// SQLite row representation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct UserRecord {
    pub user_uuid: Uuid,
    pub username: String,
    pub email: String,
    pub phone: Option<String>,
    pub address: Option<String>,
}

// User roles (many-to-many junction table)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct UserRoleRecord {
    pub user_uuid: Uuid,
    pub role: String,
}

// Permission overrides (many-to-many junction table)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, FromRow)]
pub struct UserPermissionOverrideRecord {
    pub user_uuid: Uuid,
    pub permission: String,
    pub is_allowed: bool,
}

// Aggregated view combining all user data
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserProfile {
    pub user: UserRecord,
    pub roles: Vec<UserRoleRecord>,
    pub permission_overrides: Vec<UserPermissionOverrideRecord>,
}
```

### SQLite Schema

**File**: `src-tauri/migrations/0001_baseline_schema.up.sql` (Lines 5-26)

```sql
CREATE TABLE IF NOT EXISTS users (
    user_uuid TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_uuid TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (user_uuid, role),
    FOREIGN KEY (user_uuid) REFERENCES users(user_uuid)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
    user_uuid TEXT NOT NULL,
    permission TEXT NOT NULL,
    is_allowed INTEGER NOT NULL DEFAULT 1 CHECK (is_allowed IN (0, 1)),
    PRIMARY KEY (user_uuid, permission),
    FOREIGN KEY (user_uuid) REFERENCES users(user_uuid)
        ON UPDATE CASCADE ON DELETE CASCADE
);
```

---

## Integration Points Affected by Profiles Table

### 1. Frontend User IPC Adapter Layer

**File**: `src/core/ipc/db/users.ts` (Lines 39-111)

```typescript
// CRUD operations exposed to React components
export async function createUserProfile(input: CreateUserInput): Promise<UserProfile>
export async function updateUserProfile(input: UpdateUserInput): Promise<UserProfile | null>
export async function deleteUserProfile(userUuid: string): Promise<void>
export async function getUserProfile(userUuid: string): Promise<UserProfile | null>
export async function listUserProfiles(): Promise<UserProfile[]>
```

**Integration Points**:
- Called by `AuthProvider.tsx` to sync user data
- Called by registration forms to create user profiles
- Called during login to verify user exists

### 2. Rust IPC Commands

**File**: `src-tauri/src/ipc/commands/users_v2.rs` (Lines 11-52)

Commands registered with Tauri:
- `create_user_profile_v2`: Creates user with roles and permissions
- `update_user_profile_v2`: Updates user data selectively
- `delete_user_profile_v2`: Deletes user and cascading data
- `get_user_profile_v2`: Retrieves user with all relationships
- `list_user_profiles_v2`: Lists all users

### 3. Database Operations Layer

**File**: `src-tauri/src/db/operations/users.rs` (Lines 12-141)

```rust
pub async fn create_user(pool: &SqlitePool, args: NewUserArgs) -> DbResult<UserProfile>
pub async fn update_user(pool: &SqlitePool, args: UpdateUserArgs) -> DbResult<Option<UserProfile>>
pub async fn delete_user(pool: &SqlitePool, user_uuid: Uuid) -> DbResult<()>
pub async fn get_user(pool: &SqlitePool, user_uuid: Uuid) -> DbResult<Option<UserProfile>>
pub async fn list_users(pool: &SqlitePool) -> DbResult<Vec<UserProfile>>
```

**Key Implementation Details**:
- Uses transactions for atomicity
- Separate operations for roles and permissions
- Handles many-to-many relationships

### 4. Authentication Context

**File**: `src/app/providers/auth/AuthProvider.tsx` (Lines 1-95)

**Integration Points**:
- Queries user profile during login
- Creates/updates profile on authentication
- Checks orphan status (missing company data)
- Provides `useAuth()` hook to all components

### 5. Supabase PostgreSQL Tables (Future)

According to user input requirements, three new Supabase PostgreSQL tables needed:

1. **companies**
   - `id` (UUID, primary key)
   - `name` (text)
   - `vat_id` (text, unique)
   - `email`, `phone`
   - `address` (JSONB)
   - `logo_url`, `created_at`, `updated_at`

2. **profiles** (extends auth.users)
   - `id` (UUID, FK → auth.users.id)
   - `full_name`, `avatar_url`
   - `created_at`, `updated_at`

3. **company_members** (junction table)
   - `id` (UUID, primary key)
   - `company_id` (UUID, FK)
   - `user_id` (UUID, FK → profiles.id)
   - `role` (text/enum)
   - `invited_by` (UUID, nullable)
   - `created_at`, `updated_at`
   - Unique constraint: (company_id, user_id)

### 6. Orphan Detection Queries

**Location**: `src/modules/auth/utils/orphanDetection.ts` (Lines 106-150)

**Current Implementation** (pre-profiles table):
```typescript
// Queries Supabase for company data
const companyResult = await supabase
  .from('companies')
  .select('*')
  .eq('owner_admin_uuid', userId);

const adminResult = await supabase
  .from('company_admins')
  .select('*')
  .eq('admin_uuid', userId);
```

**After Profiles Table Implementation** (will need update):
```typescript
// Will need to query profiles + company_members instead
const profileResult = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId);

const membershipResult = await supabase
  .from('company_members')
  .select('*')
  .eq('user_id', userId);
```

### 7. Verification Code Storage (Supabase PostgreSQL)

**File**: `supabase/migrations/20251027210000_create_verification_codes.sql`

```sql
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT NOT NULL,
  code_hash BYTEA NOT NULL,
  code_salt BYTEA NOT NULL,
  correlation_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT verification_codes_email_hash_unique UNIQUE (email_hash)
);
```

**Used for**: Two-step orphaned user recovery flow

---

## Codebase Architecture

### Layer 1: Authentication Layer (React Context)

**File**: `src/app/providers/auth/AuthProvider.tsx`

- Manages Supabase session state
- Provides `useAuth()` hook to all components
- Handles login/logout flows
- Implements orphan detection
- Syncs local user profiles

**Key Context Interface**:
```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  session: Session | null;
}
```

### Layer 2: IPC Adapter Layer (Frontend ↔ Backend Communication)

**Files**:
- `src/core/ipc/db/users.ts` (Frontend TypeScript)
- `src-tauri/src/ipc/commands/users_v2.rs` (Backend Rust)
- `src-tauri/src/ipc/dto.rs` (Data transfer objects)

**Flow**:
```
React Component
  ↓
useAuth() or direct invoke
  ↓
Frontend IPC Adapter (users.ts)
  ↓
Tauri invoke("create_user_profile_v2", payload)
  ↓
Rust IPC Command Handler (users_v2.rs)
  ↓
Database Operation (users.rs)
  ↓
SQLite Database
```

### Layer 3: Database Layer

**Frontends**:
- `src-tauri/src/db/operations/users.rs` - SQLite operations
- Future: Supabase PostgreSQL operations

**Type System**:
- `src-tauri/src/db/types/schema.rs` - Strong typing for database rows

### Layer 4: Supabase Services

**Current**:
- Supabase Auth (hosted authentication)

**Planned**:
- Supabase PostgreSQL (companies, profiles, company_members)
- Row-level security (RLS) policies
- Triggers for updated_at timestamps

---

## Error Handling Strategy

### 1. Orphaned User Detection

**Error Class**: `OrphanedUserError`
- **When thrown**: User exists in auth.users but has no company data (Case 1.2)
- **How handled**: Initiate cleanup flow, redirect to recovery route
- **User message**: "Your registration was incomplete. Check your email for verification code."

**File**: `src/modules/auth/errors/OrphanedUserError.ts` (Lines 33-120)

### 2. Orphan Detection Failure

**Error Class**: `OrphanDetectionError`
- **When thrown**: Orphan detection fails after 3 retry attempts
- **Security Policy**: Fail-closed (block login)
- **How handled**: Sign out user, display service unavailable message
- **User message**: "Authentication system temporarily unavailable. Please try again in a few minutes."

**File**: `src/modules/auth/errors/OrphanDetectionError.ts` (Lines 106-220)

### 3. IPC Error Handling

**File**: `src-tauri/src/ipc/error.rs`

IPC errors include:
- Validation errors (invalid UUIDs, missing fields)
- Database errors (query failures, constraint violations)
- JSON serialization errors

---

## Key Design Patterns

### 1. Context-Based State Management

```typescript
// AuthProvider provides state through React Context
const AuthContext = createContext<AuthContextType | null>(null);

// Components consume with hook
const auth = useAuth();
```

**Advantages**:
- Centralized auth state
- Automatic re-renders on auth changes
- Type-safe context API

### 2. IPC Command Pattern

```typescript
// Frontend calls typed command
const dto = await safeInvoke<UserProfileDto>(
  "create_user_profile_v2",
  { payload }
);

// Backend receives and processes
#[tauri::command]
pub async fn create_user_profile_v2(...) -> IpcResult<UserProfileDto>
```

**Advantages**:
- Type safety across IPC boundary
- Error handling uniformity
- Clear command contracts

### 3. Fail-Closed Security

```typescript
// Retry orphan detection with exponential backoff
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    // Query with timeout
    const result = await queryWithTimeout(timeoutMs);
    return result;
  } catch (error) {
    if (attempt === maxRetries) {
      // Block login on detection failure (security > availability)
      throw new OrphanDetectionError(...);
    }
    await sleep(exponentialBackoff(attempt));
  }
}
```

**Advantages**:
- Prevents unauthorized access
- Provides monitoring/alerting hooks
- Graceful degradation with user-friendly messages

### 4. Transaction-Based User Creation

```rust
pub async fn create_user(pool: &SqlitePool, args: NewUserArgs) -> DbResult<UserProfile> {
    let mut tx = pool.begin().await?;

    // Insert user record
    sqlx::query(...).execute(&mut *tx).await?;

    // Insert roles
    replace_roles(&mut tx, user_uuid, &roles).await?;

    // Insert permissions
    replace_permission_overrides(&mut tx, user_uuid, &overrides).await?;

    // Fetch complete profile
    let profile = fetch_user_profile(&mut tx, user_uuid).await?;

    // Atomic commit
    tx.commit().await?;

    Ok(profile)
}
```

**Advantages**:
- All-or-nothing atomicity
- Consistent data state
- Prevents partial user creation

---

## Supabase PostgreSQL Integration

### Current Status

**Supabase Auth Integration**:
- ✅ Supabase Auth client configured (`src/core/config/supabaseClient.ts`)
- ✅ Session persistence enabled
- ✅ Auto-refresh token enabled
- ✅ Custom storage key for Tauri environment

**Supabase PostgreSQL Queries**:
- ✅ `verification_codes` table (migration exists)
- ✅ `auth_cleanup_log` table (migration exists)
- ✅ Rate limiting tables and functions (migrations exist)
- ❌ `companies` table (needs implementation)
- ❌ `profiles` table (needs implementation)
- ❌ `company_members` table (needs implementation)
- ❌ RLS policies (needs implementation)

**Supabase Migrations**:
- `20251027000001_create_auth_cleanup_log.sql` - 152 lines
- `20251027000002_create_cleanup_log_retention_policy.sql` - ~50 lines
- `20251027210000_create_verification_codes.sql` - 150 lines
- `20251027210100_create_rate_limits.sql` - ~100 lines
- `20251027210200_create_rate_limit_function.sql` - ~200 lines
- `20251027210300_create_advisory_lock_helpers.sql` - ~300 lines

### Migration Concerns

#### 1. Trigger-Based Profile Creation

When users sign up via Supabase Auth, need trigger to auto-create profile:

```sql
-- Trigger on auth.users INSERT
CREATE TRIGGER create_profile_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_on_signup();

-- Function
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

#### 2. RLS Policy Scope

Orphan detection queries need to work with RLS policies:

```sql
-- Example: Users can see their own company data
CREATE POLICY "users_see_own_companies"
  ON companies
  FOR SELECT
  USING (owner_admin_uuid = auth.uid());

-- Orphan detection needs override or service role access
```

#### 3. Cascade Delete Behavior

Company member removal should handle:
- Soft deletes vs hard deletes
- Audit trail requirements
- Cascade effects on company data

---

## Performance Considerations

### 1. Orphan Detection Query Performance

**Targets**:
- p95: <200ms (single attempt)
- p99: <350ms (single attempt)
- Timeout: 500ms per attempt
- Total max: 2.2 seconds (3 attempts with backoff)

**Optimization**:
```sql
-- Indexes needed
CREATE INDEX idx_companies_owner_admin_uuid ON companies(owner_admin_uuid);
CREATE INDEX idx_company_admins_admin_uuid ON company_admins(admin_uuid);
```

**Parallel Queries**:
```typescript
const [companyResult, adminResult] = await Promise.all([
  supabase.from('companies').select(...),
  supabase.from('company_admins').select(...)
]);
```

### 2. User Profile Sync Performance

**Location**: AuthProvider (Lines 314-383)

**Optimization**:
- Only sync when user changes
- Skip if profile hasn't changed (name, email same)
- Use local cache to prevent redundant updates

### 3. Database Connection Pooling

**Rust Side**: SqlitePool manages connections automatically

**Considerations**:
- Local SQLite is single-file, less critical
- Supabase PostgreSQL pooling handled by Supabase

---

## Testing Strategy

### Unit Tests

**Frontend**:
- `src/test/modules/auth/hooks/useAuth.test.ts` - useAuth hook
- `src/test/modules/auth/hooks/useRegistrationForm.test.tsx` - Registration form
- `src/test/modules/auth/hooks/useRegistrationSubmission.test.ts` - Submission logic

**Backend**:
- Orphan detection tests
- User CRUD operation tests
- Transaction atomicity tests

### Integration Tests

- Login flow with orphan detection
- User creation and profile sync
- Email verification checks

### Security Tests

- Fail-closed policy enforcement
- RLS policy validation (when implemented)
- Permission override application

---

## Key Findings and Observations

### Strengths

1. **Well-Architected Layering**: Clear separation between frontend context, IPC adapters, and backend operations
2. **Type Safety**: Strong typing across React (TypeScript), Rust (serde), and database (sqlx)
3. **Fail-Closed Security**: Orphan detection with retry logic prioritizes security over availability
4. **Comprehensive Audit Trail**: Auth cleanup log with detailed metrics and correlation IDs
5. **Transaction-Based Operations**: Database operations use transactions for atomicity
6. **Performance Monitoring**: Detailed metrics collection for orphan detection operations

### Areas Requiring Implementation

1. **Supabase PostgreSQL Schema**: Companies, profiles, company_members tables not yet created
2. **RLS Policies**: Row-level security policies for company data access control
3. **Trigger for Profile Auto-Creation**: On auth.users insert, create corresponding profile
4. **Migration Path**: Update orphan detection queries to use new schema
5. **Schema Manipulation Removal**: User input specifies removal of any schema manipulation capabilities

### Technical Debt & Observations

1. **SQLite vs PostgreSQL Duality**:
   - Local SQLite stores user profiles (Tauri desktop app)
   - Supabase PostgreSQL stores company data
   - Potential sync challenges as schema grows

2. **Orphan Detection Query Assumptions**:
   - Currently queries `companies` and `company_admins`
   - Needs update to use `company_members` table
   - May need to handle soft-deleted companies

3. **Email Verification Coupling**:
   - Login blocked if email not verified
   - Orphan detection also requires email verification
   - Consider UX for partial registration states

4. **Permission Override System**:
   - Currently supports arbitrary permission strings
   - No validation of valid permission types
   - Consider enum-based permissions for type safety

### Migration Impact Analysis

#### High Impact

1. **Auth Flow Changes** - Login will need new orphan detection queries
2. **Frontend IPC Contracts** - May need to add company/member operations
3. **Database Schema** - New tables with dependencies on auth.users

#### Medium Impact

1. **Testing** - All auth flow tests need updating
2. **Documentation** - API documentation needs revision
3. **Error Messages** - May need adjustment for new scenarios

#### Low Impact

1. **UI Components** - Login/registration UI likely stable
2. **Configuration** - Supabase credentials already configured
3. **Build Process** - No changes needed

---

## Clarifications Needed

### 1. SQLite vs PostgreSQL Division

- Should SQLite continue storing user profiles for desktop app?
- Or migrate all user data to PostgreSQL with Supabase real-time sync?
- **Implication**: Affects sync strategy and offline capability

### 2. Company Creation Timing

- When should company creation be required?
  - During registration (current flow)?
  - After email verification?
  - In separate onboarding step?
- **Implication**: Affects orphan detection logic

### 3. RLS Policy Scope

- Who can invite members to company?
  - Owner only? Admins? Members?
- Who can change member roles?
- What happens to company if owner is removed?
- **Implication**: Affects policy implementation

### 4. Address Storage Format

- User input specifies address as JSONB or separate columns
- Decision impacts schema, queries, validation
- **Recommendation**: JSONB for flexibility, add GIN index if searching needed

### 5. Role Definition

- Should roles be fixed enum or dynamic strings?
- Valid role values? (owner, admin, member, viewer, etc.)
- **Recommendation**: PostgreSQL ENUM type for type safety

### 6. Email Verification After Profile Creation

- Current flow: Email verification required for login
- Should profile creation also require verification?
- **Implication**: Affects user data completeness

### 7. Soft Delete Support

- Should deleted profiles be archived or hard deleted?
- Compliance requirements (GDPR "right to be forgotten")?
- **Recommendation**: Implement soft deletes with retention policy

---

## Next Steps for Implementation

1. **Create PostgreSQL Schema**
   - companies table with constraints
   - profiles table with FK to auth.users
   - company_members junction table
   - Indexes for performance

2. **Implement RLS Policies**
   - User isolation policies
   - Admin access policies
   - Service role overrides

3. **Create Database Triggers**
   - Auto-create profile on auth.users insert
   - Update updated_at timestamps
   - Validate company member constraints

4. **Update Frontend IPC**
   - Add company CRUD operations
   - Add company_members CRUD operations
   - Update orphan detection queries

5. **Update Auth Flow**
   - Modify orphan detection for new schema
   - Add company creation to registration
   - Update email verification logic

6. **Remove Schema Manipulation**
   - Audit codebase for schema alteration capabilities
   - Remove any DDL operations from app
   - Document that schemas are developer-managed only

7. **Testing & Validation**
   - Integration tests for new flows
   - RLS policy testing
   - Performance validation against targets

---

**Document Version**: 1.0
**Last Updated**: 2025-10-29
**Status**: Complete - Initial Analysis

