# cleanup-orphaned-user Edge Function API

## Overview

The `cleanup-orphaned-user` edge function provides a secure two-step verification flow for deleting orphaned user accounts without requiring authentication. This enables users who cannot log in due to incomplete registration to clean up their accounts and retry registration.

**Version**: 1.0
**Endpoint**: `POST /functions/v1/cleanup-orphaned-user`
**Authentication**: None required (uses service role key internally)
**Rate Limiting**: Yes (see below)

## Security Model

- **No User Authentication**: Operates without user session to handle cases where users cannot log in
- **Service Role Authentication**: Uses Supabase Vault-stored service role key for admin operations
- **Email Verification**: Sends 8-character verification code to user's registered email address
- **Constant-Time Responses**: All responses target 500ms ±50ms (Gaussian jitter) to prevent timing attacks
- **Hash-Based Storage**: Verification codes stored as SHA-256 hashes with random 16-byte salts
- **Distributed Locking**: PostgreSQL advisory locks prevent concurrent cleanup attempts
- **Rate Limiting**: Three-tier rate limiting prevents abuse (see below)

## Request Format

The function accepts a discriminated union of two request types:

### Step 1: Request Verification Code

```typescript
{
  "step": "request-code",
  "email": "user@example.com",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000" // Optional UUID v4
}
```

### Step 2: Validate Code and Cleanup

```typescript
{
  "step": "validate-and-cleanup",
  "email": "user@example.com",
  "verificationCode": "ABCD-EFGH", // 8-character alphanumeric code
  "correlationId": "123e4567-e89b-12d3-a456-426614174000" // Optional UUID v4
}
```

## Request Schema (Zod)

```typescript
import { z } from 'zod';

const requestSchema = z.discriminatedUnion('step', [
  // Step 1: Request Code
  z.object({
    step: z.literal('request-code'),
    email: z.string()
      .email('Invalid email format')
      .max(255, 'Email too long')
      .transform(s => s.toLowerCase().trim()),
    correlationId: z.string().uuid().optional(),
  }),

  // Step 2: Validate and Cleanup
  z.object({
    step: z.literal('validate-and-cleanup'),
    email: z.string()
      .email('Invalid email format')
      .max(255, 'Email too long')
      .transform(s => s.toLowerCase().trim()),
    verificationCode: z.string()
      .length(9, 'Code must be 9 characters (XXXX-XXXX)')
      .regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, 'Invalid code format')
      .transform(s => s.replace(/-/g, '')), // Remove hyphen for processing
    correlationId: z.string().uuid().optional(),
  }),
]);

type CleanupRequest = z.infer<typeof requestSchema>;
```

## Response Format

### Success Response

```typescript
{
  "data": {
    "message": string,
    "correlationId": string
  }
}
```

