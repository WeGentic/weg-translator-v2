# Task 6 – Frontend Data Loading Summary

- Completed: 2025-09-23
- Reworked `src/components/projects/editor/ProjectEditor.tsx` to fetch `ProjectDetails`, select the freshest completed conversion with JLIFF/tag-map artifacts, and surface friendly errors when prerequisites are missing.
- Hydrated the editor by reading artifacts through IPC, validating JSON payloads, normalising into `SegmentRow[]`, and caching conversion metadata plus derived summaries (total, untranslated, placeholder mismatches, languages, artifact paths).
- Added a provisional preview viewport while the virtualised table is pending, ensuring the editor canvas reflects loaded segment data and parity diagnostics.
- Expanded Vitest coverage in `src/components/projects/editor/ProjectEditor.test.tsx` covering happy-path hydration, missing-conversion errors, and the no-file placeholder state.
- Tests: `npm run test -- ProjectEditor.test.tsx`

Next steps: implement Task 7 virtualised `SegmentsTable` with TanStack Table and connect it to the hydrated artifacts.
