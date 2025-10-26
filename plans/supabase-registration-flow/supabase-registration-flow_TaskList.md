# Implementation Plan

- [x] 1. Wire Supabase environment and configuration guards
  - Requirements: Requirement 1, Requirement 4
  - [x] Verify `.env` templates include new Supabase project URL/anon key placeholders
  - [x] Update `supabaseClient.ts` runtime validation messaging to reference new project
  - [x] Document CLI steps for setting env vars in development/CI

- [x] 2. Author Supabase provisioning SQL
  - [x] 2.1. Draft table definitions (`companies`, `company_admins`) with constraints
    - Requirements: Requirement 2, Requirement 3
    - [x] Ensure idempotency via `create table if not exists` and `alter table` guards
  - [x] 2.2. Add RLS enablement and tenant-aware policies
    - Requirements: Requirement 2, Requirement 3, Requirement 4
    - [x] Include policy comments clarifying expected JWT claims
  - [x] 2.3. Create helper roles or grants for Edge Functions if needed
    - Requirements: Requirement 3, Requirement 4
    - [ ] Validate script via Supabase CLI against staging project

- [x] 3. Implement `register_organization` Edge Function
  - [x] 3.1. Scaffold function with JWT validation utilities
    - Requirements: Requirement 2, Requirement 4
    - [x] Decode auth token, assert `email_confirmed_at` before proceeding
  - [x] 3.2. Execute transactional inserts using pooled Postgres client
    - Requirements: Requirement 2
    - [x] Wrap multi-table writes in `BEGIN`/`COMMIT` with rollback on failure
  - [x] 3.3. Return structured error payloads
    - Requirements: Requirement 2, Requirement 4
    - [x] Map constraint violations to HTTP 409, validation to 422, unexpected to 500
  - [x] 3.4. Add logging and correlation IDs
    - Requirements: Requirement 2, Requirement 4
    - [x] Forward attempt ID from client to logs for diagnostics

- [x] 4. Extend registration controller with submission hook
  - Requirements: Requirement 1
  - [x] Create `useRegistrationSubmission` encapsulating sign-up, polling, persistence
  - [x] Integrate hook into `useRegistrationForm.handleSubmit`, preserving validation flow
  - [x] Surface Supabase error codes via existing toast/dialog patterns

- [x] 5. Build verification dialog experience
  - Requirements: Requirement 1
  - [x] Implement modal UI with status messaging and manual “I verified” action
  - [x] Add polling with exponential backoff and cancellation support
  - [x] Close dialog and advance flow once `email_confirmed_at` detected

- [x] 6. Persist organization/admin data post-verification
  - Requirements: Requirement 2
  - [x] Invoke Edge Function with sanitized payload once verification confirmed
  - [x] Handle success by storing IDs and syncing local profile through IPC
  - [x] On failure, present rollback messaging and abort local sync

- [x] 7. Harden auth gating and observability
  - Requirements: Requirement 1, Requirement 4
  - [x] Update AuthProvider to deny dashboard navigation for unverified sessions
  - [x] Emit structured logs/analytics for sign-up, verification, persistence results
  - [x] Ensure service worker excludes Supabase responses containing tokens (verified via absence of SW registration and auth gate logs)

- [ ] 8. Testing and QA sweep
  - [ ] 8.1. Frontend automated tests
    - Requirements: Requirement 1, Requirement 2, Requirement 4
    - [ ] Add unit/component tests for submission hook and verification dialog
  - [ ] 8.2. Edge Function tests
    - Requirements: Requirement 2, Requirement 4
    - [ ] Write Deno tests covering success, duplicate detection, unverified user rejection
  - [ ] 8.3. Manual verification checklist
    - Requirements: Requirement 1, Requirement 2
    - [ ] Execute end-to-end scenario: register, verify email, confirm data in Supabase and local app