**Step 1 Success Example**:
```json
{
  "data": {
    "message": "Verification code sent to email",
    "correlationId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

**Step 2 Success Example**:
```json
{
  "data": {
    "message": "User deleted successfully",
    "correlationId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

### Error Response

```typescript
{
  "error": {
    "code": string,
    "message": string,
    "retryAfter"?: number // Seconds to wait before retry (rate limit only)
  }
}
```

## Error Codes

| Code | HTTP Status | Description | User Action |
|------|-------------|-------------|-------------|
| `ORPHAN_CLEANUP_001` | 404 | Verification code expired (>5 minutes) | Request new code |
| `ORPHAN_CLEANUP_002` | 401 | Invalid verification code | Re-enter code or request new one |
| `ORPHAN_CLEANUP_003` | 429 | Rate limit exceeded | Wait for `retryAfter` seconds |
| `ORPHAN_CLEANUP_004` | 404 | User not found in auth.users | Email not registered |
| `ORPHAN_CLEANUP_005` | 409 | User is not orphaned (has company data) | Use normal login flow |
| `ORPHAN_CLEANUP_006` | 500 | Database transaction failed | Retry in a few seconds |
| `ORPHAN_CLEANUP_007` | 400 | Invalid request format (validation error) | Fix request format |
| `ORPHAN_CLEANUP_008` | 503 | Email delivery failed (all providers) | Retry later or contact support |
| `ORPHAN_CLEANUP_009` | 409 | Operation already in progress | Wait for previous operation to complete |

### Error Examples

**Code Expired**:
```json
{
  "error": {
    "code": "ORPHAN_CLEANUP_001",
    "message": "Verification code expired. Please request a new code."
  }
}
```

**Invalid Code**:
```json
{
  "error": {
    "code": "ORPHAN_CLEANUP_002",
    "message": "Invalid verification code. Please check your email and try again."
  }
}
```

**Rate Limited**:
```json
{
  "error": {
    "code": "ORPHAN_CLEANUP_003",
    "message": "Too many requests. Please wait 45 seconds before trying again.",
    "retryAfter": 45
  }
}
```

**Not Orphaned**:
```json
{
  "error": {
    "code": "ORPHAN_CLEANUP_005",
    "message": "Your account is active. Please log in instead."
  }
}
```

## Rate Limiting

The function implements three-tier rate limiting using PostgreSQL-based sliding window algorithm:

### Rate Limit Tiers

| Tier | Limit | Window | Scope | Purpose |
|------|-------|--------|-------|---------|
| **Global** | 1000 requests | 60 seconds | All requests | Protect backend from overload |
| **Per-IP** | 5 requests | 60 seconds | Source IP address | Prevent single-source abuse |
| **Per-Email** | 3 requests | 60 minutes | Email address | Prevent targeted attacks |

### Rate Limit Headers

Responses include standard rate limit headers:

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1677649200
Retry-After: 45
```

### Rate Limit Response (429)

```json
{
  "error": {
    "code": "ORPHAN_CLEANUP_003",
    "message": "Too many requests. Please wait 45 seconds before trying again.",
    "retryAfter": 45
  }
}
```

## Workflow

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Request Verification Code                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Check Rate Limits (Global, IP, Email)       │
    └──────────────────────────────────────────────┘
                           ↓
          ┌────────────────────────────┐
          │ Acquire Distributed Lock   │
          └────────────────────────────┘
                           ↓
      ┌─────────────────────────────────────┐
      │ Find User in auth.users             │
      │ (auth.admin.listUsers)              │
      └─────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Verify User is Orphaned                      │
    │ (parallel queries: companies, company_admins)│
    └──────────────────────────────────────────────┘
                           ↓
      ┌─────────────────────────────────────┐
      │ Generate 8-Character Code (CSPRNG)  │
      └─────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Hash Code (SHA-256 + 16-byte salt)          │
    └──────────────────────────────────────────────┘
                           ↓
      ┌─────────────────────────────────────┐
      │ Store in verification_codes table   │
      │ (TTL: 5 minutes)                     │
      └─────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Send Email (Resend → SendGrid fallback)     │
    │ Retry: immediate, +1s, +2s                  │
    └──────────────────────────────────────────────┘
                           ↓
      ┌─────────────────────────────────────┐
      │ Log to auth_cleanup_log (pending)   │
      └─────────────────────────────────────┘
                           ↓
          ┌────────────────────────────┐
          │ Release Distributed Lock   │
          └────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Apply Constant-Time Response (500ms ±50ms)  │
    └──────────────────────────────────────────────┘
                           ↓
          ┌────────────────────────────┐
          │ Return Success (200 OK)    │
          └────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Step 2: Validate Code and Delete User                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Check Rate Limits (Global, IP, Email)       │
    └──────────────────────────────────────────────┘
                           ↓
          ┌────────────────────────────┐
          │ Acquire Distributed Lock   │
          └────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Retrieve Stored Hash + Salt from DB          │
    │ (verification_codes table)                   │
    └──────────────────────────────────────────────┘
                           ↓
      ┌─────────────────────────────────────┐
      │ Hash Submitted Code with Stored Salt│
      └─────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Constant-Time Comparison                     │
    │ (compare hashes byte-by-byte)                │
    └──────────────────────────────────────────────┘
                           ↓
      ┌─────────────────────────────────────┐
      │ Find User in auth.users             │
      └─────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Re-Verify User is Still Orphaned             │
    │ (user may have completed registration)       │
    └──────────────────────────────────────────────┘
                           ↓
      ┌─────────────────────────────────────┐
      │ Delete User                          │
      │ (supabase.auth.admin.deleteUser)     │
      └─────────────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Update auth_cleanup_log (completed/failed)   │
    └──────────────────────────────────────────────┘
                           ↓
      ┌─────────────────────────────────────┐
      │ Delete Verification Code from DB     │
      └─────────────────────────────────────┘
                           ↓
          ┌────────────────────────────┐
          │ Release Distributed Lock   │
          └────────────────────────────┘
                           ↓
    ┌──────────────────────────────────────────────┐
    │ Apply Constant-Time Response (500ms ±50ms)  │
    └──────────────────────────────────────────────┘
                           ↓
          ┌────────────────────────────┐
          │ Return Success (200 OK)    │
          └────────────────────────────┘
```

## Request Examples

### Example 1: Request Code (Success)

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: 123e4567-e89b-12d3-a456-426614174000" \
  -d '{
    "step": "request-code",
    "email": "user@example.com"
  }'
```

**Response** (200 OK):
```json
{
  "data": {
    "message": "Verification code sent to email",
    "correlationId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

### Example 2: Validate Code (Success)

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: 123e4567-e89b-12d3-a456-426614174000" \
  -d '{
    "step": "validate-and-cleanup",
    "email": "user@example.com",
    "verificationCode": "ABCD-EFGH"
  }'
```

**Response** (200 OK):
```json
{
  "data": {
    "message": "User deleted successfully",
    "correlationId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

### Example 3: Rate Limited

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -d '{
    "step": "request-code",
    "email": "user@example.com"
  }'
```

**Response** (429 Too Many Requests):
```json
{
  "error": {
    "code": "ORPHAN_CLEANUP_003",
    "message": "Too many requests. Please wait 45 seconds before trying again.",
    "retryAfter": 45
  }
}
```

### Example 4: User Not Orphaned

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-orphaned-user \
  -H "Content-Type: application/json" \
  -d '{
    "step": "request-code",
    "email": "active-user@example.com"
  }'
```

**Response** (409 Conflict):
```json
{
  "error": {
    "code": "ORPHAN_CLEANUP_005",
    "message": "Your account is active. Please log in instead."
  }
}
```

## Frontend Integration

### TypeScript Client Library

```typescript
// src/modules/auth/utils/cleanupOrphanedUser.ts

import { supabase } from '@/core/supabase';
import type { FunctionsError, FunctionsRelayError } from '@supabase/supabase-js';

interface CleanupResult {
  success: boolean;
  message: string;
  correlationId: string;
}

interface CleanupError {
  code: string;
  message: string;
  retryAfter?: number;
}

/**
 * Step 1: Request verification code for cleanup
 */
export async function requestCleanupCode(
  email: string,
  correlationId?: string
): Promise<CleanupResult> {
  const { data, error } = await supabase.functions.invoke('cleanup-orphaned-user', {
    body: {
      step: 'request-code',
      email: email.toLowerCase().trim(),
      correlationId: correlationId ?? crypto.randomUUID(),
    },
    headers: {
      'x-correlation-id': correlationId ?? crypto.randomUUID(),
    },
  });

  if (error) {
    throw parseCleanupError(error);
  }

  return {
    success: true,
    message: data.message,
    correlationId: data.correlationId,
  };
}

/**
 * Step 2: Validate code and delete orphaned user
 */
export async function validateAndCleanup(
  email: string,
  verificationCode: string,
  correlationId?: string
): Promise<CleanupResult> {
  const { data, error } = await supabase.functions.invoke('cleanup-orphaned-user', {
    body: {
      step: 'validate-and-cleanup',
      email: email.toLowerCase().trim(),
      verificationCode,
      correlationId: correlationId ?? crypto.randomUUID(),
    },
    headers: {
      'x-correlation-id': correlationId ?? crypto.randomUUID(),
    },
  });

  if (error) {
    throw parseCleanupError(error);
  }

  return {
    success: true,
    message: data.message,
    correlationId: data.correlationId,
  };
}

/**
 * Parse edge function error into CleanupError
 */
function parseCleanupError(
  error: FunctionsError | FunctionsRelayError
): CleanupError {
  // Handle function relay errors (network, timeout)
  if ('context' in error) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Request timed out. Please try again.',
    };
  }

  // Parse error response
  const errorData = error.context?.error || {};

  return {
    code: errorData.code || 'UNKNOWN_ERROR',
    message: errorData.message || 'An unexpected error occurred',
    retryAfter: errorData.retryAfter,
  };
}
```

## Security Considerations

### Constant-Time Response

All response paths apply constant-time delay to prevent timing attacks:

```typescript
async function applyConstantTimeResponse(
  startTime: number,
  response: Response
): Promise<Response> {
  const TARGET_MS = 500;

  // Gaussian jitter using Box-Muller transform
  const jitter = gaussianRandom(0, 25);

  const elapsed = Date.now() - startTime;
  const delay = Math.max(0, TARGET_MS + jitter - elapsed);

  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return response;
}
```

**Why**: Prevents attackers from determining valid emails, valid codes, or orphan status through response timing analysis.

### Hash Storage

Verification codes are never stored in plaintext:

```typescript
// Generate code
const code = generateSecureCode(); // "ABCDEFGH"

// Hash with random salt
const salt = crypto.getRandomValues(new Uint8Array(16));
const combined = new Uint8Array([...codeBytes, ...salt]);
const hash = await crypto.subtle.digest('SHA-256', combined);

// Store hash + salt, NOT plaintext code
await db.insert({
  email_hash: hashEmail(email),
  code_hash: hash,
  code_salt: salt,
  expires_at: new Date(Date.now() + 300_000), // 5 minutes
});
```

**Why**: Protects codes if database is compromised. Even with access to `verification_codes` table, attacker cannot retrieve original codes.

### Distributed Locking

PostgreSQL advisory locks prevent concurrent cleanup attempts:

```typescript
// Acquire lock (exclusive for this email)
const lockId = hashEmailToInt64(email);
const acquired = await db.query('SELECT pg_try_advisory_lock($1)', [lockId]);

if (!acquired) {
  return {
    error: {
      code: 'ORPHAN_CLEANUP_009',
      message: 'Operation already in progress for this email',
    }
  };
}

try {
  // Perform cleanup operations
  await performCleanup();
} finally {
  // Always release lock
  await db.query('SELECT pg_advisory_unlock($1)', [lockId]);
}
```

**Why**: Prevents race conditions where two requests process the same email simultaneously, causing duplicate emails or conflicting state.

## Monitoring and Observability

### Correlation IDs

Every request should include a correlation ID for end-to-end tracing:

```typescript
const correlationId = crypto.randomUUID();

// Pass in request
await supabase.functions.invoke('cleanup-orphaned-user', {
  headers: { 'x-correlation-id': correlationId },
});

// Logged at every step
console.log('Cleanup initiated', { correlationId });
console.log('Code sent', { correlationId });
console.log('User deleted', { correlationId });
```

### Audit Trail

All operations are logged in `auth_cleanup_log` table:

```sql
SELECT
  correlation_id,
  email_hash,
  status,
  error_code,
  created_at,
  updated_at
FROM auth_cleanup_log
WHERE correlation_id = '123e4567-e89b-12d3-a456-426614174000';
```

### Metrics

Key metrics to monitor:

- **Request Volume**: Requests per hour by step
- **Success Rate**: (completed / total) × 100
- **Error Distribution**: Count by error code
- **Latency**: p50, p95, p99 response times
- **Email Delivery**: Success rate, bounce rate
- **Rate Limit Hits**: Count by tier (global, IP, email)

## Troubleshooting

### User Reports "Code Not Received"

1. Check `auth_cleanup_log` for status='pending'
2. Verify email sent successfully (check ESP logs)
3. Check spam folder
4. Check bounce rate in ESP dashboard
5. Resend code (if >5 minutes expired)

### High Error Rate

1. Query `auth_cleanup_log` for error_code distribution
2. Check for `ORPHAN_CLEANUP_006` (database errors)
3. Check database connection health
4. Check edge function logs in Supabase Dashboard
5. Verify Vault secret is accessible

### Performance Degradation

1. Check orphan detection queries (p95 target: <200ms)
2. Verify indexes exist on `companies(owner_admin_uuid)` and `company_admins(admin_uuid)`
3. Check database connection pool
4. Monitor PostgreSQL slow query log

## Related Documentation

- [check-email-status API](./check-email-status.md) - Email status probe with orphan detection
- [Operational Runbook](../operations/orphan-cleanup-runbook.md) - Monitoring and incident response
- [Email Deliverability Setup](../operations/email-deliverability-setup.md) - SPF, DKIM, DMARC configuration
- [Database Migrations](../deployment/database-migrations.md) - Schema setup
- [Rollback Procedures](../deployment/rollback-procedures.md) - Emergency rollback guide
