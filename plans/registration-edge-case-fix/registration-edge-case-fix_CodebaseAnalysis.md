# Codebase Analysis for registration-edge-case-fix

## Feature Overview

The login flow and user notification system handles user authentication, error handling, redirect patterns, and user feedback mechanisms. This analysis covers how login credentials are validated, how errors are displayed to users, how email status is checked, and how the system handles orphaned users (users with verified email but no company data).

## Login Flow & User Notifications

### Entry Points

- **LoginForm Component**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/auth/components/LoginForm.tsx` (lines 49-291)
  - User-facing form for email/password input and submission
  - Handles local field validation and error display

- **Login Route**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/router/routes/login.tsx` (lines 5-24)
  - TanStack Router route definition with redirect guards
  - Redirects authenticated users away from login page
  - Preserves redirect query parameter for post-login navigation

- **AuthProvider.login()**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/app/providers/auth/AuthProvider.tsx` (lines 109-269)
  - Core authentication logic that calls Supabase
  - Handles orphan detection and error handling
  - Manages auth state and session persistence

- **useEmailStatusProbe Hook**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/auth/hooks/controllers/useEmailStatusProbe.ts` (lines 175-512)
  - Probes email registration status via check-email-status edge function
  - Used in registration flow to detect existing/orphaned accounts

- **EmailStatusBanner Component**: `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/auth/components/forms/EmailStatusBanner.tsx` (lines 16-257)
  - Displays email status results with contextual actions

### Codebase Structure relevant to the Feature/Request

```
src/modules/auth/
├── components/
│   ├── LoginForm.tsx                    # Login form UI and basic validation
│   ├── forms/
│   │   ├── EmailStatusBanner.tsx        # Email status display with actions
│   │   └── PasswordStrengthMeter.tsx    # Password validation display
│   └── ...other registration components
├── hooks/
│   ├── useAuth.ts                       # Export from AuthProvider
│   └── controllers/
│       ├── useEmailStatusProbe.ts       # Email status checking with Supabase edge function
│       ├── useRegistrationForm.ts
│       └── useRegistrationSubmission.ts
├── errors/
│   └── OrphanedUserError.ts            # Custom error for orphaned user detection
├── routes/
│   ├── index.tsx                        # LoginRoute component rendering
│   └── RecoveryRoute.tsx                # Recovery flow for orphaned users
├── utils/
│   ├── orphanDetection.ts              # Orphan detection logic with performance metrics
│   ├── cleanupInitiation.ts            # Fire-and-forget cleanup flow initiation
│   └── ...other utilities
└── index.ts                             # Module exports

src/app/providers/
├── auth/
│   └── AuthProvider.tsx                 # Core auth context, login logic, orphan handling
└── index.tsx                            # Provider composition

src/shared/ui/
├── toast.tsx                            # Toast notification system
└── ...other UI components

src/router/routes/
├── __root.tsx                           # Root route with auth guard
├── login.tsx                            # Login route with redirect logic
└── _app.tsx                             # Authenticated layout guard
```

### Codebase analysis

#### 1. Login Flow Execution Path

**Entry Point → AuthProvider.login() → Orphan Detection → Success/Error**

The login flow follows these steps:

1. **Form Submission** (LoginForm.tsx:78-124)
   - User enters email and password
   - Local validation checks for required fields (lines 65-76)
   - On submit, calls `login(email, password)` from AuthProvider (line 91)
   - Form state: `isLoading`, `fieldErrors`, `touched`, `error`

2. **Supabase Authentication** (AuthProvider.tsx:119-127)
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password,
   });

   if (error) {
     throw error;  // Supabase auth error (wrong password, no account, etc.)
   }
   ```
   - Errors thrown here propagate to LoginForm catch block (line 107)
   - User-friendly error message displayed via `setError()`

3. **Email Verification Check** (AuthProvider.tsx:130-137)
   ```typescript
   const verified = Boolean(supabaseUser?.email_confirmed_at);
   if (!verified || !supabaseUser) {
     await supabase.auth.signOut();  // Force signout for unverified users
     throw new Error("Please verify your email before signing in...");
   }
   ```
   - Blocks login if email is not verified
   - Clears session state to prevent authenticated access
   - Error message directs user to check email

4. **Orphan Detection** (AuthProvider.tsx:140-234)
   - Calls `checkIfOrphaned(supabaseUser.id)` (line 141)
   - Orphan detection checks companies and company_admins tables in parallel
   - If user is orphaned (verified email but no company data):
     - Signs out user (line 194)
     - Logs orphan detection with metrics (lines 199-205)
     - Throws `OrphanedUserError` (line 207)

5. **Error Handling in Login Handler** (AuthProvider.tsx:235-264)
   - Catches `OrphanedUserError` specifically
   - Initiates cleanup flow (fire-and-forget): calls `initiateCleanupFlow()` (line 239)
   - Shows toast notification (lines 242-247)
   - Throws redirect error with recovery URL (lines 257-260)
   ```typescript
   if (error instanceof OrphanedUserError) {
     void initiateCleanupFlow(error.email, error.correlationId);
     toast({
       title: "Registration Incomplete",
       description: "Your registration was incomplete. Check your email for a verification code...",
     });
     const redirectError = new Error("REDIRECT_TO_RECOVERY");
     redirectError.redirectUrl = error.redirectUrl;
     throw redirectError;
   }
   ```

6. **Form Redirect Handling** (LoginForm.tsx:108-117)
   - Catches redirect errors from orphan detection
   - Extracts redirect URL from error object
   - Navigates to recovery route: `/register/recover?email=...&reason=orphaned`
   ```typescript
   if (err instanceof Error && err.message === "REDIRECT_TO_RECOVERY") {
     const redirectUrl = (err as Error & { redirectUrl?: string }).redirectUrl;
     if (redirectUrl) {
       await router.navigate({ to: redirectUrl as any });
       return;
     }
   }
   ```

7. **Post-Login Redirect** (LoginForm.tsx:95-106)
   - On successful login, checks for redirect query parameter
   - Defaults to "/" if no redirect specified
   - Validates redirect is safe (starts with "/", not "/login")
   - Uses `router.history.push()` to navigate

#### 2. Error Handling & Display Patterns

**Error Types and Display Mechanisms**:

1. **Field-Level Validation Errors** (LoginForm.tsx:61-76, 159-166)
   - Type: Local validation (required fields)
   - Display: Red text below input field (lines 209-211, 250-252)
   - Triggered: On blur or after form submission
   - Structure: `role="alert"` with `id="login-email-error"`, `id="login-password-error"`

2. **Form-Level Validation Error** (LoginForm.tsx:78-88)
   - Message: "Please correct the highlighted fields before continuing."
   - Display: General form error message (rendered via `aria-describedby`)
   - Triggered: When submit attempted with empty fields

3. **Authentication Errors** (LoginForm.tsx:107-121)
   - Source: Supabase auth, AuthProvider
   - Examples: "Invalid credentials", "User not found"
   - Display: General error message in form (line 120)
   - Handling: `setError(err instanceof Error ? err.message : "Login failed...")`

4. **Orphaned User Error** (LoginForm.tsx:109-117)
   - Source: AuthProvider orphan detection
   - Flow: Orphan detected → toast + redirect
   - Error Object: `REDIRECT_TO_RECOVERY` error with `redirectUrl` property
   - Toast shown by AuthProvider (not form)
   - Form then redirects to recovery route

5. **Toast Notifications** (AuthProvider.tsx:242-247)
   - API: `const { toast } = useToast()` (line 70)
   - Called in error catch block for orphaned users
   - Options: `title`, `description`, `variant`, `duration`
   - Implementation: Toast system in `/src/shared/ui/toast.tsx`

#### 3. Email Status Banner & Probe Implementation

**Email Status Probe Flow** (useEmailStatusProbe.ts):

1. **Initialization** (lines 175-180)
   - Takes `email`, `attemptId`, `enabled`, `debounceMs` as options
   - Maintains reducer state: `phase`, `result`, `error`, `lastCheckedEmail`

2. **Email Validation & Normalization** (lines 391-400)
   - Normalizes email: lowercase, trim
   - Validates format using `validator.isEmail()`
   - Only proceeds if email is valid

3. **Debouncing & Caching** (lines 414-416, 216-227)
   - Debounces probe by default 450ms (line 75)
   - Caches results for 2 minutes (line 76)
   - Prevents redundant API calls for same email

4. **Edge Function Invocation** (lines 249-263)
   ```typescript
   const { data, error, response } = await supabase.functions.invoke(
     "check-email-status",
     {
       body: {
         email: normalizedEmail,
         attemptId: resolvedAttemptId ?? undefined,
       },
       headers: {
         "x-correlation-id": correlationId,
         Authorization: `Bearer ${accessToken}`,
       },
       signal: controller.signal,
     },
   );
   ```
   - Calls Supabase edge function with correlation ID
   - Includes access token in headers
   - Supports cancellation via AbortController

5. **Response Parsing & Error Handling** (lines 269-331)
   - Checks for Supabase function errors
   - Extracts retry-after header for rate limiting
   - Parses error response JSON
   - Shows destructive toast on error (lines 292-296)

6. **Result Structure** (lines 333-343)
   ```typescript
   const result: EmailProbeResult = {
     status: payload.status,  // "not_registered" | "registered_verified" | "registered_unverified"
     verifiedAt: payload.verifiedAt ?? null,
     lastSignInAt: payload.lastSignInAt ?? null,
     attemptId: payload.attemptId ?? resolvedAttemptId ?? undefined,
     correlationId: payload.correlationId ?? correlationId,
     checkedAt: now,
     hasCompanyData: payload.hasCompanyData ?? null,
     isOrphaned: payload.isOrphaned ?? null,
   };
   ```

7. **Resend Verification** (lines 446-497)
   - Only works for `registered_unverified` status
   - Calls `supabase.auth.resend()`
   - Shows success/error toast
   - Logs operation with email hash for privacy

**Email Status Banner Display** (EmailStatusBanner.tsx):

1. **Loading State** (lines 28-46)
   - Shows: "Checking email status…"
   - Icon: Loader
   - ARIA: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`

