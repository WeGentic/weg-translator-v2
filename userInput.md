# User Registration Flow

FULLY IMPLEMENT the final User Login and Registration flow:

```ascii
╔════════════════════════════════════════════════════════════════════════════╗
║                        REGISTRATION FLOW SCHEMATIC                         ║
║                     (Desktop App - Production Grade)                       ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FORM SUBMISSION & TEMPORARY STORAGE                                │
└─────────────────────────────────────────────────────────────────────────────┘

    [User Opens App]
           ↓
    [User Fills Registration Form]
           ↓
    [Client-Side Validation]
           ↓
    ┌──────────────────────┐
    │ Generate state_token │ ← UUID v4
    │ (Client-side)        │
    └──────────────────────┘
           ↓
    ┌─────────────────────────────────────┐
    │ Store in OS Secure Keychain         │
    │ Key: "pending_registration_state"   │
    │ Value: state_token                  │
    └─────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ CLIENT → SERVER RPC CALL                                   │
    │ store_pending_registration(                                │
    │   company_name, company_email, admin_email,                │
    │   admin_first_name, admin_last_name, state_token,           │
    │   ip_address, user_agent                                   │
    │ )                                                          │
    └────────────────────────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ SERVER: Rate Limit Check                                   │
    │ • IP-based: Max 5 registrations per hour                   │
    │ • Email-based: Max 3 attempts per hour                     │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔═══════════════════╗
    ║ Rate Limited?     ║
    ╚═══════════════════╝
           ├─── YES ───→ [Return Error: "Too many attempts. Try again in X minutes"]
           │                      ↓
           │                 [END FLOW]
           │
           NO
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ SERVER: Encrypt PII Data (AES-256-GCM)                     │
    │ • company_name, company_email, admin_email                 │
    │ • admin_first_name, admin_last_name                         │
    │ • Generate email_hash (SHA-256) for lookup                 │
    └────────────────────────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ SERVER: INSERT into pending_registrations                  │
    │ • encrypted_data (bytea)                                   │
    │ • email_hash (indexed)                                     │
    │ • state_token (unique)                                     │
    │ • expires_at (now + 24 hours)                              │
    │ • status = 'pending'                                       │
    └────────────────────────────────────────────────────────────┘
           ↓
    [Return Success: pending_uuid]
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ CLIENT → SUPABASE AUTH                                     │
    │ signUp(                                                    │
    │   email: admin_email,                                      │
    │   password: password,                                      │
    │   options: {                                               │
    │     emailRedirectTo: 'app://callback'                      │
    │   }                                                        │
    │ )                                                          │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔══════════════════════╗
    ║ SignUp Result?       ║
    ╚══════════════════════╝
           ├─── Email Already Exists ───→ [Show: "Email already registered. Try logging in."]
           │                                       ↓
           │                                  [END FLOW]
           │
           ├─── Weak Password ───→ [Show: "Password too weak. Requirements: ..."]
           │                              ↓
           │                         [Return to Form]
           │
           ├─── Network Error ───→ [Show: "Network error. Please retry."]
           │                              ↓
           │                         [Retry Button]
           │
           SUCCESS
           ↓
    [Show Email Verification Dialog]
    "Please check your email and click the verification link"
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ Supabase: auth.users created with:                         │
    │ • email_confirmed_at = NULL (unverified)                     │
    │ • confirmation_token generated                              │
    │ • confirmation_sent_at = now()                              │
    └────────────────────────────────────────────────────────────┘
           ↓
    [User Waits for Email]

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: EMAIL VERIFICATION & AUTOMATIC ACCOUNT CREATION                    │
└─────────────────────────────────────────────────────────────────────────────┘

    [User Receives Email]
           ↓
    ╔══════════════════════╗
    ║ User Action?         ║
    ╚══════════════════════╝
           ├─── Clicks "Cancel" ───→ [Confirm Cancellation Dialog]
           │                               ↓
           │                         ╔═══════════╗
           │                         ║ Confirmed? ║
           │                         ╚═══════════╝
           │                               ├─── YES ───→ [Call cancel_pending_registration(state_token)]
           │                               │                   ↓
           │                               │              [Clear keychain]
           │                               │                   ↓
           │                               │              [END FLOW]
           │                               │
           │                               NO
           │                               ↓
           │                         [Back to Wait]
           │
           ├─── Clicks "Resend Email" ───→ [Call request_verification_resend(state_token)]
           │                                      ↓
           │                                ╔═══════════════════╗
           │                                ║ Resend Allowed?   ║
           │                                ╚═══════════════════╝
           │                                      ├─── NO (Limit Exceeded) ───→ [Show: "Max 5 resends reached"]
           │                                      │
           │                                      ├─── NO (Cooldown) ───→ [Show: "Wait 2 minutes between resends"]
           │                                      │
           │                                      YES
           │                                      ↓
           │                                [Supabase Resends Email]
           │                                      ↓
           │                                [Back to Wait]
           │
           CLICKS EMAIL LINK
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ User Clicks Email Verification Link                         │
    └────────────────────────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ Supabase Backend Processes:                                │
    │ 1. Validates confirmation_token                             │
    │ 2. UPDATE auth.users SET email_confirmed_at = now()         │
    │ 3. Generates session (access_token, refresh_token)         │
    └────────────────────────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ ⚡ DATABASE TRIGGER FIRES AUTOMATICALLY                     │
    │ on_auth_email_confirmed                                     │
    └────────────────────────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ TRIGGER LOGIC:                                             │
    │ 1. Detect: email_confirmed_at changed from NULL to NOW()    │
    │ 2. Calculate: email_hash = SHA256(email)                   │
    │ 3. Query: pending_registrations by email_hash              │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔═══════════════════════╗
    ║ Pending Found?        ║
    ╚═══════════════════════╝
           ├─── NO ───→ [Log Warning: "Email verified but no pending registration"]
           │                  ↓
           │            [Continue - User can login but has no profile yet]
           │                  ↓
           │            [Supabase Redirects to app://callback#tokens]
           │                  ↓
           │            [Handle in Phase 3 with fallback]
           │
           YES
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ TRIGGER: Decrypt registration data                         │
    └────────────────────────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ TRIGGER: BEGIN ATOMIC TRANSACTION                          │
    │ ┌────────────────────────────────────────────────────────┐ │
    │ │ 1. INSERT INTO accounts                                │ │
    │ │    (company_name, company_email, is_active)            │ │
    │ │    VALUES (...)                                        │ │
    │ │    RETURNING account_uuid                              │ │
    │ └────────────────────────────────────────────────────────┘ │
    │                         ↓                                  │
    │ ┌────────────────────────────────────────────────────────┐ │
    │ │ 2. INSERT INTO users                                   │ │
    │ │    (user_uuid, account_uuid, role, user_email,         │ │
    │ │     first_name, last_name, is_active)                   │ │
    │ │    VALUES (auth_user_id, account_uuid, 'owner', ...)   │ │
    │ └────────────────────────────────────────────────────────┘ │
    │                         ↓                                  │
    │ ┌────────────────────────────────────────────────────────┐ │
    │ │ 3. INSERT INTO subscriptions                           │ │
    │ │    (account_uuid, subscription_type, status,           │ │
    │ │     trial_ends_at)                                     │ │
    │ │    VALUES (account_uuid, 'trial', 'trial',             │ │
    │ │           now() + interval '14 days')                  │ │
    │ └────────────────────────────────────────────────────────┘ │
    │                         ↓                                  │
    │ ┌────────────────────────────────────────────────────────┐ │
    │ │ 4. UPDATE pending_registrations                        │ │
    │ │    SET status = 'completed', deleted_at = now()        │ │
    │ │    WHERE pending_uuid = ...                            │ │
    │ └────────────────────────────────────────────────────────┘ │
    │                         ↓                                  │
    │ ┌────────────────────────────────────────────────────────┐ │
    │ │ 5. INSERT INTO security_audit_log                      │ │
    │ │    (event_type, severity, user_uuid, details)          │ │
    │ │    VALUES ('registration_completed', 'info', ...)      │ │
    │ └────────────────────────────────────────────────────────┘ │
    │ COMMIT TRANSACTION                                         │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔═══════════════════════╗
    ║ Transaction Success?  ║
    ╚═══════════════════════╝
           ├─── FAILED ───→ [ROLLBACK ALL CHANGES]
           │                      ↓
           │                [Log Critical Error]
           │                      ↓
           │                [User will need fallback in Phase 3]
           │
           SUCCESS
           ↓
    [Production Tables Now Populated:
     ✅ accounts
     ✅ users  
     ✅ subscriptions]
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ Supabase: Redirect to app://callback with tokens in hash   │
    │ URL: app://callback#access_token=xxx&refresh_token=yyy     │
    └────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: DEEP LINK HANDLING & DASHBOARD REDIRECT                            │
└─────────────────────────────────────────────────────────────────────────────┘

    [OS Receives Deep Link]
           ↓
    [App Process Launched/Resumed]
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ Parse Deep Link URL                                        │
    │ • Extract hash fragments: #access_token=xxx&refresh_token  │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔═══════════════════════╗
    ║ Valid Token Format?   ║
    ╚═══════════════════════╝
           ├─── NO ───→ [Show: "Invalid verification link"]
           │                  ↓
           │            [END FLOW - Contact Support]
           │
           YES
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ CLIENT → SUPABASE                                          │
    │ setSession({ access_token, refresh_token })                │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔═══════════════════════╗
    ║ Session Valid?        ║
    ╚═══════════════════════╝
           ├─── NO ───→ [Show: "Session expired or invalid"]
           │                  ↓
           │            [Redirect to Login]
           │
           YES
           ↓
    [✅ User Now Authenticated - auth.uid() available]
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ CLIENT → SERVER QUERY                                      │
    │ SELECT * FROM users WHERE user_uuid = auth.uid()           │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔═══════════════════════╗
    ║ User Profile Exists?   ║
    ╚═══════════════════════╝
           ├─── YES ───→ [Profile Found - Registration Complete!]
           │                  ↓
           │            ┌──────────────────────────────────────┐
           │            │ Retrieve state_token from keychain   │
           │            │ (for cleanup)                        │
           │            └──────────────────────────────────────┘
           │                  ↓
           │            ┌──────────────────────────────────────┐
           │            │ If state_token found:                │
           │            │ • Call cancel_pending_registration() │
           │            │ • Clear keychain                     │
           │            └──────────────────────────────────────┘
           │                  ↓
           │            [Redirect to Dashboard]
           │                  ↓
           │            [END FLOW - SUCCESS ✅]
           │
           NO (Profile Missing - Edge Case)
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ FALLBACK MECHANISM                                         │
    │ (Trigger failed or race condition)                         │
    └────────────────────────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ Retrieve state_token from keychain                         │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔═══════════════════════╗
    ║ state_token Found?    ║
    ╚═══════════════════════╝
           ├─── NO ───→ [Try Email-Based Fallback]
           │                  ↓
           │            ┌──────────────────────────────────────┐
           │            │ CLIENT → SERVER                      │
           │            │ complete_registration_by_email()     │
           │            └──────────────────────────────────────┘
           │                  ↓
           │            ╔═══════════════════╗
           │            ║ Success?          ║
           │            ╚═══════════════════╝
           │                  ├─── YES ───→ [Clear keychain]
           │                  │                  ↓
           │                  │            [Redirect to Dashboard]
           │                  │                  ↓
           │                  │            [END FLOW - SUCCESS ✅]
           │                  │
           │                  NO
           │                  ↓
           │            [Show: "Registration data not found"]
           │                  ↓
           │            [Offer: Re-register or Contact Support]
           │                  ↓
           │            [END FLOW - MANUAL INTERVENTION NEEDED]
           │
           YES
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ CLIENT → SERVER RPC CALL                                   │
    │ complete_registration_with_state_token(state_token)        │
    └────────────────────────────────────────────────────────────┘
           ↓
    ┌────────────────────────────────────────────────────────────┐
    │ SERVER LOGIC:                                              │
    │ 1. Verify auth.uid() exists                                │
    │ 2. Find pending by state_token                             │
    │ 3. Check if expired                                        │
    │ 4. Decrypt data                                            │
    │ 5. Validate email matches auth.uid() email                 │
    │ 6. Call create_account_with_admin_internal()               │
    │ 7. Mark pending as completed                               │
    └────────────────────────────────────────────────────────────┘
           ↓
    ╔═══════════════════════╗
    ║ Result?               ║
    ╚═══════════════════════╝
           ├─── Email Mismatch ───→ [❌ SECURITY INCIDENT]
           │                              ↓
           │                        [Log Critical Security Event]
           │                              ↓
           │                        [Show: "Security error. Account locked."]
           │                              ↓
           │                        [END FLOW - Contact Support]
           │
           ├─── Not Found/Expired ───→ [Try Email Fallback]
           │                              ↓
           │                        [If fails: Show re-register option]
           │
           ├─── Database Error ───→ [Show: "Technical error"]
           │                              ↓
           │                        [Retry Button]
           │                              ↓
           │                        [If retry fails 3x: Contact Support]
           │
           SUCCESS
           ↓
    [Clear state_token from keychain]
           ↓
    [Update users.last_login_at = now()]
           ↓
    [Show Success Message: "Welcome to [App Name]!"]
           ↓
    [Redirect to Dashboard]
           ↓
    [END FLOW - SUCCESS ✅]

┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKGROUND MAINTENANCE (Automated)                                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────┐
    │ pg_cron: Every 15 Minutes                                  │
    │ cleanup_expired_pending_registrations()                    │
    │ • Soft delete expired (> 24 hours)                         │
    │ • Status = 'expired'                                       │
    └────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────┐
    │ pg_cron: Daily at 2 AM                                     │
    │ purge_old_pending_registrations()                          │
    │ • Hard delete soft-deleted records older than 7 days       │
    │ • GDPR compliance                                          │
    └────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────┐
    │ pg_cron: Hourly                                            │
    │ cleanup_old_rate_limits()                                  │
    │ • Delete rate limit records older than 24 hours            │
    └────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────┐
    │ pg_cron: Weekly (Sunday 3 AM)                              │
    │ archive_old_audit_logs()                                   │
    │ • Archive logs older than 90 days                          │
    └────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE CASE HANDLING SUMMARY                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    1. ✅ User Never Clicks Email
       → Auto-cleanup after 24 hours
       → Soft delete, then hard delete after 7 days

    2. ✅ User Clicks Email but Never Opens App
       → Trigger creates account automatically
       → User can login anytime with normal flow

    3. ✅ User Uninstalls App After Registration
       → state_token lost from keychain
       → Fallback: complete_registration_by_email()
       → If pending not found: Trigger already completed it

    4. ✅ User Registers Twice with Same Email
       → First time: store_pending_registration succeeds
       → Second time: signUp returns "Email already exists"
       → Client shows: "Email already registered"

    5. ✅ Database Trigger Fails
       → User receives deep link but has no profile
       → Fallback: complete_registration_with_state_token()
       → If that fails: complete_registration_by_email()

    6. ✅ Network Interruption During Process
       → All database operations are atomic transactions
       → Either complete or rollback entirely
       → User can retry from any point

    7. ✅ User Cancels Registration
       → Soft delete pending_registrations
       → auth.users remains (can be used for future registration)
       → No orphaned encrypted data after 7 days

    8. ✅ Rate Limit Attacks
       → IP-based: 5 per hour (blocked for 1 hour)
       → Email-based: 3 per hour
       → Logged in security_audit_log

    9. ✅ Email Verification Link Expires
       → Supabase tokens expire after 24 hours by default
       → Pending registration expires after 24 hours
       → User must re-register

    10. ✅ Session Hijacking (Deep Link Interception)
        → Unique app scheme: app://com.yourcompany.yourapp.callback
        → Additional device fingerprinting (optional)
        → State token validation
        → Email match validation in server

╔════════════════════════════════════════════════════════════════════════════╗
║                          END OF FLOW SCHEMATIC                             ║
╚════════════════════════════════════════════════════════════════════════════╝
```

