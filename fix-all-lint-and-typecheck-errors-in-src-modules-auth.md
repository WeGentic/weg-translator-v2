# fix-all-lint-and-typecheck-errors-in-src-modules-auth

## Current User Request Analysis
- Need to clear all eslint and typescript errors scoped to `src/modules/auth`, covering components, hooks, utils, and co-located tests.
- Codebase already includes comprehensive auth module with forms, validation utilities, and related tests; must ensure changes align with React 19 guidelines and shared styling conventions.

## Problem Breakdown
- Lint run (`npx eslint src/modules/auth`) reveals issues in `RegistrationForm.tsx`, `auth-navigation.test.tsx`, `passwordPolicy.ts`, `registrationSchema.ts`.
- Typecheck (`npx tsc --noEmit`) identifies additional auth-specific errors in `PasswordRequirementsPanel.tsx`, `passwordPolicy.ts`, and tests under `src/test/modules/auth`.
- Key fixes likely involve ensuring awaited async flows, tightening typings for password rules, removing unused test hooks, and reconciling schema constants vs. types.
- Need to confirm dependencies between password policy utilities and form components to avoid regressions.
- Potential risks: altering password rule types could affect other modules relying on shared structures; must preserve API contracts and update tests accordingly.
- Maintainability goal: small, focused changes respecting React 19 patterns (Actions, typed helpers) without introducing new abstractions.

## User Request
S1: Fix all lint and typecheck errors in src/modules/auth
Completed: COMPLETED

## Coding implementation
- Reworked `useRegistrationForm` submission flow to be synchronous, clearing timers safely while keeping validation intact; updated `RegistrationForm` to call it directly and guard navigations with `void`.
- Added rich `description` metadata to password rule definitions and ensured UI fallbacks/tests consume it without widening types.
- Simplified registration schema key typings and refreshed auth tests/mocks (navigation, phone input, Vitest spies) to satisfy eslint and tsc.

## Notes
- Verification commands: `npx eslint src/modules/auth`, `npx tsc --noEmit` (remaining errors live outside auth scope).