2. **Error State** (lines 49-82)
   - Shows error message with retry-after hint
   - Button: "Retry check" calls `probe.forceCheck()`
   - Variant: "warning"

3. **Success: Not Registered** (lines 89-108)
   - Message: "You're good to go."
   - Description: Email ready for registration
   - Variant: "success"
   - No actions shown

4. **Registered & Verified - Orphaned** (lines 113-139)
   - Condition: `status === "registered_verified" && result.isOrphaned === true`
   - Message: "Registration incomplete - email verified."
   - Actions: "Complete registration" or "Start fresh"
   - Variant: "warning"

5. **Registered & Verified - Not Orphaned** (lines 143-169)
   - Message: "This email already has access."
   - Actions: "Log in" or "Recover password"
   - Variant: "error"

6. **Registered Unverified - Orphaned** (lines 174-212)
   - Message: "Incomplete registration detected."
   - Description: Email verified but unverified
   - Actions: "Resend verification email" or "Resume verification"
   - Can show resend hint for rate limiting (lines 206-210)
   - Variant: "warning"

7. **Registered Unverified - Regular** (lines 216-253)
   - Message: "Finish verifying your email."
   - Actions: "Resend email" or "Resume verification"
   - Variant: "info"

#### 4. Redirect Patterns

**Login Route Redirect Guard** (login.tsx:5-24)
- Checks: `context.auth?.isAuthenticated`
- If authenticated: redirects to either `search?.redirect` or `/`
- Validates redirect is safe (lines 13-18)

**Root Route Auth Guard** (__root.tsx:23-44)
- Checks: `context.auth?.isAuthenticated` for non-public paths
- Public paths: `/login`, `/register`
- Unauthenticated users: redirect to `/login?redirect={originalPath}`
- Preserves query string and hash in redirect param (lines 31-33)

**Post-Login Redirect** (LoginForm.tsx:95-106)
- Extracts redirect from search params
- Validates: starts with "/", is not "/login"
- Falls back to "/"
- Uses `router.history.push()` not `router.navigate()`

**Orphan User Redirect** (LoginForm.tsx:109-117)
- Catches `REDIRECT_TO_RECOVERY` error
- Extracts `redirectUrl` from error object
- Navigates to recovery route via `router.navigate()`

#### 5. Orphan Detection Details

**Detection Function** (orphanDetection.ts:125-386)

1. **Parallel Query Execution** (lines 138-151)
   ```typescript
   const [companiesResult, adminsResult] = await Promise.race([
     Promise.all([
       supabase.from("companies").select("id").eq("owner_admin_uuid", userId).limit(1),
       supabase.from("company_admins").select("admin_uuid").eq("admin_uuid", userId).limit(1),
     ]),
     timeoutPromise,  // 500ms timeout
   ]);
   ```
   - Queries both companies and company_admins tables in parallel
   - Target: <100ms at p95
   - Timeout: 500ms (graceful degradation)

2. **Classification Logic** (lines 229-233)
   ```typescript
   const hasCompanyData = companiesResult.data !== null;
   const hasAdminData = adminsResult.data !== null;
   const isOrphaned = !hasCompanyData && !hasAdminData;
   ```
   - User is orphaned only if BOTH tables have no data

3. **Performance Metrics** (lines 238-246)
   - Tracks: totalDurationMs, queryDurationMs, correlationId, startedAt, completedAt
   - Flags: timedOut (>500ms), hadError
   - Logged with context in AuthProvider (lines 144-189)
   - P95 target: <200ms, warns if >500ms (lines 179-189)

4. **Error Handling** (lines 286-346)
   - Query error: returns `{isOrphaned: false}` (graceful degradation)
   - Timeout: returns `{isOrphaned: false, timedOut: true}`
   - Unexpected error: returns `{isOrphaned: false, metrics}` with error flag
   - All errors logged with correlation ID

#### 6. Toast Notification System

**Toast Provider & API** (toast.tsx:136-157)

1. **Provider Setup**
   - Renders `ToastProvider` in app provider stack (/src/app/providers/index.tsx:12)
   - Manages toasts in context

2. **useToast Hook** (lines 147-150)
   ```typescript
   const { toast } = useToast();
   toast({
     title: "Email status check failed",
     description: merged.message,
     variant: "destructive",
   });
   ```

