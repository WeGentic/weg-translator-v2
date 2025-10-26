# Requirements Document

## Introduction

This initiative delivers a production-ready Supabase-backed registration experience for the Weg Translator desktop/PWA. Scope includes wiring the existing multi-step registration UI to Supabase Auth, enforcing email verification before access, persisting organization and admin metadata in Supabase under strong security controls, and supplying developers with the SQL schema required to provision the backend tables. Success is measured by end-to-end enrolment without manual intervention, adherence to Supabase security guidance (no service role key exposure, RLS-first posture), and graceful rollback on partial failures. Out of scope: paid subscription handling, account type distinctions, non-email auth factors, and any runtime execution of developer-only SQL scripts within the app.

## Glossary

- **Supabase**: Managed backend platform providing Postgres, authentication, storage, and edge functions.
- **RLS (Row Level Security)**: Postgres security feature restricting table access based on policies tied to authenticated users.
- **Edge Function**: Supabase serverless function executing trusted logic with elevated privileges via service role.
- **Anon Key**: Public Supabase API key used by client applications for authenticated requests.
- **Registration Flow**: The multi-step UX collecting company and admin details before creating Supabase identities.
- **Email Verification**: Step requiring the user to confirm their email address via Supabase-auth link before accessing the app.

## Non-Functional Requirements (NFRs)

- Security: Never embed the Supabase service role key in the client; all privileged writes must flow through RLS-safe tables or Edge Functions.
- Privacy: Do not cache user tokens or PII in service workers; rely on Supabase session storage only.
- Reliability: Registration must provide actionable feedback for any failure, retry instructions, and leave no orphaned database rows.
- Observability: Emit structured logs (frontend + Edge Function) for sign-up attempts, verification completion, and persistence failures.
- Performance: Email verification polling must back off exponentially to avoid excessive Supabase requests.
- Compliance: Enforce RLS policies covering company and admin tables before deployment; verification gate must be audited in tests.
- Usability: Provide clear progress states, disabled actions when waiting for verification, and manual “I have verified” trigger.

## Requirement 1

#### User Story: As a prospective organization admin, I want the registration form to create a Supabase user account and guide me to verify my email before logging in so that access is secure and controlled.

#### Acceptance Criteria

1. Submitting valid registration data triggers `supabase.auth.signUp`, surfacing Supabase error messages to the user when failures occur.
2. Success states immediately display a verification-required dialog with instructions and a countdown/polling indicator.
3. The UI prevents navigation to the dashboard until Supabase reports `email_confirmed_at` for the pending session.
4. The dialog includes an “I have verified the email” action that re-checks verification status on demand.
5. Polling stops automatically once verification is detected and handles network errors with retry messaging.
6. Analytics/logging captures sign-up attempts, verification completions, and surfaced errors.

### Priority & Complexity

- Priority: Must

## Requirement 2

#### User Story: As the system, I need to persist organization and admin metadata in Supabase only after verification so that data integrity and tenancy rules remain consistent.

#### Acceptance Criteria

1. After verification, the app (or Edge Function) inserts company and admin records containing the specified fields (UUIDs, tax data, contact info).
2. Insertion logic runs within a transaction (Edge Function or SQL RPC) ensuring either both company and admin records persist or none do.
3. Failures during persistence surface to the user with remediation guidance and trigger compensating cleanup of any partial records.
4. Supabase RLS policies ensure only the verified admin can read/update their organization data; unverified users cannot access tables.
5. Local Tauri profile sync stays consistent with Supabase data, using Supabase UUID as the source of truth.
6. Observability instrumentation logs success/failure with correlation IDs for troubleshooting.

### Priority & Complexity

- Priority: Must

## Requirement 3

#### User Story: As a developer, I want a Supabase SQL provisioning script that creates the required tables, relationships, and default policies so that new environments can be bootstrapped safely outside the app runtime.

#### Acceptance Criteria

1. Script creates `companies` and `company_admins` tables with the fields requested (UUIDs, address segmentation, tax ID, contact info, verification flags, placeholders for account type/subscription).
2. Script enforces UUID primary keys and foreign keys between company and admin records.
3. Default values set `email_verified`, `phone_verified`, and `account_approved` to false.
4. RLS is enabled for both tables with policies allowing access only to authenticated users matching their `auth.uid()`.
5. Seed policies or helper roles required for Edge Functions are included or documented in comments.
6. Script is idempotent (safe to run multiple times) via `create table if not exists` patterns.

### Priority & Complexity

- Priority: Must

## Requirement 4

#### User Story: As an engineering lead, I need the registration experience to respect platform security guidance (no secret leakage, edge functions for admin capabilities) so that compliance risks are mitigated.

#### Acceptance Criteria

1. The client constructor uses only the anon key; service role keys are referenced solely in Edge Functions or server-side configuration.
2. Edge Functions performing privileged work validate JWT claims and reject requests when email verification is incomplete.
3. API responses with tokens or PII are never cached in service workers or localStorage beyond Supabase’s session storage.
4. Client-side validation complements but never replaces Supabase RLS or Edge Function validation.
5. Automated tests cover negative paths: unverified login attempt, failed data persistence, RLS policy enforcement.
6. Documentation updates warn against deploying without running the SQL script and policies.

### Priority & Complexity

- Priority: Must
