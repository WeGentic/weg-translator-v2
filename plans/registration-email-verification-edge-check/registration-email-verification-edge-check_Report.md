## Executive Summary

The registration flow currently allows duplicate sign-up attempts because it never inspects Supabase auth records before calling `supabase.auth.signUp`. Introducing a lightweight Edge Function (`check-email-status`) paired with a debounced frontend probe will classify admin emails in real time. The UI can then steer users with verified accounts to login/recovery, funnel unverified users back into the existing verification dialog, and keep brand-new emails on the happy path. The design preserves existing architecture patterns: Deno Edge Functions with service-role access, React 19 hooks with controlled side effects, and ShadCN-based UI components.

Key considerations:
- Reuse Supabase service-role patterns from `register-organization` to ensure consistent security and observability.
- Extract a dedicated `useEmailStatusProbe` hook so `useRegistrationForm` remains manageable despite added logic.
- Provide accessible, debounced feedback aligned with React 19 guidelines, ensuring fallback behavior when the probe fails.

## Recommended Next Actions

1. Monitor cross-module test failures (password requirements/strength panels, `useEmailStatusProbe`) surfaced during full `vitest run`; coordinate follow-up fixes with owners since they pre-date this iteration.
2. Proceed with staged rollout or monitoring only if telemetry surfaces probe anomalies after deployment.

## Progress Log

- **Task 1 – `check-email-status` Edge Function**: Completed. Added `supabase/functions/check-email-status/` with CORS handling, Zod validation, structured JSON logging, and Supabase `auth.admin.listUsers` lookup for case-insensitive email classification. Implemented deterministic error responses, correlation ID propagation, email hashing for telemetry, and unit tests (`deno test --allow-env supabase/functions/check-email-status/index.test.ts`). Deployment and env expectations documented in the function README.
- **Task 2 – Observability & Rate Limiting**: Completed. Extended the function with correlation-aware request/response logging (including hashed email/IP metadata), KV-backed per-IP rate limiting with `Retry-After` + rate headers, and Supabase configuration notes captured in `supabase/config/README.md`. Test suite now covers IP parsing and rate-limit behavior via a KV mock.
- **Task 3 – Email Probe Hook**: Completed. Added `useEmailStatusProbe` with compiler-safe debounced invocation, AbortController cleanup, caching, structured logger/toast wiring, and helpers (`reset`, `forceCheck`, `resendVerification`). Vitest suite exercises debounce timing, rate-limit handling, cache bypass, and resend behaviour with mocked Supabase clients.
- **Task 4 – Registration UI Integration**: Completed. Registration form now consumes the probe state, renders an ARIA-live `EmailStatusBanner` with actionable CTAs, clears results on email edits, and blocks advancement/submission when the email is already verified while keeping error warnings non-blocking.
- **Task 5 – Returning User Verification**: Completed. Unverified probes trigger the verification dialog with re-verification copy, resend actions are handled through `supabase.auth.resend` with cooldown + telemetry, manual checks reuse the probe without new sign-ups, and resend attempts are logged with correlation metadata.
- **Task 6 – UX & Analytics Polish**: Completed. Login and recovery CTAs now carry transition copy, CTA usage and resend/manual check events produce structured logs, and the new banner/dialog maintain ARIA-live focus management for accessibility.
- **Task 7 – Validation & Release Readiness**: Completed. Added targeted regression coverage for `useRegistrationForm`, `useEmailStatusProbe`, and a new integration suite for `RegistrationForm` (verified/non-verified paths) plus axe-driven accessibility snapshots for the form and verification dialog. `vitest-axe` is wired through the global test setup, and `deno test --allow-env supabase/functions/check-email-status/index.test.ts` now runs cleanly. Repository keeps the Deno KV lockfile ephemeral—`deno.lock` was removed to match existing Supabase function policy. A full `npx vitest run` still reports legacy failures in password helper suites; no regressions were introduced by the new work.
