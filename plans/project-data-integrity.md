# project-data-integrity
        
## Current User Request Analysis
- Need to review the create-project wizard payload against the new DB schema summary to confirm every required entity (project record, subjects list, language pairs, files, jobs/artifacts) is persisted correctly.
- Projects table view currently shows stale metadata: columns include `Type`, lacks `Subject`, and the Files count remains zero even after files are attached, indicating summary data is not coming back from the backend.

## Problem Breakdown
- Inspect wizard finalize/build flow plus IPC calls to validate fields (name, status, client, subjects, language pairs, notes, file attachments) align with `docs/db-refactor-summary.md` expectations; patch any missing pieces.
- Extend list-project IPC/DTOs so each row includes actual `file_count` and subjects (likely first subject or the set) without breaking other consumers.
- Update React datagrid to drop the `Type` column, surface a `Subject` column, and wire the Files badge to the real count.
- Refresh affected types, mapping helpers, and tests to stay type-safe and aligned with the new data.

## User Request
S1: 
- Check src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx flow -> docs/db-refactor-summary.md. Are all data is correctly written? 
- Fix the project manager datagrid, remove Type and Add Subject, Fix files (even if files are loaded it shows 0,
Completed: COMPLETED
        
## Coding implementation
- Confirmed wizard finalize payload covers schema requirements (subjects, language pairs, notes, client) and tightened subject handling with shared resolver utilities.
- Added aggregated project summaries in Rust (`ProjectListRecord`) exposing `subjects` and `file_count`; extended IPC DTOs plus TypeScript mappings so front-end lists receive real counts/subjects.
- Refactored project manager datagrid to surface the Subject column, drop Type, and rely on the new data; updated state types, shared constants, and Vitest coverage accordingly.
- Enriched project rows with client names and refreshed grid presentation: project name cells now include the client line, and Created/Updated columns present centered two-line date/time output.
- Synced supporting utilities/tests, ensured search filters include subjects, and ran `cargo fmt` plus `npm run test -- ProjectManagerContent`.
        
## Notes
- Next follow-up: consider exposing richer subject selection (multi-select) now that the pipeline persists full arrays.
