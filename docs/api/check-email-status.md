# check-email-status Edge Function API

## Overview

The `check-email-status` edge function provides real-time email registration status checking with orphan detection capabilities. It enables the registration form to detect existing accounts (both complete and orphaned) and guide users to the appropriate recovery flow.

**Version**: 2.0 (Enhanced with orphan detection)
**Endpoint**: `POST /functions/v1/check-email-status`
**Authentication**: Optional (uses anon key or session token)
**Rate Limiting**: Yes

## What's New in v2.0

- ✨ **Orphan Detection**: Returns `isOrphaned` and `hasCompanyData` flags
- ✨ **Graceful Degradation**: Returns `null` for flags when queries fail (non-blocking)
- ✨ **Attempt Tracking**: Optional `attemptId` for retry correlation
- 🔧 **Improved Performance**: Parallel queries with 100ms timeout
- 🔧 **Better Error Handling**: Detailed error responses with retry guidance

## Request Format

```typescript
{
  "email": "user@example.com",
  "attemptId": "123e4567-e89b-12d3-a456-426614174000" // Optional UUID v4
}
```

### Request Schema (Zod)

```typescript
import { z } from 'zod';

const requestSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .transform(s => s.toLowerCase().trim()),
  attemptId: z.string().uuid().optional(),
});

type EmailStatusRequest = z.infer<typeof requestSchema>;
```

## Response Format

```typescript
{
  "status": "not_registered" | "registered_verified" | "registered_unverified",
  "verifiedAt": string | null,          // ISO timestamp or null
  "lastSignInAt": string | null,         // ISO timestamp or null
  "hasCompanyData": boolean | null,      // null if query failed
  "isOrphaned": boolean | null,          // null if query failed/timed out
  "attemptId": string | undefined,       // UUID if provided in request
  "correlationId": string                // UUID for tracing
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"not_registered"` \| `"registered_verified"` \| `"registered_unverified"` | Email registration status |
| `verifiedAt` | `string \| null` | ISO timestamp when email was verified, or null if unverified |
| `lastSignInAt` | `string \| null` | ISO timestamp of last sign-in, or null if never signed in |
| `hasCompanyData` | `boolean \| null` | **NEW**: True if user has company records, false if not, null if query failed |
| `isOrphaned` | `boolean \| null` | **NEW**: True if user is orphaned (no company data), false if not, null if query failed/timed out |
| `attemptId` | `string \| undefined` | Echoed from request if provided, for retry tracking |
| `correlationId` | `string` | UUID for end-to-end tracing |

## Status Classification

### not_registered

User email does not exist in `auth.users` table.

