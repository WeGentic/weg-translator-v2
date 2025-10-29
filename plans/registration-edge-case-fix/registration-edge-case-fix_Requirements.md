# Requirements Document

## Introduction

### Purpose and Scope

This requirements document defines the comprehensive specifications for enhancing the registration and login flows to correctly handle orphaned user accounts in the Weg Translator application. Orphaned users are defined as users who exist in Supabase Auth (auth.users table) but lack corresponding data in the application's database tables (companies and company_admins).

The current system has partial implementations for orphan detection during login (Case 1.2) but lacks complete handling for all edge cases, particularly:
- **Case 1.1**: Users with unverified email addresses and no database data
- **Case 1.2**: Users with verified email addresses but no database data
- Incomplete retry mechanisms when users attempt to register again after initial failure
- Missing secure cleanup operations without requiring authentication sessions

This enhancement ensures that users experiencing registration failures can seamlessly recover and complete their registration without orphaned accounts accumulating in the system. The solution must maintain strict security requirements, provide clear user notifications, and preserve data integrity throughout all recovery flows.

### Success Criteria

The implementation is considered successful when:

1. **Zero Orphaned Accounts**: No orphaned user accounts persist in the system longer than 10 minutes after detection
2. **Seamless Recovery**: Users can complete registration after any failure scenario without manual intervention
3. **Clear Communication**: Users receive contextual, actionable notifications at every stage of the recovery process
4. **Security Compliance**: Cleanup operations execute without authentication sessions while maintaining security integrity
5. **Data Integrity**: All database operations preserve referential integrity and prevent race conditions
6. **Performance**: Orphan detection completes in <200ms at p95, with graceful degradation if timeout occurs
7. **Audit Trail**: All cleanup operations are logged with correlation IDs for traceability

### Out of Scope

The following items are explicitly excluded from this implementation:

1. **Bulk Cleanup**: Retroactive cleanup of existing orphaned accounts created before this implementation
2. **Account Merging**: Merging orphaned accounts with new registrations (always delete and recreate)
3. **Multi-Factor Authentication**: MFA considerations for orphaned account recovery
4. **Password Reset Flow**: Integration with password recovery mechanisms (separate concern)
5. **Admin Dashboard**: Administrative interface for viewing/managing orphaned accounts
6. **Analytics Integration**: Metrics dashboard for tracking orphan rates and cleanup success
7. **Email Template Customization**: UI for modifying verification code email templates
8. **SMS Verification**: Alternative verification methods beyond email

## Glossary

- **Orphaned User**: A user account that exists in Supabase Auth (auth.users table) but has no corresponding records in the companies or company_admins tables, indicating incomplete registration
- **Case 1.1**: Orphaned user with unverified email address (email_confirmed_at is NULL)
- **Case 1.2**: Orphaned user with verified email address (email_confirmed_at is set)
- **Edge Function**: Serverless function running on Supabase Edge Runtime (Deno) with access to service role credentials
- **Service Role Key**: Supabase authentication key with elevated privileges that bypasses Row-Level Security (RLS) policies
- **Verification Code**: 6-digit numeric code generated using CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) for verifying user intent during cleanup
- **Correlation ID**: UUID tracking identifier passed through all operations for end-to-end request tracing
- **Fire-and-Forget**: Asynchronous operation pattern where the initiating function does not wait for completion or handle errors
- **Constant-Time Response**: Security pattern where all code paths take the same duration to prevent timing attacks
- **Deno KV**: Key-value store integrated with Deno runtime for distributed state management
- **RLS (Row-Level Security)**: PostgreSQL security feature that restricts row access based on user identity
- **Atomic Operation**: Database transaction where all operations succeed or all fail (no partial state)
- **Graceful Degradation**: System behavior where non-critical failures are logged but do not block primary operations
- **Sliding Window Rate Limiting**: Rate limiting algorithm that tracks requests within a moving time window
- **Check-and-Set (CAS)**: Atomic operation pattern that only updates a value if it matches an expected state

## Non-Functional Requirements (NFRs)

### Performance

**NFR-1**: Orphan detection during login must complete within 200ms at p95 (95th percentile) with parallel queries to companies and company_admins tables.

**NFR-2**: Orphan detection must gracefully degrade with a 500ms hard timeout. If timeout occurs, login proceeds with orphanCheckFailed flag set to true, and the operation is logged for monitoring.

**NFR-3**: Email status probe must debounce user input by 450ms to prevent excessive API calls during typing.

**NFR-4**: Email status probe results must be cached for 2 minutes per unique email to reduce edge function invocations.

**NFR-5**: Constant-time response pattern must target 500ms ±50ms jitter for all cleanup-orphaned-user edge function responses to prevent timing attacks.

### Scalability

**NFR-6**: Rate limiting must support at least 1000 global requests per minute to check-email-status edge function.

**NFR-7**: Distributed locking using Deno KV must support concurrent cleanup attempts across multiple edge function instances without data corruption.

**NFR-8**: Edge functions must handle exponential backoff for KV atomic operation conflicts (max 5 retry attempts).

### Security

**NFR-9**: Cleanup operations must execute without requiring authenticated user sessions to handle cases where users cannot log in.

**NFR-10**: Verification codes must be stored as SHA-256 hashes with random 16-byte salts in Deno KV, never in plaintext.

**NFR-11**: Verification code validation must use constant-time comparison to prevent timing attacks that could reveal valid codes.

**NFR-12**: Verification codes must expire after 10 minutes (600 seconds) with automatic cleanup via Deno KV TTL.

**NFR-13**: All user-identifying information (emails, IP addresses) must be hashed before logging using SHA-256 to comply with privacy requirements.

**NFR-14**: Edge functions must validate all input using Zod schemas with strict type checking before processing.

