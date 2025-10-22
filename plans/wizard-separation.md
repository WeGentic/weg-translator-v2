# wizard-separation

## Current User Request Analysis
- The user wants the existing wizard feature to be split so that client-related logic is isolated from project-related logic, keeping shared pieces reusable.
- Existing code places all wizard components, hooks, utilities, and styles beneath `src/modules/clients/wizard`, so both the project creation wizard and the new client dialog are tightly coupled.

## Problem Breakdown
- The wizard implementation currently mixes project and client flows inside the same module, so we must audit each component/hook/util to decide where it belongs before moving anything.
- New folder structure required: `src/modules/wizards/{client,project,shared}` while keeping file cohesion (components, hooks, utils, tests, styles).
- We need to identify shared types/utilities (e.g., wizard types, language helpers) that both flows use and move them into a dedicated shared package.
- CSS is consolidated in `client-wizard.css`; we must extract project-specific classes (wizard shells, language chips, file table) into `project-wizard.css` and client-specific classes (dialog, phone picker, address suggestions) into `client-wizard.css`.
- All imports across the codebase (components, tests, barrels) must be updated to reference the new paths without breaking compile-time contracts.
- Maintainability risk: large component (`CreateProjectWizardV2`) spans ~1k lines; when moving we must ensure React 19 compiler constraints stay satisfied and that hooks remain in correct scopes.

## User Request
S1: Precisely separate ALL code related to PROJECT WIZARD from the one correlated to CLIENT wizard, create a new folder wizards and place in client the CLIENT related code, in PROJECT the project related code, and in SHARED any shared code. SPLIT THE CSS in two files with only the pertinent classes for the specific wizard. Finally check all the imports
Completed: COMPLETED

## Coding implementation
- Added `src/modules/wizards/project`, `client`, and `shared` packages with barrel exports for each scope.
- Relocated project wizard components, hooks, utils, and tests into `wizards/project`, promoting the shared `WizardClientField` component into `wizards/shared`.
- Moved the client wizard dialog helpers into `wizards/client` and ensured the dialog imports its dedicated stylesheet.
- Split the legacy stylesheet into the project wizard bundle (`project-wizard-shell.css`, `project-wizard-form.css`, `project-wizard-autocomplete.css`, `project-wizard-combobox.css`, `project-wizard-language.css`, `project-wizard-actions.css`, `project-wizard-dropzone.css`, `project-wizard-files.css`, `project-wizard-feedback.css`) and `client/client-wizard.css`, updating component imports accordingly and removing the old asset.
- Re-pointed feature and test imports to `@/modules/wizards/*`, then dropped the obsolete `src/modules/clients/wizard` directory.

## Notes
- Tests: `pnpm vitest run src/modules/project-manager/__tests__/ProjectManagerView.test.tsx src/modules/project-manager/__tests__/ProjectManagerShell.test.tsx` (passes with existing router warnings).
