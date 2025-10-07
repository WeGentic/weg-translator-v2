# Task 1 Domain Blueprint Summary

## Inventory Highlights
- Catalogued TanStack Router entrypoints (`__root.tsx`, `/`, `/login`, `/dashboard`, `/resources`) and confirmed layout orchestration inside `MainLayout` plus navigation event wiring.
- Documented feature surface areas across `src/features` and `src/components`, noting dependencies on layout stores, IPC commands, toasts, and sidecar integrations.
- Flagged supporting layers (hooks, lib, ipc, logging, contexts) for relocation into `core`, `shared`, or future module packages based on coupling.

## Module Responsibility Matrix
- **projects**: owns project grid, overview, conversions; needs `routes/`, `components/`, `state/`, `services/`, `ipc/` plus OpenXLIFF bridge.
- **workspace**: manages primary app shell, global menu state, navigation events; exposes default `/` route and coordination hooks.
- **resources**: encapsulates asset/resource management view; poised for future data loaders and filters.
- **dashboard**: landing analytics/cards with light state for metrics fetching.
- **settings**: wraps enhanced settings panel, Supabase-backed mutations, and route integration.
- **history**: provides translation history table + filters using dedicated hook and event subscription.
- **auth**: houses login flow, Supabase session helpers, and guards.
- **editor**: centralizes editor panel, placeholders, and state linking to workspace.
- Orphaned utilities (OpenXLIFF panel, logging console) to merge into dedicated modules (`projects`, `diagnostics`) as scope clarifies.

## Shared & Core Segmentation
- **shared**: ShadCN UI primitives, typography/icons, Toast + feedback patterns, generic hooks (`useDebouncedValue`, `useFileDrop`, `useMediaQuery`, `useTauriFileDrop`), and utility suites (`cn`, datetime, validators) with centralized theme CSS.
- **core**: IPC invoke client/events/types, OpenXLIFF sidecar runners, logging provider/logger, environment + Supabase config, platform plugin wrappers, and global layout/workspace stores pending modularization.

## Migration Strategy & Risk Controls
- Phase sequence: bootstrap `core`/`shared` scaffolding → migrate infrastructure → consolidate shared assets → move router → migrate modules domain-by-domain → remove shims.
- Temporary shims via legacy barrels (e.g., `@/features/*`) until consumers converted; dual aliases maintained in `tsconfig`/`vite.config` with lint warnings to enforce deprecation.
- Validation gates per tranche: `npm run lint`, `npm run test`, `npm run typecheck`, targeted `tauri dev` smoke (navigation, project load, settings update).
- Track progress in `docs/domain-refactor-journal.md` once created; summarize deltas per PR for reviewer clarity.

## Recommended Next Actions
- Start Task 2: align TypeScript/Vite aliases with new `core`/`shared`/`modules` structure while preserving backwards-compatible paths.
- Prepare shared theme extraction plan to accompany UI primitive move.
- Draft communication to reviewers outlining phased rollout and testing expectations.