**NFR-15**: Service role keys must be accessed only via environment variables and never exposed to client-side code.

### Privacy

**NFR-16**: Email addresses must not appear in plaintext in any log output (use SHA-256 hash with salt).

**NFR-17**: Verification codes must not be logged in any form (plain or hashed).

**NFR-18**: User IP addresses must be hashed before storage in rate limiting or audit logs.

### Compliance

**NFR-19**: All user deletion operations must be logged in auth_cleanup_log table with timestamps, correlation IDs, and operation status for audit compliance.

**NFR-20**: GDPR compliance: Users must be able to have their orphaned accounts deleted without authentication (right to erasure).

### Availability

**NFR-21**: Edge function errors must not block critical user flows. If cleanup fails, user must still be able to access recovery route.

**NFR-22**: Rate limiting must return RFC 7231 compliant Retry-After headers indicating when users can retry.

**NFR-23**: Distributed locks must auto-expire after 30 seconds to prevent deadlocks if edge function crashes.

### Observability

**NFR-24**: All operations must include correlation IDs generated as UUIDs for end-to-end tracing across frontend, edge functions, and database.

**NFR-25**: Orphan detection metrics must track: totalDurationMs, queryDurationMs, timedOut flag, hadError flag, and log warnings if p95 exceeds 200ms.

**NFR-26**: Edge functions must log structured JSON with consistent schema including: correlationId, email hash, timestamp, operation, status, and error details if applicable.

**NFR-27**: Rate limiting must expose current limits via headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.

### Usability

**NFR-28**: All user-facing error messages must be actionable (e.g., "Please retry in 45 seconds" instead of "Rate limited").

**NFR-29**: Toast notifications must be visually distinct by severity: info (blue), warning (yellow), error (red), success (green).

**NFR-30**: Email status banner must update in real-time as users type, with clear visual indicators for each state.

**NFR-31**: Verification dialog must show progress indicators for each phase: signing up, awaiting verification, verifying, persisting, succeeded/failed.

### Reliability

**NFR-32**: Database transactions for user deletion must be atomic: auth.users deletion and auth_cleanup_log update must both succeed or both fail.

**NFR-33**: Edge function invocations from frontend must include AbortController support for request cancellation when components unmount.

**NFR-34**: Email sending must implement retry logic with exponential backoff (3 attempts: immediate, +1s, +2s) and try multiple providers (Resend → SendGrid).

**NFR-35**: Registration submission must implement automatic verification polling with exponential backoff (5s, 10s, 20s, 40s, capped at 60s).

## Requirement 1: Orphan Detection for Case 1.1 (Unverified Email)

#### User Story

As a system administrator, I want the login flow to detect users with unverified email addresses and no database records (Case 1.1) so that these incomplete registrations are identified and handled before allowing access.

#### Acceptance Criteria

1. **Detection Logic**: When a user attempts to log in, the system must query both companies (owner_admin_uuid) and company_admins (admin_uuid) tables in parallel to determine if the user has database records, even if their email is unverified.

2. **Email Verification Block**: If a user's email_confirmed_at field is NULL, the login attempt must be blocked before orphan detection with error message: "Please verify your email before signing in. Check your inbox for the verification link."

3. **Case 1.1 Classification**: If a user passes Supabase authentication, has email_confirmed_at = NULL, and has no records in companies or company_admins tables, the system must classify them as Case 1.1 (orphaned_unverified).

4. **Graceful Degradation**: If the orphan detection query times out (>500ms) or errors, the login must be blocked for unverified users and the orphanCheckFailed flag must be set to true in the auth context.

5. **Logging**: All Case 1.1 detections must be logged with correlation ID, email hash (SHA-256), detection duration, and classification result for monitoring.

### Priority & Complexity

- Priority: Must (Critical for preventing unverified orphaned users from accessing the system)

## Requirement 2: Orphan Detection for Case 1.2 (Verified Email)

#### User Story

As a user with a verified email address but incomplete registration, I want the system to detect my orphaned account during login so that I can be guided to complete my registration instead of being stuck with login failures.

#### Acceptance Criteria

1. **Detection Logic**: When a user logs in successfully with verified email (email_confirmed_at is set), the system must execute parallel queries to companies and company_admins tables with a 500ms timeout.

2. **Case 1.2 Classification**: If both queries return zero results, the user must be classified as orphaned (isOrphaned: true) with hasCompanyData: false and hasAdminData: false.

3. **Immediate Signout**: Upon detecting Case 1.2, the system must immediately call supabase.auth.signOut() to clear the session before initiating recovery flow.

4. **Fire-and-Forget Cleanup Initiation**: The system must call initiateCleanupFlow(email, correlationId) asynchronously without awaiting completion, ensuring login flow is not blocked by cleanup delays.

5. **OrphanedUserError Throw**: After initiating cleanup, the system must throw OrphanedUserError with email, correlationId, and pre-computed redirectUrl containing query parameters: email, reason=orphaned, correlationId.

6. **Performance Metrics**: The detection operation must log performance metrics including: totalDurationMs, queryDurationMs, timedOut boolean, hadError boolean, and warn if duration exceeds 500ms.

7. **Graceful Degradation**: If detection fails or times out, the system must allow login to proceed with orphanCheckFailed: true flag and log the failure for investigation.

### Priority & Complexity

- Priority: Must (Already partially implemented but requires verification of completeness)

## Requirement 3: Cleanup Edge Function Without Authentication

#### User Story

As a user who cannot log in due to an orphaned account, I want to securely delete my incomplete registration via email verification so that I can register again without contacting support.

#### Acceptance Criteria

1. **Service Role Authentication**: The cleanup-orphaned-user edge function must use SUPABASE_SERVICE_ROLE_KEY from environment variables to create a Supabase client with auth: { persistSession: false }.

