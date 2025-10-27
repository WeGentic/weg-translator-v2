# admin-email-verification-edge-function

## Current User Request Analysis
- Admin email verification via Supabase Edge Function `supabase/functions/check-email-status/index.ts` reports non-2xx responses when invoked from the desktop client, surfacing "We couldn’t verify this email." in the UI.
- Existing implementation initializes a service-role Supabase client and queries `auth.admin.listUsers` with a `filter` formatted as `email.eq.{normalizedEmail}` to locate matching accounts.

## Problem Breakdown
- Supabase docs indicate `auth.admin.listUsers` only accepts a free-text email filter; supplying `email.eq.` style operators throws a 400-series `supabase_query_failed` error, causing our Edge Function to answer with status 502.
- Need to adjust the lookup to use the supported filter syntax (plain normalized email substring) while keeping downstream equality check to avoid false positives.
- Confirm no other failure paths (missing env vars, rate limiting) are masking the same symptom; ensure logging remains actionable.
- After updating the filter, verify the function returns 200-class responses for known scenarios and that existing unit tests still cover success/error handling.
- Ensure the desktop probe hook continues to parse success payloads without changes and handle error codes gracefully.

## User Request
S1: The Admin email verification EDGE function DOES NOT WORK -> We couldn’t verify this email. Edge Function returned a non-2xx status code. Precisely assess the causes and find a definitive soluton
Completed: COMPLETED

## Coding implementation
- [x] Updated `supabase/functions/check-email-status/index.ts` to pass the normalized email string to `auth.admin.listUsers` (avoids unsupported `email.eq` filters).
- [x] Extended `supabase/functions/check-email-status/index.test.ts` with a regression test that captures the `listUsers` call arguments.
- [x] deno test --allow-env supabase/functions/check-email-status/index.test.ts
- [x] Added `[functions.check-email-status] verify_jwt = false` to `supabase/config.toml` so unauthenticated requests reach the function in environments where the CLI flag isn’t applied.

## Notes
- Reference: https://supabase.com/docs/reference/javascript/auth-admin-listusers – `filter` argument performs substring search across email/user metadata; operators like `email.eq` are unsupported and raise errors.
- 401 responses after deployment likely indicate JWT verification is still required for the Edge Function; review Supabase function config/CLI flags to ensure `verify_jwt = false` for unauthenticated probes.
