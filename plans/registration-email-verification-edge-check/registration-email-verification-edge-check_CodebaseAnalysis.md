## Current Codebase Analysis

### High-Level Observations
- The registration journey is driven by React 19.2 components under `src/modules/auth`, with controller logic centralized in `useRegistrationForm` (`src/modules/auth/hooks/controllers/useRegistrationForm.ts:1-660`). This hook coordinates validation, multi-step navigation, Supabase sign-up, and verification polling.
- Supabase client access is abstracted in `src/core/config/supabaseClient.ts:1-26`, enforcing environment configuration before runtime.
- Existing Supabase Edge Functions live in `supabase/functions`. They follow a consistent Deno pattern—`serve`, schema validation with Zod, CORS headers, and explicit error shaping. The `register-organization` function (`supabase/functions/register-organization/index.ts:1-332`) demonstrates service-role usage plus transactional persistence.

### Frontend Registration Flow
- `RegistrationRoute` (`src/modules/auth/routes/RegistrationRoute.tsx:1-29`) renders the `RegistrationForm`.
- `RegistrationForm` (`src/modules/auth/components/RegistrationForm.tsx:1-216`) delegates interaction logic to `useRegistrationForm`, handles submission button states, and surfaces the `RegistrationVerificationDialog`.
- `RegistrationAdminStep` (`src/modules/auth/components/forms/RegistrationAdminStep.tsx:1-103`) renders admin credentials fields without asynchronous validation hooks—email uniqueness/verification is not currently checked client-side.
- `useRegistrationForm`:
  - Manages validation via `registrationSchema` utilities (`src/modules/auth/utils/validation/registrationSchema.ts:1-196`), covering format checks but not Supabase-side status.
  - Normalizes payloads before calling `useRegistrationSubmission.submit` (`src/modules/auth/hooks/controllers/useRegistrationForm.ts:324-357`).
  - Triggers verification polling and profile sync post-registration (`src/modules/auth/hooks/controllers/useRegistrationForm.ts:428-494`).
- `useRegistrationSubmission` handles:
  - Supabase sign-up (`src/modules/auth/hooks/controllers/useRegistrationSubmission.ts:547-596`), awaiting email confirmation, and exponential backoff polling (`src/modules/auth/hooks/controllers/useRegistrationSubmission.ts:396-517`).
  - Invocation of the `register-organization` Edge Function for persistence (`src/modules/auth/hooks/controllers/useRegistrationSubmission.ts:314-383`).
  - Error normalization for Supabase auth and Edge Function failures.

### Supabase & Edge Functions
- `supabase/functions/register-organization/index.ts` exemplifies:
  - Service-role client instantiation (`lines 13-22`), defensive env checks, and Zod request schemas.
  - Guarding with `getVerifiedUser` to ensure email confirmation before DB writes (`lines 61-85`).
  - Postgres transactions via `postgresjs` with structured error translation (`lines 167-286`).
- `supabase/functions/address-autocomplete/index.ts:1-220` shows shared patterns for CORS handling, method checks, and upstream API calls. This is useful for crafting a new function with consistent ergonomics.
- Database schema in `supabase/sql/register_organization_schema.sql:1-120` enforces unique company/admin emails and provides the context for conflicts we must respect when checking email status.

### Gaps & Constraints Relevant to New Requirement
- No existing API/Edge function checks whether an email is already registered or verified prior to sign-up; validation only enforces format.
- Registration currently assumes new user flow; re-registering or unverified states are only surfaced through Supabase errors after sign-up attempts.
- The UI lacks UX pathways to redirect returning users to login/reset or to resume verification for pending accounts—logic will need to branch before calling `supabase.auth.signUp`.
- Supabase Edge Functions rely on environment-provided service-role keys; the new function must follow the same deployment and secret management conventions.
- React 19.2 + React Compiler requirements imply side effects (e.g., async fetches) should live in hooks or server actions, avoiding manual memoization.

### Technical Debt & Considerations
- `useRegistrationForm` is already sizeable (>600 lines) and couples multiple concerns. Adding email status checks risks further growth; extracting a dedicated hook (e.g., `useEmailStatusProbe`) will help maintain cohesion.
- Error presentation relies on toast notifications and dialog states; introducing new states must integrate with existing `submissionPhase` flow or introduce parallel UX affordances.
- Edge Function telemetry (console logs) currently uses string literals—adding the new function should follow the same logging conventions for traceability.
- Rate limiting and debounce strategies for email checking are absent; introducing backend lookups needs client-side throttling to avoid abusing the Edge Function endpoint.