2. **Two-Step Flow**: The edge function must implement a discriminated union request schema with two steps:
   - Step 1: { step: "request-code", email: string, correlationId?: string }
   - Step 2: { step: "validate-and-cleanup", email: string, verificationCode: string, correlationId?: string }

3. **Step 1 - Code Generation**: On request-code, the function must:
   - Validate email exists in auth.users using auth.admin.listUsers()
   - Verify user is orphaned by querying companies and company_admins tables
   - Generate 6-digit code using crypto.getRandomValues() (CSPRNG)
   - Hash code with SHA-256 and random 16-byte salt
   - Store hash + salt in Deno KV with 10-minute TTL: ['cleanup-code', emailLower]
   - Send code via email using Resend or SendGrid with retry logic
   - Log to auth_cleanup_log table with status: 'pending'

4. **Step 2 - Validation and Deletion**: On validate-and-cleanup, the function must:
   - Retrieve stored hash + salt from Deno KV
   - Hash submitted code with stored salt and compare using constant-time equals
   - Re-verify user is still orphaned (may have completed registration between steps)
   - Delete user via supabase.auth.admin.deleteUser(userId)
   - Update auth_cleanup_log with status: 'completed'
   - Delete verification code from Deno KV

5. **Distributed Locking**: Both steps must acquire a distributed lock using Deno KV atomic operations with key ['cleanup-lock', emailLower] and 30-second auto-expiry to prevent concurrent cleanup attempts.

6. **Error Codes**: The function must return standardized error codes with user-friendly messages:
   - ORPHAN_CLEANUP_001: Code expired (>10 minutes)
   - ORPHAN_CLEANUP_002: Invalid code
   - ORPHAN_CLEANUP_003: Rate limited
   - ORPHAN_CLEANUP_004: User not found
   - ORPHAN_CLEANUP_005: Not orphaned (has company data)
   - ORPHAN_CLEANUP_006: Database transaction failed
   - ORPHAN_CLEANUP_007: Invalid input
   - ORPHAN_CLEANUP_008: Email delivery failed
   - ORPHAN_CLEANUP_009: Operation already in progress

7. **Constant-Time Response**: All response paths must apply constant-time delay to reach 500ms ±50ms jitter to prevent timing attacks on code validity or user existence.

8. **Rate Limiting**: The function must implement three-tier rate limiting:
   - Global: 1000 requests per 60 seconds
   - Per-IP: 5 requests per 60 seconds (sliding window)
   - Per-Email: 3 requests per 60 minutes
   - Return 429 with Retry-After header when limits exceeded

### Priority & Complexity

- Priority: Must (Core security requirement for cleanup without authentication)

## Requirement 4: Enhanced Login Flow with Orphan Handling

#### User Story

As a user logging in with an orphaned account, I want to be automatically redirected to a recovery page with clear instructions so that I understand what happened and can complete my registration.

#### Acceptance Criteria

1. **Orphan Detection Integration**: The AuthProvider.login() method must call checkIfOrphaned(userId) after successful Supabase authentication and email verification, passing the result to subsequent error handling.

2. **OrphanedUserError Catch**: The login method must have a specific catch block for OrphanedUserError that:
   - Calls initiateCleanupFlow(error.email, error.correlationId) without awaiting
   - Shows toast notification with title: "Registration Incomplete" and description: "Your registration was incomplete. Check your email for a verification code to complete cleanup."
   - Throws redirect error with message: "REDIRECT_TO_RECOVERY" and property redirectUrl: error.redirectUrl

3. **LoginForm Error Handling**: The LoginForm component must catch REDIRECT_TO_RECOVERY errors and:
   - Extract redirectUrl property from error object
   - Navigate to recovery route using router.navigate({ to: redirectUrl })
   - Not display general error message (toast already shown by AuthProvider)

4. **Recovery Route Parameters**: The redirect URL must contain query parameters:
   - email: User's email address (URL encoded)
   - reason: "orphaned"
   - correlationId: UUID for tracing

5. **User State Consistency**: After orphan detection, the user must be signed out (session cleared) and isAuthenticated flag must be false before redirect occurs.

6. **Performance Monitoring**: The login flow must log orphan detection performance metrics with warnings if detection exceeds 200ms, including: detection start time, end time, duration, timeout flag, error flag.

### Priority & Complexity

- Priority: Must (Critical for user experience during orphan recovery)

## Requirement 5: Enhanced Registration Flow with Retry Logic

#### User Story

As a user retrying registration after initial failure, I want the system to detect my existing account status and guide me through the appropriate recovery path so that I can complete registration without confusion.

#### Acceptance Criteria

1. **Email Status Probe Enhancement**: The useEmailStatusProbe hook must check for orphaned status in addition to registration status by invoking check-email-status edge function with attemptId tracking.

2. **Case 1.1 Retry Flow**: When check-email-status returns { status: "registered_unverified", isOrphaned: true }:
   - EmailStatusBanner must display message: "Incomplete registration detected. Your email needs verification."
   - Actions: "Resend verification email" button calling supabase.auth.resend() and "Resume verification" navigating to verification dialog
   - User may proceed with verification polling after resending email

3. **Case 1.2 Retry Flow**: When check-email-status returns { status: "registered_verified", isOrphaned: true }:
   - EmailStatusBanner must display message: "Registration incomplete - email verified. Complete your organization setup."
   - Actions: "Complete registration" navigating to /register/recover with pre-filled email, or "Start fresh" triggering cleanup flow
   - User must not be allowed to submit new registration form until cleanup completes