## Implement these SQL functions and triggers as part of the backend logic to support the above flow

-- POSTGRESQL EXTENSIONS
-- TABLE: pending_registrations
-- TABLE: registration_rate_limits
-- TABLE: security_audit_log
    'registration_started',
    'registration_rate_limited',
    'email_verification_sent',
    'email_verification_resent',
    'registration_completed',
    'registration_failed',
    'email_mismatch_detected',
    'invalid_deep_link',
    'trigger_created_account',
    'fallback_used'
-- FUNCTION: Get encryption key -> use Supabase Vault
-- FUNCTION: Encrypt registration data
-- FUNCTION: Decrypt registration data
-- FUNCTION: Check rate limits
-- FUNCTION: Record rate limit attempt
-- FUNCTION: Store pending registration (PUBLIC - Called by client)
-- TRIGGER: Auto-create account after email verification
-- FUNCTION: Fallback - Complete registration with state token
-- FUNCTION: Fallback - Complete registration by email
-- FUNCTION: Request verification email resend
-- FUNCTION: Cancel pending registration
-- FUNCTION: Cleanup expired pending registrations
-- FUNCTION: Purge old pending registrations (GDPR)
-- FUNCTION: Cleanup old rate limits
-- FUNCTION: Archive old audit logs
-- SCHEDULED JOBS (pg_cron)
    -- Cleanup expired registrations every 15 minutes
    -- Purge old registrations daily at 2 AM
    -- Cleanup rate limits every hour
    -- Archive audit logs weekly on Sunday at 3 AM
