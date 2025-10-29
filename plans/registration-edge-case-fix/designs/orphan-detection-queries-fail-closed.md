# Orphan Detection Queries for Fail-Closed Implementation Design

## Overview

This document specifies the updated orphan detection query pattern with retry logic and fail-closed error handling per UserQA security recommendation.

## Requirements Addressed

- **Req#1**: Orphan Detection Case 1.1
- **Req#2**: Orphan Detection Case 1.2
- **NFR-1**: Performance <200ms p95

## Query Pattern

### Parallel Execution

```typescript
const [companiesResult, adminsResult] = await Promise.all([
  supabase
    .from('companies')
    .select('id')
    .eq('owner_admin_uuid', userId)
    .limit(1),

  supabase
    .from('company_admins')
    .select('admin_uuid')
    .eq('admin_uuid', userId)
    .limit(1),
]);
```

**Rationale**: Parallel queries reduce total latency (100ms + 100ms = ~100ms parallel vs 200ms sequential).

### Required Indexes

```sql
-- Index on companies for orphan detection
CREATE INDEX IF NOT EXISTS idx_companies_owner_admin_uuid
  ON companies(owner_admin_uuid);

-- Index on company_admins for orphan detection
CREATE INDEX IF NOT EXISTS idx_company_admins_admin_uuid
  ON company_admins(admin_uuid);
```

**Performance Impact**:
- Without indexes: Full table scan (~500ms-2s depending on table size)
- With indexes: Index lookup (~5-20ms per query)

## Retry Logic Implementation

### Complete Function

```typescript
interface OrphanCheckResult {
  isOrphaned: boolean;
  hasCompanyData: boolean | null;
  hasAdminData: boolean | null;
  metrics: OrphanDetectionMetrics;
}

interface OrphanDetectionMetrics {
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  queryDurationMs: number;
  attemptCount: number;
  timedOut: boolean;
  hadError: boolean;
}

async function checkIfOrphaned(
  userId: string,
  options: { maxRetries?: number } = {}
): Promise<OrphanCheckResult> {
  const maxRetries = options.maxRetries ?? 3;
  const delays = [0, 200, 500]; // Exponential backoff
  const startedAt = new Date().toISOString();
  const startTime = performance.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Apply backoff delay
    if (attempt > 1) {
      await sleep(delays[attempt - 1]);
    }

    try {
      const queryStartTime = performance.now();

      // Create timeout promise (500ms)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 500)
      );

      // Execute parallel queries with timeout
      const [companiesResult, adminsResult] = await Promise.race([
        Promise.all([
          supabase
            .from('companies')
            .select('id')
            .eq('owner_admin_uuid', userId)
            .limit(1),

          supabase
            .from('company_admins')
            .select('admin_uuid')
            .eq('admin_uuid', userId)
            .limit(1),
        ]),
        timeoutPromise,
      ]);

      const queryDurationMs = performance.now() - queryStartTime;

      // Check for query errors
      if (companiesResult.error && adminsResult.error) {
        throw new Error(
          `Both queries failed: ${companiesResult.error.message}, ${adminsResult.error.message}`
        );
      }

      if (companiesResult.error || adminsResult.error) {
        throw new Error(
          `Partial failure: companies=${companiesResult.error?.message ?? 'ok'}, ` +
          `admins=${adminsResult.error?.message ?? 'ok'}`
        );
      }

      // Extract results
      const hasCompanyData = Boolean(companiesResult.data?.length);
      const hasAdminData = Boolean(adminsResult.data?.length);

      const totalDurationMs = performance.now() - startTime;
      const completedAt = new Date().toISOString();

      // Success - return result
      return {
        isOrphaned: !hasCompanyData && !hasAdminData,
        hasCompanyData,
        hasAdminData,
        metrics: {
          startedAt,
          completedAt,
          totalDurationMs,
          queryDurationMs,
          attemptCount: attempt,
          timedOut: false,
          hadError: false,
        },
      };
    } catch (error) {
      // Log attempt failure
      logger.warn('Orphan detection attempt failed', {
        attempt,
        maxRetries,
        userId: hashUserId(userId),
        error: error.message,
      });

      // If last attempt, throw OrphanDetectionError
      if (attempt === maxRetries) {
        const totalDurationMs = performance.now() - startTime;
        const completedAt = new Date().toISOString();

        throw new OrphanDetectionError(
          'Orphan detection failed after all retry attempts',
          {
            startedAt,
            completedAt,
            totalDurationMs,
            queryDurationMs: 0,
            attemptCount: maxRetries,
            timedOut: error.message === 'Timeout',
            hadError: error.message !== 'Timeout',
          }
        );
      }

      // Continue to next retry
    }
  }

  // Should never reach here
  throw new Error('Unexpected retry loop exit');
}
```

### OrphanDetectionError Class

```typescript
export class OrphanDetectionError extends Error {
  public readonly metrics: OrphanDetectionMetrics;

  constructor(message: string, metrics: OrphanDetectionMetrics) {
    super(message);
    this.name = 'OrphanDetectionError';
    this.metrics = metrics;

    // Preserve prototype chain
    Object.setPrototypeOf(this, OrphanDetectionError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      metrics: this.metrics,
    };
  }
}
```

