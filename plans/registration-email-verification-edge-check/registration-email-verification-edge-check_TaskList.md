# Implementation Plan

- [x] 1. Ship `check-email-status` Edge Function
  - Requirements: Req#1
  - [x] Scaffold new function folder with CORS headers, Zod schema, and typed responses
  - [x] Implement Supabase `auth.users` lookup using service-role key (case-insensitive email)
  - [x] Map outcomes to `registered_verified`, `registered_unverified`, `not_registered` with correlation logging
  - [x] Handle validation, missing env, and Supabase failures with structured error payloads + appropriate HTTP codes
  - [x] Add Deno unit tests + README snippet for deployment expectations

- [x] 2. Harden function observability and rate limiting
  - Requirements: Req#1
  - [x] Add correlation ID echo + console metrics for status distribution
  - [x] Apply lightweight rate limiting (per IP) or guard rails within function; return 429 with Retry-After when exceeded
  - [x] Document environment variables / CLI steps in `supabase/config` notes

- [x] 3. Build `useEmailStatusProbe` hook
  - Requirements: Req#2, Req#3, Req#4
  - [x] Implement debounced invoke with `AbortController` cleanup per Perplexity 2025 guidance
  - [x] Expose state `{status, isLoading, error, reset, forceCheck, resendVerification}` with internal caching by lowercase email
  - [x] Wire structured logging + toast helpers for error and success cases
  - [x] Add Vitest coverage for debounce, cancellation, and error surfaces

- [x] 4. Integrate probe into registration form UI
  - Requirements: Req#2, Req#3
  - [x] Inject hook into `useRegistrationForm` and pass state to `RegistrationAdminStep`
  - [x] Render `EmailStatusBanner` with ARIA-live messaging, login/recover CTAs, and inline explanations
  - [x] Block form submission + step advancement when status is `registered_verified`; clear blocker on email change
  - [x] Persist non-blocking warnings for probe errors while allowing submission

- [x] 5. Enhance verification flow for unverified accounts
  - Requirements: Req#2, Req#4
  - [x] Auto-open `RegistrationVerificationDialog` with contextual copy when status is `registered_unverified`
  - [x] Trigger Supabase resend-verification action (auth API) and surface success/error feedback
  - [x] Ensure manual verification polling reuses existing logic without starting new sign-up
  - [x] Log resend attempts with correlation IDs

- [x] 6. UX & analytics polish
  - Requirements: Req#2, Req#3, Req#4
  - [x] Route login CTA to `/login` with page transition messaging; hook password recovery to existing flow/link
  - [x] Instrument analytics/telemetry for probe outcomes, CTA usage, and resend attempts
  - [x] Update accessibility snapshots (axe) to confirm banners/dialog meet ARIA requirements

- [ ] 7. Validation & release readiness
  - Requirements: Req#1, Req#2, Req#3, Req#4
  - [x] Write E2E/regression tests covering new, verified, and unverified email paths
  - [x] Update documentation/CHANGELOG and verify Supabase CLI deploy scripts include new function
  - [x] Coordinate feature flag or staged rollout plan if needed
