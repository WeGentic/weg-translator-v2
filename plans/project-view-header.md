# project-view-header

## Current User Request Analysis
- The user requires `ProjectViewHeader` to remain within the fixed-height header zone, using the existing divider, and to follow a strict layout: a single-row project name column, a second column with three stacked metadata rows, and a rightmost close button.
- Existing implementation uses a grid layout that can grow vertically and does not guarantee the specified column/row structure.

## Problem Breakdown
- Rework the header markup to a three-column structure: column 1 (project title), column 2 (three metadata rows: status, created/updated, client/subject), column 3 (close button).
- Update CSS to enforce fixed header height, prevent vertical overflow, and align each column/row according to hierarchy while respecting palette tokens.
- Ensure text truncation where necessary so content remains within the fixed height.
- Keep existing close behavior and divider intact, validating accessibility (aria attributes, button label).
- Re-run linting to confirm no new errors.

## User Request
S1: Refactor and improve the project view header with left-aligned metadata (name, status, timestamps, client/subject), right-aligned close button, and dedicated CSS.
Completed: NOT COMPLETED

## Coding implementation
- Added `utils/project-dates.ts` to centralize project date formatting and updated `ProjectViewContent` to consume it while demoting the hero heading to `h2`.
- Rebuilt `ProjectViewHeader` with a three-column fixed-height layout: column 1 holds the project name with a stacked status badge, column 2 presents timestamps/client/subject rows, and column 3 hosts an icon-only close button.
- Scoped styles in `css/ProjectViewHeader.css` to enforce column ordering, fixed height, left-aligned metadata (timestamps + combined client/subject row), and compact typography/badge sizing in column 1 alongside an icon-only close button while keeping palette usage consistent.
- Added a subtle vertical divider between the first and second columns to improve visual hierarchy without affecting header height.
- Passed typed props from `ProjectViewRoute`, including a router-close callback, to the new header implementation.

## Notes
- `npm run lint` (warnings only; existing issues remain outside touched files).
