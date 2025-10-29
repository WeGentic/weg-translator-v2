# Fail-Closed Graceful Degradation Policy Design

## Overview

This document specifies the fail-closed security policy for orphan detection failures. This **replaces the original fail-open design** (allow login on timeout) with a secure fail-closed approach (block login on timeout) per UserQA security recommendation.

## Requirements Addressed

- **Req#2**: Orphan Detection Case 1.2
- **Req#4**: Enhanced Login Flow
- **NFR-21**: Edge function errors non-blocking (REVISED - now blocking for security)

## Policy Statement

**Primary Principle**: When orphan detection cannot complete successfully, **BLOCK access** rather than allow it.

**Rationale**: Security over availability. A brief service disruption is preferable to allowing unauthorized access by orphaned accounts.

## Decision Tree

```
┌─────────────────────────────────┐
│   Orphan Detection Initiated    │
└───────────┬─────────────────────┘
            │
            ▼
    ┌───────────────┐
    │  Try Attempt  │
    │   (max: 3)    │
    └───────┬───────┘
            │
   ┌────────┴────────┐
   │                 │
   ▼                 ▼
SUCCESS         TIMEOUT/ERROR
   │                 │
   ▼                 ▼
 Check           More Attempts?
 Result              │
   │            ┌────┴────┐
   │            │         │
   ▼            ▼         ▼
Is Orphaned?   YES       NO
   │            │         │
┌──┴──┐        │         │
│     │        │         │
▼     ▼        ▼         ▼
YES   NO     Retry    BLOCK LOGIN
│     │      with     │
│     │      Backoff  │
│     │        │      │
▼     ▼        │      ▼
Redirect  Allow  ◄───┘  Show Error
to Recovery Login         Message
```

## Retry Strategy

### Parameters

- **Max Attempts**: 3
- **Timeout Per Attempt**: 500ms
- **Backoff Delays**: [0ms, 200ms, 500ms] (exponential)
- **Total Maximum Duration**: 1.7 seconds (0 + 500 + 200 + 500 + 500 + 500)

### Implementation

```typescript
async function checkIfOrphanedWithRetry(
  userId: string,
  maxRetries: number = 3
): Promise<OrphanCheckResult> {
  const delays = [0, 200, 500]; // Exponential backoff

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Apply backoff delay (except first attempt)
      if (attempt > 1) {
        await sleep(delays[attempt - 1]);
      }

      // Attempt orphan detection with 500ms timeout
      const result = await Promise.race([
        performOrphanCheck(userId),
        createTimeoutPromise(500),
      ]);

      // Success - return result
      return result;
    } catch (error) {
      // Log failure
      logger.warn('Orphan detection attempt failed', {
        attempt,
        maxRetries,
        error: error.message,
        userId: hashUserId(userId),
      });

      // If last attempt, throw error
      if (attempt === maxRetries) {
        throw new OrphanDetectionError(
          'Orphan detection failed after all retry attempts',
          { attemptCount: maxRetries, lastError: error }
        );
      }

      // Otherwise, continue to next retry
    }
  }

  // Should never reach here
  throw new Error('Unexpected retry loop exit');
}
```

## Failure Scenarios

### Scenario 1: Database Timeout

**Cause**: Companies/company_admins queries exceed 500ms

**Response**:
1. Log timeout event with correlation ID
2. Retry with backoff (2 more attempts)
3. If all attempts timeout: **Block login**

**User Message**:
> "Authentication system is temporarily unavailable. Please try again in a few minutes. If this persists, contact support."

### Scenario 2: Database Error

**Cause**: Postgres connection failure, query error, index missing

**Response**:
1. Log error with full stack trace
2. Retry with backoff (2 more attempts)
3. If all attempts error: **Block login**

**User Message**: Same as Scenario 1

### Scenario 3: Partial Query Failure

**Cause**: One query (companies OR company_admins) fails, other succeeds

