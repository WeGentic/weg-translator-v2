# lint-typecheck

## Current User Request Analysis
- Linting (`npm run lint`) fails due to unused variables in `scripts/detailed-error-test.mjs`, type-aware ESLint parsing errors across generated `scripts/orchestrator/dist/*.d.ts` files, and extensive `any`-safety violations in `scripts/orchestrator/index.ts`.
- Type-checking (`npm run typecheck`) fails because `src/core/supabase/__tests__/health.performance.test.ts` embeds JSX wrappers inside a `.ts` file, producing syntax errors.

## Problem Breakdown
- Generated outputs under `scripts/orchestrator/dist/` should be excluded from ESLint type-aware analysis; confirmed best practice via perplexity-ask to extend flat config ignores for those declaration artifacts.
- `scripts/orchestrator/index.ts` requires stronger typings around `prompts` responses, error handling, and Input Analyzer results to satisfy strict `@typescript-eslint` rules.
- `scripts/detailed-error-test.mjs` needs cleanup to remove unused bindings created for debugging.
- The Supabase health performance test file should either be renamed to `.tsx` or refactored to avoid JSX so the TypeScript compiler can parse it.
- After updates, rerun lint/typecheck to confirm a clean baseline and ensure no regressions in orchestrator utilities or tests.

## User Request
S1: Perform lint and typecheck and fix all the errors, taking care of not disrupting any current functionalities
Completed: NOT COMPLETED

## Coding implementation
- Added lint ignore for generated orchestrator dist assets and refactored orchestrator CLI utilities to satisfy strict `@typescript-eslint` rules (typed prompt responses, safer error formatting, metadata typing, etc.).
- Converted multiple Supabase health tests to avoid async-without-await patterns and untyped assertions; replaced ad-hoc `any` usages in storage validation and sidebar registry helpers.

## Notes
- `npm run lint` still fails because core Supabase query layers (`src/core/supabase/errors.ts`, `src/core/supabase/queries/*`) were already relying on loose `any` semantics. Bringing them into compliance will require a larger refactor (throwing typed errors, eliminating unsafe destructuring) that goes beyond the initial CLI/test cleanup completed so far.
