# Authentication Error Notifications - Codebase Analysis Report

**Project**: Tr-entic Desktop (Tauri 2.8.5 + React 19.2 + TypeScript)
**Request Subject**: auth-error-notifications
**Analysis Date**: October 30, 2025
**Status**: Complete

---

## Executive Summary

The codebase currently has **fragmented error handling** for authentication flows:
- **ToastProvider exists** and is fully functional but **underutilized** for auth errors
- **LoginForm displays errors inline** only through form state (no persistent notifications)
- **AuthProvider has toast setup** but only uses it for orphaned user recovery flow
- **Supabase auth errors are caught** but not mapped to user-friendly messages
- **Registration flow has comprehensive error mapping** (mapAuthError, mapFunctionInvokeError) but login flow lacks this

This analysis identifies the gaps and provides a clear implementation roadmap.

---

## 1. Current Authentication Implementation

### 1.1 Architecture Overview

```
Frontend Auth Flow:
LoginForm (presentation)
    ↓ (calls useAuth hook)
useAuth hook → AuthProvider context
    ↓
AuthProvider (src/app/providers/auth/AuthProvider.tsx)
    ↓ (uses supabase.auth.signInWithPassword)
Supabase Auth Client
    ↓ (returns data or error)
AuthProvider catches/throws errors
    ↓
LoginForm catch block
    ↓
User sees error (currently in-form only)
```

### 1.2 Key Files Location

| Component | File Path | Lines | Purpose |
|-----------|-----------|-------|---------|
| **AuthProvider** | `src/app/providers/auth/AuthProvider.tsx` | 1-624 | Core auth logic, session management, login method |
| **LoginForm** | `src/modules/auth/components/LoginForm.tsx` | 1-292 | Login UI, form validation, error display |
| **useAuth Hook** | `src/modules/auth/hooks/useAuth.ts` | 1-2 | Re-exports from AuthProvider (pass-through) |
| **ToastProvider** | `src/shared/ui/toast.tsx` | 1-236 | Toast notification system (fully functional) |
| **useToast Hook** | `src/shared/ui/use-toast.ts` | 1-3 | Toast hook export |
| **Orphaned User Error** | `src/modules/auth/errors/OrphanedUserError.ts` | 1-121 | Custom error class for orphaned users |
| **OrphanDetection Error** | `src/modules/auth/errors/OrphanDetectionError.ts` | N/A | Custom error class for detection failures |
| **Error Classes Index** | `src/modules/auth/errors/index.ts` | 1-12 | Error exports |

---

## 2. Current Error Handling Mechanisms

### 2.1 AuthProvider Error Handling (Lines 286-462)

**Current Implementation:**
```typescript
// Line 287-294: Supabase call
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error) {
  throw error; // Line 293: Throws raw Supabase error
}
```

**Error Flow:**
1. Supabase returns `AuthError` object with properties: `message`, `status`, `name`, `code`
2. Raw error is thrown to caller (LoginForm)
3. LoginForm catches it (line 107-121)
4. Sets error state as a string (line 120)
5. Renders in form (lines 256-272)

**Current Error Handling Locations:**
- **Line 292-293**: Raw error thrown without mapping
- **Line 303**: Email unverified error → throws generic Error
- **Line 376-377**: OrphanedUserError thrown → handled specially
- **Line 412-427**: Orphan detection errors → throws generic Error
- **Line 429-458**: Custom error handling block

**Weaknesses:**
- No error code/status inspection before throwing
- Generic Error messages don't help users understand what went wrong
- No differentiation between error types (invalid credentials vs. network error)
- Toast notifications only used for orphaned user case (line 436-441)

### 2.2 LoginForm Error Display (Lines 49-290)

**Current Implementation:**
```typescript
// Line 56: Local error state
const [error, setError] = useState("");

// Line 107-121: Error catch block
} catch (err) {
  if (err instanceof Error && err.message === "REDIRECT_TO_RECOVERY") {
    // Handle orphan redirect
  }

  // Line 120: Generic error message
  setError(err instanceof Error ? err.message : "Login failed. Please try again.");
}
```

**Display Method:**
- Stores error in component state (line 56)
- Displays as text above form (no code shown but referenced in aria-describedby)
- No visual distinction between field errors and general errors
- No toast notification used

**Weaknesses:**
- Error only visible while form is mounted
- No persistent notification if user navigates away
- All errors treated the same way visually
- Raw Supabase error messages displayed to users

