# Design Document

## Overview

The solution introduces a verified Supabase registration pipeline that bridges the existing multi-step React registration UI with Supabase Auth, transactional Edge Functions, and downstream local profile synchronization. Users complete the current company/admin form, triggering Supabase sign-up and a verification dialog. Once verified, an Edge Function persists company/admin records atomically and Row Level Security (RLS) ensures only authorized access. Tauri/Rust subsystems remain unchanged aside from receiving confirmed user metadata.

## Architecture

1. **Client (React/Tauri WebView)**: `RegistrationForm` orchestrates field collection and invokes a new submission service using the Supabase JS SDK. Verification UI resides in a modal component. Auth context gates navigation based on verified sessions.
2. **Supabase Auth**: Handles email sign-up, verification emails, and session tokens (anon key only).
3. **Edge Function (`register_organization`)**: Executes with the service role, validates JWT/email verification, inserts company/admin rows, and applies transactional rollback on failure.
4. **Database Schema**: Tables `companies` and `company_admins` with RLS policies referencing `auth.uid()`. Future account type/subscription columns reserved.
5. **Observability**: Frontend logs via existing logger; Edge Function writes to Supabase log drain. Metrics include attempt IDs for correlation.

### High-Level Flow

```mermaid
graph TD
    A[RegistrationForm\nCompany/Admin steps] --> B[Supabase Auth\nsignUp(email,password)]
    B -->|email sent| C[User verifies email\nvia Supabase link]
    C --> D[Client Verification Dialog\npoll session/email_confirmed_at]
    D -->|verified| E[Edge Function\nregister_organization]
    E -->|transaction| F[(Postgres\ncompanies & company_admins)]
    F --> G[Tauri AuthProvider\nsync local profile]
    E --> H[Structured Logs]
    D -->|failure| I[Error Dialog & Retry]
```

### Integration Points

- **AuthProvider (`src/app/providers/auth/AuthProvider.tsx`)**: Gains a utility to assert `email_confirmed_at` before marking the user authenticated; consumes Supabase session updates triggered post-verification.
- **RegistrationForm controller**: Extends `handleSubmit` to call Supabase sign-up and open the verification modal while handing form validation to existing utilities.
- **Supabase Edge Function**: New endpoint invoked via `supabase.functions.invoke("register_organization", ...)`, receiving validated form payload and returning company/admin IDs.
- **Rust IPC**: Reuses existing `createUserProfile` once the Edge Function responds, ensuring local SQLite stays aligned with cloud IDs.

## Components and Interfaces

1. **`useRegistrationSubmission` hook**
   - Responsibility: Wrap sign-up, verification polling, and Edge Function invocation.
   - Sketch:
     ```ts
     interface RegistrationSubmission {
       submit(values: RegistrationValues): Promise<SubmissionState>;
       confirmVerification(): Promise<SubmissionState>;
       cancel(): void;
     }
     ```
   - Emits state transitions consumed by the form (idle → signingUp → waitingVerification → verified → persisting → success/failure).

2. **`VerificationDialog` component**
   - Presents countdown, polling status, manual “I verified” button, and error states.
   - Props: `{ open, state, onManualCheck, onCancel }`.

3. **`register_organization` Edge Function**
   - Validates Supabase JWT, ensures `email_confirmed_at` flag using `auth.getUser`.
   - Executes transactional SQL inserting into `companies` and `company_admins`, returning inserted rows.
   - Rolls back and returns structured error messages on conflict/validation failures.

4. **Database schema**
   - `companies` (UUID PK, name, address components, tax_id, phone, email, metadata columns).
   - `company_admins` (UUID PK, company_uuid FK, admin_email, admin_uuid, verification flags).

5. **RLS Policies**
   - `companies`: `using ( auth.uid() = owner_admin_uuid )`.
   - `company_admins`: `using ( auth.uid() = admin_uuid )`.

6. **Logging service adapters**
   - Extend existing logger to capture attempt IDs, propagate to Edge Function calls (`functions.invoke` request headers/params).

## Data Models 1

- **Table `companies`**
  - Columns: `company_uuid` (uuid, PK), `name` (text), `address_line1/line2/city/state/postal_code/country_code` (text), `tax_id` (text), `email` (text), `phone` (text), `account_type` (text, nullable placeholder), `subscription_plan` (text, nullable placeholder), `email_verified` (boolean default false), `phone_verified` (boolean default false), `account_approved` (boolean default false), timestamps.
  - Constraints: unique tax ID per country, email format check.

