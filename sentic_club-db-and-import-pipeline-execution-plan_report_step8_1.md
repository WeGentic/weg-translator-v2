# Step 8.1 Completion Report

## Summary
- Added `src-tauri/migrations/016_create_notes.sql` establishing the `notes` table with cascaded project deletion, restricted user deletion, and UTC timestamp defaults for per-project annotations.

## Validation
- Automated migration tests remain pending (Task 22); none executed for this step.

## Notes
- Body stored as TEXT allowing multiline content; future tasks may extend with updated_at or indexing as needed.
