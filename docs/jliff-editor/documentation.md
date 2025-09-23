# JLIFF Editor Save Flow Update Documentation

## Summary
- Introduced a dedicated `TargetEditor` form component that uses React 19 `useActionState` to invoke the new IPC bridge (`updateJliffSegment`) and present inline success/error feedback.
- Added a lightweight `RowActions` control strip (mocked in tests) to expose copy/reset/save buttons and surface pending state to the action UI.
- Updated the virtualized `SegmentsTable` to embed the editor and placeholder inspector inside expanded detail rows, expand rows whenever a transunit is editable, and surface an explicit edit action column.
- Extended `ProjectEditor` state management to re-normalize JLIFF/tag-map artifacts after a save, track a version seed for token cache busting, and refresh summary metrics.
- Augmented `ProjectEditor.test.tsx` with a regression test that verifies the save path, IPC invocation, and summary updates using a mocked `RowActions` component.

## Tests
- `npm run lint` (passes with pre-existing warnings from `ProjectEditor.tsx` hook setters).
- `npm run test -- --run` (Vitest suite covering updated editor integration).

## Follow-ups
- Implement placeholder insertion/validation tests (Plan Step 11.4) and parity filters (Task 10).
- Evaluate exposing parity filter toggles and outstanding QC badges on the table header.
