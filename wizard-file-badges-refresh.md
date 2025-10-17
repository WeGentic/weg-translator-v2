# wizard-file-badges-refresh

## Current User Request Analysis
- Improve readability of file type/role indicators by giving each category a distinct visual treatment.
- Ensure long file names truncate elegantly with ellipsis instead of wrapping across multiple lines.
- Adjust file type column width to accommodate new badge styling without crowding other columns.

## Problem Breakdown
- File list currently applies a single neutral badge style and relies on `word-break` for names, leading to uneven wrapping.
- Need deterministic mapping from file extensions to color variants while fitting within WeGentic palette constraints.
- Role selector uses Radix `Select`; must maintain accessible focus states while applying color accents.
- CSS updates must stay scoped to wizard styles to avoid regressions in shared table components.

## User Request
S1: Color-code file type/role indicators, ellipsize long names, and widen the type column.
Completed: COMPLETED

## Coding implementation
- Added file-type classification helper + variant class mappings inside `WizardFilesStep` to drive color-coded badges and role-specific triggers.
- Displayed uppercase extension labels, widened type column to 130px, and ensured file names ellipsize with tooltip via `title`.
- Expanded wizard CSS with palette-compliant badge/trigger variants using subtle neutral backgrounds and high-contrast accent borders, plus select menu accents and ellipsis styling.
- Lint verification: `npm exec -- eslint src/modules/projects/components/wizard-v2/components/WizardFilesStep.tsx`.

## Notes
- Will define TypeScript helper to categorise extensions before applying CSS classes.
- Additional lint run required because component logic changes. (Completed)
