# Implementation Plan

- [ ] 1. Ship `check-email-status` Edge Function
  - Requirements: Req#1
  - [ ] Scaffold new function folder with CORS headers, Zod schema, and typed responses
  - [ ] Implement Supabase `auth.users` lookup using service-role key (case-insensitive email)
  - [ ] Map outcomes to `registered_verified`, `registered_unverified`, `not_registered` with correlation logging
  - [ ] Handle validation, missing env, and Supabase failures with structured error payloads + appropriate HTTP codes
  - [ ] Add Deno unit tests + README snippet for deployment expectations

- [ ] 2. Harden function observability and rate limiting
  - Requirements: Req#1
  - [ ] Add correlation ID echo + console metrics for status distribution
  - [ ] Apply lightweight rate limiting (per IP) or guard rails within function; return 429 with Retry-After when exceeded
  - [ ] Document environment variables / CLI steps in `supabase/config` notes

- [ ] 3. Build `useEmailStatusProbe` hook
  - Requirements: Req#2, Req#3, Req#4
  - [ ] Implement debounced invoke with `AbortController` cleanup per Perplexity 2025 guidance
  - [ ] Expose state `{status, isLoading, error, reset, forceCheck, resendVerification}` with internal caching by lowercase email
  - [ ] Wire structured logging + toast helpers for error and success cases
  - [ ] Add Vitest coverage for debounce, cancellation, and error surfaces

- [ ] 4. Integrate probe into registration form UI
  - Requirements: Req#2, Req#3
  - [ ] Inject hook into `useRegistrationForm` and pass state to `RegistrationAdminStep`
  - [ ] Render `EmailStatusBanner` with ARIA-live messaging, login/recover CTAs, and inline explanations
  - [ ] Block form submission + step advancement when status is `registered_verified`; clear blocker on email change
  - [ ] Persist non-blocking warnings for probe errors while allowing submission

- [ ] 5. Enhance verification flow for unverified accounts
  - Requirements: Req#2, Req#4
  - [ ] Auto-open `RegistrationVerificationDialog` with contextual copy when status is `registered_unverified`
  - [ ] Trigger Supabase resend-verification action (auth API) and surface success/error feedback
  - [ ] Ensure manual verification polling reuses existing logic without starting new sign-up
  - [ ] Log resend attempts with correlation IDs

- [ ] 6. UX & analytics polish
  - Requirements: Req#2, Req#3, Req#4
  - [ ] Route login CTA to `/login` with page transition messaging; hook password recovery to existing flow/link
  - [ ] Instrument analytics/telemetry for probe outcomes, CTA usage, and resend attempts
  - [ ] Update accessibility snapshots (axe) to confirm banners/dialog meet ARIA requirements

- [ ] 7. Validation & release readiness
  - Requirements: Req#1, Req#2, Req#3, Req#4
  - [ ] Write E2E/regression tests covering new, verified, and unverified email paths
  - [ ] Update documentation/CHANGELOG and verify Supabase CLI deploy scripts include new function
  - [ ] Coordinate feature flag or staged rollout plan if needed
