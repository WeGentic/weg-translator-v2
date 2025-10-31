# Supabase Health Check Feature

## Overview

The Supabase Health Check feature provides real-time database connectivity monitoring with visual status indicators displayed on both the login page and authenticated workspace footer. This feature helps users and administrators quickly identify database connectivity issues before they attempt operations that require database access.

## Architecture

### Components

The health check system consists of four main components:

1. **Health Check Service** (`src/core/supabase/health.ts`)
   - Performs lightweight connectivity validation using a dedicated `health_check` table
   - Implements timeout handling with Promise.race pattern
   - Tracks query latency for performance monitoring
   - Returns structured health results with status, timestamp, latency, and error details

2. **React Hook** (`src/app/hooks/useSupabaseHealth.ts`)
   - Manages health check lifecycle and state
   - Provides automatic polling for authenticated users
   - Implements race condition prevention using request IDs
   - Handles cleanup on component unmount

3. **UI Component** (`src/shared/components/SupabaseConnectionIndicator.tsx`)
   - Displays color-coded visual status (checking/connected/disconnected)
   - Shows connection latency for connected state
   - Provides accessibility support with ARIA attributes
   - Includes tooltips with extended information

4. **Database Table** (`supabase/migrations/*_health_check.sql`)
   - Dedicated `health_check` table with single row
   - RLS (Row-Level Security) explicitly disabled for unauthenticated access
   - Provides lightweight query target for connectivity validation

### Data Flow

```
Component Mount
    ↓
useSupabaseHealth Hook
    ↓
checkSupabaseHealth Service
    ↓
Supabase Query (SELECT id FROM health_check LIMIT 1)
    ↓
SupabaseHealthResult
    ↓
SupabaseConnectionIndicator Component
    ↓
Visual Status Display
```

## Health Check Query Pattern

### Why Use a Dedicated `health_check` Table?

The health check uses a dedicated table with RLS disabled for several important reasons:

1. **Unauthenticated Access**: The login page needs to check database connectivity before users authenticate. Most tables have RLS enabled, which blocks unauthenticated queries.

2. **Lightweight Query**: The `health_check` table contains a single row with minimal data (`id` field only), making the query extremely fast and efficient.

3. **No Side Effects**: Querying the `health_check` table doesn't expose sensitive data or affect application state.

4. **Dedicated Purpose**: Having a table explicitly designed for health checks makes the intent clear and separates monitoring from business logic.

### Query Implementation

```typescript
// src/core/supabase/health.ts
const { data, error } = await supabase
  .from("health_check")
  .select("id")
  .limit(1)
  .maybeSingle();
```

**Why this query pattern?**
- `select("id")` - Minimal data retrieval (just one integer field)
- `limit(1)` - Only need one row to confirm connectivity
- `maybeSingle()` - Handles case where table might be empty without throwing error

### Timeout Implementation

The health check implements a 3-second timeout to prevent blocking the UI:

```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(new Error(`Health check timeout after ${timeoutMs}ms`));
  }, timeoutMs);
});

await Promise.race([queryPromise, timeoutPromise]);
```

**Why 3 seconds?**
- Long enough for typical database queries under normal network conditions
- Short enough to avoid frustrating users waiting for feedback
- Aligns with industry best practices for health check timeouts

## Polling Strategy

The feature uses different polling strategies depending on authentication state:

### Login Page (Unauthenticated Users)

- **No Polling**: Health check runs once on page mount
- **Rationale**: Users spend minimal time on login page; continuous polling wastes resources
- **User Action**: Manual retry possible if needed (though not implemented in UI)

### Workspace Footer (Authenticated Users)

- **Polling Interval**: 60 seconds (configurable)
- **Rationale**: Provides ongoing monitoring during active work sessions
- **Resource Impact**: Minimal - lightweight query every minute
- **Automatic Cleanup**: Polling stops when user logs out or component unmounts

### Implementation Details

```typescript
// Login page usage (no polling)
const { healthResult, isLoading, error } = useSupabaseHealth({
  pollingInterval: 60000,
  autoStart: true, // Check once on mount, but authenticated-only polling
});

// Workspace footer usage (with polling)
const { healthResult } = useSupabaseHealth({
  pollingInterval: 60000, // Check every 60 seconds
  autoStart: true,
});
```

The hook automatically detects authentication state and only enables polling for authenticated users.

## Accessibility Compliance

The health indicator meets WCAG AA accessibility standards:

### Visual Design

- **Color + Icon + Text**: Uses three methods to convey status
  - Checking: Yellow color + spinning loader icon + "Checking database..."
  - Connected: Green color + checkmark icon + "Connected • XXms"
  - Disconnected: Red color + X icon + "Connection failed"