4. **Non-Orphaned Detection**: When check-email-status returns { status: "registered_verified", isOrphaned: false }:
   - EmailStatusBanner must display message: "This email already has access."
   - Actions: "Log in" navigating to /login with pre-filled email, or "Recover password" navigating to password reset
   - Registration form submit button must be disabled

5. **Cleanup Initiation from Registration**: If user selects "Start fresh" option:
   - Call requestCleanupCode(email, correlationId) from cleanupOrphanedUser.ts
   - Show toast: "Verification code sent to {email}. Please check your inbox."
   - Navigate to recovery route with context: "cleanup-initiated"

6. **Verification Code Entry**: Recovery form must provide input for 6-digit verification code with:
   - Auto-formatting (add spaces every 2 digits for readability)
   - Client-side validation (numeric only, exactly 6 digits)
   - Submit button calling validateAndCleanup(email, code, correlationId)
   - Error display for invalid/expired codes with retry option

7. **Post-Cleanup Registration**: After successful cleanup (user deleted), the recovery form must transition to standard registration form flow, pre-filling email and allowing user to re-enter all registration details.

### Priority & Complexity

- Priority: Must (Essential for users to recover from edge cases)

## Requirement 6: User Notifications and Feedback

#### User Story

As a user experiencing registration issues, I want clear, timely notifications explaining what is happening and what actions I need to take so that I am not confused or frustrated during recovery.

#### Acceptance Criteria

1. **Toast Notification Standards**: All toasts must follow severity conventions:
   - info: Default variant, blue accent, auto-dismiss in 6 seconds
   - warning: Yellow accent, auto-dismiss in 8 seconds
   - error: Red accent (destructive variant), auto-dismiss in 10 seconds
   - success: Green accent, auto-dismiss in 5 seconds

2. **Orphan Detection Toast**: When orphan detected during login, show toast:
   - Title: "Registration Incomplete"
   - Description: "Your registration was incomplete. Check your email for a verification code to complete cleanup and try again."
   - Variant: warning
   - Duration: 8000ms

3. **Cleanup Code Sent Toast**: When verification code is sent, show toast:
   - Title: "Verification Code Sent"
   - Description: "Please check your email for a 6-digit code to verify cleanup request."
   - Variant: info
   - Duration: 6000ms

4. **Cleanup Success Toast**: When orphaned user is deleted, show toast:
   - Title: "Account Cleanup Complete"
   - Description: "You can now register again with this email address."
   - Variant: success
   - Duration: 5000ms

5. **Rate Limit Toast**: When rate limited, show toast:
   - Title: "Too Many Requests"
   - Description: "Please wait {retryAfter} seconds before trying again."
   - Variant: error
   - Duration: 10000ms

6. **Email Status Banner States**: EmailStatusBanner component must render contextual messages:
   - Loading: "Checking email status…" with spinner
   - Not registered: "You're good to go." (success variant)
   - Registered + verified + orphaned: "Registration incomplete - email verified." (warning)
   - Registered + verified + not orphaned: "This email already has access." (error)
   - Registered + unverified + orphaned: "Incomplete registration detected." (warning)
   - Registered + unverified + regular: "Finish verifying your email." (info)

7. **Verification Dialog Progress**: Registration verification dialog must show current phase:
   - signingUp: "Creating your account…" with spinner
   - awaitingVerification: "Please verify your email" with action button
   - verifying: "Verifying your email…" with spinner
   - persisting: "Creating your organization…" with spinner
   - succeeded: "Registration complete! Welcome to {companyName}." with success icon
   - failed: Error message with retry/close buttons

8. **Accessibility**: All notifications must include:
   - role="alert" for field errors
   - role="status" with aria-live="polite" for status updates
   - aria-atomic="true" for complete message replacement
   - Descriptive aria-labels on action buttons

### Priority & Complexity

- Priority: Must (Critical for user experience and accessibility)

## Requirement 7: Data Integrity and Atomicity

#### User Story

As a system architect, I want all database operations related to orphan cleanup and registration to be atomic and maintain referential integrity so that the system never enters an inconsistent state.

#### Acceptance Criteria

1. **Parallel Query Atomicity**: Orphan detection queries to companies and company_admins tables must execute in parallel using Promise.all() with individual error handling, where failure in one query does not prevent the other from completing.

2. **User Deletion Atomicity**: When deleting an orphaned user, the following must occur atomically:
   - Insert record to auth_cleanup_log with status: 'pending'
   - Call supabase.auth.admin.deleteUser(userId)
   - Update auth_cleanup_log record with status: 'completed'
   - If any step fails, auth_cleanup_log must be updated with status: 'failed' and error details

3. **Verification Code Atomicity**: Storing verification codes in Deno KV must use atomic operations:
   - Check if code already exists for email
   - Set new code only if no existing code or existing is expired
   - Use kv.atomic().check().set().commit() pattern
   - Retry up to 3 times with exponential backoff if atomic operation fails

4. **Distributed Lock Atomicity**: Acquiring cleanup lock must use atomic check-and-set:
   - Check lock key versionstamp is null (not exists)
   - Set lock with correlationId and timestamp
   - Return success only if both operations commit atomically
   - If lock already held, return 409 Conflict without retrying

5. **Registration Transaction Atomicity**: In register-organization edge function, company and company_admin creation must use PostgreSQL transaction:
   - BEGIN transaction
   - INSERT into companies RETURNING id
   - INSERT into company_admins with foreign key to company
   - COMMIT on success, ROLLBACK on any error
   - Return 503 with retry message on deadlock (40001/40P01 errors)

6. **Race Condition Prevention**: Cleanup operations must prevent race conditions:
   - Re-verify orphan status after lock acquisition (user may have completed registration)
   - Use distributed lock with 30-second TTL to prevent concurrent cleanups
   - Return 409 if user is no longer orphaned before deletion

