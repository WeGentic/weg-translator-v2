# create-project-wizard-v2-refactor

## Current User Request Analysis
- Refactor `CreateProjectWizardV2.tsx` into smaller, single-scoped modules placed within `src/modules/wizards/project`.
- Existing implementation mixes helper utilities, conversion planning, feedback handling, and UI orchestration in a single ~1.2k LOC file.

## Problem Breakdown
- Split pure utilities (feedback mapping, payload builders, conversion planning) into focused files to reduce component scope.
- Identify cross-cutting logic such as finalize orchestration that should live in a dedicated hook.
- Preserve public API by re-exporting moved helpers so downstream imports/tests remain valid.
- Ensure new modules follow React 19 guidelines and existing project conventions (hooks in `hooks/`, pure helpers in root utilities).
- Validate behavior via existing Vitest coverage for wizard finalize utilities.

## User Request
S1: Refactor src/modules/wizards/project/CreateProjectWizardV2.tsx splitting it into smaller, simpler, single-scoped files, aiming for best maintainability. Place files in the proper folders in src/modules/wizards/project
Completed: NOT COMPLETED

## Coding implementation
- Extracted feedback/error helpers to `src/modules/wizards/project/feedback.ts`, payload builders to `finalizePayload.ts`, conversion planning utilities to `conversionPlan.ts`, and introduced `useWizardFinalize` hook to encapsulate async finalize flow.
- Simplified `CreateProjectWizardV2.tsx` to orchestrate UI state, wiring new hook/functions while keeping existing exports intact for tests/consumers.
- Ran `pnpm vitest src/modules/wizards/project/__tests__/finalize-utils.test.ts` (pass).

## Notes
- Verify full wizard UX manually in the desktop shell when convenient.
