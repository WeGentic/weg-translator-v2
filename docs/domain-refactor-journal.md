# Domain Refactor Journal

Purpose: capture reviewer guidance and migration checkpoints while the codebase transitions from legacy `src/features`/`src/components` folders into the new `src/modules`, `src/shared`, and `src/core` structure.

---

## Reviewer Checklist (Running)
- Verify new imports use `@/modules`, `@/shared`, or `@/core` aliases instead of deep relative paths or legacy `@/features` references.
- Confirm updated files continue to rely on centralized theme tokens once `src/shared/styles/theme.css` lands; flag hardcoded color literals that bypass palette variables.
- Ensure Tailwind utility additions still compile with auto-detected sources or the declared `@source` directives—spot check `App.css` when modules move.
- Check that IPC and state management calls originating from modules continue to import through the typed wrappers inside `src/core` (once the migration reaches Task 3).
- Request localized tests or Storybook stories follow the target folder (co-locate under the module) to keep future Task 8 changes simple.

## Entry Log

### Entry 2025-02-14
- Established alias parity across TypeScript, Vite, and ESLint to unblock module imports. Documented in `docs/task-2-alias-updates-documentation.md` for cross-reference.
- Drafted shared theme plan; reviewer flag: hold modules that still import directly from `src/App.css` until the shared theme file exists to avoid merge conflicts.
- Reminder for upcoming PRs: note when Tailwind `@source` directives are added so reviewers can verify they match actual module paths.

### Entry 2025-03-01
- Removed legacy `src/components`, `src/features`, `src/hooks`, `src/lib`, and `src/styles` folders; new work must target `src/modules`, `src/app`, `src/core`, or `src/shared` equivalents.
- Updated import guidance: constants formerly under `@/lib/file-formats` now live at `@/modules/projects/config`; adjust wizard/overview consumers accordingly.
- Deprecated alias `@/components/ui` has been removed from tsconfig/vite; use `@/shared/ui` or module-level barrels instead.
- ShadCN generator (`components.json`) now maps `components` to `@/shared/ui` and `lib` to `@/core`; ensure local scaffolding pulls from the refreshed aliases before generating new primitives.

### Entry 2025-03-08
- Ticket: Extract shared palette and semantic tokens into `src/shared/styles/theme.css`, wire Tailwind `@source` directives, and update `App.css` to import the shared theme (owner: Frontend Infrastructure).
- Ticket: Polish OpenXLIFF create-project wizard (error surfaces, optimistic state reset) and align IPC mocks with new `@/core/ipc` adapters (owner: Projects Domain).
- Ticket: Instrument workspace layout telemetry once analytics provider finalizes, ensuring sidebar/panel toggles emit structured events via `@/core/logging` (owner: App Shell).
- Ticket: Finish relocating router-aware hooks (`useWorkspaceShell`, `useSidebarTwoContentSync`) into domain barrels and add unit coverage for the navigation event bus (owner: App Shell).

---

_Add new entries with the date and concise bullet points describing what reviewers should watch for in incremental PRs._
