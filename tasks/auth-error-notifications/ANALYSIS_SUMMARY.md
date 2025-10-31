# Auth Error Notifications - Analysis Summary

## Request Subject
`auth-error-notifications`

## Quick Overview

**Problem**: When login fails (e.g., invalid credentials, network error from Supabase), the application shows nothing to the user or only displays raw error messages inline in the form.

**Current State**:
- Toast system exists ✅ but is underutilized
- Error mapping pattern exists in registration ✅ but not in login
- Orphaned user flow shows perfect error+notification pattern ✅
- Login errors are raw/unmapped ❌
- No user-friendly error messages ❌

**Solution**: Implement error notification system following the orphaned user pattern (which already works perfectly).

---

## Key Findings

### 1. Toast System Ready (No New Code Needed)
- **Location**: `src/shared/ui/toast.tsx`
- **Status**: Fully functional, correctly positioned in provider stack
- **Current Usage**: Only used for orphaned user error (1 place)
- **Action**: Call from AuthProvider and LoginForm for all other login errors

### 2. Error Mapping Pattern Exists (Reuse It)
- **Location**: `src/modules/auth/hooks/controllers/useRegistrationSubmission.ts` (lines 152-292)
- **Functions**: `mapAuthError()`, `mapFunctionInvokeError()`, `isEmailNotConfirmedError()`
- **Status**: Proven and working in registration flow
- **Action**: Extract to shared utility, import and use in login flow

### 3. Orphaned User Error Shows Perfect Pattern (Copy It)
- **Location**: `src/app/providers/auth/AuthProvider.tsx` (lines 431-454)
- **Pattern**: Throw custom error → catch with instanceof → show toast → optional action → redirect
- **Status**: Works perfectly
- **Action**: Replicate this pattern for all login error types

### 4. Main Gaps
1. **No error code inspection** (line 292-293: raw error thrown)
2. **No error mapping** (registration has it, login doesn't)
3. **No toast for login errors** (except orphan case)
4. **No user-friendly messages** (raw Supabase errors shown)
5. **No recovery actions** (no Resend Email, Reset Password, etc.)

---

## Files to Reference (Reading Priority)

1. **src/app/providers/auth/AuthProvider.tsx** - Main login logic (lines 276-463)
2. **src/modules/auth/components/LoginForm.tsx** - Form error handling (lines 107-121)
3. **src/modules/auth/hooks/controllers/useRegistrationSubmission.ts** - Error mapping pattern (lines 152-292)
4. **src/shared/ui/toast.tsx** - Toast system (entire file)
5. **src/modules/auth/errors/OrphanedUserError.ts** - Custom error pattern (entire file)

---

## Files to Create

1. **src/modules/auth/errors/LoginError.ts**
   - Custom error class for login errors (follow OrphanedUserError pattern)

2. **src/modules/auth/utils/loginErrorMapper.ts**
   - Error mapping functions:
     - `mapAuthError(error: AuthError): LoginError`
     - `mapNetworkError(error: Error): LoginError`
     - `getLoginErrorMessage(code: string): string` (user-friendly)
     - `getLoginErrorAction(code: string): ToastAction | undefined`

3. **src/modules/auth/__tests__/loginErrorMapper.test.ts**
   - Unit tests for error mapping

---

## Files to Modify

1. **src/app/providers/auth/AuthProvider.tsx**
   - Line 287-294: Add error mapping before throwing
   - Line 429-458: Show toast for non-orphan errors

2. **src/modules/auth/components/LoginForm.tsx**
   - Line 107-121: Add toast call for non-redirect errors
   - Line 120: Enhance error message formatting

3. **src/modules/auth/errors/index.ts**
   - Export new LoginError class

---

## Implementation Pattern (Copy from Orphaned User)

```typescript
// 1. Throw custom error (with code + message)
throw new LoginError(code, userFriendlyMessage, status);

// 2. Catch with instanceof (in AuthProvider catch block)
if (error instanceof LoginError) {
  // 3. Show toast notification
  toast({
    title: "Login Failed",
    description: error.message,
    variant: "destructive",
    duration: 8000,
    action: error.action, // e.g., { label: "Resend Email", onClick: ... }
  });

  // 4. Optional: Log with correlation ID
  logger.error("Login failed", {
    code: error.code,
    email,
    correlationId
  });

  // 5. Re-throw or handle (LoginForm catches it)
  throw error;
}
```

---

## Error Types to Handle

| Scenario | Status | Message | Action |
|----------|--------|---------|--------|
| Invalid credentials | 400 | "Email or password is incorrect" | None |
| Email not verified | 400 | "Please verify your email" | "Resend Email" |
| User not found | 400 | "No account found" | None |
| Account locked | 429 | "Too many attempts. Try later." | "Contact Support" |
| Network error | N/A | "Connection failed. Check internet." | "Retry" |
| Server error | 500+ | "Service unavailable. Try again." | "Retry" |

---

## Success Criteria

- [ ] All Supabase auth errors are caught and mapped (no raw errors shown)
- [ ] User-friendly error messages displayed in toast notifications
- [ ] Toast notifications appear for all login failures
- [ ] Error messages include actionable guidance or recovery options
- [ ] Recovery actions available where applicable (Resend Email, Reset Password, etc.)
- [ ] Errors logged with correlation IDs for debugging
- [ ] Form error state cleared intelligently on field changes
- [ ] Orphaned user flow continues to work (no regression)
- [ ] Tests cover error mapping and notification flows
- [ ] Accessibility: error toasts announced to screen readers

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking orphaned user flow | Medium | Keep OrphanedUserError handling exactly as-is, add new errors separately |
| Duplicate error messages | Low | Use toast ID pattern to prevent duplicates |
| Users missing toast | Low | Extend duration to 8 seconds (matching orphan pattern) |
| Over-engineering | Low | Follow existing registration pattern (proven) |

---

## Documentation Generated

Two comprehensive documents created:

1. **auth-error-notifications_CodebaseAnalysis.md** (17 sections, ~1000 lines)
   - Detailed implementation approach
   - Error flow diagrams
   - Architectural analysis
   - Risk analysis
   - Complete file references

2. **auth-error-notifications_StructuredAnalysis.json** (JSON schema format)
   - Structured entry points
   - Code flow tracing
   - Implementation details
   - Key findings with priority
   - Clarifications needed

---

## Next Steps

1. **Read** the detailed analysis documents
2. **Review** the error mapping pattern in registration flow
3. **Plan** error types and user messages
4. **Create** LoginError class and mapper utility
5. **Update** AuthProvider.login() to use mapper
6. **Enhance** LoginForm error handling
7. **Test** all error scenarios
8. **Document** error codes and messages

---

**Status**: Ready for Implementation Planning
**Confidence**: High (extensive codebase analysis completed)
**Complexity**: Medium (follows proven patterns already in codebase)