**Response**:
1. Log partial failure
2. **Consider result invalid** (treat as total failure)
3. Retry with backoff
4. If all attempts fail: **Block login**

**Rationale**: Cannot determine orphan status with partial data.

### Scenario 4: Network Partition

**Cause**: Edge function cannot reach Postgres

**Response**:
1. Retry attempts will all fail
2. **Block login after all retries**

**Rationale**: Network partition is infrastructure failure; prioritize security.

## Timeout Calculation

### Per-Attempt Timeout

**500ms per attempt**:
- p95 target: 200ms
- p99 target: 350ms
- 500ms provides generous margin (42% above p99)

### Total Maximum Duration

**1.7 seconds**:
- Attempt 1: 0ms delay + 500ms query = 500ms
- Attempt 2: 200ms delay + 500ms query = 700ms
- Attempt 3: 500ms delay + 500ms query = 1000ms
- **Total**: 500 + 700 + 1000 = **2200ms = 2.2 seconds**

*Correction: Original calculation was wrong. Actual total is 2.2s, not 1.7s.*

**User Impact**: 2.2-second delay is acceptable for security-critical operation.

## Error Messages

### Technical Error (Logged)

```typescript
{
  level: 'error',
  message: 'Orphan detection failed after all retry attempts',
  correlationId: '<uuid>',
  userId: '<hashed>',
  attemptCount: 3,
  errors: [
    { attempt: 1, error: 'Timeout after 500ms', duration: 502 },
    { attempt: 2, error: 'Timeout after 500ms', duration: 501 },
    { attempt: 3, error: 'Timeout after 500ms', duration: 503 },
  ],
  totalDuration: 2206,
}
```

### User-Facing Error

```typescript
const ERROR_MESSAGE = {
  title: 'Service Temporarily Unavailable',
  description:
    'Our authentication system is experiencing temporary issues. ' +
    'Please try again in a few minutes. ' +
    'If this problem persists, please contact support with reference ID: ${correlationId}',
  variant: 'error',
  duration: 10000, // 10 seconds
};
```

**Key Elements**:
- Non-technical language
- Actionable guidance (try again, contact support)
- Reference ID for support tickets (correlation ID)
- No security-sensitive details

## Monitoring and Alerting

### Metrics to Track

```typescript
interface OrphanDetectionMetrics {
  // Success rate
  successRate: number; // %
  timeoutRate: number; // %
  errorRate: number; // %

  // Performance
  p50Duration: number; // ms
  p95Duration: number; // ms
  p99Duration: number; // ms

  // Retries
  avgRetriesPerCheck: number;
  checksRequiringRetries: number; // %

  // Failures
  totalBlocked: number;
  blockedDueToTimeout: number;
  blockedDueToError: number;
}
```

### Alert Thresholds

```typescript
const ALERT_THRESHOLDS = {
  // Performance degradation
  p95ExceedsTarget: {
    condition: 'p95Duration > 400ms',
    severity: 'warning',
    action: 'Investigate slow queries',
  },

  // High timeout rate
  timeoutRateHigh: {
    condition: 'timeoutRate > 5%',
    severity: 'critical',
    action: 'Check database health, increase timeout if needed',
  },

  // High error rate
  errorRateHigh: {
    condition: 'errorRate > 1%',
    severity: 'critical',
    action: 'Check database connectivity and query errors',
  },

  // Users being blocked
  blockRateHigh: {
    condition: 'totalBlocked > 10 per minute',
    severity: 'critical',
    action: 'Consider temporarily disabling orphan detection if outage confirmed',
  },
};
```

### Dashboard Queries

```sql
-- Recent orphan detection failures
SELECT
  DATE_TRUNC('minute', timestamp) AS minute,
  COUNT(*) FILTER (WHERE status = 'timeout') AS timeouts,
  COUNT(*) FILTER (WHERE status = 'error') AS errors,
  COUNT(*) FILTER (WHERE status = 'success') AS successes,
  AVG(duration_ms) AS avg_duration
FROM orphan_detection_log
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute DESC;
```