### 2.3 Registration Flow Error Mapping (Reference: useRegistrationSubmission.ts)

The registration flow has **comprehensive error mapping** that should be adapted for login:

```typescript
// Lines 152-165: mapAuthError function
function mapAuthError(error: AuthError): SubmissionError {
  const code = error.name || "supabase_error";
  const message = typeof error.message === "string" && error.message.trim().length > 0
    ? error.message
    : "Supabase rejected the sign-up request.";

  return {
    code,
    message,
    source: "supabase",
    details: { status: error.status },
  };
}

// Lines 167-178: Specific error detection
function isEmailNotConfirmedError(error: AuthError): boolean { ... }
function isUserAlreadyExistsError(error: AuthError): boolean { ... }
```

**This pattern should be adopted for login errors.**

---

## 3. Existing Notification Systems

### 3.1 ToastProvider System (src/shared/ui/toast.tsx)

**Status**: Fully implemented and working ✅

**Key Features:**
- React Context-based notification system
- Support for title + description
- Two variants: `"default"` and `"destructive"`
- Auto-dismiss with configurable duration
- Max 5 concurrent toasts (lines 95)
- Duplicate detection via signature (lines 64-83)
- Portal rendering to document.body (lines 159-191)

**Usage Pattern:**
```typescript
const { toast } = useToast();

toast({
  title: "Error",
  description: "Invalid credentials",
  variant: "destructive",
  duration: 6000, // default
  action?: { label: "Retry", onClick: () => {...} }
});
```

**Currently Used In:**
- AuthProvider (orphaned user flow only, line 436-441)
- ProjectView module (line reference in grep results)
- ProjectViewRoute module (line reference in grep results)

**Not Currently Used For:**
- Login credential errors
- Email verification failures
- Network/server errors
- Account lockout scenarios

### 3.2 Alert Component (src/shared/ui/alert.tsx)

**Status**: Basic alert UI component ✅

**Capabilities:**
- Two variants: `"default"` and `"destructive"`
- Renders as semantic `<div role="alert">`
- Supports title and description slots
- Used in toast items (line 5 of toast.tsx)

**Not Currently Used For**: Direct error display in forms

---

## 4. Integration Points for Error Notifications

### 4.1 Primary Integration Point: AuthProvider.login() Method

**File**: `src/app/providers/auth/AuthProvider.tsx`
**Lines**: 276-463

**Current Error Flow:**
1. Line 287: `supabase.auth.signInWithPassword()` called
2. Lines 292-294: Error thrown without inspection
3. Line 429-458: Generic catch block, OrphanedUserError special case

**Required Modification Points:**
```
Line 287-294: After getting { data, error }
  ├── INSPECT error.status and error.message
  ├── MAP to user-friendly error type
  └── THROW custom AuthError with code + user message

Line 429-458: Main catch block
  ├── Handle specific error codes with toast
  ├── Log correlation IDs for debugging
  └── Optionally redirect on certain errors
```

### 4.2 Secondary Integration Point: LoginForm Component

**File**: `src/modules/auth/components/LoginForm.tsx`
**Lines**: 49-290

**Current Error Flow:**
1. Line 91: Calls `login(email, password)`
2. Lines 107-121: Catches error, stores in state
3. Line 120: Sets generic error message

**Required Modification Points:**
```
Line 107-121: Error catch block
  ├── ADD toast call for non-redirect errors
  ├── Enhance error message for specific error codes
  └── CLEAR form error on successful recovery attempts
```

### 4.3 App Providers Structure

**File**: `src/app/providers/index.tsx`

**Current Structure:**
```typescript
AppProviders
  └── LogProvider
      └── AppErrorBoundary
          └── QueryProvider
              └── ToastProvider ← Toast system available here
                  └── AuthProvider ← Has access to useToast()
                      └── children (pages/routes)
```

**Status**: Perfect positioning for error notifications ✅

---

## 5. Supabase Error Types to Handle

### 5.1 Common Supabase Auth Errors

Based on code inspection and Supabase documentation:

