# Step 4.3 Report — Renderer Uses Schema-Aligned IPC

- **Scope**: Updated project management views and stores to consume the new database IPC helpers while tolerating optional collections (A4, A21–A23).
- **Key Changes**:
  - Rewired `listProjects` / `deleteProject` in `src/core/ipc/client.ts` to delegate to the v2 commands, translating `ProjectRecord` DTOs into UI-friendly summaries with safer defaults.
  - Relaxed project filter/state types to accept dynamic status/type values and ensured selectors fallback gracefully when language pairs/files are absent.
  - Adjusted overview placeholders and batch panels to handle undefined counts and non-standard statuses without crashing.
- **Verification**: `pnpm typecheck` and `pnpm lint` (warnings only) confirm the React surface compiles against the new IPC contract.
- **Open Items**: Forms still rely on legacy creation IPC and will be migrated alongside validation upgrades in Step 4.4.