## Exception: Email Verification

**Email verification check failure is NOT subject to fail-closed retry**:
- Supabase auth verification is upstream (before orphan detection)
- If user's email is not verified (email_confirmed_at = null), login is blocked immediately
- **No retry attempts** for email verification (single check)

**Rationale**: Email verification is a hard requirement; no retry needed.

## Rollback Mechanism

If fail-closed policy causes widespread login failures due to infrastructure issues:

### Emergency Rollback

```typescript
// Feature flag in environment
const ENABLE_FAIL_CLOSED = Deno.env.get('ENABLE_FAIL_CLOSED') !== 'false';

if (!ENABLE_FAIL_CLOSED) {
  // Fallback to fail-open (log but allow login)
  logger.warn('Fail-closed disabled, using fail-open fallback');

  try {
    const result = await checkIfOrphaned(userId, { maxRetries: 1 });
    // Process result if successful
  } catch (error) {
    logger.error('Orphan detection failed (fail-open mode)', { error });
    // ALLOW LOGIN (fail-open)
    return { orphanDetectionFailed: true };
  }
}
```

**Procedure**:
1. Set `ENABLE_FAIL_CLOSED=false` in environment
2. Redeploy edge functions (or restart if hot-reloadable)
3. Monitor error rates
4. Investigate root cause
5. Re-enable (`ENABLE_FAIL_CLOSED=true`) after fix

## Testing

### Unit Tests

```typescript
describe('Fail-Closed Policy', () => {
  test('allows login on successful orphan check', async () => {
    const result = await checkIfOrphanedWithRetry(userId);
    expect(result.isOrphaned).toBe(false);
    // Login should proceed
  });

  test('blocks login on timeout after all retries', async () => {
    // Mock all 3 attempts to timeout
    await expect(
      checkIfOrphanedWithRetry(userId)
    ).rejects.toThrow(OrphanDetectionError);
    // Login should be blocked
  });

  test('blocks login on error after all retries', async () => {
    // Mock all 3 attempts to error
    await expect(
      checkIfOrphanedWithRetry(userId)
    ).rejects.toThrow(OrphanDetectionError);
    // Login should be blocked
  });

  test('succeeds on second retry attempt', async () => {
    // Mock: first attempt timeout, second attempt success
    const result = await checkIfOrphanedWithRetry(userId);
    expect(result.isOrphaned).toBe(false);
    expect(result.metrics.attemptCount).toBe(2);
  });
});
```

### Integration Tests

```typescript
describe('Login Flow with Fail-Closed', () => {
  test('user login succeeds when orphan check succeeds', async () => {
    const result = await loginUser(email, password);
    expect(result.success).toBe(true);
    expect(result.isAuthenticated).toBe(true);
  });

  test('user login blocked when orphan check times out', async () => {
    // Simulate database slowness
    await expect(
      loginUser(email, password)
    ).rejects.toThrow('Service Temporarily Unavailable');

    // Verify user is NOT logged in
    expect(authState.isAuthenticated).toBe(false);
  });

  test('error message shown to user on failure', async () => {
    await loginUser(email, password).catch(() => {});

    expect(screen.getByText(/Service Temporarily Unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/contact support/)).toBeInTheDocument();
  });
});
```

## Acceptance Criteria

- [x] Fail-closed policy documented: block login on detection failure
- [x] Retry strategy specified: 3 attempts with exponential backoff (0ms, 200ms, 500ms)
- [x] Timeout per attempt: 500ms
- [x] Total maximum duration: 2.2 seconds
- [x] Error messages documented (technical logs + user-facing)
- [x] Exception documented: email verification is not retried
- [x] Monitoring metrics and alert thresholds specified
- [x] Rollback mechanism documented (ENABLE_FAIL_CLOSED feature flag)
- [x] Testing strategy provided

**Status**: Ready for implementation in Phase 1
