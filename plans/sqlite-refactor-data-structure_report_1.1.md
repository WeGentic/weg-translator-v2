# Step 1.1 Report — Database Access Inventory

- **Scope**: Enumerated backend (`src-tauri/src`) and frontend (`src`) database entry points per refactor plan requirements A1, A2, A24.
- **Method**: Ran `rg "sqlx" src-tauri/src -n` and supplementary searches for `DbManager` consumers and TypeScript IPC invocations. Consulted external best practices on cataloging database access to ensure coverage.
- **Deliverable**: Created `docs/db-refactor-catalog.md` documenting every Rust module, direct SQL block, and TypeScript wrapper that touches SQLite, listing intent and downstream usage.
- **Observations**:
  - Numerous `DbManager` methods live under `db/operations/*`; these underpin all current CRUD logic.
  - Two IPC modules (`projects/service.rs`, `projects/artifacts.rs`) embed raw SQL outside the operations layer, requiring special attention during refactor.
  - Frontend access is centralized in `src/core/ipc/client.ts`, with project UI as the dominant consumer.
- **Open Questions**: None at this stage; catalog covers all discovered touchpoints.