3. **Toast Options**
   - `title`: Main message
   - `description`: Additional details
   - `variant`: "default" or "destructive"
   - `duration`: Auto-dismiss ms (default 6000, line 39)
   - `action`: Custom action button with `label` and `onClick`

4. **Toast Deduplication** (lines 70-96)
   - Creates signature from title, description, variant, action
   - Prevents duplicate toasts with same message
   - Caps displayed toasts at 5 (line 95)

5. **Toast Dismissal**
   - Auto-dismisses after duration (line 100-102)
   - Can manually dismiss via `dismiss(id)`

#### 7. Cleanup Initiation Flow

**Fire-and-Forget Pattern** (cleanupInitiation.ts:102-184)

1. **Payload Structure** (lines 117-121)
   ```typescript
   const payload: CleanupRequestPayload = {
     step: 'request-code',
     email: email.toLowerCase().trim(),
     correlationId,
   };
   ```

2. **Edge Function Call** (lines 130-137)
   - Invokes `cleanup-orphaned-user` edge function
   - Includes correlation ID in headers
   - Does not await full response (fire-and-forget)

3. **Error Handling** (lines 140-163)
   - Network error: logs but doesn't throw
   - Edge function error: logs but doesn't throw
   - Parse error: logs but doesn't throw
   - Success: logs completion

4. **Email Privacy** (lines 186-215)
   - Hashes email for logging (simple non-crypto hash)
   - Prevents plaintext email in logs
   - Complies with GDPR/privacy requirements

#### 8. OrphanedUserError Class

**Error Structure** (OrphanedUserError.ts:33-120)

Properties:
- `email`: User's email address
- `correlationId`: UUID for tracing
- `redirectUrl`: Pre-computed redirect URL with query params

```typescript
throw new OrphanedUserError(
  'user@example.com',
  crypto.randomUUID(),
  '/register/recover?email=user@example.com&reason=orphaned&correlationId=...',
);
```

Methods:
- `toJSON()`: Returns error as object for logging
- `toString()`: User-friendly string representation
- Properly extends Error with prototype chain preservation (line 86)

### 9. User State Tracking in AuthProvider

**Context Value** (AuthProvider.tsx:278-293)

```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;  // session exists && email verified
  isVerified: boolean;       // email_confirmed_at set
  orphanCheckFailed: boolean;  // Orphan detection query timed out/errored
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  session: Session | null;
}
```

**Login State Machine** (AuthProvider.tsx:109-269)

1. Initial state: `isLoading = true` (line 117)
2. After Supabase auth call: either sets session or throws error
3. After orphan check:
   - **Success**: Sets authenticated user + session
   - **Orphaned**: Throws redirect error
   - **Check Failed**: Sets user with `orphanCheckFailed = true`
4. Finally block: `isLoading = false`, `loginInProgress = false` (line 266-267)

Guard against duplicate login calls (lines 111-114):
```typescript
if (loginInProgress.current) {
  void logger.warn("Login already in progress - ignoring duplicate call", { email });
  return;
}
```

### 10. User Profile Synchronization

**Local Database Profile** (AuthProvider.tsx:298-364)

After successful login, ensures local user profile exists:
- Checks if profile exists via `getUserProfile()`
- Creates if missing via `createUserProfile()`
- Updates if name/email changed via `updateUserProfile()`
- Uses RLS-enabled Supabase client

### Key Observations & Architecture Insights

1. **Multi-Layer Error Handling**:
   - Form-level: Field validation errors
   - Auth-level: Supabase authentication errors
   - Business-logic: Orphan detection errors
   - Each layer has appropriate error display mechanism

