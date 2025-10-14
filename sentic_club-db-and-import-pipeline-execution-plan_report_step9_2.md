# Step 9.2 Completion Report

## Summary
- Introduced BCP-47 normalization by adding the `language-tags` dependency and updating `src-tauri/src/ipc/commands/projects/validation.rs` to parse/format tags, returning canonical casing and rejecting invalid inputs.
- Updated `src-tauri/src/ipc/commands/projects/service.rs` to propagate validation errors and store normalized defaults, aligning with guidance from the `language-tags` crate maintainers [language-tags crate](https://github.com/pyfisch/rust-language-tags).

## Validation
- Existing unit tests updated to cover normalization and error paths; full test suite not executed yet (scheduled under Task 22).

## Notes
- Invalid tags now produce user-facing validation errors, preventing inconsistent locale storage ahead of migration backfills.
