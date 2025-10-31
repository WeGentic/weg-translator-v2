# Supabase Health Check - Visual Reference Guide

## Component Placement Diagrams

### 1. Login Page Indicator Placement

```
┌─────────────────────────────────────────────────────┐
│                    LOGIN PAGE                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│   [Logo]  Tr-entic                                 │
│           Next-Gen Translation Framework           │
│                                                     │
│   ┌──────────────────────────────────────────────┐ │
│   │  Login Form                                  │ │
│   │                                              │ │
│   │  Email:    [________________]                │ │
│   │  Password: [________________] [👁️]           │ │
│   │  ☐ Remember me    [Forgot password?]        │ │
│   │                                              │ │
│   │  [Sign in] (loading spinner)                │ │
│   └──────────────────────────────────────────────┘ │
│                                                     │
│   ─────────────────────────────────────────────    │
│   Create an account for your Organization.         │
│                                                     │
│   [Create a new Account]                           │
│                                                     │
│   ┌─────────────────────────────────────────────┐  │
│   │ NEW: 🟢 Database connected                  │  │
│   │ or   🔴 Database unavailable                │  │
│   │ or   ⏳ Checking connection...               │  │
│   └─────────────────────────────────────────────┘  │
│   ↑                                                 │
│   └── INSERT INDICATOR HERE                        │
│       (Size: Compact, align left)                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. Workspace Footer Indicator Placement

```
┌─────────────────────────────────────────────────────┐
│                   WORKSPACE                         │
│                 (Main Content)                      │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ FOOTER                                              │
├─────────────────────────────────────────────────────┤
│  App: 1.0.0  │ 🟢 Database connected │  [Logs] [X] │
│              │                        │             │
│  Metrics     │  NEW INDICATOR HERE    │  Actions    │
│              │  (Same size as metrics)│             │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   APP INITIALIZATION                    │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌────────┐        ┌──────────┐      ┌───────────┐
   │AppEnter│        │AuthProvider      │useAppHealth
   │        │        │Bootstrap │      │Health Check
   └────────┘        └──────────┘      └───────────┘
                           │                  │
                    ┌──────┴──────┐           │
                    ▼             ▼           ▼
             ┌────────────┐  ┌───────────────────┐
             │Session     │  │AppHealthReport    │
             │State       │  │├─ appVersion      │
             │├─ user     │  │├─ tauriVersion    │
             │├─ token    │  │└─ buildProfile    │
             │└─ roles    │  └───────────────────┘
             └────────────┘

ROUTE PROTECTION (__root.tsx)
├── Public: /login, /register
└── Protected: All others
        │
        └──► isAuthenticated? → Route or Redirect

RENDER COMPONENTS
├── LoginRoute
│   └── ConnectionIndicator (NEW) ← useSupabaseHealth()
│       └── Supabase Health Check
│           └── SELECT COUNT(*) FROM accounts LIMIT 1
│
└── Protected Routes
    └── WorkspaceFooter
        └── ConnectionIndicator (NEW) ← useSupabaseHealth()
            └── Supabase Health Check
```

---

## State Machine: Connection Indicator States

```
                    ┌─────────────┐
                    │   INITIAL   │
                    │  (No data)  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   CHECKING  │ ⏳
                    │ (Loading...)│
                    └──┬───────┬──┘
                      │       │
            ┌─────────┘       └────────┐
            │                          │
            ▼ (after 5s timeout)       ▼ (response)
      ┌──────────────┐          ┌─────────────┐
      │  UNHEALTHY   │          │   SUCCESS   │
      │ 🔴 Database  │          │  (Parse OK) │
      │  unavailable │          └─────┬───────┘
      └──────────────┘                │
            ▲                    ┌─────▼──────┐
            │                    │  HEALTHY   │
            │                    │ 🟢 Database│
            │                    │ connected  │
            │                    └────────────┘
            │                         ▲
            └─────────────────────────┘
             (Retry after delay)