2. **Graceful Degradation**:
   - Orphan detection has 500ms timeout
   - On timeout: allows login to proceed with flag set
   - On error: allows login to proceed (doesn't block critical flow)

3. **Correlation IDs for Tracing**:
   - Generated at orphan detection: `crypto.randomUUID()` (orphanDetection.ts:126)
   - Passed to cleanup flow (cleanupInitiation.ts:120)
   - Included in edge function headers (useEmailStatusProbe.ts:257)
   - Enables end-to-end request tracing

4. **Email Privacy**:
   - Email not logged in plaintext
   - Uses simple hash function (cleanupInitiation.ts:200-214)
   - SHA-256 in some places (useEmailStatusProbe.ts:168-173)

5. **Accessibility**:
   - Field errors: `role="alert"`
   - Email status banner: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`
   - Proper aria-describedby linking
   - aria-disabled attributes on buttons

6. **Performance Patterns**:
   - Debounced email probe (450ms default)
   - Cached probe results (2min TTL)
   - Orphan detection with parallel queries
   - Request deduplication in toast system

7. **State Management**:
   - Auth state in React Context
   - Session managed by Supabase SDK
   - Form state in local component state
   - No additional state library needed for auth

8. **Redirect Security**:
   - Validates redirect URL format (must start with "/")
   - Prevents "//", protocol-relative, and absolute URLs
   - Falls back to "/" if redirect unsafe
   - Query parameters preserved in redirect

### Files Essential for Understanding This Feature

1. **Core Auth Logic**:
   - `/src/app/providers/auth/AuthProvider.tsx` - Login, orphan detection, session management
   - `/src/modules/auth/components/LoginForm.tsx` - Form UI and submission handling

2. **Orphan Detection & Recovery**:
   - `/src/modules/auth/utils/orphanDetection.ts` - Core orphan detection with metrics
   - `/src/modules/auth/errors/OrphanedUserError.ts` - Error class with redirect URL
   - `/src/modules/auth/utils/cleanupInitiation.ts` - Fire-and-forget cleanup initiation

3. **Email Status & Registration Integration**:
   - `/src/modules/auth/hooks/controllers/useEmailStatusProbe.ts` - Email status checking
   - `/src/modules/auth/components/forms/EmailStatusBanner.tsx` - Email status display

4. **Routing & Navigation**:
   - `/src/router/routes/login.tsx` - Login route with auth guard
   - `/src/router/routes/__root.tsx` - Root auth guard
   - `/src/app/providers/index.tsx` - Provider stack order

5. **User Notifications**:
   - `/src/shared/ui/toast.tsx` - Toast notification system
   - `/src/shared/ui/alert.tsx` - Alert component used in toasts

6. **Type & Configuration**:
   - `/src/core/config/supabaseClient.ts` - Supabase client initialization
   - `/src/core/logging/index.ts` - Structured logging

---

## Edge Functions & Authentication Patterns

### Overview

This section provides comprehensive analysis of Supabase Edge Functions used in the registration flow, authentication patterns, and how Edge functions operate without requiring user authentication sessions.

### Edge Functions in the Codebase

#### 1. check-email-status Edge Function

**Location**: `/supabase/functions/check-email-status/index.ts` (609 lines)

**Purpose**: Unauthenticated email status probe that classifies user registration state without requiring auth session

**Key Characteristics**:
- **No Auth Required**: Uses Supabase service role key to query auth.users directly
- **Rate Limiting**: Multi-tier rate limiting with Deno KV
  - Global: 12 requests per 60 seconds
  - Per-IP: Sliding window tracking via KV atomic operations
- **Orphan Detection**: Queries `companies` table to detect orphaned users (Cases 1.1 and 1.2)
- **Graceful Degradation**: 100ms timeout on company data query; returns `isOrphaned: null` on failure

**Core Functions** (lines 106-277):
- `classifyEmail()`: Main classification logic
  - Queries `auth.admin.listUsers()` with substring filter (line 149-156)
  - Performs case-insensitive email exact match (line 179-182)
  - Checks company ownership with 100ms timeout (lines 203-218)
  - Determines orphan state matrix (lines 248-265)

**Response Schema** (lines 41-70):
```typescript
interface ClassificationResult {
  status: "not_registered" | "registered_verified" | "registered_unverified"
  verifiedAt: string | null
  lastSignInAt: string | null
  hasCompanyData: boolean | null
  isOrphaned: boolean | null
}
```

**Rate Limiting Implementation** (lines 519-586):
- Uses Deno KV atomic operations with CAS (check-and-set)
- Sliding window algorithm with timestamps
- Exponential backoff on conflict (max 5 attempts)

**Security Measures**:
- CORS headers explicitly configured (lines 6-12)
- Email/IP hashing for logging (SHA-256)
- Request correlation ID tracking
- Constant-time response pattern NOT implemented here (only in cleanup function)

**Tests**: `/supabase/functions/check-email-status/index.test.ts` (550 lines)
- Tests cover email classification, rate limiting, orphan detection
- Mock Supabase client and Deno KV implementations
- Tests handle graceful degradation on timeout/error

---

#### 2. cleanup-orphaned-user Edge Function

**Location**: `/supabase/functions/cleanup-orphaned-user/index.ts` (2468 lines)

**Purpose**: Two-step flow for securely deleting orphaned auth users with email verification

**Two-Step Flow**:

**Step 1: Request Verification Code** (lines 1895-2159)
1. Validate email exists in auth.users
2. Verify user is orphaned (no company data)
3. Generate 6-digit code
4. Store hash in Deno KV with 10-minute TTL
5. Send email via Resend/SendGrid
6. Log to `auth_cleanup_log` table

**Step 2: Validate and Cleanup** (lines 2164-2416)
1. Validate verification code (constant-time comparison)
2. Re-verify orphan state
3. Delete user via auth.admin.deleteUser()
4. Update cleanup log
5. Delete verification code from KV

**Request Schema** (lines 111-123):
```typescript
z.discriminatedUnion("step", [
  z.object({
    step: z.literal("request-code"),
    email: z.string().email(),
    correlationId: z.string().uuid().optional(),
  }),
  z.object({
    step: z.literal("validate-and-cleanup"),
    email: z.string().email(),
    verificationCode: z.string().length(6).regex(/^\d{6}$/),
    correlationId: z.string().uuid().optional(),
  }),
])
```

**Error Codes** (lines 37-83):
- `ORPHAN_CLEANUP_001`: Code expired
- `ORPHAN_CLEANUP_002`: Invalid code
- `ORPHAN_CLEANUP_003`: Rate limited
- `ORPHAN_CLEANUP_004`: User not found
- `ORPHAN_CLEANUP_005`: Not orphaned (has company data)
- `ORPHAN_CLEANUP_006`: DB transaction failed
- `ORPHAN_CLEANUP_007`: Invalid input
- `ORPHAN_CLEANUP_008`: Email delivery failed
- `ORPHAN_CLEANUP_009`: Operation in progress

**RateLimiter Class** (lines 319-616):
- Three-tier hierarchical rate limiting
  - Tier 1 (Global): 1000 req/60s
  - Tier 2 (IP): 5 req/60s
  - Tier 3 (Email): 3 req/60min
- Uses Deno KV sliding window with atomic operations
- Returns retry-after headers (RFC 7231)

**Verification Code Management** (lines 622-824):
- `generateSecureCode()`: Uses crypto.getRandomValues() for CSPRNG (line 628-636)
- `hashVerificationCode()`: SHA-256 with random salt (lines 646-666)
- `constantTimeEquals()`: Timing-attack resistant comparison (lines 674-685)
- `validateVerificationCode()`: Constant-time validation with 10-min expiry (lines 697-767)
- `storeVerificationCode()`: Deno KV storage with TTL (lines 779-824)

**Distributed Locking** (lines 858-950):
- `acquireCleanupLock()`: Atomic check-and-set for concurrent operation prevention (lines 858-907)
- Lock auto-expires after 30 seconds
- Used in both steps to prevent race conditions

**Orphan State Validation** (lines 993-1130):
- Parallel queries to `companies` and `company_admins` tables
- 500ms timeout with Promise.race()
- Classification logic (lines 1087-1092):
  - Case 1.1 (orphaned_unverified): unverified + no company data
  - Case 1.2 (orphaned_verified): verified + no company data
  - not_orphaned: has company data OR admin data

**Email Sending** (lines 1194-1585):
- Tries providers in order: Resend → SendGrid → error
- Retry logic with exponential backoff (3 attempts, 1s/2s delays)
- Both plain text and HTML templates
- Custom headers for correlation ID and attempt tracking

**User Deletion** (lines 1610-1761):
- Calls `supabase.auth.admin.deleteUser(userId)` (line 1675)
- Logs deletion to `auth_cleanup_log` with status tracking
- Maps Supabase errors to user-friendly messages
- Graceful degradation if log insert fails

**Constant-Time Response Pattern** (lines 1780-1802):
- Target: 500ms ±50ms jitter
- Prevents timing attacks on code validity, user existence
- Applied to all response paths

---

#### 3. register-organization Edge Function

**Location**: `/supabase/functions/register-organization/index.ts` (394 lines)

**Purpose**: Authenticated endpoint for completing registration by creating company data

**Authentication Pattern** (lines 61-87):
- Requires Bearer token in Authorization header
- Uses `supabase.auth.getUser(token)` to verify session
- Validates email confirmation (line 77-83)

**Key Features**:
- Validates token and email verification (lines 188-194)
- Matches company email to authenticated user email (lines 198-212)
- Uses PostgreSQL transactions via postgresjs (lines 220-286)
- Inserts to `companies` and `company_admins` tables atomically
- Handles unique constraint violations (error 23505) as 409 Conflict
- Handles referential integrity violations (errors 23503, 23514) as 422 Unprocessable Entity

**Error Handling Pattern** (lines 100-165):
- Maps PostgreSQL error codes to HTTP status and user-friendly messages
- 40001/40P01 (deadlock/serialization): Return 503 with retry message
- All errors include correlation ID for tracing

---

### How Edge Functions Are Called from Frontend

#### 1. check-email-status Invocation

**File**: `src/modules/auth/hooks/controllers/useEmailStatusProbe.ts` (512 lines)

**Hook**: `useEmailStatusProbe()` - lines 175-512

**Invocation Pattern** (lines 249-263):
```typescript
const { data, error, response } = await supabase.functions.invoke(
  "check-email-status",
  {
    body: {
      email: cacheKey,
      attemptId: resolvedAttemptId ?? undefined,
    },
    headers: {
      "x-correlation-id": correlationId,
      Authorization: `Bearer ${accessToken}`,
      apikey: VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    },
    signal: controller.signal,
  },
);
```

**Authentication Approach**:
- Uses anon key when no session: `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (line 240)
- Uses session access token if authenticated: `sessionData?.session?.access_token` (line 239)
- Edge function doesn't validate auth (service role key bypasses RLS)

**Features**:
- 450ms debounce on email input changes (line 75)
- 2-minute cache TTL (line 76)
- AbortController for request cancellation (line 230)
- Request ID tracking to ignore stale responses (lines 235-236, 265-267)
- Retry-After header extraction (lines 272-275)
- Rate limit headers parsing (lines 272-282)
- Comprehensive error handling (lines 269-298)

---

#### 2. cleanup-orphaned-user Invocation

**File 1**: `src/modules/auth/utils/cleanupInitiation.ts` (216 lines)

**Purpose**: Fire-and-forget initiation of cleanup flow during orphan detection

**Invocation Pattern** (lines 130-137):
```typescript
const { data, error } = await supabase.functions.invoke<
  CleanupRequestResponse | CleanupErrorResponse
>('cleanup-orphaned-user', {
  body: payload,
  headers: {
    'x-correlation-id': correlationId,
  },
});
```

**Key Features**:
- No auth headers (operates without session)
- Fire-and-forget: errors logged but not thrown (lines 140-183)
- Email hashing for privacy (lines 200-215)
- Minimal validation (lines 108-114)

**Call Context** (lines 74-105):
- Called from AuthProvider.login() when orphan detected
- Initiated in try-catch with graceful degradation
- No blocking of login flow

---

**File 2**: `src/modules/auth/utils/cleanupOrphanedUser.ts` (376 lines)

**Purpose**: Type-safe client library for both cleanup steps

**Step 1 - requestCleanupCode** (lines 146-248):
```typescript
const { data, error } = await supabase.functions.invoke<
  CleanupCodeSentResponse | CleanupErrorResponse
>('cleanup-orphaned-user', {
  body: {
    step: 'request-code',
    email,
    correlationId,
  },
  headers: {
    'x-correlation-id': correlationId,
  },
});
```

**Step 2 - validateAndCleanup** (lines 259-375):
```typescript
const { data, error } = await supabase.functions.invoke<
  CleanupUserDeletedResponse | CleanupErrorResponse
>('cleanup-orphaned-user', {
  body: {
    step: 'validate-and-cleanup',
    email,
    verificationCode: sanitizedCode,
    correlationId,
  },
  headers: {
    'x-correlation-id': correlationId,
  },
});
```

**Error Handling**:
- Custom CleanupError class (lines 114-136)
- User-friendly error messages via CLEANUP_ERROR_MESSAGES (lines 91-109)
- Wraps all errors in CleanupError instances

---

### Authentication Patterns

#### 1. Service Role Key Pattern (Admin Operations)

**Used By**: check-email-status, cleanup-orphaned-user, register-organization

**Pattern** (lines 14-27 in supabase/functions/check-email-status/index.ts):
```typescript
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
  : null;
```

**Characteristics**:
- **No Persistence**: `persistSession: false` - stateless operation
- **Full Access**: Bypasses RLS policies
- **Server-Only**: Should never leak to client
- **Use Cases**:
  - Querying auth.users (admin API)
  - Deleting users (admin API)
  - Operations requiring elevated permissions

**Risk Mitigation**:
- Stored as environment variable (Deno.env.get)
- Not exposed to frontend
- All operations logged with correlation IDs

---

#### 2. Anon Key Pattern (Public Operations)

**Used By**: Frontend client for unauthenticated requests

**Pattern** (src/core/config/supabaseClient.ts, lines 21-28):
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "weg-translator-auth",
  },
});
```

**Characteristics**:
- **Persistent Session**: Maintains auth state across page loads
- **Auto-Refresh**: Automatically refreshes expired tokens
- **RLS Enforced**: Respects Row-Level Security policies
- **Exposed**: Safe to embed in frontend

---

#### 3. Session-Based Pattern (Authenticated Operations)

**Used By**: register-organization, orphan detection queries

**Pattern** (useEmailStatusProbe.ts, lines 239-240):
```typescript
const { data: sessionData } = await supabase.auth.getSession();
const accessToken = sessionData?.session?.access_token ?? VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
```

**Characteristics**:
- **Token Extraction**: Gets access token from current session
- **Fallback**: Uses anon key if no session
- **RLS Enforcement**: Operations respect user ownership
- **Stateful**: Tied to authenticated user identity

---

### Creating Edge Functions Without Auth Session

#### Key Pattern: Service Role Key

Edge functions that don't require user auth use the service role key pattern:

```typescript
// 1. Get environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// 2. Create client with service role (no session)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }  // Critical: no session persistence
});

