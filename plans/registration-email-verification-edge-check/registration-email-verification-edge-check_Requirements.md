# Requirements Document

## Introduction

Purpose: add a Supabase Edge Function–backed email status probe to the organization registration flow so the app can steer returning or incomplete users to the right path before submitting new sign-ups. Scope includes backend function, frontend integration, UX affordances, telemetry, and resilience. Success criteria: registration form warns immediately when an email already belongs to a verified account, guides unverified accounts back into verification, and allows new emails to proceed without friction. Out of scope: changes to Supabase auth configuration, password reset flows themselves, or broader account management beyond the registration screen. Assumptions: the email to validate is the admin login email, Supabase auth metadata is the source of truth, and rate limiting will be handled client-side via debounce.

## Glossary

- **Supabase Edge Function**: Deno-based serverless function deployed through Supabase, capable of using the service-role key for privileged operations.
- **Email Status Probe**: Backend check that classifies an email as unregistered, registered+verified, or registered+unverified.
- **Verification Dialog**: Existing modal (`RegistrationVerificationDialog`) that guides users through email confirmation.
- **Returning Admin**: User whose email already exists in Supabase auth (verified or not).
- **Status Banner**: Inline UI element on the registration form highlighting the probe result.

## Non-Functional Requirements (NFRs)

- **Security**: Edge Function must use the service-role key securely stored in Supabase config; never expose sensitive data to the client.
- **Performance**: Backend lookup should complete within 300 ms P95; client must debounce requests to avoid hammering the endpoint.
- **Reliability**: Function must handle Supabase outages gracefully, returning deterministic error payloads the UI can surface.
- **Observability**: Log status checks with correlation IDs and classification results for audit trails.
- **Usability**: Feedback must be accessible (ARIA compliant) and not block keyboard navigation.
- **Scalability**: Solution should tolerate increased registration attempts without manual scaling, relying on Supabase serverless elasticity.

## Requirement 1

#### User Story: As a registration backend service, I want to classify a submitted admin email against Supabase auth so the client can react appropriately before attempting sign-up.

#### Acceptance Criteria

1. Edge Function `check-email-status` (name TBD during implementation) exists under `supabase/functions/`.
2. Function accepts POST payload `{ email: string }` and validates format via Zod.
3. Function queries `auth.users` using service-role credentials and returns one of `registered_verified`, `registered_unverified`, or `not_registered`.
4. Function includes `attemptId` / `correlationId` echo when provided to support tracing.
5. Function responds with HTTP 200 for known classifications, 4xx for validation errors, 5xx for unexpected failures with sanitized messages.
6. Security headers match existing functions (CORS, content type) and service-role key is not logged.

### Priority & Complexity

- Priority: Must

## Requirement 2

#### User Story: As a registering administrator, I want the registration form to inform me in real time if my email already exists so I avoid duplicate sign-ups.

#### Acceptance Criteria

1. `useRegistrationForm` (or a dedicated child hook) invokes the new Edge Function when the admin email field is blurred and the value passes client-side format validation.
2. Requests are debounced (≥400 ms) and cancelled on subsequent edits to prevent stale responses.
3. UI renders an inline status banner near the admin email field summarizing the probe result.
4. Banner content is screen-reader accessible and dismissible when the email changes.
5. Network errors show a non-blocking warning and allow the user to proceed (registration isn’t hard-blocked).
6. Probe results update in store/state without breaking existing validation or step navigation.

### Priority & Complexity

- Priority: Must

## Requirement 3

#### User Story: As a returning administrator with a verified account, I want clear options to log in or recover my password instead of restarting registration.

#### Acceptance Criteria

1. When probe result is `registered_verified`, the registration flow blocks submission and surfaces CTA buttons: “Log in” (navigates to `/login`) and “Recover password” (navigates to existing recovery flow or external link).
2. Attempting to submit while this state is active shows an inline explanation rather than invoking `supabase.auth.signUp`.
3. Toast notifications clarify that the email is already verified and provide next steps.
4. CTA buttons are keyboard reachable and respect theming guidelines.
5. Dismissing or changing the email clears the blocking state.
6. Analytics/logging captures the event with context for support diagnostics.

### Priority & Complexity

- Priority: Must

## Requirement 4

#### User Story: As a returning administrator whose email is unverified, I want the app to help me resume verification without restarting registration.

#### Acceptance Criteria

1. When probe result is `registered_unverified`, the existing `RegistrationVerificationDialog` opens (or focuses) with messaging tailored for re-verification.
2. The flow triggers `supabase.auth.resend` (or equivalent) to resend a confirmation email via Supabase if the user requests it.
3. Manual verification check button calls existing polling logic without starting a new signup attempt.
4. UI prevents creating duplicate accounts while still letting the user update their email if they made a typo.
5. State persists across navigation within the registration form so users can still review company info.
6. Logs include attempt IDs linking probe results with verification retries.

### Priority & Complexity

- Priority: Should
