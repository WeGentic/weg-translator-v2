# Supabase Health Check - Codebase Analysis

**Request Subject:** supabase-health-check

**User Request:** Add a Supabase health check when the app loads, verify the database is healthy and working. Display a small connection indicator below the "Create a new Account" button in the Login page, and add the same element in the footer for logged-in users.

**Analysis Scope:** Examined Supabase client setup, authentication flow, login page structure, footer components, existing health check patterns, app initialization, state management, UI component architecture, and database schema documentation.

---

## 1. Supabase Integration Overview

### 1.1 Supabase Client Setup

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/config/supabaseClient.ts`

The Supabase client is configured with:
- URL from `VITE_SUPABASE_URL` environment variable
- Publishable key from `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Session persistence enabled
- Auto-refresh token enabled
- Session detection in URL enabled
- Storage key: `"weg-translator-auth"`

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

The client is exported as a singleton and used throughout the app via `import { supabase } from '@/core/config'`.

### 1.2 Authentication Provider

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/app/providers/auth/AuthProvider.tsx`

Key features:
- Uses React Context API for auth state management
- Provides `useAuth()` hook for component access
- Implements session bootstrap on app startup (lines 239-274)
- Handles JWT token extraction with fallback queries for account context (lines 84-174)
- Includes orphan user detection during login flow
- Maps Supabase user to application User type with account_uuid and role enrichment

**Auth Context provides:**
- `user: User | null`
- `isAuthenticated: boolean`
- `session: Session | null`
- `accountUuid: string | null`
- `userRole: UserRole | null`
- `hasActiveSubscription: boolean`
- `trialEndsAt: string | null`
- `daysRemaining: number | null`
- `login()` / `logout()` methods
- `isLoading: boolean`

---

## 2. Login Page Structure

### 2.1 Login Route Component

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/auth/routes/index.tsx`

The login page is a TanStack Router file-based route that renders:
- Brand section with logo and title (lines 48-61)
- `LoginForm` component (line 63)
- "Create a new Account" button at line 75-78:
  ```tsx
  <Link
    to="/register"
    preload="intent"
    onClick={handleNavigateToRegister}
    aria-label="Navigate to registration page"
    className={cn(buttonVariants({ variant: "default", size: "lg" }), "login-page__toggle-button mb-6")}
  >
    Create a new Account
  </Link>
  ```

**Location to add indicator:** Below the "Create a new Account" button (after line 78) would be the ideal placement for the Supabase connection indicator.

### 2.2 LoginForm Component

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/auth/components/LoginForm.tsx`

The form component:
- Uses `useAuth()` hook to access login method
- Implements client-side validation
- Shows loading state during login
- Handles password visibility toggle
- Routes authenticated users to either "/" or a redirect URL

---

## 3. Footer Component for Logged-in Users

### 3.1 WorkspaceFooter Component

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/app/shell/main_elements/footer/WorkspaceFooter.tsx`

Current implementation (lines 1-70):
- Displays app health metrics (app version)
- Has toggle for logger expansion
- Shows "Hide footer" button
- Uses Zustand store for layout state management

**Integration points:**
- Line 5: Accepts `health: AppHealthReport | null` as prop
- Lines 41: Displays `health?.appVersion ?? "—"`
- Line 4: Uses `useLayoutStoreApi()` to manage footer visibility and height

**Ideal location for Supabase indicator:** In the `workspace-footer__metrics` div (around line 40-42) alongside the existing app version metric.

### 3.2 Where Footer is Used

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/App.tsx`

The legacy app shows both:
- `<CollapsedFooterBar />` (line 6)
- `<WorkspaceFooter health={health} />` (where health comes from `useAppHealth()`)

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/app/shell/MainLayout.tsx` (needs to be verified, but should be the main layout component)

---

## 4. Existing Health Check Pattern

### 4.1 App Health Hook

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/app/hooks/useAppHealth.ts`

The `useAppHealth()` hook:
- Runs once on component mount
- Calls `healthCheck()` IPC command to Rust backend
- Returns `{ health: AppHealthReport | null, systemError: string | null }`
- Provides structure for adding more health metrics

```typescript
export function useAppHealth() {
  const [health, setHealth] = useState<AppHealthReport | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);

  useEffect(() => {
    // Calls healthCheck() from IPC
    const healthReport = await healthCheck();
    setHealth(healthReport);
  }, []);

  return { health, systemError, setSystemError } as const;
}
```

### 4.2 IPC Health Check Interface

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/ipc/types.ts` (lines 87-91)