// 3. Query admin APIs
const { data, error } = await supabase.auth.admin.listUsers({...});

// 4. Delete users
const { error } = await supabase.auth.admin.deleteUser(userId);
```

#### Rate Limiting Without Auth

Use **Deno KV** for unauthenticated rate limiting:

```typescript
// Store rate limit data by IP or email
const kvKey = ['rate-limit', 'ip', clientIp];
const result = await kv.get<{count: number, resetAt: number}>(kvKey);

// Atomic update to prevent race conditions
const { ok } = await kv.atomic()
  .check(result)  // CAS check
  .set(kvKey, {...}, {expireIn: 60000})
  .commit();
```

#### Email Verification Codes

```typescript
// Generate secure code
function generateSecureCode(): string {
  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  return (randomValues[0] % 1000000).toString().padStart(6, '0');
}

// Store hash + salt in Deno KV
const { hash, salt } = await hashVerificationCode(code);
await kv.set(
  ['cleanup-code', emailLower],
  { hash, salt, timestamp: Date.now(), correlationId },
  { expireIn: 600000 }  // 10-minute TTL
);

// Validate with constant-time comparison
const submittedHash = await hashWithSalt(submittedCode, storedSalt);
const isValid = constantTimeEquals(submittedHash, storedHash);
```

---

### User Deletion & Cleanup Patterns

#### 1. Orphan Detection Flow

**Flow** (AuthProvider.tsx, lines 140-234):

1. User logs in with valid credentials
2. Email verification check (lines 130-137)
3. Orphan detection query (line 141):
   - `checkIfOrphaned(supabaseUser.id)` from orphanDetection.ts
4. Parallel queries with 500ms timeout (lines 138-162 in orphanDetection.ts):
   - Query `companies` table for `owner_admin_uuid = userId`
   - Query `company_admins` table for `admin_uuid = userId`
5. Classification (lines 248-265 in orphanDetection.ts):
   - If no company/admin data → orphaned → Case 1.2 (verified)
6. If orphaned:
   - Sign out user (line 194)
   - Initiate cleanup flow (line 239): fire-and-forget code send
   - Throw OrphanedUserError (line 207)
   - Redirect to recovery route

---

#### 2. Admin User Deletion API

**Pattern** (cleanup-orphaned-user, line 1675):
```typescript
const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
```

**Requirements**:
- Service role key (bypasses RLS)
- User ID (UUID)
- Stateless operation

**Audit Logging** (lines 1637-1671):
- Insert to `auth_cleanup_log` table before deletion
- Update status to 'pending' → 'completed'/'failed'
- Logs correlation ID, email hash, IP hash, timestamps

---

### Key Security Patterns

#### 1. Constant-Time Response Blinding

**Purpose**: Prevent timing attacks that leak information about code validity, user existence

**Implementation** (cleanup-orphaned-user, lines 1780-1802):
```typescript
async function applyConstantTimeResponse(
  startTime: number,
  response: Response,
): Promise<Response> {
  const TARGET_RESPONSE_TIME_MS = 500;
  const JITTER_MAX_MS = 50;  // ±50ms random jitter

  const elapsed = Date.now() - startTime;
  const jitter = (Math.random() * 2 - 1) * JITTER_MAX_MS;
  const delay = Math.max(0, TARGET_RESPONSE_TIME_MS + jitter - elapsed);

  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return response;
}
```

**Applied To**: All response paths in cleanup-orphaned-user function

---

#### 2. Hash-Based Code Storage

**Pattern** (cleanup-orphaned-user, lines 646-666):
```typescript
async function hashVerificationCode(code: string): Promise<{ hash: Uint8Array; salt: Uint8Array }> {
  // Generate 16-byte random salt
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  // Hash: SHA-256(code || salt)
  const combined = new Uint8Array(codeBytes.length + salt.length);
  combined.set(codeBytes, 0);
  combined.set(salt, codeBytes.length);

  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  return { hash: new Uint8Array(hashBuffer), salt };
}
```

**Benefits**:
- Codes not stored in plaintext
- Same code + different salt = different hash (rainbow table resistant)
- Even if KV is compromised, codes are unrecoverable

---

#### 3. Correlation ID Tracking

**Pattern** (All functions):
```typescript
function deriveCorrelationId(req: Request, payload?: RequestPayload): string {
  // 1. Check header (highest priority)
  const headerId = req.headers.get("x-correlation-id");
  if (headerId?.trim().length) return headerId.trim();

  // 2. Check payload
  if (payload?.correlationId) return payload.correlationId;

  // 3. Generate new UUID
  return crypto.randomUUID();
}
```

**Usage**:
- Trace requests end-to-end (frontend → edge function → database)
- Include in all log entries
- Return in response headers for client tracking
- Enables debugging without exposing user data

---

#### 4. Distributed Locking with Deno KV

**Purpose**: Prevent concurrent deletion of same user (race condition protection)

**Pattern** (cleanup-orphaned-user, lines 858-907):
```typescript
async function acquireCleanupLock(email: string, correlationId: string): Promise<boolean> {
  const lockKey = ["cleanup-lock", email.toLowerCase()];
  const lockData = { startedAt: Date.now(), correlationId };

  // Atomic check-and-set: only set if key doesn't exist
  const result = await kv.atomic()
    .check({ key: lockKey, versionstamp: null })  // Must not exist
    .set(lockKey, lockData, { expireIn: 30_000 })  // Auto-expire
    .commit();

  return result.ok;  // true if acquired, false if already held
}
```

**Guarantees**:
- Only one cleanup operation per email at a time
- 30-second automatic expiration prevents deadlocks
- Returns 409 (Conflict) if already locked

---

### Deno KV Usage Patterns

#### 1. Initialization

**Pattern** (All functions using KV):
```typescript
let kvInstance: Deno.Kv | null = null;
let kvInitPromise: Promise<Deno.Kv | null> | null = null;