- **Color Contrast**: All text meets WCAG AA contrast ratios (4.5:1 minimum)

### Semantic HTML

```typescript
<div
  role="status"           // Identifies as a status indicator
  aria-live="polite"      // Announces changes to screen readers
  aria-label={ariaLabel}  // Descriptive label for each state
>
```

### Screen Reader Support

- **Status Updates**: `aria-live="polite"` ensures status changes are announced
- **Descriptive Labels**: Each state has a unique `aria-label`:
  - "Checking database connection"
  - "Database connected with 45 millisecond latency"
  - "Database connection failed: [error message]"
- **Icon Handling**: Icons marked with `aria-hidden="true"` since text provides context

### Tooltips

Extended information provided on hover for additional context without cluttering the main UI.

## Usage Examples

### Basic Component Usage

```tsx
import { SupabaseConnectionIndicator } from '@/shared/components/SupabaseConnectionIndicator';
import { useSupabaseHealth } from '@/app/hooks/useSupabaseHealth';

function MyComponent() {
  const { healthResult } = useSupabaseHealth();

  if (!healthResult) return null;

  return (
    <SupabaseConnectionIndicator
      status={healthResult.status}
      latency={healthResult.latency}
      error={healthResult.error}
    />
  );
}
```

### Custom Polling Interval

```tsx
// Check every 2 minutes instead of default 60 seconds
const { healthResult } = useSupabaseHealth({
  pollingInterval: 120000,
});
```

### Manual Control

```tsx
const { healthResult, retry, startPolling, stopPolling } = useSupabaseHealth({
  autoStart: false, // Don't start automatically
});

// Manually trigger a check
<button onClick={retry}>Check Now</button>

// Start/stop polling dynamically
<button onClick={startPolling}>Start Monitoring</button>
<button onClick={stopPolling}>Stop Monitoring</button>
```

### Service-Level Usage

```typescript
import { checkSupabaseHealth, isHealthy, formatLatency } from '@/core/supabase/health';

// Perform a health check
const result = await checkSupabaseHealth({ timeoutMs: 3000 });

// Check if healthy
if (isHealthy(result)) {
  console.log(`Connected in ${formatLatency(result.latency)}`);
} else {
  console.error(`Connection failed: ${result.error}`);
}
```

## Troubleshooting

### Issue: Health Check Always Shows "Disconnected"

**Possible Causes:**
1. Database is actually unreachable
2. RLS policy blocking the `health_check` table
3. Supabase credentials incorrect or expired
4. Network connectivity issues

**Resolution Steps:**
1. Verify Supabase credentials in environment variables:
   ```bash
   echo $VITE_SUPABASE_URL
   echo $VITE_SUPABASE_ANON_KEY
   ```