## Logging Integration

### Success Logging

```typescript
logger.info('Orphan detection completed', {
  userId: hashUserId(userId),
  isOrphaned: result.isOrphaned,
  hasCompanyData: result.hasCompanyData,
  hasAdminData: result.hasAdminData,
  metrics: result.metrics,
});

// Warn if slow (>200ms target)
if (result.metrics.totalDurationMs > 200) {
  logger.warn('Orphan detection exceeded p95 target', {
    userId: hashUserId(userId),
    target: 200,
    actual: result.metrics.totalDurationMs,
    metrics: result.metrics,
  });
}
```

### Failure Logging

```typescript
catch (error) {
  if (error instanceof OrphanDetectionError) {
    logger.error('Orphan detection failed (fail-closed)', {
      userId: hashUserId(userId),
      metrics: error.metrics,
      timedOut: error.metrics.timedOut,
      hadError: error.metrics.hadError,
    });

    // Block login
    await supabase.auth.signOut();

    throw new Error(
      'Authentication system is temporarily unavailable. ' +
      'Please try again in a few minutes. ' +
      'If this persists, contact support.'
    );
  }

  throw error;
}
```

## Performance Optimization

### Query Optimization

**Limit 1**: Both queries use `LIMIT 1` to return immediately after finding first match.

**Index Selection**: Postgres query planner should use indexes:
```sql
EXPLAIN ANALYZE
SELECT id FROM companies WHERE owner_admin_uuid = 'user-uuid' LIMIT 1;

-- Expected plan:
-- Limit  (cost=0.43..8.45 rows=1 width=16)
--   ->  Index Scan using idx_companies_owner_admin_uuid on companies
--       Index Cond: (owner_admin_uuid = 'user-uuid'::uuid)
```

### Caching (Future Enhancement)

**Not Recommended for Initial Implementation**:
- Orphan status can change (user completes registration)
- Cache invalidation complexity
- 500ms timeout + retry is acceptable latency

**If Needed Later**:
```typescript
const cacheKey = `orphan:${userId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const result = await checkIfOrphaned(userId);

// Cache for 30 seconds
await redis.setex(cacheKey, 30, JSON.stringify(result));

return result;
```

## Testing Strategy

### Unit Tests

```typescript
describe('checkIfOrphaned with Retry', () => {
  test('succeeds on first attempt (Case 1.2)', async () => {
    const result = await checkIfOrphaned(userId);

    expect(result.isOrphaned).toBe(true);
    expect(result.metrics.attemptCount).toBe(1);
    expect(result.metrics.timedOut).toBe(false);
  });

  test('succeeds on second attempt after timeout', async () => {
    // Mock: first timeout, second success
    const result = await checkIfOrphaned(userId);

    expect(result.isOrphaned).toBe(false);
    expect(result.metrics.attemptCount).toBe(2);
    expect(result.metrics.timedOut).toBe(false);
  });

  test('throws OrphanDetectionError after all retries timeout', async () => {
    // Mock: all 3 attempts timeout

    await expect(checkIfOrphaned(userId)).rejects.toThrow(OrphanDetectionError);
  });

  test('throws OrphanDetectionError on database error', async () => {
    // Mock: database connection error

    await expect(checkIfOrphaned(userId)).rejects.toThrow(OrphanDetectionError);
  });

  test('logs warning if duration exceeds 200ms', async () => {
    const spy = jest.spyOn(logger, 'warn');

    // Mock slow query (300ms)
    await checkIfOrphaned(userId);

    expect(spy).toHaveBeenCalledWith(
      'Orphan detection exceeded p95 target',
      expect.objectContaining({ target: 200, actual: expect.any(Number) })
    );
  });
});
```

### Integration Tests

```typescript
describe('Orphan Detection Integration', () => {
  test('detects orphaned user (no company, no admin)', async () => {
    const user = await createTestUser();

    const result = await checkIfOrphaned(user.id);

    expect(result.isOrphaned).toBe(true);
    expect(result.hasCompanyData).toBe(false);
    expect(result.hasAdminData).toBe(false);
  });

  test('detects non-orphaned user (has company)', async () => {
    const user = await createTestUser();
    await createTestCompany({ ownerAdminUuid: user.id });

    const result = await checkIfOrphaned(user.id);

    expect(result.isOrphaned).toBe(false);
    expect(result.hasCompanyData).toBe(true);
  });

  test('detects non-orphaned user (has admin record)', async () => {
    const user = await createTestUser();
    await createTestCompanyAdmin({ adminUuid: user.id });

    const result = await checkIfOrphaned(user.id);

    expect(result.isOrphaned).toBe(false);
    expect(result.hasAdminData).toBe(true);
  });
});
```

## Acceptance Criteria

- [x] Parallel query pattern documented with Promise.all
- [x] Required indexes specified (companies.owner_admin_uuid, company_admins.admin_uuid)
- [x] Complete retry logic function with 3 attempts and exponential backoff
- [x] 500ms timeout per attempt
- [x] OrphanDetectionError class for fail-closed behavior
- [x] Comprehensive logging for success and failure cases
- [x] Performance optimization strategies documented
- [x] Testing strategy with unit and integration tests

**Status**: Ready for implementation in Phase 1
