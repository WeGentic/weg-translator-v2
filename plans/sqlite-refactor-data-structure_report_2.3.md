# Step 2.3 Report — Legacy Database Removal

- **Scope**: Enforced the "always fresh" database requirement (A3) by removing the existing SQLite file before every bootstrap.
- **Key Changes**:
  - Modified `DbManager::connect_pool` to delete the prior database file regardless of environment variables, logging the removal (`info`) or absence (`debug`) outcome.
  - Dropped the `WEG_TRANSLATOR_RESET_DB` feature flag and helper function so no legacy path can retain stale data.
- **Verification**: `cargo check` from `src-tauri` passes with the new logic.
- **Next Focus**: Implement triggers for timestamps and language-pair validation (Step 2.4).