7. **Eventual Consistency Handling**: System must handle edge cases where user completes registration between detection and cleanup:
   - Always re-query database before destructive operations
   - Log when orphan status changes between detection and cleanup
   - Return friendly error message if user is no longer orphaned

### Priority & Complexity

- Priority: Must (Critical for data consistency and preventing data corruption)

## Requirement 8: Security Requirements for Cleanup Without Auth

#### User Story

As a security engineer, I want cleanup operations to execute without authentication while maintaining strict security controls so that attackers cannot abuse the cleanup flow to delete arbitrary accounts.

#### Acceptance Criteria

1. **Service Role Key Isolation**: The SUPABASE_SERVICE_ROLE_KEY environment variable must:
   - Only be accessible to edge function runtime (Deno.env.get)
   - Never be sent to client-side code or included in responses
   - Use separate key from anon/public API key
   - Be rotated according to security policy (documented in ops runbook)

2. **Email Verification Requirement**: Before cleanup, the system must:
   - Send verification code to the email address registered in auth.users
   - Require user to enter code from email to prove ownership
   - Reject cleanup if code is invalid, expired, or missing

3. **Constant-Time Comparison**: Verification code validation must:
   - Use timing-attack resistant comparison function
   - Hash submitted code with stored salt using SHA-256
   - Compare hashes byte-by-byte with constant-time equals function
   - Never short-circuit comparison on first mismatch

4. **Constant-Time Response**: All cleanup edge function responses must:
   - Target 500ms total response time
   - Add random jitter: ±50ms (Math.random() * 2 - 1) * 50
   - Delay response using setTimeout to reach target
   - Apply to all paths: success, error, validation failure, rate limit

5. **Code Expiry**: Verification codes must:
   - Expire after 10 minutes (600,000ms)
   - Be automatically deleted by Deno KV TTL
   - Return ORPHAN_CLEANUP_001 error if code is expired
   - Require user to request new code if expired

6. **Hash-Based Storage**: Verification codes must:
   - Never be stored in plaintext in Deno KV or database
   - Use SHA-256 hash with random 16-byte salt
   - Store both hash and salt in Deno KV with TTL
   - Salt must be unique per code generation (use crypto.getRandomValues)

7. **Rate Limiting for Abuse Prevention**: Cleanup endpoint must enforce:
   - Global limit: 1000 requests per 60 seconds across all users
   - IP-based limit: 5 requests per 60 seconds per IP address
   - Email-based limit: 3 code requests per 60 minutes per email
   - Return 429 with Retry-After header indicating seconds to wait

8. **Audit Logging**: All cleanup operations must be logged in auth_cleanup_log table:
   - Email hash (SHA-256 of lowercase trimmed email)
   - IP hash (SHA-256 of requester IP)
   - Correlation ID for tracing
   - Timestamp of request
   - Operation status: pending, completed, failed
   - Error details if failed (sanitized, no PII)

9. **Orphan Verification**: Before deletion, the system must:
   - Query companies table for owner_admin_uuid = userId
   - Query company_admins table for admin_uuid = userId
   - Only proceed with deletion if both queries return zero rows
   - Return ORPHAN_CLEANUP_005 error if user has company data

10. **Input Validation**: All edge function inputs must be validated using Zod schemas:
    - Email: Must be valid email format and max 255 characters
    - Verification code: Must be exactly 6 digits (regex: /^\d{6}$/)
    - Correlation ID: Must be valid UUID v4 format
    - Step: Must be literal "request-code" or "validate-and-cleanup"

### Priority & Complexity

- Priority: Must (Critical security requirement for operating without authentication)

## Requirement 9: Email Status Checking Integration

#### User Story

As a user on the registration form, I want real-time feedback on whether my email is already registered so that I know immediately if I should log in instead or if my account is orphaned and needs recovery.

#### Acceptance Criteria

1. **Debounced Probing**: The useEmailStatusProbe hook must:
   - Wait 450ms after user stops typing before probing
   - Cancel in-flight requests if email changes
   - Use AbortController to cancel requests on component unmount

2. **Cache Management**: Email status results must be cached:
   - Cache key: Normalized email (lowercase, trimmed)
   - TTL: 2 minutes (120,000ms)
   - Skip probe if valid cached result exists for email
   - Force refresh if probe.forceCheck() is called

3. **Edge Function Invocation**: The probe must call check-email-status with:
   - Body: { email: normalizedEmail, attemptId?: string }
   - Headers: { 'x-correlation-id': correlationId, Authorization: Bearer token }
   - Bearer token: Use session access token if authenticated, else anon key
   - Request ID tracking to ignore stale responses

4. **Response Schema Validation**: The probe must validate edge function response:
   - status: "not_registered" | "registered_verified" | "registered_unverified"
   - verifiedAt: ISO timestamp or null
   - lastSignInAt: ISO timestamp or null
   - hasCompanyData: boolean or null (null if query failed)
   - isOrphaned: boolean or null (null if query failed/timed out)
   - attemptId: UUID for retry tracking
   - correlationId: UUID for tracing

5. **Error Handling**: The probe must handle errors:
   - Network error: Show destructive toast with retry button
   - Rate limit (429): Extract Retry-After header, show toast with countdown
   - Edge function error: Parse error response JSON, show error message
   - Validation error: Log error, show generic "Check failed" message

6. **State Management**: The probe must maintain phase state:
   - idle: Not yet probed
   - loading: Probe in progress
   - success: Result available in probe.result
   - error: Error available in probe.error with retry-after info

7. **Manual Check Support**: The probe must expose forceCheck() method:
   - Clears cache for current email
   - Immediately triggers probe regardless of debounce
   - Used by "Retry check" button in error state