| Error Scenario | Status Code | Message | User-Friendly Message |
|---|---|---|---|
| **Invalid credentials** | 400 | "Invalid login credentials" | "Email or password is incorrect. Please try again." |
| **User not found** | 400 | "User not found" | "No account found with this email." |
| **Email not confirmed** | 400 | "Email not confirmed" | "Please verify your email before signing in. Check your inbox." |
| **Account locked** | 429 | "Too many login attempts" | "Account temporarily locked due to multiple failed attempts. Try again later." |
| **User already exists** | 422 | "User already registered" | "This email is already registered. Try logging in instead." |
| **Network error** | N/A | "fetch failed" | "Network connection failed. Please check your internet." |
| **Service unavailable** | 500+ | "Server error" | "Authentication service is temporarily unavailable. Please try again." |
| **Session expired** | 401 | "Session expired" | "Your session has expired. Please log in again." |

### 5.2 Error Detection Patterns

From `useRegistrationSubmission.ts` (Lines 152-292):
- Check `error.status` for HTTP status codes
- Check `error.message` for text patterns (case-insensitive)
- Check `error.code` or `error.name` for error codes
- Pattern example: `isEmailNotConfirmedError()` checks message.includes("email not confirmed")

---

## 6. Custom Error Classes Already in Place

### 6.1 OrphanedUserError (src/modules/auth/errors/OrphanedUserError.ts)

**Purpose**: Thrown when user is authenticated but has no company/profile data

**Properties:**
- `email: string` - User's email for cleanup flow
- `correlationId: string` - UUID for request tracing
- `redirectUrl: string` - Recovery route URL

**Current Usage**: Lines 376, 386-387 in AuthProvider

**Toast Integration**: Already implemented (AuthProvider line 436-441)

### 6.2 OrphanDetectionError

**Purpose**: Thrown when orphan detection fails after retries

**Current Usage**: Lines 391-412 in AuthProvider

**Toast Integration**: Only logs error, no toast shown

### 6.3 Recommendation

Create new custom error class: **`AuthenticationError`** for login failures
- Parallel to OrphanedUserError pattern
- Properties: `code`, `message`, `status`, `details`
- Can be caught specifically in LoginForm

---

## 7. Existing Error Handling Patterns in Codebase

### 7.1 Error Mapping Pattern (from Registration)

**Location**: `useRegistrationSubmission.ts` lines 152-292

**Pattern Overview:**
```typescript
// Generic error type
export interface SubmissionError {
  code: string;           // Machine-readable error code
  message: string;        // User-friendly message
  source: "supabase" | "network" | "unknown";
  details?: unknown;      // Original error details
}

// Specialized mappers
function mapAuthError(error: AuthError): SubmissionError { }
function mapFunctionInvokeError(error: unknown): SubmissionError { }
function mapUnknownError(error: unknown): SubmissionError { }
```

**This pattern is PERFECT for login errors and should be reused.**

### 7.2 Error State Pattern

**Location**: `useRegistrationSubmission.ts` lines 67-74

```typescript
interface SubmissionState {
  phase: SubmissionPhase;    // Loading state
  error: SubmissionError | null;
  adminUuid: string | null;
  payload: NormalizedRegistrationPayload | null;
  result: SubmissionSuccessResult | null;
}
```

**This could be simplified for login but shows proper error state management.**

### 7.3 Logging Pattern

**Location**: Throughout codebase using `logger` from `src/core/logging`

```typescript
void logger.error("Failed to load auth session", error);
void logger.warn("Blocked login for unverified user", { email });
void logger.info("Extracted account context from JWT claims", { userId });
```

**Error notifications should be paired with logging for debugging.**

---

## 8. Key Findings

### Finding 1: Toast System Ready But Underutilized ✅

**Category**: Opportunity
**Impact**: High
**Current State**: ToastProvider is fully functional, positioned correctly in provider stack, but only used for orphaned user case (1 place in entire codebase where login-related).

**Recommendation**: Leverage existing toast system for all auth errors instead of inline form display only.

---

### Finding 2: Error Mapping Pattern Exists But Not in Login ✅

**Category**: Pattern (Anti-pattern)
**Impact**: High
**Current State**: Registration flow has comprehensive error mapping (`mapAuthError`, `mapFunctionInvokeError`, specific error detectors). Login flow throws raw Supabase errors.

**Recommendation**: Extract error mapping logic to shared utility, use same pattern in AuthProvider login method.

---

### Finding 3: Supabase Errors Not Mapped to User Messages ❌

**Category**: Weakness
**Impact**: Critical
**Current State**: When login fails with 400 error, user sees raw Supabase message or "Login failed. Please try again."

**Example Scenario**:
- User enters wrong password
- Supabase returns: `{ status: 400, message: "Invalid login credentials" }`
- User sees: "Invalid login credentials" (not actionable)
- Better: "Email or password is incorrect. Try again or reset your password."

