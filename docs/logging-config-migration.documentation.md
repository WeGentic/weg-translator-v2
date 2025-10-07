# Logging & Configuration Migration Summary

## Scope
- Completed Task 3 / Sub-task 3.2 from the tr-entic domain-first refactor plan by relocating logging utilities and environment configuration into the `src/core` namespace.

## Changes
- Moved `LogProvider`, `logger`, and their barrel into `src/core/logging`, eliminating the legacy `src/logging` folder and updating all imports (app shell, hooks, tests, and log console).
- Established `src/core/config` with `feature-flags.ts`, `supabaseClient.ts`, and an index barrel, updating `AuthContext` to consume `supabase` via the core layer.
- Ensured downstream files (e.g., `useAppHealth`, `useTranslationHistory`, `LogConsole`) consume the core exports so domain modules no longer reach into legacy paths.

## Validation
- `npx tsc --noEmit` *(fails: pre-existing type errors in workspace packages; no new logging/config regressions detected before the failure).* 

## Follow-up
- Continue Task 3 by migrating remaining infrastructure (e.g., shared utilities) and revisit the outstanding `tsc` errors once the broader refactor stabilizes.
