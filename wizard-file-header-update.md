# wizard-file-header-update

## Current User Request Analysis
- Header within `CreateProjectWizardV2` remains static as "New Project Wizard" even when user transitions to file management step.
- Requirement: show "{Project name} - FILE MANAGER" instead, pulling from wizard state and aligning with file step context.

## Problem Breakdown
- Header is rendered in `CreateProjectWizardV2.tsx` inside modal chrome, not within `WizardFilesStep.tsx`; need conditional logic tied to current step.
- Must safely handle empty or whitespace-only project names and avoid breaking heading semantics highlighted by React accessibility best practices.
- Ensure casing matches spec (uppercase `FILE MANAGER`) and provide sensible fallback to avoid blank headers.
- Keep code compliant with React 19 patterns and existing styling (class names remain unchanged).

## User Request
S1: Update wizard header from "New Project Wizard" to dynamic "{Project name} - FILE MANAGER".
Completed: COMPLETED

## Coding implementation
- Added `wizardHeaderTitle` derived from current step and trimmed project name, defaulting to "Unnamed Project - FILE MANAGER" when blank (`src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx`).
- swapped static header copy with dynamic variable while preserving existing styling and semantics.
- Lint verification: `npm exec -- eslint src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx`.

## Notes
- Referenced dynamic heading accessibility guidance to confirm semantic approach.