```

---

## Component Hierarchy

```
App
├── AppProviders
│   ├── AuthProvider
│   │   └── useAuth() hook
│   │       └── User auth state
│   │           ├── isAuthenticated
│   │           ├── user
│   │           ├── session
│   │           └── accountUuid
│   │
│   ├── LogProvider
│   │
│   └── Router (TanStack Router)
│       ├── __root.tsx (auth check)
│       │
│       ├── /login route
│       │   └── LoginRoute
│       │       ├── LoginForm
│       │       │   └── useAuth()
│       │       │
│       │       └── ConnectionIndicator (NEW)
│       │           └── useSupabaseHealth()
│       │
│       └── Protected Routes
│           ├── MainLayout
│           │   └── WorkspaceFooter
│           │       ├── useLayoutStoreApi()
│           │       │
│           │       └── ConnectionIndicator (NEW)
│           │           └── useSupabaseHealth()
│           │
│           └── [Other features]

Files to Create:
├── /src/core/supabase/queries/health.ts
├── /src/shared/ui/ConnectionIndicator.tsx
└── /src/app/hooks/useSupabaseHealth.ts

Files to Modify:
├── /src/modules/auth/routes/index.tsx
└── /src/app/shell/main_elements/footer/WorkspaceFooter.tsx
```

---

## Query Execution Flow

```
┌──────────────────────────────────────┐
│ useSupabaseHealth() Hook Trigger     │
│ ├─ Component mounts                  │
│ └─ useEffect dependencies change     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ supabaseHealthCheck() Function        │
│ ├─ generateCorrelationId()           │
│ └─ Start timer                       │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Supabase Query Execution             │
│                                      │
│ SELECT COUNT(*) FROM accounts       │
│ LIMIT 1                             │
│                                      │
│ With error mapping:                 │
│ ├─ Network timeout (5s)             │
│ ├─ RLS policy violation             │
│ ├─ Table not found                  │
│ ├─ Connection refused               │
│ └─ Other DB errors                  │
└────────────┬─────────────────────────┘
             │
        ┌────┴────┐
        │          │
        ▼          ▼
    ┌──────┐   ┌────────┐
    │ OK   │   │ ERROR  │
    └──┬───┘   └───┬────┘
       │           │
       ▼           ▼
   healthy:     error:
   true         mapped
   ─────        ──────
   Return       Return
   {healthy:    {healthy:
    true,        false,
    error:       error:
    null}        msg}
       │           │
       └─────┬─────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Update Component State               │
│ ├─ isHealthy boolean                │
│ ├─ isLoading boolean                │
│ └─ error string | null              │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Render ConnectionIndicator           │
│                                      │
│ if isLoading:                       │
│   ⏳ Checking connection...          │
│                                      │
│ else if isHealthy:                  │
│   🟢 Database connected             │
│                                      │
│ else if error:                      │
│   🔴 Database unavailable           │
│                                      │
│ else:                               │
│   ⚪ Status unknown                 │
└──────────────────────────────────────┘
```

---

## File Dependency Graph

```
                    supabaseClient
                    (/src/core/config)
                           │
                           ▼
                   ┌────────────────┐
                   │ Supabase Auth  │
                   │ Session Mgmt   │
                   └────────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
    AuthProvider    UserQueries        HealthQuery (NEW)
    (Context)       (Queries)          (New File)
        │                   │                   │
        ├─────────┬─────────┘                   │
        │         │                             │
        ▼         ▼                             ▼
    useAuth()  getUserProfile()      useSupabaseHealth()
                                      (New Hook)
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
            LoginRoute           WorkspaceFooter      Other Components
            (modify)             (modify)
                │                    │
                ▼                    ▼
      ConnectionIndicator    ConnectionIndicator
      (New Component)         (Reusable Component)
            │                    │
            └────────┬───────────┘
                     │
                     ▼
            Shared UI Elements
            (Badge, Icon, Tooltip)
```

---

## CSS Layout Reference

### Login Page Indicator

```css
/* Container */
.connection-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin-top: 1rem;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  background-color: rgba(0, 0, 0, 0.05);
}

/* Status Icon */
.connection-indicator__icon {
  width: 1rem;
  height: 1rem;
  animation: pulse 2s infinite;
}

.connection-indicator__icon--healthy {
  color: #22c55e; /* green */
}

.connection-indicator__icon--unhealthy {
  color: #ef4444; /* red */
}

.connection-indicator__icon--checking {
  color: #f59e0b; /* amber */
}

/* Status Text */
.connection-indicator__text {
  font-weight: 500;
  color: #374151;
}