8. **Resend Verification Support**: The probe must expose resendVerification() method:
   - Only works if status is "registered_unverified"
   - Calls supabase.auth.resend({ type: 'signup', email })
   - Shows success or error toast
   - Logs operation with email hash

### Priority & Complexity

- Priority: Must (Required for proper registration retry flow)

## Requirement 10: Recovery Route and Form

#### User Story

As a user redirected to the recovery route after orphan detection, I want a dedicated form where I can enter the verification code and either complete cleanup or resume registration so that I can resolve my account status.

#### Acceptance Criteria

1. **Route Definition**: Create /register/recover route that:
   - Accepts query parameters: email, reason, correlationId
   - Pre-fills email input with query param value (readonly)
   - Displays different UI based on reason parameter
   - Is publicly accessible (no auth required)

2. **Recovery Form UI**: The form must include:
   - Readonly email field displaying affected email
   - Explanation text based on reason: "Your previous registration was incomplete. Enter the verification code sent to your email to clean up and start fresh."
   - 6-digit verification code input with auto-formatting (XX-XX-XX)
   - "Verify and Cleanup" button that calls validateAndCleanup()
   - "Resend Code" button that calls requestCleanupCode() with 60-second cooldown
   - "Cancel and Return to Login" button

3. **Code Entry Validation**: The verification code input must:
   - Accept only numeric characters (0-9)
   - Auto-format with hyphens every 2 digits for readability
   - Restrict to exactly 6 digits
   - Trim and sanitize input before submission
   - Show inline error if format is invalid

4. **Cleanup Submission**: On "Verify and Cleanup" click:
   - Validate code format (6 digits)
   - Call validateAndCleanup(email, code, correlationId)
   - Show loading spinner on button during request
   - Disable form inputs during submission

5. **Success Handling**: On successful cleanup:
   - Show success toast: "Account cleanup complete. You can now register again."
   - Wait 2 seconds
   - Navigate to /register with pre-filled email
   - Clear recovery form state

6. **Error Handling**: On cleanup failure:
   - Show error message from edge function response
   - If code expired (ORPHAN_CLEANUP_001): Prompt to resend code
   - If code invalid (ORPHAN_CLEANUP_002): Allow immediate retry with different code
   - If rate limited (ORPHAN_CLEANUP_003): Show retry-after countdown
   - If user not orphaned (ORPHAN_CLEANUP_005): Show success message and redirect to login

7. **Resend Code Flow**: On "Resend Code" click:
   - Call requestCleanupCode(email, newCorrelationId)
   - Show toast: "New verification code sent"
   - Start 60-second cooldown timer
   - Disable "Resend Code" button during cooldown
   - Show countdown: "Resend available in {seconds}s"

8. **Alternative Path**: Provide "I want to log in instead" button that:
   - Navigates to /login with pre-filled email
   - Shows info toast: "If you remember your password, try logging in. If your account is incomplete, you'll be redirected back here."

### Priority & Complexity

- Priority: Must (Essential user-facing component for recovery flow)

## Requirement 11: Performance Monitoring and Logging

#### User Story

As a DevOps engineer, I want comprehensive logging and performance metrics for orphan detection and cleanup operations so that I can monitor system health and debug issues.

#### Acceptance Criteria

1. **Orphan Detection Metrics**: Every orphan detection must log:
   - startedAt: ISO timestamp
   - completedAt: ISO timestamp
   - totalDurationMs: Total time including all operations
   - queryDurationMs: Time spent in database queries
   - correlationId: UUID for tracing
   - email: Hashed with SHA-256
   - isOrphaned: Boolean result
   - hasCompanyData: Boolean result
   - hasAdminData: Boolean result
   - timedOut: Boolean if exceeded 500ms
   - hadError: Boolean if any query errored
   - gracefulDegradation: Boolean if proceeded despite error

2. **Performance Warnings**: Log warnings if:
   - Detection duration exceeds 200ms: "Orphan detection slow (p95 target: 200ms)"
   - Detection duration exceeds 500ms: "Orphan detection timed out"
   - Detection errors: "Orphan detection failed, proceeding with graceful degradation"

3. **Edge Function Structured Logging**: All edge functions must log:
   - level: "info" | "warn" | "error"
   - message: Human-readable description
   - correlationId: UUID
   - email: SHA-256 hash
   - ip: SHA-256 hash (if available)
   - operation: "request-code" | "validate-and-cleanup" | "email-status-check"
   - status: "success" | "failed" | "pending"
   - durationMs: Operation duration
   - error: Error details if failed (sanitized)

4. **Rate Limit Metrics**: Rate limiting must log:
   - Limit hits: When user hits rate limit
   - Current count: Requests in current window
   - Window reset: Timestamp when window resets
   - Tier: "global" | "ip" | "email"

5. **Cleanup Audit Trail**: auth_cleanup_log table must record:
   - id: UUID primary key
   - email_hash: SHA-256 of email
   - ip_hash: SHA-256 of IP address
   - correlation_id: UUID for tracing
   - status: 'pending' | 'completed' | 'failed'
   - error_code: Error code if failed
   - error_message: Sanitized error message
   - created_at: Timestamp of request
   - updated_at: Timestamp of status change

6. **Frontend Logging**: All critical operations must log to browser console:
   - Orphan detection: Duration and result
   - Email probe: Status changes and errors
   - Cleanup initiation: Success or failure
   - Recovery form: Submissions and errors
   - Use structured format: { operation, correlationId, status, details }

7. **Correlation ID Propagation**: Correlation IDs must be:
   - Generated as UUID v4 in frontend
   - Passed in x-correlation-id header to edge functions
   - Returned in response headers
   - Logged in all operations
   - Used to trace end-to-end request flow

### Priority & Complexity

- Priority: Should (Important for debugging and monitoring but not blocking for users)