```typescript
export interface AppHealthReport {
  appVersion: string;
  tauriVersion: string;
  buildProfile: string;
}
```

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/ipc/client.ts` (lines 28-30)

```typescript
export async function healthCheck() {
  return safeInvoke<AppHealthReport>("health_check");
}
```

---

## 5. Supabase Query Pattern

### 5.1 Type-Safe Query Helpers

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/supabase/queries/users.ts` (lines 26-71)

Example pattern for querying Supabase:
```typescript
static async getUser(userUuid: string): Promise<User | null> {
  const correlationId = generateCorrelationId();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_uuid', userUuid)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      const userError = mapSupabaseError(error, correlationId);
      logOperationError('getUser', userError, { userUuid });
      throw userError;
    }

    return data;
  } catch (error) {
    // Error handling...
  }
}
```

**Key characteristics:**
- Uses static methods for organization
- Generates correlation IDs for tracing
- Maps Supabase errors to user-friendly errors
- Logs operations with context
- Uses `maybeSingle()` for optional single row queries

### 5.2 Error Handling

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/core/supabase/errors.ts`

Provides:
- `generateCorrelationId()` - UUID generation for tracing
- `mapSupabaseError()` - Error mapping to user-friendly messages
- `logOperationError()` - Structured error logging
- Custom error types for different scenarios

---

## 6. Database Schema

### 6.1 Key Tables for Health Check

**Source:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/docs/supabase_account_schemas/account-schemas.md`

**Tables available:**
1. `public.accounts` - Account records
2. `public.users` - User profiles with account_uuid and role
3. `public.subscriptions` - Subscription data

**Health check table recommendation:**
- Query `public.accounts` table as it's foundational and simple
- Provides confirmation of database connectivity
- Returns minimal data for quick response

**Recommended query structure:**
```sql
SELECT COUNT(*) FROM public.accounts LIMIT 1
```

---

## 7. App Initialization Flow

### 7.1 Router Context Setup

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/router/routes/__root.tsx` (lines 23-44)

The root route:
- Checks if user is authenticated via `context.auth?.isAuthenticated`
- Redirects unauthenticated users to `/login`
- Uses auth context as middleware for route protection

### 7.2 App Entry Point

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/App.tsx` (lines 1-50)

Entry flow:
1. Uses `useAppHealth()` hook to bootstrap IPC health check
2. Wraps app with `AppProviders` (which includes `AuthProvider`)
3. The `AuthProvider` is responsible for session initialization

---

## 8. Connection State Management Patterns

### 8.1 Existing Context Patterns

**Auth Context:** Located at `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/app/providers/auth/AuthProvider.tsx`

The app uses React Context for:
- Authentication state
- User profile data
- Session information
- Subscription status

### 8.2 Zustand Store Pattern

**Layout Store:** Used in `WorkspaceFooter.tsx` (line 4)

```typescript
const layoutStore = useLayoutStoreApi();
layoutStore.getState().setFooter({ visible: false });
layoutStore.getState().setFooter({ height: newHeight });
```

**Recommendation:** Supabase connection state can be managed similarly, either through:
- Extension of existing `AppHealthReport` type (simpler)
- New Zustand store for Supabase-specific state (more scalable)

---

## 9. UI Component Patterns for Status Indicators

### 9.1 Badge Component

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/shared/ui/badge.tsx`

Available as shadCN component, can be used for status display.

### 9.2 Status Badge in Project View

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/modules/project-view/ui/components/StatusBadge.tsx`

Shows implementation pattern for status displays in the codebase.

### 9.3 Alert Component

**File:** `/Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator/src/shared/ui/alert.tsx`

Used in `App.tsx` (lines 89-95) for displaying errors.

---

## 10. Key File Locations Summary

### Core Files to Modify/Reference

| Purpose | File Path |
|---------|-----------|
| Supabase Client | `/src/core/config/supabaseClient.ts` |
| Auth Provider | `/src/app/providers/auth/AuthProvider.tsx` |
| Login Route (Insert Indicator) | `/src/modules/auth/routes/index.tsx` |
| Workspace Footer (Insert Indicator) | `/src/app/shell/main_elements/footer/WorkspaceFooter.tsx` |
| App Health Hook | `/src/app/hooks/useAppHealth.ts` |
| IPC Health Types | `/src/core/ipc/types.ts` |
| IPC Health Client | `/src/core/ipc/client.ts` |
| Supabase Query Pattern | `/src/core/supabase/queries/users.ts` |
| Supabase Error Handling | `/src/core/supabase/errors.ts` |
| Root Router | `/src/router/routes/__root.tsx` |
| App Entry | `/src/App.tsx` |
| Database Schema | `/docs/supabase_account_schemas/account-schemas.md` |

