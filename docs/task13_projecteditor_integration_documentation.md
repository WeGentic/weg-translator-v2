# Task 13.E — Project Editor Integration + QC Filters (2025-09-24)

## Scope
- Completed sub-task 13.E by wiring the editor shell to react to file context changes and surface project-level summary data directly in the header.
- Finished Task 19.6 by introducing a QC toggle that filters out “ok” segments while preserving virtualization performance and accessibility guarantees.

## Key Changes
- Updated `src/components/projects/editor/ProjectEditor.tsx` to reset scroll position safely on file switches, pass the active file identifier into the table, and expose language/segment metrics in the header meta block.
- Extended `src/components/projects/editor/SegmentsTable.tsx` with a `statusMismatch` filter, labelled ShadCN checkbox control, and resilient scroll reset logic for the virtualizer.
- Added a regression test in `src/components/projects/editor/ProjectEditor.test.tsx` covering the mismatch-only filter and refreshed fixtures to include a placeholder mismatch scenario.
- Refreshed `docs/Plan_Jliff_Visualization.md` with completed statuses for steps 13.E.1, 13.E.2, 19.6, and captured the new reference checks against TanStack docs.

## Validation
- `npm run test:run -- ProjectEditor`

## Follow-up
- Step 9.D.3 (save flow toast integration) remains in progress and should be finalized before addressing Task 20 acceptance scenarios.
- Task 20 demo steps are still open; once QC filters and header metrics stabilize in manual QA, proceed with the end-to-end demo validation.
