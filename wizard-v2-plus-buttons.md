# wizard-v2-plus-buttons

## Current User Request Analysis
- The wizard details step currently renders static labels for project field and client inputs without adjacent action controls.
- Popover dropdown for project field lists predefined options sourced from `PROJECT_FIELDS` with no affordance for adding new values.
- Client input is a plain text field with no linkage to persisted clients; database search and creation flows are absent.

## Problem Breakdown
- Identify injection points in `WizardDetailsStep.tsx` for placing icon-only buttons aligned with existing label typography.
- Ensure new buttons reuse shared icon styling patterns and remain accessible (aria labels, keyboard-friendly).
- Extend `wizard-v2.css` with minimal, cohesive rules to support horizontal label + action layouts and icon button appearance.
- Design an autocomplete UX tied to SQLite-backed client records (fetch, filter, selection sync with wizard state).
- Introduce a secondary dialog workflow for creating clients, including trigger points (plus button and inline CTA).
- Surface a dynamic hint beneath the client field whenever typed input does not match existing records and wire it to open the dialog.
- Confirm lucide `Plus` icon import is reused without reintroducing duplicates or unused imports.
- Validate that structural changes do not break current layout responsiveness or React compiler constraints.

## User Request
S1: Add a Plus button on the right of Client Fields and within the Project Field dropdown (functions to be added later).
Completed: IN REVIEW
S2: Implement client autocomplete with database search and a new client dialog (plus button + inline CTA).
Completed: IN REVIEW

## Coding implementation
- `src/modules/projects/components/wizard-v2/components/WizardDetailsStep.tsx`: added icon-only actions for client entry and project field creation while preserving existing combobox interactions, aligned the project field button beside the label per feedback, and wrapped both controls in tooltips with accessible labels.
- `src/modules/projects/components/wizard-v2/wizard-v2.css`: introduced shared icon button styling, label alignment helpers, and removed the temporary popover toolbar in favor of the outside-aligned action.
- `src/modules/projects/components/wizard-v2/components/WizardClientField.tsx`: new controlled autocomplete input that filters persisted clients once three characters are entered, exposes keyboard navigation, and surfaces inline CTA plus explanatory messaging when no exact match exists.
- `src/modules/projects/components/wizard-v2/hooks/useWizardClients.ts`: hook that asynchronously loads client records with cancellation guards and exposes a refresh entrypoint.
- `src/modules/projects/components/wizard-v2/hooks/useWizardClients.ts`: hook that asynchronously loads client records with cancellation guards and exposes a refresh entrypoint plus an ordered `upsert`.
- `src/modules/projects/components/wizard-v2/components/WizardNewClientDialog.tsx`: full client form aligned with schema, including optional metadata fields, submission feedback, and disabling while persisting.
- `src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx`: wired client selection state, dialog lifecycle, and backend submission integration (persisting new clients, updating local cache, and applying the created `clientUuid`).

## Notes
- React 19 icon-button accessibility reviewed; ensure icons carry `aria-hidden="true"` with visible labels exposed via `aria-label`.
- Lint: `npm run lint -- src/modules/projects/components/wizard-v2/components/WizardDetailsStep.tsx src/modules/projects/components/wizard-v2/components/WizardClientField.tsx src/modules/projects/components/wizard-v2/components/WizardNewClientDialog.tsx src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx src/modules/projects/components/wizard-v2/hooks/useWizardClients.ts`