## Data Models 2

- **Table `company_admins`**
  - Columns: `admin_uuid` (uuid, PK), `company_uuid` (uuid FK references `companies`), `admin_email` (text), `phone` (text null), `email_verified` (boolean default false), `phone_verified` (boolean default false), `account_approved` (boolean default false), timestamps.
  - Constraints: `admin_email` unique, `admin_uuid` matches Supabase `auth.users` ID.

## Error Handling 1

- Frontend wraps Supabase calls in try/catch, mapping error codes to user-readable messages and logging structured errors.
- Edge Function uses try/catch around SQL transaction; on error, rolls back and responds with error JSON `{code, message, remediation}`.
- Polling handles timeouts (backoff) and network failures with user prompts.

### Graceful Degradation 1

- If Supabase Functions invocation fails, the UI keeps the user in a recoverable state offering retries and support contact.
- Should verification polling fail repeatedly, manual “verify now” action remains available.
- If the Edge Function is unavailable, inform the user that registration is queued and alert support while preventing partial local profile creation.

### Diagnostic Integration 1

- Frontend emits logs through the existing `logger` abstraction with correlation IDs (UUID per registration attempt).
- Edge Function logs to Supabase observability and optionally forwards to external log drains.
- Metrics counters (success/failure) can be wired using Supabase analytics or a lightweight telemetry endpoint.

## Testing Strategy

- Unit tests for `useRegistrationSubmission` mocking Supabase responses (success, failure, timeout).
- Component tests covering `VerificationDialog` accessibility and state transitions.
- Integration tests (Vitest + MSW) simulating sign-up → verification → persistence success/failure.
- Supabase Edge Function tests (Deno) verifying JWT validation and transactional rollback.
- SQL linting plus migration tests (Supabase CLI) ensuring tables/policies create correctly.

## Implementation Phases

### Phase 1 - Supabase Foundations
- Establish Supabase project configuration (env handling, client guards).
- Author SQL script for `companies`/`company_admins` tables and RLS policies.
- Scaffold Edge Function structure with logging and JWT validation utilities.

### Phase 2 - Client Registration & Verification
- Refactor `useRegistrationForm` submission to delegate to new submission hook.
- Implement verification dialog with polling/backoff and manual trigger.
- Block navigation/auth state until `email_confirmed_at` is confirmed.

### Phase 3 - Persistence & Synchronization
- Implement Edge Function transactional inserts and error mapping.
- Wire client to invoke the Edge Function post-verification and handle rollbacks.
- Sync confirmed data with local Tauri profile and emit analytics logs.

### Phase 4 - Quality & Hardening
- Add automated tests (unit, integration, Edge Function) covering positive/negative flows.
- Run Supabase CLI policy checks and document operational runbooks.
- Conduct security review ensuring no service-role exposure and RLS enforcement.

## Performance Considerations

- Email verification polling uses exponential backoff (e.g., 5s, 10s, 20s) and manual trigger to avoid spamming the Auth API.
- Edge Function should minimize cold-start latency by preloading the DB connection pool and using lean dependencies.
- Form validation remains client-side to reduce perceived latency while still relying on server enforcement.

### Minimal Impact Design

- Reuse existing `useRegistrationForm` state to avoid duplicate computations.
- Limit Edge Function response payload to essential identifiers.
- Only start polling after a successful sign-up response, cancel when the dialog closes.

### Scalability

- Tables use UUID primary keys and indexes on email/tax ID for quick lookups.
- Edge Function is stateless, enabling horizontal scaling via Supabase.
- RLS policies support multi-tenant growth; future account type/subscription columns ready for upgrade.

### Backward Compatibility (when applicable)

- Existing login flow continues to operate with new Supabase project credentials.
- Local SQLite profile sync uses the same shape; ensures fallbacks if new data absent.
- Registration UI structure (steps, validation) remains unchanged, minimizing regression risk.

## Migration and Compatibility (when applicable)

- Provide manual migration checklist: run SQL script via Supabase SQL editor, deploy Edge Function, configure redirect URLs for email verification.
- Document environment variable updates and ensure CI loads the new Supabase anon key securely.
- For existing users, script to backfill `companies`/`company_admins` with current data if necessary.
