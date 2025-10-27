# registration-auth-session-missing

## Current User Request Analysis
- Desktop registration flow crashes during verification step with "Auth session missing!" surfaced to the user, blocking organization registration.
- Existing submission controller (`src/modules/auth/hooks/controllers/useRegistrationSubmission.ts`) polls `supabase.auth.getUser()` immediately after `signUp`; this call assumes a persisted session that is not created until the email confirmation link produces login tokens.

## Problem Breakdown
- Supabase sign-up with email confirmation returns `session: null`, so `supabase.auth.getUser()` throws an `AuthError` with message "Auth session missing!" until the user signs in.
- The flow never attempts to establish a session after verification; it simply polls `getUser`, fails, and surfaces the error to the UI while also preventing persistence (`register-organization` Edge Function requires a bearer token).
- Need to gate verification polling behind an explicit session check: attempt a password sign-in once email is confirmed, handle the "Email not confirmed" 400 gracefully, and retry until success.
- After a session exists, reuse the authenticated user info to continue with registration persistence.
- Update tests covering `useRegistrationSubmission` to account for the new "ensure session" behavior and guard against regressions.

## User Request
S1: Find the cause of this error, during the registration FLOW: Registration issue → "Auth session missing!"
Completed: COMPLETED

## Coding implementation
- [x] Added `ensureAuthenticatedUser` logic in `src/modules/auth/hooks/controllers/useRegistrationSubmission.ts` to establish a Supabase session (via `getSession` + password sign-in) before polling verification, avoiding `Auth session missing!` failures.
- [x] Handled "Email not confirmed" responses gracefully and retained the existing toast/reschedule behavior for manual checks.
- [x] Updated `src/test/modules/auth/hooks/useRegistrationSubmission.test.ts` to cover the new flow, including mocks for `getSession`/`signInWithPassword` and verifying graceful retries.
- [x] npx vitest run src/test/modules/auth/hooks/useRegistrationSubmission.test.ts

## Notes
- Supabase docs: `auth.getUser()` requires an active session (https://supabase.com/docs/reference/javascript/auth-getuser); without tokens it returns an AuthError.
- Supabase sign-in for unconfirmed emails returns status 400 with message "Email not confirmed" (https://github.com/supabase/auth/issues/1077).