## Requirement 12: Testing and Validation

#### User Story

As a QA engineer, I want comprehensive test coverage for orphan detection and cleanup flows so that I can verify all edge cases are handled correctly.

#### Acceptance Criteria

1. **Unit Tests for Orphan Detection**: Test orphanDetection.ts:
   - Case 1.1: Unverified email + no database records → isOrphaned: true
   - Case 1.2: Verified email + no database records → isOrphaned: true
   - Has company data only → isOrphaned: false
   - Has admin data only → isOrphaned: false
   - Has both → isOrphaned: false
   - Query timeout → isOrphaned: false, timedOut: true
   - Query error → isOrphaned: false, hadError: true

2. **Unit Tests for Edge Functions**: Test cleanup-orphaned-user:
   - Request code: Valid email → code sent, stored in KV
   - Request code: Non-existent email → user not found error
   - Request code: Non-orphaned user → not orphaned error
   - Request code: Rate limited → 429 with retry-after
   - Validate: Correct code → user deleted, success response
   - Validate: Incorrect code → invalid code error
   - Validate: Expired code → code expired error
   - Validate: User no longer orphaned → not orphaned error
   - Constant-time: All responses within 500ms ±50ms

3. **Integration Tests for Login Flow**: Test login with orphaned accounts:
   - Login as Case 1.1 → blocked before orphan detection
   - Login as Case 1.2 → orphan detected, cleanup initiated, redirected to recovery
   - Login as non-orphaned verified user → login succeeds
   - Login when detection times out → login succeeds with orphanCheckFailed flag

4. **Integration Tests for Registration Retry**: Test registration with existing accounts:
   - Email probe detects registered_unverified + orphaned → show resend option
   - Email probe detects registered_verified + orphaned → show complete registration option
   - Email probe detects registered_verified + not orphaned → block registration
   - User requests cleanup → code sent, user can enter and verify
   - User completes cleanup → can register again immediately

5. **End-to-End Tests**: Test complete recovery flows:
   - User starts registration → email verification fails → logs in → orphan detected → receives code → enters code → account cleaned up → registers successfully
   - User with Case 1.1 → attempts login → blocked → resends verification → verifies → logs in → orphan detected → completes registration
   - User with Case 1.2 → logs in → redirected to recovery → enters code → cleans up → registers → login succeeds

6. **Performance Tests**: Verify non-functional requirements:
   - Orphan detection completes in <200ms at p95
   - Edge function responses target 500ms ±50ms
   - Rate limits enforce correctly (global, IP, email)
   - Deno KV atomic operations retry on conflict

7. **Security Tests**: Verify security requirements:
   - Service role key never exposed to client
   - Verification codes stored as hashes only
   - Constant-time comparison prevents timing attacks
   - Email and IP addresses hashed in logs
   - Rate limiting prevents brute force attacks

### Priority & Complexity

- Priority: Should (Critical for quality assurance but not blocking for implementation)

## Requirement 13: Documentation and Developer Experience

#### User Story

As a developer maintaining this system, I want clear documentation of the orphan detection and cleanup flows so that I can understand the architecture and debug issues efficiently.

#### Acceptance Criteria

1. **Architecture Documentation**: Create or update documentation covering:
   - Orphan detection flow diagram (login path)
   - Cleanup flow diagram (two-step verification)
   - Registration retry flow diagram
   - State machine transitions for useRegistrationSubmission
   - Database schema for auth_cleanup_log table

2. **Edge Function Documentation**: Document for each edge function:
   - Purpose and use cases
   - Request/response schemas
   - Authentication requirements
   - Error codes and meanings
   - Rate limiting rules
   - Example requests and responses

3. **Code Comments**: Add inline comments for:
   - Orphan detection logic explaining Case 1.1 vs 1.2
   - Constant-time response implementation and security rationale
   - Distributed locking pattern using Deno KV
   - Rate limiting algorithm (sliding window)
   - Verification code hashing and validation

4. **API Documentation**: Document client utilities:
   - cleanupOrphanedUser.ts: requestCleanupCode() and validateAndCleanup()
   - cleanupInitiation.ts: initiateCleanupFlow() (fire-and-forget)
   - orphanDetection.ts: checkIfOrphaned() parameters and return type

5. **Error Handling Guide**: Document for developers:
   - All error codes from cleanup edge function
   - Mapping from Supabase errors to user messages
   - When to use graceful degradation vs blocking errors
   - How to add new error types

6. **Runbook for Operations**: Create operational documentation:
   - How to monitor orphan detection performance
   - How to investigate cleanup failures in auth_cleanup_log
   - How to rotate service role key
   - How to adjust rate limits if under attack
   - How to manually delete orphaned users (emergency procedure)

7. **Testing Guide**: Document how to:
   - Set up test environment with mock Supabase
   - Create test orphaned users
   - Mock Deno KV for edge function tests
   - Run integration tests locally
   - Verify constant-time response timing

### Priority & Complexity

- Priority: Could (Improves maintainability but not required for MVP)

## Requirement 14: Edge Cases and Error Recovery

#### User Story

As a product manager, I want the system to handle all edge cases gracefully so that users never encounter dead ends or confusing error states.

#### Acceptance Criteria

1. **Concurrent Cleanup Attempts**: If user requests cleanup code twice:
   - Second request must check for existing non-expired code
   - Return existing code's expiry time in response
   - Only generate new code if previous is expired or doesn't exist
   - Distributed lock prevents race condition

2. **Registration Between Detection and Cleanup**: If user completes registration after cleanup code sent:
   - Re-verify orphan status before deletion in validate-and-cleanup step
   - Return ORPHAN_CLEANUP_005 (not orphaned) error
   - Show user success message: "Your account is active. Please log in."
   - Redirect to login page