2. Check that `health_check` table exists and RLS is disabled:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE tablename = 'health_check';
   -- rowsecurity should be 'false'
   ```

3. Test direct database connectivity:
   ```typescript
   const { data, error } = await supabase
     .from('health_check')
     .select('id')
     .limit(1);
   console.log({ data, error });
   ```

4. Check browser console for detailed error messages from the health service

### Issue: Health Check Timeouts Frequently

**Possible Causes:**
1. Slow network connection
2. Database performance issues
3. Timeout too aggressive (< 3 seconds)

**Resolution Steps:**
1. Increase timeout for slower networks:
   ```typescript
   const result = await checkSupabaseHealth({ timeoutMs: 5000 });
   ```

2. Check database performance in Supabase dashboard (Reports → Performance)

3. Verify network latency using browser DevTools Network tab

4. Review Supabase connection pooling configuration

### Issue: Polling Stops Working After Some Time

**Possible Causes:**
1. Component unmounted (expected behavior)
2. User logged out (expected behavior)
3. JavaScript error breaking the interval
4. Browser tab backgrounded (browser throttling)

**Resolution Steps:**
1. Check browser console for JavaScript errors

2. Verify polling interval is set correctly:
   ```typescript
   useSupabaseHealth({ pollingInterval: 60000 });
   ```

3. Check that component is still mounted:
   - Login page: single check only (no polling)
   - Workspace footer: polling active only when authenticated

4. Review application logs for health check activity:
   ```
   [INFO] Starting Supabase health polling { intervalMs: 60000 }
   [INFO] Supabase health check completed { status: 'connected', latency: 45 }
   ```

### Issue: Health Indicator Not Showing on Login Page

**Possible Causes:**
1. Component not imported/rendered in LoginRoute
2. CSS display issue
3. Health check failing silently

**Resolution Steps:**
1. Verify component is rendered in `src/modules/auth/routes/index.tsx`:
   ```tsx
   <SupabaseConnectionIndicator
     status={healthResult?.status ?? 'checking'}
     latency={healthResult?.latency}
     error={healthResult?.error}
   />
   ```

2. Check element is in DOM using browser DevTools

3. Verify CSS classes are loaded and not conflicting

4. Check browser console for React errors

### Issue: Race Condition - Stale Status Displayed

**Possible Causes:**
1. Multiple health checks running concurrently
2. Request ID tracking not working
3. Component not cleaning up properly

**Resolution Steps:**
1. This should be prevented by the request ID mechanism in the hook
2. Check implementation in `useSupabaseHealth.ts`:
   ```typescript
   const requestId = ++requestIdRef.current;
   // Later...
   if (isMountedRef.current && requestId === requestIdRef.current) {
     setHealthResult(result);
   }
   ```

3. Verify cleanup is happening on unmount:
   ```typescript
   return () => {
     isMountedRef.current = false;
     stopPolling();
   };
   ```

4. Review logs for out-of-order health check completions

### Issue: Accessibility Violations Detected

**Possible Causes:**
1. ARIA attributes missing or incorrect
2. Color contrast issues
3. Missing text alternatives

**Resolution Steps:**
1. Run automated accessibility tests:
   ```bash
   npm run test:a11y
   ```

2. Verify ARIA attributes in rendered HTML:
   ```html
   <div role="status" aria-live="polite" aria-label="...">
   ```

3. Check color contrast ratios using browser DevTools or tools like:
   - Chrome DevTools → Elements → Accessibility
   - axe DevTools browser extension
   - WAVE browser extension

4. Test with screen reader (VoiceOver on macOS, NVDA on Windows)

## Performance Considerations

### Query Performance

- **Baseline**: Health check query should complete in < 100ms under normal conditions
- **Acceptable**: Up to 500ms is acceptable for reasonable user experience
- **Timeout**: 3000ms (3 seconds) hard timeout prevents blocking UI

### Resource Usage

- **Memory**: Minimal - single state object per mounted component
- **Network**: ~1KB per health check request
- **Database Load**: Negligible - simple SELECT query with LIMIT 1
- **Polling Frequency**: 60 seconds balances freshness with resource consumption

### Optimization Tips

1. **Share State**: If multiple components need health status, consider lifting state up or using context to avoid duplicate checks

2. **Conditional Rendering**: Only render indicator when health status is relevant to user

3. **Debounce Manual Retries**: Prevent users from hammering retry button:
   ```typescript
   const debouncedRetry = debounce(retry, 1000);
   ```

4. **Monitor in Production**: Track health check latency and failure rates:
   ```typescript
   logger.info("Health check metrics", {
     latency: result.latency,
     status: result.status,
     timestamp: result.timestamp,
   });
   ```

## Migration Path from health_check Table

If you need to change the health check implementation in the future:

1. **Add new health check method** (e.g., different table, different query)
2. **Update `checkSupabaseHealth` function** to use new method
3. **Test thoroughly** - this is a critical user-facing feature
4. **Deploy with feature flag** to allow rollback if needed
5. **Remove old `health_check` table** after confirming new method works

The `health_check` table can be safely removed if you implement an alternative health check mechanism, as it has no foreign key dependencies and is not used by any other part of the application.

## Related Documentation

- [Supabase Account Schemas](../supabase_account_schemas/account-schemas.md) - Database schema documentation
- [React 19 Guidelines](../../.claude/agents/docs/React_19_guideline.md) - React coding patterns
- [Logging](../../src/core/logging/README.md) - Application logging system

## Testing

The health check feature includes comprehensive test coverage:

- **Unit Tests**: `src/core/supabase/__tests__/health.test.ts`
- **Hook Tests**: `src/app/hooks/__tests__/useSupabaseHealth.test.ts`
- **Component Tests**: `src/shared/components/__tests__/SupabaseConnectionIndicator.test.tsx`
- **Integration Tests**: `src/app/__tests__/health-check-flow.test.tsx`

Run tests with:
```bash
npm test health
```

## Future Enhancements

Potential improvements for future iterations:

1. **Historical Tracking**: Store health check history for trend analysis
2. **Alerting**: Notify administrators when health checks fail repeatedly
3. **Advanced Diagnostics**: Include additional metrics (connection pool status, query queue length)
4. **Custom Thresholds**: Allow users to configure their own timeout and polling intervals
5. **Regional Status**: Show health status for multiple Supabase regions if using geo-distribution
6. **Recovery Suggestions**: Provide actionable suggestions when connectivity fails