**Response**:
```json
{
  "status": "not_registered",
  "verifiedAt": null,
  "lastSignInAt": null,
  "hasCompanyData": null,
  "isOrphaned": null,
  "correlationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**UI Action**: Allow registration, show success indicator.

### registered_verified (Not Orphaned)

User exists, email verified, has company data (complete registration).

**Response**:
```json
{
  "status": "registered_verified",
  "verifiedAt": "2024-01-15T10:30:00.000Z",
  "lastSignInAt": "2024-01-20T08:15:00.000Z",
  "hasCompanyData": true,
  "isOrphaned": false,
  "correlationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**UI Action**: Block registration, show "Email already registered. [Log in instead]" message.

### registered_verified (Orphaned - Case 1.2)

User exists, email verified, but no company data (incomplete registration).

**Response**:
```json
{
  "status": "registered_verified",
  "verifiedAt": "2024-01-15T10:30:00.000Z",
  "lastSignInAt": null,
  "hasCompanyData": false,
  "isOrphaned": true,
  "correlationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**UI Action**: Show recovery options:
- "Complete Registration" → Navigate to recovery route
- "Start Fresh" → Initiate cleanup flow

### registered_unverified (Orphaned - Case 1.1)

User exists, email unverified, no company data (incomplete registration).

**Response**:
```json
{
  "status": "registered_unverified",
  "verifiedAt": null,
  "lastSignInAt": null,
  "hasCompanyData": false,
  "isOrphaned": true,
  "correlationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**UI Action**: Show verification options:
- "Resend Verification Email" → Call `supabase.auth.resend()`
- "Resume Verification" → Navigate to registration with polling

### Graceful Degradation (Query Failed)

If company data queries timeout or error, returns null values.

**Response**:
```json
{
  "status": "registered_verified",
  "verifiedAt": "2024-01-15T10:30:00.000Z",
  "lastSignInAt": "2024-01-20T08:15:00.000Z",
  "hasCompanyData": null,
  "isOrphaned": null,
  "correlationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**UI Action**: Allow registration to proceed (backend will validate uniqueness).

## Orphan Detection Logic

The function queries two tables in parallel to determine orphan status:

```typescript
async function checkOrphanStatus(userId: string): Promise<{
  hasCompanyData: boolean | null;
  isOrphaned: boolean | null;
}> {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 100) // 100ms timeout
    );

    const [companiesResult, adminsResult] = await Promise.race([
      Promise.all([
        supabase.from('companies').select('id').eq('owner_admin_uuid', userId).limit(1),
        supabase.from('company_admins').select('admin_uuid').eq('admin_uuid', userId).limit(1),
      ]),
      timeoutPromise,
    ]);

    const hasCompanyData = Boolean(companiesResult.data?.length) ||
                           Boolean(adminsResult.data?.length);

    return {
      hasCompanyData,
      isOrphaned: !hasCompanyData,
    };
  } catch (error) {
    // Graceful degradation: return null if query fails
    console.warn('Orphan detection failed', { userId, error });

    return {
      hasCompanyData: null,
      isOrphaned: null,
    };
  }
}
```

### Query Performance

- **Target**: <100ms for company data queries (p95)
- **Timeout**: 100ms hard timeout to prevent blocking
- **Parallelization**: Both queries execute simultaneously
- **Indexes Required**:
  - `companies(owner_admin_uuid)`
  - `company_admins(admin_uuid)`

### Graceful Degradation Policy

**When queries fail or timeout**:
- Set `hasCompanyData = null`
- Set `isOrphaned = null`
- Log warning with correlation ID
- Return response (don't block user)
- UI allows registration to proceed
- Backend validates email uniqueness

**Why**: Non-critical query failures should not block user registration. Backend has final say on email uniqueness.

## Rate Limiting

Uses PostgreSQL-based sliding window rate limiting:

| Tier | Limit | Window | Scope |
|------|-------|--------|-------|
| **Global** | 1000 requests | 60 seconds | All requests |
| **Per-IP** | 10 requests | 60 seconds | Source IP address |

### Rate Limit Response (429)

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait 30 seconds before trying again.",
    "retryAfter": 30
  }
}
```

**Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1677649200
Retry-After: 30
```

## Request Examples

### Example 1: Email Not Registered

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-email-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "newuser@example.com"
  }'
```

**Response** (200 OK):
```json
{
  "status": "not_registered",
  "verifiedAt": null,
  "lastSignInAt": null,
  "hasCompanyData": null,
  "isOrphaned": null,
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Example 2: Registered + Verified + Not Orphaned

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-email-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "activeuser@example.com",
    "attemptId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Response** (200 OK):
```json
{
  "status": "registered_verified",
  "verifiedAt": "2024-01-15T10:30:00.000Z",
  "lastSignInAt": "2024-01-20T08:15:00.000Z",
  "hasCompanyData": true,
  "isOrphaned": false,
  "attemptId": "123e4567-e89b-12d3-a456-426614174000",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Example 3: Registered + Verified + Orphaned (Case 1.2)

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-email-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "orphaned@example.com"
  }'
```

**Response** (200 OK):
```json
{
  "status": "registered_verified",
  "verifiedAt": "2024-01-15T10:30:00.000Z",
  "lastSignInAt": null,
  "hasCompanyData": false,
  "isOrphaned": true,
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Example 4: Registered + Unverified + Orphaned (Case 1.1)

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-email-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "unverified@example.com"
  }'
