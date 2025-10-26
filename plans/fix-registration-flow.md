# fix-registration-flow

## Current User Request Analysis
- User reports registration phone input behaving unpredictably and form validation/reactivity not reflecting correctly despite valid data.
- Registration flow implemented via `RegistrationForm` (React 19) backed by `useRegistrationForm` hook, validation via Zod schema (`registrationSchema.ts`), and UI pieces in `RegistrationCompanyStep`/`RegistrationAdminStep` with phone integration through `react-phone-number-input`.

## Problem Breakdown
- Investigate controller logic to confirm how phone value/country state (`phoneValue`, `phoneCountry`) and error propagation interact with `react-phone-number-input`.
- Break down fixes into phone handling stability (state syncing, validation overrides) and field reactivity (touched/error visibility) while preserving multi-step wizard structure.
- Required updates likely limited to `useRegistrationForm.ts`, possibly `RegistrationCompanyStep.tsx`, and associated validation helpers/tests to maintain cohesion.
- Key risks: introducing regressions in submission guard logic, breaking existing tests, or violating React 19 compiler expectations; ensure changes remain type-safe and incremental.
- Maintainability focus: encapsulate phone-specific adjustments within controller, keep UI components declarative, and extend automated tests to cover the discovered regressions.

## User Request
S1: Fix registration flow - phone acts erratically, form validation/reactivity unreliable.
Completed: COMPLETED

## Coding implementation
- Updated `useRegistrationForm` to auto-detect phone countries, tolerate undefined selections, reset touched flags more responsively, and guard dial code resolution.
- Persist raw phone digits from the visible input when react-phone-number-input emits `undefined`, ensuring validation can still detect required state without discarding user input.
- Added debug logging to surface when the phone field is marked required so the root cause (digit detection, phone country, tax code) is traceable in app logs.
- Relaxed `RegistrationCompanyStep` typing to accept optional phone country and rely on derived dial code.
- Extended unit coverage ensuring phone behaviour and touched reactivity are validated, mocking toast usage for isolation.

## Notes
- Verified targeted Vitest suites: `useRegistrationForm` and `registration-company-step`.
