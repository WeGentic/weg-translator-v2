## Executive Summary

The registration flow currently allows duplicate sign-up attempts because it never inspects Supabase auth records before calling `supabase.auth.signUp`. Introducing a lightweight Edge Function (`check-email-status`) paired with a debounced frontend probe will classify admin emails in real time. The UI can then steer users with verified accounts to login/recovery, funnel unverified users back into the existing verification dialog, and keep brand-new emails on the happy path. The design preserves existing architecture patterns: Deno Edge Functions with service-role access, React 19 hooks with controlled side effects, and ShadCN-based UI components.

Key considerations:
- Reuse Supabase service-role patterns from `register-organization` to ensure consistent security and observability.
- Extract a dedicated `useEmailStatusProbe` hook so `useRegistrationForm` remains manageable despite added logic.
- Provide accessible, debounced feedback aligned with React 19 guidelines, ensuring fallback behavior when the probe fails.

## Recommended Next Actions

1. Implement and deploy the Edge Function skeleton with automated tests (Task 1 & 2).
2. Build the frontend probe hook and integrate it into the registration form (Task 3 & 4).
3. Enhance verification flows and UX messaging for returning accounts, then complete regression and release preparations (Task 5–7).