**Recommendation**: Create `mapLoginError()` function following registration pattern.

---

### Finding 4: No Error Categorization for Different Flow Types ⚠️

**Category**: Weakness
**Impact**: Medium
**Current State**: All auth errors handled identically. No distinction between:
- Credential errors (user should retry)
- Email verification errors (direct user to email)
- Account lockout (wait time needed)
- Network errors (retry suggested)
- Server errors (notify support)

**Recommendation**: Add error category system with appropriate UI treatment for each.

---

### Finding 5: No Toast Action Support for Login Errors ⚠️

**Category**: Opportunity
**Impact**: Medium
**Current State**: Toast supports `action` prop with label and click handler, but login errors don't use this.

**Examples of Actions We Could Add**:
- "Email not confirmed" → Action: "Resend verification link"
- "Forgot password" → Action: "Reset password"
- "Account locked" → Action: "Contact support"

**Recommendation**: Implement contextual actions for different error types.

---

### Finding 6: Orphaned User Toast Already Implemented Correctly ✅

**Category**: Strength
**Impact**: High
**Current State**: AuthProvider already shows toast for orphaned users (line 436-441), then redirects.

```typescript
toast({
  title: "Registration Incomplete",
  description: "Your registration was incomplete. Check your email for a verification code to complete setup.",
  variant: "default",
  duration: 8000,
});
```

**Observation**: This is the ONLY place login-related toast is used. Pattern already works - just needs replication for other error types.

---

### Finding 7: Error Logging Infrastructure Exists ✅

**Category**: Strength
**Impact**: High
**Current State**: Logger available globally via `src/core/logging` with correlation ID support.

**Current Usage**: AuthProvider extensively logs errors with context (userId, email, correlationId, etc.)

**Recommendation**: Pair each toast notification with log entry for debugging user issues.

---

### Finding 8: No Validation Before Toast for Duplicate Prevention ⚠️

**Category**: Opportunity
**Impact**: Low
**Current State**: Toast system has signature-based duplicate detection (line 64-83), but no validation of error state before showing.

**Risk**: Multiple error messages for same failure if error handling isn't careful.

**Recommendation**: Use toast ID pattern to avoid duplicate error notifications for same login attempt.

---

## 9. Recommended Implementation Approach

### Phase 1: Create Error Mapping & Types

**Files to Create/Modify:**
1. `src/modules/auth/errors/LoginError.ts` (NEW)
   - Custom error class for login-specific errors
   - Properties: code, message, status, details

2. `src/modules/auth/utils/loginErrorMapper.ts` (NEW)
   - `mapAuthError(error: AuthError): LoginError`
   - `mapNetworkError(error: Error): LoginError`
   - `getLoginErrorMessage(code: string): string` (user-friendly)
   - `getLoginErrorAction(code: string): ToastAction | undefined`

3. `src/modules/auth/errors/index.ts` (MODIFY)
   - Export new LoginError class

### Phase 2: Update AuthProvider

**File**: `src/app/providers/auth/AuthProvider.tsx`

**Modifications:**
1. Line 287-294: Replace error throwing with mapped error handling
2. Line 429-458: Enhance catch block to show toast for mapped errors
3. Add proper error code inspection before throwing
4. Add logging with correlation IDs

### Phase 3: Enhance LoginForm

**File**: `src/modules/auth/components/LoginForm.tsx`

**Modifications:**
1. Line 107-121: Add toast call for non-orphan errors
2. Enhance inline error display with error category styling
3. Add error recovery options (resend email, reset password, etc.)
4. Clear error state on field changes intelligently

### Phase 4: Testing & Documentation

**Files to Create:**
1. `src/modules/auth/__tests__/loginErrorMapper.test.ts`
2. `src/modules/auth/__tests__/authErrorNotifications.test.tsx`
3. Update docs/auth-error-handling.md with error codes and messages

---

## 10. Integration Checklist

### Required Integration Points

- [ ] **AuthProvider.login()** - Catch Supabase errors and map to LoginError
- [ ] **LoginForm catch block** - Show toast for non-orphan login errors
- [ ] **Error mapper** - Create comprehensive mapping for all Supabase auth codes
- [ ] **Toast styling** - Use "destructive" variant for auth failures
- [ ] **Logging** - Pair each toast with error log entry
- [ ] **Correlation IDs** - Track error through login → logging → support
- [ ] **Error recovery options** - Add toast actions for resend/reset flows
- [ ] **Duplicate prevention** - Use toast ID to avoid duplicate notifications
- [ ] **Testing** - Unit tests for error mapping, integration tests for flows
- [ ] **Documentation** - List all handled error codes and messages

