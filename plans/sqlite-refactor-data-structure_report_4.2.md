# Step 4.2 Report — IPC Wrappers Migrated to v2 Commands

- **Scope**: Implemented renderer-side IPC adapters that speak to the new `*_v2` Tauri commands for users, clients, projects, artifacts, and jobs (A4).
- **Key Changes**:
  - Introduced `src/core/ipc/request.ts` to centralize error-normalised `safeInvoke` logic reused across modules.
  - Added domain-specific wrappers under `src/core/ipc/db/` that map between DTOs and the shared schema types in `src/shared/types/database.ts` while enforcing required invariants (e.g., project language pair requirements).
- **Verification**: `pnpm typecheck` and `pnpm lint` (warnings only) run cleanly, confirming the new wrappers integrate without type or lint regressions.
- **Open Items**: Next step refactors UI/state modules to adopt these wrappers (Step 4.3).