---

## 11. Implementation Recommendations

### 11.1 New Files to Create

1. **`/src/core/supabase/health.ts`** - Supabase health check query
2. **`/src/app/hooks/useSupabaseHealth.ts`** - React hook for health monitoring
3. **`/src/shared/ui/ConnectionIndicator.tsx`** - Reusable connection status component

### 11.2 Files to Modify

1. **`/src/core/ipc/types.ts`** - Extend `AppHealthReport` with Supabase status
2. **`/src/app/hooks/useAppHealth.ts`** - Integrate Supabase health check
3. **`/src/modules/auth/routes/index.tsx`** - Add indicator below registration button
4. **`/src/app/shell/main_elements/footer/WorkspaceFooter.tsx`** - Add indicator to footer

### 11.3 Implementation Approach

**Two-phase approach:**

**Phase 1: Foundation**
- Create Supabase health check query helper
- Create reusable `ConnectionIndicator` component
- Extend `AppHealthReport` interface

**Phase 2: Integration**
- Add hook to check Supabase health on app load
- Display indicator on login page
- Display indicator in workspace footer
- Handle states: checking, healthy, unhealthy, offline

### 11.4 Connection States to Support

- **Checking:** Spinner with "Checking connection..."
- **Healthy:** Green dot with "Database connected"
- **Unhealthy:** Red dot with "Database unavailable"
- **Offline:** Gray dot with "Offline"

### 11.5 Error Handling Strategy

- Fail gracefully if Supabase check times out (5s timeout recommended)
- Don't block app initialization if check fails
- Log health check failures for monitoring
- Display user-friendly connection status without technical details

---

## 12. Key Architectural Insights

### 12.1 Context and Hooks Pattern
The codebase uses React 19.2 with Compiler enabled. The auth flow leverages:
- React Context for global state
- Custom hooks for encapsulation
- Automatic memoization via React Compiler

### 12.2 Error Handling Philosophy
- Correlation IDs for tracing
- User-friendly error messages
- Structured logging with context
- Fail-closed approach for security-critical operations

### 12.3 IPC and Backend Integration
- Tauri IPC commands for local operations
- Supabase client for cloud operations
- Type-safe query helpers with fallback patterns

### 12.4 Authentication State Machine
- Session bootstrap on mount
- Email verification requirement
- Orphan user detection and recovery flow
- Account context extraction from JWT or fallback query

---

## 13. Constraints and Considerations

### 13.1 Performance
- Health check must complete quickly (aim for <500ms)
- Should not block authentication flow
- Run in parallel with other initialization

### 13.2 Network
- May need timeout handling for slow/offline networks
- Consider retry logic with exponential backoff
- Cache health status briefly to avoid hammering the database

### 13.3 Supabase-Specific
- RLS policies enforced even for simple queries
- May need a simple query that works for unauthenticated users
- Consider using connection pool status if available

### 13.4 UI Consistency
- Login page styling follows ShadCN/Tailwind pattern
- Footer uses existing layout store for state
- Components should be compact and non-intrusive

---

## 14. Data Flow

```
App Initialization
├── Session Bootstrap (AuthProvider)
├── Health Check (useAppHealth)
│   ├── IPC: health_check (Tauri backend)
│   ├── Could extend with Supabase check
│   └── Return AppHealthReport
├── Route Protection (__root.tsx)
└── Display App

Login Page
├── LoginForm component
├── "Create a new Account" button
├── [NEW] Supabase Connection Indicator
└── Error display

Logged-in Workspace
├── MainLayout
├── WorkspaceFooter
│   ├── App health metrics
│   └── [NEW] Supabase Connection Indicator
└── Content panels
```

---

## 15. Next Steps

1. Create `ConnectionIndicator` component for reuse
2. Implement Supabase health check query helper
3. Create `useSupabaseHealth` hook
4. Integrate into `useAppHealth` or create separate hook
5. Add to login page below registration button
6. Add to workspace footer metrics
7. Add error boundary handling
8. Test offline scenarios
9. Add monitoring/logging for health status