async function getKvInstance(): Promise<Deno.Kv | null> {
  if (kvInstance) return kvInstance;
  if (!kvInitPromise) {
    kvInitPromise = Deno.openKv().catch(error => {
      console.warn("KV unavailable", { error });
      return null;
    });
  }
  kvInstance = await kvInitPromise;
  return kvInstance;
}
```

**Characteristics**:
- Lazy initialization (opened on first use)
- Singleton pattern with promise caching
- Graceful degradation if unavailable
- No error thrown (logs warning instead)

#### 2. Atomic Operations

**Pattern** (Rate limiting, locking):
```typescript
const result = await kv.atomic()
  .check({ key, versionstamp })  // CAS condition
  .set(key, newValue, {expireIn: ttlMs})  // Update if check passes
  .commit();  // All-or-nothing

if (!result.ok) {
  // Condition failed - retry with exponential backoff
  await new Promise(r => setTimeout(r, backoffMs));
  // Try again...
}
```

#### 3. TTL (Time-To-Live)

**Pattern**:
```typescript
// Verification code expires in 10 minutes
await kv.set(['cleanup-code', email], verificationData, {
  expireIn: 600_000  // milliseconds
});

// Rate limit entries auto-cleanup after window passes
await kv.set(['rate-limit', ip], timestamps, {
  expireIn: 120_000  // 2x the window (60s)
});
```

---

### Essential Files for Understanding Edge Functions

1. **Edge Function Core**:
   - `/supabase/functions/check-email-status/index.ts` (609 lines)
   - `/supabase/functions/cleanup-orphaned-user/index.ts` (2468 lines)
   - `/supabase/functions/register-organization/index.ts` (394 lines)

2. **Frontend Integration**:
   - `src/modules/auth/hooks/controllers/useEmailStatusProbe.ts` (512 lines)
   - `src/modules/auth/utils/cleanupInitiation.ts` (216 lines)
   - `src/modules/auth/utils/cleanupOrphanedUser.ts` (376 lines)

3. **Auth Provider**:
   - `src/app/providers/auth/AuthProvider.tsx` (376 lines)
   - `src/modules/auth/utils/orphanDetection.ts` (387 lines)

4. **Configuration**:
   - `src/core/config/supabaseClient.ts` (31 lines)

5. **Tests**:
   - `/supabase/functions/check-email-status/index.test.ts` (550 lines)

---

## Registration Submission Flow (New User Creation)

### Entry Points and High-Level Flow

**Primary Entry Point**: `RegistrationForm.tsx` component renders the complete multi-step registration UI
- **Location**: `/src/modules/auth/components/RegistrationForm.tsx` (437 lines)
- **Controlled By**: `useRegistrationForm` hook (custom state/validation management)
- **Submission**: Handled by `useRegistrationSubmission` hook (sign-up + verification polling)

**Flow Diagram**:
```
RegistrationForm (UI)
  ↓
useRegistrationForm (state/validation)
  ↓
useRegistrationSubmission (Supabase sign-up + polling)
  ↓
register-organization edge function (DB persistence)
  ↓