-- RLS POLICIES
    -- No direct access to pending registrations (only through functions)
    -- No direct access to rate limits (only through functions)
    -- Admins can view their own account's audit logs
-- GRANT PERMISSIONS
    -- Revoke access to internal functions
-- MONITORING VIEWS
-- TRIGGERS FOR AUTO-UPDATING modified_at

## Implement also the following checklists for development and security review

A. Encryption & Data Protection
B. Rate Limiting Configuration
C. Security Headers & CORS
D. Deep Link Security
E. Session Management
F. Audit Logging Requirements
G. GDPR Compliance
H. Performance Optimization
I. Monitoring & Alerting Checklist
J. Backup & Disaster Recovery

## FINAL IMPLEMENTATION CHECKLIST

 ✅ SQL schema created with proper indexes
 ✅ Encryption functions implemented (AES-256-GCM)
 ✅ Rate limiting enforced (IP + email-based)
 ✅ Database trigger for automatic account creation
 ✅ Fallback mechanisms for edge cases
 ✅ Comprehensive security audit logging
 ✅ RLS policies preventing direct table access
 ✅ GDPR-compliant data retention (24h + 7d + 90d)
 ✅ Automated cleanup via pg_cron
 ✅ Monitoring views and alerts
 ✅ Deep link security validation
 ✅ Session management best practices
 ✅ Backup and disaster recovery procedures