```

**Response** (200 OK):
```json
{
  "status": "registered_unverified",
  "verifiedAt": null,
  "lastSignInAt": null,
  "hasCompanyData": false,
  "isOrphaned": true,
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Example 5: Query Timeout (Graceful Degradation)

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-email-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "email": "slowquery@example.com"
  }'
```

**Response** (200 OK):
```json
{
  "status": "registered_verified",
  "verifiedAt": "2024-01-15T10:30:00.000Z",
  "lastSignInAt": "2024-01-20T08:15:00.000Z",
  "hasCompanyData": null,
  "isOrphaned": null,
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Note**: UI allows registration to proceed despite null orphan status.

## Frontend Integration

### React Hook: useEmailStatusProbe

```typescript
// src/modules/auth/hooks/controllers/useEmailStatusProbe.ts

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { supabase } from '@/core/supabase';

interface EmailStatusProbeOptions {
  email: string;
  attemptId?: string;
  enabled?: boolean;
  debounceMs?: number;
}

interface EmailStatusResult {
  status: 'not_registered' | 'registered_verified' | 'registered_unverified';
  verifiedAt: string | null;
  lastSignInAt: string | null;
  hasCompanyData: boolean | null;
  isOrphaned: boolean | null;
  attemptId?: string;
  correlationId: string;
}

export function useEmailStatusProbe(options: EmailStatusProbeOptions) {
  const { email, attemptId, enabled = true, debounceMs = 450 } = options;

  const [state, dispatch] = useReducer(probeReducer, {
    phase: 'idle',
    result: null,
    error: null,
  });

  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map<string, { result: EmailStatusResult; timestamp: number }>());
  const abortControllerRef = useRef<AbortController | null>(null);

  const probe = useCallback(async (emailToProbe: string, signal: AbortSignal) => {
    if (!emailToProbe || !enabled) return;

    const normalizedEmail = emailToProbe.toLowerCase().trim();

    // Check cache (2-minute TTL)
    const cached = cacheRef.current.get(normalizedEmail);
    if (cached && Date.now() - cached.timestamp < 120_000) {
      dispatch({ type: 'probe-success', result: cached.result });
      return;
    }

    dispatch({ type: 'probe-start' });

    const requestId = ++requestIdRef.current;
    const correlationId = crypto.randomUUID();

    try {
      const { data, error } = await supabase.functions.invoke('check-email-status', {
        body: { email: normalizedEmail, attemptId },
        headers: { 'x-correlation-id': correlationId },
      });

      // Ignore stale responses
      if (requestId !== requestIdRef.current || signal.aborted) return;

      if (error) {
        dispatch({ type: 'probe-error', error });
        return;
      }

      // Cache result
      cacheRef.current.set(normalizedEmail, {
        result: data,
        timestamp: Date.now(),
      });

      dispatch({ type: 'probe-success', result: data });
    } catch (error) {
      if (requestId === requestIdRef.current && !signal.aborted) {
        dispatch({ type: 'probe-error', error });
      }
    }
  }, [enabled, attemptId]);

  // Debounced effect
  useEffect(() => {
    if (!email || !enabled) return;

    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const controller = abortControllerRef.current;
    const timer = setTimeout(() => {
      probe(email, controller.signal);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [email, enabled, debounceMs, probe]);

  return {
    phase: state.phase,
    result: state.result,
    error: state.error,
    forceCheck: () => {
      cacheRef.current.delete(email.toLowerCase().trim());
      probe(email, new AbortController().signal);
    },
  };
}
```

### EmailStatusBanner Component

```typescript
// src/modules/auth/components/forms/EmailStatusBanner.tsx

interface EmailStatusBannerProps {
  probe: ReturnType<typeof useEmailStatusProbe>;
}

export function EmailStatusBanner({ probe }: EmailStatusBannerProps) {
  const navigate = useNavigate();

  if (probe.phase === 'loading') {
    return (
      <Alert variant="info">
        <Spinner className="h-4 w-4" />
        <AlertDescription>Checking email status…</AlertDescription>
      </Alert>
    );
  }

  if (probe.phase === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Unable to check email status. {probe.error?.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (probe.phase !== 'success' || !probe.result) return null;

  const { status, isOrphaned, hasCompanyData } = probe.result;

  // Case: Not registered (good to proceed)
  if (status === 'not_registered') {
    return (
      <Alert variant="success">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>You're good to go.</AlertDescription>
      </Alert>
    );
  }

  // Case: Registered + Verified + Orphaned (Case 1.2)
  if (status === 'registered_verified' && isOrphaned === true) {
    return (
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Registration incomplete - email verified</AlertTitle>
        <AlertDescription>
          Your email is verified but your organization setup is incomplete.
        </AlertDescription>
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            onClick={() =>
              navigate({
                to: '/register/recover',
                search: {
                  email: probe.result.email,
                  reason: 'orphaned',
                  correlationId: probe.result.correlationId,
                },
              })
            }
          >
            Complete Registration
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await requestCleanupCode(probe.result.email, crypto.randomUUID());
              navigate({
                to: '/register/recover',
                search: { email: probe.result.email, reason: 'cleanup-initiated' },
              });
            }}
          >
            Start Fresh
          </Button>
        </div>
      </Alert>
    );
  }

  // Case: Registered + Unverified + Orphaned (Case 1.1)
  if (status === 'registered_unverified' && isOrphaned === true) {
    return (
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Incomplete registration detected</AlertTitle>
        <AlertDescription>
          Your email needs verification to complete registration.
        </AlertDescription>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={() => resendVerification(probe.result.email)}>
            Resend Verification Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigate({
                to: '/register',
                search: { email: probe.result.email, resumeVerification: true },
              })
            }
          >
            Resume Verification
          </Button>
        </div>
      </Alert>
    );
  }

  // Case: Registered + Not Orphaned (has company data)
  if (status === 'registered_verified' && isOrphaned === false) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>This email already has access</AlertTitle>
        <AlertDescription>
          Please log in with your existing account.
        </AlertDescription>
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            onClick={() => navigate({ to: '/login', search: { email: probe.result.email } })}
          >
            Log In
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: '/recover' })}>
            Recover Password
          </Button>
        </div>
      </Alert>
    );
  }

  // Case: Query failed (graceful degradation)
  if (isOrphaned === null || hasCompanyData === null) {
    return (
      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Unable to verify account status. You may proceed with registration.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
```

## Monitoring and Troubleshooting

### Key Metrics

- **Request Volume**: Requests per hour
- **Status Distribution**: Count by status (not_registered, registered_verified, registered_unverified)
- **Orphan Detection Rate**: Percentage with isOrphaned=true
- **Query Performance**: p50, p95, p99 for company data queries
- **Graceful Degradation Rate**: Percentage with isOrphaned=null
- **Rate Limit Hits**: Count by tier (global, IP)

### Common Issues

**High Graceful Degradation Rate (>5%)**:
- Check database query performance
- Verify indexes exist on `companies(owner_admin_uuid)` and `company_admins(admin_uuid)`
- Consider increasing timeout from 100ms to 200ms

**Slow Response Times**:
- Check `auth.users` query performance (uses email filter)
- Verify edge function cold start times
- Monitor database connection pool

**False Orphan Detection**:
- Verify company data is written atomically during registration
- Check for race conditions in registration flow
- Query `auth_cleanup_log` for patterns

## Related Documentation

- [cleanup-orphaned-user API](./cleanup-orphaned-user.md) - Secure cleanup operations
- [Operational Runbook](../operations/orphan-cleanup-runbook.md) - Monitoring and incident response
- [Database Migrations](../deployment/database-migrations.md) - Schema setup
