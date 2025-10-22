# Report: weg-translator-plan_migration

## Step 1.1 – Inventory (2025-02-14)
- Enumerated wizard assets under `src/modules/project-manager/components/wizard-v2`, covering components, hooks, utilities, constants, CSS, and tests.
- Confirmed supporting helpers (address/phone utilities, language pair/project folder utils) and their colocated tests to include in relocation scope.

## Step 1.2 – Consumer Mapping (2025-02-14)
- Logged primary consumers: `ProjectManagerView.tsx` (direct import), Vitest suites (`ProjectManagerView.test.tsx`, `ProjectManagerShell.test.tsx`) mocking the wizard path, and `ClientsView.tsx` reusing `WizardNewClientDialog`.
- No additional modules reference `wizard-v2`, so updates can focus on these entry points during relocation.

## Task 1 Wrap-Up
- Inventory and dependency targets confirmed; ready to design Clients module destination before moving files.

## Step 2.1 – Target Structure (2025-02-14)
- Defined `src/modules/clients/wizard/` as the relocation root, preserving existing segregation (`components`, `hooks`, `utils`, `__tests__`).
- Root will house shared files (`CreateProjectWizardV2.tsx`, `constants.ts`, `types.ts`, `utils.ts`, `index.ts`) with stylesheet colocated pending naming decision.

## Step 2.2 – Stylesheet Plan (2025-02-14)
- Plan to move styles into `src/modules/clients/wizard/client-wizard.css`, updating the wizard container import and pruning the original file.
- Will validate during relocation whether shared consumers need an explicit CSS import once the bundle structure changes.

## Task 2 Wrap-Up
- Clients module destination structure and styling approach confirmed; ready to execute file moves.

## Step 3.1 – Relocation (2025-02-14)
- Moved `wizard-v2` package to `src/modules/clients/wizard`, retaining components, hooks, utils, and colocated tests.
- Updated `CreateProjectWizardV2` and `WizardDetailsStep` to consume shared Project Manager config/resources via alias paths.

## Step 3.2 – Stylesheet Migration (2025-02-14)
- Renamed the stylesheet to `client-wizard.css` under the Clients module and updated the wizard container import.
- Old Project Manager stylesheet path removed; no additional modules referenced the previous filename.

## Step 3.3 – Exports (2025-02-14)
- Introduced `src/modules/clients/wizard/index.ts` to re-export the wizard component, helper utilities, and types.
- `src/modules/clients/index.ts` now surfaces the wizard package so other modules can import via `@/modules/clients`.

## Task 3 Wrap-Up
- Wizard assets now live entirely under the Clients domain with updated stylesheet and exports.

## Step 4.1 – Project Manager Integration (2025-02-14)
- `ProjectManagerView` and `ClientsView` now resolve wizard imports via `@/modules/clients/wizard`, eliminating deep paths.

## Step 4.2 – Test Updates (2025-02-14)
- Project Manager Vitest suites mock the wizard through `@/modules/clients/wizard`; no remaining references to the previous location.

## Step 4.3 – Documentation Review (2025-02-14)
- Scanned plans/docs; no external references needed adjustment beyond this migration plan, which intentionally records the previous structure.

## Task 4 Wrap-Up
- External integrations, tests, and documentation references now align with the Clients-based wizard.

## Step 5.1 – Automated Checks (2025-02-14)
- TypeScript (`npm run typecheck`) and Vitest (`npm run test:run`) succeeded.
- ESLint still fails due to known issues in `project-view` (unused props) and existing warnings; no new errors introduced by the wizard move.

## Step 5.2 – Manual Validation Plan (2025-02-14)
- Documented QA flow covering wizard launch from Project Manager, inline client creation, file upload/role assignment, and project creation/cancellation.

## Task 5 Wrap-Up
- Validation complete: automated checks recorded, manual QA guidance prepared (lint issues noted for follow-up).

## Step 6.1 – Lint Cleanup (2025-02-14)
- Trimmed `ProjectViewContent` props/state destructuring to avoid unused bindings and reran ESLint (`npm run lint`), which now passes with only pre-existing warnings.

## Task 6 Wrap-Up
- Outstanding lint errors resolved; command now exits successfully while known warnings remain for future refactors.