---

## 11. File Structure & Dependencies

### Import Chain for Error Notifications

```
LoginForm.tsx
  ├── useAuth() → AuthProvider from "src/app/providers"
  ├── useToast() → from "src/shared/ui/toast"
  └── [NEW: error handler/mapper imports]

AuthProvider.tsx
  ├── supabase.auth from "src/core/config"
  ├── useToast() → from "src/shared/ui/toast"
  ├── logger → from "src/core/logging"
  └── [NEW: loginErrorMapper from "src/modules/auth/utils"]

[NEW] loginErrorMapper.ts
  ├── AuthError from "@supabase/supabase-js"
  └── LoginError from "src/modules/auth/errors"

[NEW] LoginError.ts
  └── Extends Error class, properties for code/message/status
```

### UI Component Hierarchy for Error Display

```
ToastProvider (src/shared/ui/toast.tsx)
  └── ToastViewport (portal-rendered)
      └── ToastItem
          └── Alert (src/shared/ui/alert.tsx)
              ├── AlertTitle
              └── AlertDescription
```

**Current Usage**: Already fully wired, just needs to be called from AuthProvider/LoginForm

---

## 12. Accessibility Considerations

### Current Implementation (LoginForm)

- Line 209-211: Field errors use `role="alert"` ✅
- Line 204-205: `aria-invalid` and `aria-describedby` for fields ✅
- Line 171-176: Proper error ID chaining ✅

### Toast Accessibility

- Toast uses semantic `role="alert"` (alert.tsx line 30) ✅
- Screen readers will announce toast on appearance ✅
- Close button has `aria-label` (toast.tsx line 229) ✅

### Required Additions

- Ensure error toast is announced to screen readers
- Use clear, actionable error messages
- Provide alternative ways to recover (not just toast action)

---

## 13. Risk Analysis

### Risk 1: Multiple Error Messages (Medium)

**Scenario**: Login fails, toast shows error, form inline error also shows error

**Mitigation**:
- Clear form errors when showing toast
- Use toast ID to prevent duplicates
- Show inline errors only for field validation, toast for auth errors

### Risk 2: Users Missing Toast Notifications (Low)

**Scenario**: Toast disappears after 6 seconds, user didn't see it

**Mitigation**:
- Extended duration for error toasts (8-10 seconds)
- Pair with form state (but clear on field change)
- Provide persistent error in form title/description

### Risk 3: Breaking Existing Orphaned User Flow (Medium)

**Scenario**: Modifying AuthProvider.login() breaks orphan detection handling

**Mitigation**:
- Keep OrphanedUserError handling exactly as-is
- New error mapping only applies to non-OrphanedUserError cases
- Add tests to prevent regression

### Risk 4: Over-Engineering Error States (Low)

**Scenario**: Creating too many error types/categories makes code complex

**Mitigation**:
- Follow existing registration pattern (already proven)
- Keep error mapper simple and testable
- Document error codes clearly

---

## 14. Example Implementation Patterns

### Pattern 1: Error Mapping (from Registration - WORKING)

```typescript
// From useRegistrationSubmission.ts lines 152-165
export interface LoginError {
  code: string;
  message: string;
  source: "supabase" | "network" | "unknown";
  status?: number;
  details?: unknown;
}

export function mapAuthError(error: AuthError): LoginError {
  return {
    code: error.name || "supabase_error",
    message: error.message || "Supabase authentication failed",
    source: "supabase",
    status: error.status,
  };
}
```

### Pattern 2: Error Detection (from Registration - WORKING)

```typescript
// From useRegistrationSubmission.ts lines 167-178
export function isEmailNotConfirmedError(error: AuthError): boolean {
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  const status = typeof (error as { status?: number }).status === "number"
    ? (error as { status?: number }).status
    : undefined;

  return status === 400 && message.includes("not confirmed");
}
```

### Pattern 3: Toast with Action (from Toast system)

```typescript
// From toast.tsx line 23
export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastAction;  // NEW feature to use
}
```