/* Animation */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Footer Metric

```css
/* Follows existing FooterMetric pattern */
.workspace-footer__metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
}

.workspace-footer__metric-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
}

.workspace-footer__metric-value {
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
```

---

## Timing Diagram

```
Time: 0ms         App mounts
      │
      ├─► useEffect triggers
      │   ├─► setIsLoading(true)
      │   └─► Start Supabase query
      │
      ├─► Component renders (loading state shown)
      │   └─► UI: ⏳ Checking connection...
      │
100ms ├─► Still querying...
      │
500ms ├─► Query response received (or timeout approaching)
      │
1000ms├─► Query completes (or timeout)
      │
      ├─► mapSupabaseError() if needed
      ├─► setIsHealthy() or setError()
      ├─► setIsLoading(false)
      │
      └─► Component re-renders with result
          └─► UI: 🟢 Database connected
              OR 🔴 Database unavailable
              OR ⚪ Offline

Total time: ~1000-5000ms depending on network
```

---

## Error Scenarios

```
SCENARIO 1: Network Offline
  ├─ Query times out after 5s
  ├─ Error: "Connection timeout"
  ├─ Display: 🔴 Database unavailable
  └─ Action: Show retry button (optional)

SCENARIO 2: RLS Policy Blocks Query
  ├─ Query succeeds but returns 0 rows
  ├─ Error: "Permission denied" from Supabase
  ├─ Display: 🔴 Database unavailable
  └─ Action: Check auth token is valid

SCENARIO 3: Connection Pool Exhausted
  ├─ Query times out after 5s
  ├─ Error: "Connection pool exhausted"
  ├─ Display: 🔴 Database unavailable
  └─ Action: User should retry later

SCENARIO 4: Database Down
  ├─ Query times out or connection refused
  ├─ Error: "Connection refused"
  ├─ Display: 🔴 Database unavailable
  └─ Action: Show "Service unavailable" message

SCENARIO 5: Successful Connection
  ├─ Query returns COUNT(*) > 0 or = 0
  ├─ Success: Connection established
  ├─ Display: 🟢 Database connected
  └─ Action: Proceed normally
```

---

## Browser DevTools Inspection Guide

### Check Health Query Results

```javascript
// In Browser Console:

// Get current auth session
const { data } = await supabase.auth.getSession();
console.log('Session:', data);

// Test health query manually
const { data, error } = await supabase
  .from('accounts')
  .select('COUNT(*)', { count: 'exact' })
  .limit(1);

if (error) {
  console.error('Health check failed:', error);
} else {
  console.log('Health check passed:', data);
}
```

### Monitor Hook Execution

```javascript
// React DevTools: Look for useSupabaseHealth() hook state
- isHealthy: boolean
- isLoading: boolean
- error: string | null

// Check re-renders in Profiler
- Mount: Initial data fetch
- Update: When query completes
- Unmount: Cleanup
```

---

## Performance Targets

```
Operation                 Target      Acceptable    Max
─────────────────────────────────────────────────────────
Health check query       <100ms       <500ms        5000ms
Hook initialization      <50ms        <200ms        1000ms
Component render         <16ms        <50ms         100ms
Indicator display        Instant      <100ms        500ms
─────────────────────────────────────────────────────────

Budget: Keep total < 500ms to not impact perceived app startup
```

---

## Testing Checklist

```
FUNCTIONAL
✓ Indicator appears on login page
✓ Indicator appears in footer
✓ Shows checking state during query
✓ Shows healthy when database is accessible
✓ Shows unhealthy when database is unreachable
✓ Respects RLS policies
✓ Handles query timeout gracefully

EDGE CASES
✓ Offline network (query times out)
✓ Slow network (query takes >5s)
✓ User closes browser during query
✓ Component unmounts during query
✓ Multiple queries in flight
✓ RLS blocks query for unauthenticated user

PERFORMANCE
✓ Query completes in <500ms
✓ Doesn't block app initialization
✓ Doesn't cause layout shift
✓ No memory leaks on unmount
✓ No infinite loops

UI/UX
✓ Styling matches existing components
✓ Text is user-friendly (no technical jargon)
✓ Responsive on mobile
✓ Accessible (ARIA labels, colors)
✓ Colors are accessible (contrast ratio)
```

---