Database: companies + company_admins tables created
```

### Multi-Step Registration Process

#### Step 1: Company Details Form

**Component**: `RegistrationCompanyStep.tsx` (lines 82-245 in RegistrationForm.tsx)

**Fields Collected**:
- `companyName`: Organization legal name
- `companyEmail`: Organization email (must match admin email)
- `companyPhone`: Phone number with country selector
- `companyAddress`: Address with autocomplete suggestions
- `companyTaxNumber`: Tax ID with country code derivation

**Validation**:
- Real-time via `evaluateErrors()` in useRegistrationForm (lines 185-215)
- Validates format, required fields, phone number structure
- Tax ID validated with country code inference from address

**Address Handling**:
- Uses `useAddressAutocomplete` hook for Google Places suggestions
- Locked value pattern prevents user editing after selection
- Country code inferred from address and used for tax ID validation

#### Step 2: Administrator Account Form

**Component**: `RegistrationAdminStep.tsx` (lines 307-325 in RegistrationForm.tsx)

**Fields Collected**:
- `adminEmail`: Administrator email (must match companyEmail)
- `adminPassword`: Password with real-time strength evaluation
- Displays password requirements and strength meter

**Email Status Monitoring**:
- `useEmailStatusProbe` hook checks if email already registered (lines 160-164)
- Shows email status banner with contextual actions
- Prevents registration if email is `registered_verified` and not orphaned

**Password Evaluation**:
- Real-time via `evaluatePassword()` function from `passwordPolicy.ts`
- Checks: length, uppercase, lowercase, numbers, special chars
- Shows requirements panel with visual feedback

#### Step 3: Multi-Step Navigation

**Navigation Buttons**:
- "Back to login" (first step) or "Back" (other steps): navigates to previous step
- "Continue..." (non-final steps): validates current step and advances
- "Request organization access" (final step): submits form

**Validation on Step Advance** (lines 405-424):
```typescript
const attemptAdvance = useCallback(() => {
  const nextErrors = evaluateErrors(values);
  const currentStep = STEP_SEQUENCE[stepIndex];
  const relevantFields = STEP_FIELDS[currentStep];

  setErrors(nextErrors);
  setTouched(prev => {
    const updated = {...prev};
    for (const field of relevantFields) {
      updated[field] = true;
    }
    return updated;
  });

  const hasStepErrors = relevantFields.some(field => Boolean(nextErrors[field]));
  return !hasStepErrors;
}, [evaluateErrors, isSubmissionLocked, stepIndex, values]);
```

### Form Submission & Supabase Sign-Up

#### Step 1: Form Submission (useRegistrationForm.ts)

**Handler**: `handleSubmit()` (lines 490-528)

**Pre-Submission Checks**:
1. Validates all form fields
2. Checks email status: if `registered_verified`, blocks submission
3. Builds normalized payload via `buildSubmissionPayload()` (lines 462-488)
4. Calls `submitRegistration(payload)` from useRegistrationSubmission

**Payload Structure** (lines 34-55 in useRegistrationSubmission.ts):
```typescript
interface NormalizedRegistrationPayload {
  admin: {
    email: string;           // Verified to match company email
    password: string;        // Raw password (sent to Supabase)
  };
  company: {
    name: string;
    email: string;
    phone: string;
    taxId: string;
    taxCountryCode?: string;
    address: {
      freeform: string;      // User-entered or autocompleted
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      countryCode?: string | null;
    };
  };
}
```

#### Step 2: Supabase Auth Sign-Up (useRegistrationSubmission.ts)

**Handler**: `submit()` function (lines 615-683)

**Process**:
1. Generate unique `attemptId` (lines 621)
2. Call `supabase.auth.signUp()` (lines 626-636):
   ```typescript
   const { data, error } = await supabase.auth.signUp({
     email: payload.admin.email,
     password: payload.admin.password,
     options: {
       data: {
         company_name: payload.company.name,
         company_phone: payload.company.phone,
         tax_id: payload.company.taxId,
       },
     },
   });
   ```
3. Store metadata in auth.users user_metadata field
4. On success: user created in Supabase Auth (not yet verified)
5. Supabase sends confirmation email

**Error Handling** (lines 659-673):
- Catches `AuthError` instances
- Maps to `SubmissionError` with code and message
- Shows destructive toast notification
- Logs error with attempt ID
- Transition to `failed` phase

**Success Path** (lines 642-652):
- Reset poll attempts counter
- Transition to `awaitingVerification` phase
- Record admin UUID from signup response
- Schedule verification polling (every 5s, exponential backoff)
- Show toast: "Verify your email..."

#### Step 3: Email Verification Polling (useRegistrationSubmission.ts)

**Handler**: `runVerificationCheck()` (lines 422-600)

**Polling Schedule** (lines 308-312):
- Initial: 5 seconds
- Exponential backoff: delay = 5s * 2^(attempt-1), capped at 60s
- Manual check: 2-second debounce to prevent spam

**Verification Check Process**:

1. **Check Current Session** (lines 452-458):
   ```typescript
   const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
   const sessionUser = sessionData?.session?.user ?? null;
   ```

2. **Attempt Sign-In if Not Already Verified** (lines 461-490):
   - If no current session, try sign-in with credentials:
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email: payload.admin.email,
     password: payload.admin.password,
   });
   ```
   - Detects `"email not confirmed"` error (lines 468-484)
   - If still unverified, reschedule poll and return

3. **Validate Email Confirmation** (lines 510-528):
   ```typescript
   const emailConfirmed = Boolean(supabaseUser.email_confirmed_at);
   if (!emailConfirmed) {
     dispatch({ type: "await-verification" });
     scheduleVerificationPoll();
     return;
   }
   ```

4. **Persist Registration** (lines 530-546):
   - Once email verified, call `persistRegistration()`
   - Transitions to `persisting` phase
   - Calls `register-organization` edge function
   - Handles persistence errors (lines 538-545)

5. **Success** (lines 553-569):
   - Dispatch success action with result
   - Show toast: "Registration complete"
   - Log with company ID and admin UUID
   - Form closes verification dialog

#### Step 4: Organization Registration (register-organization edge function)

**Location**: `/supabase/functions/register-organization/index.ts` (394 lines)

**Authentication** (lines 339-350):
- Requires Bearer token in Authorization header
- Token extracted from verified admin session
- Validates token via `getVerifiedUser(token)` (lines 61-87)

**Email Verification Check** (lines 77-83):
```typescript
if (!user.email_confirmed_at) {
  return jsonResponse({
    error: {
      code: "email_not_verified",
      message: "Email address must be verified before completing registration.",
    },
  }, 403, correlationId);
}
```

**Email Matching** (lines 198-212):
```typescript
const adminEmail = (user.email ?? payload.company.email).toLowerCase();
const companyEmail = payload.company.email.toLowerCase();

if (adminEmail !== companyEmail) {
  return jsonResponse({
    error: {
      code: "email_mismatch",
      message: "Company email must match the authenticated administrator email.",
    },
  }, 422, correlationId);
}
```

**Database Transaction** (lines 220-286):
```typescript
const result = await sql.begin(async (trx) => {
  // 1. Insert company
  const [companyRow] = await trx`
    insert into public.companies (
      owner_admin_uuid, name, email, phone, tax_id, tax_country_code,
      address_freeform, address_line1, address_line2, address_city,
      address_state, address_postal_code, address_country_code,
      email_verified, phone_verified, account_approved
    ) values (...)
    returning id;
  `;

  // 2. Insert company_admin
  await trx`
    insert into public.company_admins (
      admin_uuid, company_id, admin_email, phone,
      email_verified, phone_verified, account_approved
    ) values (...)
    returning admin_uuid;
  `;

  return { companyId: companyRow.id };
});
```

**Atomic Constraints**:
- Transaction ensures both tables or neither are modified
- Unique constraint on (admin_uuid, company_id) prevents duplicates
- Foreign key constraint ensures admin exists

**Error Mapping** (lines 100-165):
- `23505` (unique constraint): 409 Conflict
- `23503`/`23514` (FK/check constraint): 422 Unprocessable
- `40001`/`40P01` (deadlock): 503 Service Unavailable (retry)
- Default: 500 Internal Server Error

**Response** (lines 293-303):
```typescript
return jsonResponse({
  data: {
    companyId: result.companyId,
    adminUuid: user.id,
    correlationId,
  },
}, 201, correlationId);
```