**Usage Example**:
```typescript
const { toast } = useToast();

toast({
  title: "Email Not Verified",
  description: "Check your inbox for a verification link.",
  variant: "destructive",
  duration: 8000,
  action: {
    label: "Resend Email",
    onClick: () => { /* resend verification */ },
    dismiss: false, // Keep toast open until user closes
  }
});
```

---

## 15. Summary of Gaps

| Gap | Severity | Current State | Required Action |
|-----|----------|---------------|-----------------|
| Supabase errors not mapped to user messages | Critical | Raw errors thrown | Create mapLoginError() |
| No toast notifications for login errors | Critical | Only inline form error | Call useToast in AuthProvider |
| Error codes not inspected before throwing | High | Blind error pass-through | Add error code switch/mapper |
| No error categorization | High | All errors treated same | Create error type enum |
| No recovery actions in notifications | Medium | No toast actions used | Add action callbacks |
| Error state not coordinated | Medium | Separate form + auth errors | Centralize error state |
| Logging not paired with notifications | Medium | Logs exist, toasts separate | Log error with toast |
| No tests for error flows | Medium | Only orphan flow tested | Add error mapper tests |

---

## 16. Files to Reference

### Files to Read First (Priority Order)

1. **src/app/providers/auth/AuthProvider.tsx** - Main login logic, lines 276-463
2. **src/modules/auth/components/LoginForm.tsx** - Form handling, lines 107-121
3. **src/modules/auth/hooks/controllers/useRegistrationSubmission.ts** - Error mapping pattern, lines 152-292
4. **src/shared/ui/toast.tsx** - Toast system, entire file
5. **src/modules/auth/errors/OrphanedUserError.ts** - Custom error pattern, entire file

### Files to Create

1. **src/modules/auth/errors/LoginError.ts** - Custom login error class
2. **src/modules/auth/utils/loginErrorMapper.ts** - Error mapping logic
3. **src/modules/auth/__tests__/loginErrorMapper.test.ts** - Error mapper tests

### Files to Modify

1. **src/app/providers/auth/AuthProvider.tsx** - Add error mapping and toast calls
2. **src/modules/auth/components/LoginForm.tsx** - Enhance error handling
3. **src/modules/auth/errors/index.ts** - Export new error class

---

## 17. Next Steps

1. **Planning Phase**:
   - Review error codes from Supabase documentation
   - Verify toast API matches current system
   - Design error categorization system

2. **Implementation Phase**:
   - Create LoginError class and mapper
   - Update AuthProvider.login() method
   - Enhance LoginForm error handling
   - Add error recovery actions

3. **Testing Phase**:
   - Unit test error mapping
   - Integration test login flows
   - Test error recovery actions
   - Accessibility testing for toasts

4. **Documentation Phase**:
   - List all handled error codes
   - Document user messages
   - Create runbook for common errors
   - Update CLAUDE.md with auth error patterns

---

## Appendix A: Supabase Auth Error Reference

**Source**: Analysis of AuthProvider usage and registration flow error mapping

### Status Code 400 - Bad Request
- Invalid credentials
- Email not confirmed
- User not found
- Invalid email format

### Status Code 401 - Unauthorized
- Session expired
- Invalid token
- Insufficient permissions

### Status Code 409 - Conflict
- User already exists
- Email already registered

### Status Code 429 - Too Many Requests
- Account locked due to login attempts
- Rate limit exceeded

### Status Code 500+ - Server Error
- Service unavailable
- Internal server error

---

## Appendix B: Current Error Flow Diagram

```
┌─────────────────┐
│   User Input    │
│  (email/pwd)    │
└────────┬────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ LoginForm.handleSubmit()  │
    │ Line 78-124              │
    └────────┬─────────────────┘
             │
             ▼
        ┌─────────────┐
        │ useAuth()   │
        │ Login call  │
        └────┬────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │ AuthProvider.login() [Line 276]  │
    │ - Calls supabase.auth.signInWithPassword
    │ - Gets { data, error }
    │ - If error, throws raw error (line 293)
    └────────┬──────────────────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │ LoginForm Catch Block    │
    │ Line 107-121             │
    │ - Catches error          │
    │ - Checks if orphan       │
    │ - Sets form state        │
    │ - Shows inline error     │
    └──────────────────────────┘

KEY GAPS:
❌ No error code inspection
❌ No error mapping
❌ No toast notification (except orphan case)
❌ No correlation ID tracking
❌ No recovery options
```

---

**Report Generated**: October 30, 2025
**Analyzed By**: Claude Code (codebase analysis)
**Status**: Ready for Implementation Planning
