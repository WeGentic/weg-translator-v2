# wizard-file-role-summary

## Current User Request Analysis
- Enhance file table header to surface counts per file role alongside total queued files.
- Requirement targets `WizardFilesStep` header copy without altering table structure.

## Problem Breakdown
- Need to derive counts from the `files` array each render; should prefer memoization to avoid redundant work when inputs unchanged.
- Must order roles consistently and only display categories with non-zero counts; include non-editable `image` role.
- Styling update required so header accommodates multi-line layout without breaking existing spacing.
- Ensure accessibility by keeping concise text and providing descriptive label for the aggregated information.

## User Request
S1: Display file counts broken down by role within the table header.
Completed: NOT COMPLETED

## Coding implementation
- Added memoised role count derivation in `WizardFilesStep` leveraging `FILE_ROLE_LABELS` and consistent role order.
- Rendered summary string in header when counts present and supplied accessible label.
- Updated wizard CSS to stack header content and style the new summary line.
- ESLint verification: `npm exec -- eslint src/modules/projects/components/wizard-v2/components/WizardFilesStep.tsx`.

## Notes
- Existing `FILE_ROLE_LABELS` constant offers human-readable copy; leverage it for output.