3. **Email Delivery Failure**: If email provider fails to send code:
   - Edge function must try Resend first, then SendGrid
   - Implement exponential backoff retry: immediate, +1s, +2s
   - If all attempts fail, return ORPHAN_CLEANUP_008 error
   - Log failure with provider and error details
   - User can retry code request after cooldown

4. **Database Transaction Deadlock**: If PostgreSQL deadlock occurs:
   - Return 503 Service Unavailable
   - Include retry message: "System is busy. Please retry in a few seconds."
   - Log deadlock with correlation ID
   - User can manually retry operation

5. **Expired Code Recovery**: If user enters expired code:
   - Return ORPHAN_CLEANUP_001 error with friendly message
   - Show "Resend code" button prominently
   - Reset verification code input
   - Do not count as failed attempt for rate limiting

6. **Network Timeout During Cleanup**: If edge function times out:
   - Frontend must handle FunctionsRelayError
   - Show error message: "Request timed out. Please try again."
   - Allow immediate retry
   - Log timeout with correlation ID

7. **Rate Limit Recovery**: If user hits rate limit:
   - Show countdown timer: "Please wait {seconds}s before trying again"
   - Disable submit button during countdown
   - Extract Retry-After header from response
   - Show retry button when countdown reaches zero

8. **Invalid Verification Code**: If user enters wrong code:
   - Return ORPHAN_CLEANUP_002 error
   - Allow immediate retry (3 attempts before rate limit)
   - Show remaining attempts if rate limit approaching
   - Clear code input but keep email and form state

9. **Component Unmount During Operation**: If user navigates away:
   - AbortController must cancel in-flight edge function requests
   - Log cancellation with correlation ID
   - Clean up state on component unmount
   - Next mount must restart flow from idle state

10. **Session Expiry During Verification Polling**: If session expires:
    - Detect SessionExpiredError from Supabase
    - Show toast: "Session expired. Please log in again."
    - Redirect to login with redirect parameter
    - Preserve registration form data in session storage (optional)

### Priority & Complexity

- Priority: Should (Important for robustness but some are low-probability scenarios)

## Requirement 15: Migration and Rollback Plan

#### User Story

As a DevOps engineer, I want a clear migration and rollback strategy so that I can deploy these changes safely to production without data loss or extended downtime.

#### Acceptance Criteria

1. **Database Migration**: Create auth_cleanup_log table:
   - Run migration to create table with columns: id, email_hash, ip_hash, correlation_id, status, error_code, error_message, created_at, updated_at
   - Add indexes: (email_hash, created_at), (correlation_id), (status)
   - Verify migration runs successfully in staging
   - Document rollback SQL to drop table if needed

2. **Edge Function Deployment**: Deploy cleanup-orphaned-user edge function:
   - Deploy to staging environment first
   - Run smoke tests: request code, validate code, error cases
   - Verify Deno KV operations work correctly
   - Deploy to production with blue-green deployment

3. **Frontend Code Deployment**: Deploy updated login and registration flows:
   - Feature flag: ENABLE_ORPHAN_CLEANUP (default: false)
   - Deploy code with feature flag disabled
   - Enable feature flag in staging, run integration tests
   - Gradually roll out to production users (10%, 50%, 100%)
   - Monitor error rates and orphan detection performance

4. **Backward Compatibility**: Ensure compatibility:
   - Old frontend must work with new edge functions (graceful degradation)
   - New frontend must work if cleanup edge function not deployed (show fallback message)
   - Email templates must have fallback if new templates fail

5. **Monitoring Setup**: Before enabling feature:
   - Set up dashboards for orphan detection metrics
   - Create alerts for cleanup failures (>5% error rate)
   - Create alerts for slow orphan detection (p95 >500ms)
   - Set up log aggregation for correlation ID tracing

6. **Rollback Plan**: If issues occur:
   - Disable ENABLE_ORPHAN_CLEANUP feature flag immediately
   - If edge function causing issues, remove from Supabase project
   - If frontend bugs, revert to previous deployment
   - Document rollback procedure with step-by-step commands

7. **Data Cleanup**: Post-deployment:
   - Run script to identify existing orphaned users (audit only, no deletion)
   - Provide manual cleanup tool for support team if needed
   - Document process for handling orphaned users created before deployment

### Priority & Complexity

- Priority: Must (Required for safe production deployment)

---

## Summary

This requirements document defines 15 comprehensive requirements across the following domains:

1. **Orphan Detection** (Requirements 1-2): Detect both unverified (Case 1.1) and verified (Case 1.2) orphaned users during login
2. **Cleanup Operations** (Requirement 3): Secure two-step verification flow for deleting orphaned users without authentication
3. **Enhanced Flows** (Requirements 4-5): Improved login and registration flows with orphan handling and retry logic
4. **User Experience** (Requirements 6, 10): Clear notifications, feedback, and dedicated recovery interface
5. **Data & Security** (Requirements 7-8): Atomic operations, distributed locking, constant-time responses, and hash-based storage
6. **Integration** (Requirement 9): Real-time email status checking with caching and debouncing
7. **Operations** (Requirements 11-12): Comprehensive logging, performance monitoring, and test coverage
8. **Maintainability** (Requirement 13): Documentation for developers and operators
9. **Robustness** (Requirement 14): Edge case handling and error recovery
10. **Deployment** (Requirement 15): Safe migration and rollback strategy

All requirements are classified as **Must** (critical) or **Should** (important) priority, with none marked as **Could** or **Won't**, indicating the high importance of all specifications for a complete, secure, and user-friendly implementation.

The implementation of these requirements will result in a system that gracefully handles registration failures, guides users through recovery, maintains strict security without requiring authentication for cleanup, and provides comprehensive monitoring and debugging capabilities.
