# Subtask 2.2 – Create Wizard Action (Step 2.2.2)

## Scope
- Completed Step 2.2.2 by moving the create-project wizard onto the shared `useActionState` mutation pathway.
- Established v2 wizard state management that layers validation, optimistic UI, and Suspense resource refreshes.

## Implementation Highlights
- Added `useCreateProjectAction` in `src/features/project-manager-v2/actions/createProjectAction.ts`, wrapping `createProject` IPC calls with optimistic cache insertion, toast messaging, and rollback handling.
- Built a v2-specific `useProjectWizard` hook (`src/features/project-manager-v2/wizard/hooks/useProjectWizard.ts`) that composes legacy validation utilities with the new action hook, manages multi-step progression, and coordinates close/reset logic.
- Duplicated the wizard type/validation helpers into the v2 tree to avoid mutating legacy assets, keeping validations (`languages`, `file-descriptor`, `validation.ts`) in sync during the migration.
- Optimistic entries are replaced with real project metadata once the backend responds; failures remove the temporary row and surface descriptive error copy via toasts.

## React 19 Considerations
- `useActionState` drives mutation status while `useTransition` coordinates UI transitions, ensuring StrictMode-safe submission flows.
- Validation runs per-step before dispatch, preventing pointless backend calls and keeping optimistic cache mutations bounded to confirmed data.
- Resource refreshes (`refreshProjectsResource`) tie into the event-driven cache invalidation work from Step 2.1.3, so the wizard stays in sync with other clients.

## Verification
- `npm exec eslint src/features/project-manager-v2/actions/createProjectAction.ts src/features/project-manager-v2/wizard/hooks/useProjectWizard.ts`
- Manual validation of optimistic insertion/removal paths to confirm cache stability on success and failure.

## Follow-ups
1. Wire the new wizard hook into the upcoming v2 shell UI (Task 3) so the modal uses the shared logic end-to-end.
2. Add unit tests (Task 5.1) simulating validation failures and optimistic rollback scenarios.
3. Extend `useCreateProjectAction` once project metadata includes richer defaults (e.g., status/activity from backend) to minimize placeholder fields.