### Profile Synchronization After Registration

**Location**: `useRegistrationForm.ts` (lines 535-587)

**Trigger**: When `submissionPhase === "succeeded"`

**Process**:
1. Extract admin UUID and email from registration result
2. Derive username from email prefix
3. Attempt `createUserProfile()` (Tauri IPC command)
4. On duplicate error, attempt `updateUserProfile()`
5. On error, log but don't throw (graceful degradation)

**Profile Data Stored Locally**:
```typescript
{
  userUuid: submissionResult.adminUuid,
  username: email.split("@")[0] ?? email,
  email: adminEmail,
  roles: ["owner"],
}
```

### Error Handling Throughout Registration

#### 1. Form Validation Errors

**Level**: Field-level in form component
**Display**: Red text below input, blocking step advance
**Sources**:
- Required field validation
- Format validation (email, phone, tax ID)
- Constraint validation (phone length, tax ID format)

#### 2. Sign-Up Errors

**Level**: Authentication layer
**Source**: `supabase.auth.signUp()` throws `AuthError`
**Mapping**: Convert to `SubmissionError` via `mapAuthError()` (lines 148-161)
**Display**: Destructive toast + form error state
**Examples**:
- Email already registered (not orphaned)
- Weak password
- Service error

#### 3. Email Verification Errors

**Level**: Verification polling
**Source**: Sign-in attempt during verification check
**Handling**: Special detection for "email not confirmed" (lines 163-174)
**Display**: Retry messaging in verification dialog
**Timeout**: Continues polling up to 60+ seconds

#### 4. Organization Persistence Errors

**Level**: Database transaction
**Source**: Edge function returns error response
**Types**:
- Unique constraint (email already has company)
- FK constraint (admin UUID invalid)
- Deadlock (retry suggested)
**Handling**: `persistRegistration()` wraps errors (lines 373-418)
**Display**: Error message in verification dialog with retry option

#### 5. Network/Edge Function Errors

**Level**: Request/response handling
**Source**: `FunctionsFetchError`, `FunctionsHttpError`, `FunctionsRelayError`
**Mapping**: Via `mapFunctionInvokeError()` (lines 217-243)
**Display**: Verification dialog error state
**Recovery**: Manual verification check available

### State Machine Transitions

**SubmissionPhase Enum** (lines 18-25 in useRegistrationSubmission.ts):
```typescript
type SubmissionPhase =
  | "idle"              // Initial state
  | "signingUp"         // Supabase auth.signUp() in progress
  | "awaitingVerification"  // Waiting for email confirmation
  | "verifying"         // Checking if email confirmed
  | "persisting"        // Calling register-organization edge function
  | "succeeded"         // Registration complete
  | "failed";           // Error occurred (not recoverable)
```

**Transition Rules**:

1. `idle` → `signingUp`: User clicks submit
2. `signingUp` → `awaitingVerification`: Auth user created successfully
3. `signingUp` → `failed`: Auth error
4. `awaitingVerification` → `verifying`: Poll timer fires or manual check
5. `verifying` → `awaitingVerification`: Email still not confirmed, reschedule poll
6. `verifying` → `persisting`: Email confirmed, start organization creation
7. `verifying` → `failed`: Verification check error
8. `persisting` → `succeeded`: Edge function returns company ID
9. `persisting` → `failed`: Edge function error
10. Any phase → `idle`: User clicks reset/dismiss

### Verification Dialog States

**Component**: `RegistrationVerificationDialog.tsx` (lines 418-434 in RegistrationForm.tsx)

**Dialog Triggers**:
1. After form submission while in registration flow (context: "registration")
2. When user returns with existing unverified account (context: "returning")

**Phases & Actions**:

1. **signingUp**: Show loader, "Creating your account..."
2. **awaitingVerification**: Show email verification needed message
   - "Check your email" button (enables manual check)
   - Resend option (for returning users with unverified account)
3. **verifying**: Show loader, "Verifying your email..."
4. **persisting**: Show loader, "Creating your organization..."
5. **succeeded**: Show success message with company name
   - "Finish" button closes and redirects to login
6. **failed**: Show error message
   - Retry button (manual verification check if applicable)
   - Close button (dismiss and stay on form)

### Edge Cases & Error Recovery

#### Case 1: Email Already Registered (Non-Orphaned)

**Detection**: `emailStatusProbe.status === "registered_verified"` (line 511)

**Action**: Block submission
**Message**: "This email already has access" (from EmailStatusBanner)
**Options**: Log in or recover password

#### Case 2: Email Verification Times Out

**Current Handling**:
- Polling continues indefinitely with exponential backoff
- User can manually trigger verification check (2s debounce)
- Toast shows: "Still waiting for verification"

**Edge Cases**:
- Email never arrives (user should check spam)
- User clicks confirm link but network error
- Database constraint prevents company creation

#### Case 3: Organization Creation Fails

**Scenarios**:
1. **Unique Constraint** (email already has company)
   - Happens if race condition with another user
   - Response: 409 Conflict
   - Recovery: Let user retry or cleanup

2. **Foreign Key Constraint**
   - User UUID became invalid (unlikely)
   - Response: 422 Unprocessable Entity

3. **Deadlock**
   - Multiple simultaneous registrations on same email
   - Response: 503 Service Unavailable
   - Suggestion: "Please retry the registration"

#### Case 4: Orphaned User Completing Registration

**Context**: User previously registered but didn't complete company setup

**Flow**:
1. User logs in
2. Orphan detection triggers (Case 1.2)
3. Cleanup flow initiated (fire-and-forget)
4. User redirected to recovery route
5. User can complete registration from recovery form

### Key Files for Registration Submission

1. **Form Components**:
   - `/src/modules/auth/components/RegistrationForm.tsx` - Main registration UI
   - `/src/modules/auth/components/forms/RegistrationCompanyStep.tsx` - Company details
   - `/src/modules/auth/components/forms/RegistrationAdminStep.tsx` - Admin account
   - `/src/modules/auth/components/dialog/RegistrationVerificationDialog.tsx` - Verification flow

2. **Controllers & Hooks**:
   - `/src/modules/auth/hooks/controllers/useRegistrationForm.ts` - Form state/validation (698 lines)
   - `/src/modules/auth/hooks/controllers/useRegistrationSubmission.ts` - Sign-up/verification polling (720 lines)
   - `/src/modules/auth/hooks/controllers/useEmailStatusProbe.ts` - Email status checking (512 lines)

3. **Database & Persistence**:
   - `/supabase/functions/register-organization/index.ts` - Organization creation edge function (394 lines)

4. **Validation & Utilities**:
   - `/src/modules/auth/utils/validation/registrationSchema.ts` - Zod schemas
   - `/src/modules/auth/utils/validation/registration.ts` - Validation logic
   - `/src/modules/auth/utils/constants/registration.ts` - Constants (steps, fields, labels)
   - `/src/modules/auth/utils/passwordPolicy.ts` - Password evaluation

5. **Tests**:
   - `/src/test/modules/auth/components/RegistrationForm.integration.test.tsx` - Integration tests
   - `/src/test/modules/auth/hooks/useRegistrationForm.test.tsx` - Form hook tests
   - `/src/test/modules/auth/hooks/useRegistrationSubmission.test.ts` - Submission hook tests

