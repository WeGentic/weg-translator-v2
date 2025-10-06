# Subtask 5.2.1 — Project Manager v2 Contributor Notes (2025-02-23)

## React 19 Adoption Snapshot
- Hooks leverage the React 19 Compiler; avoid manual memoisation unless profiling proves necessary. Follow existing patterns (`useProjectsResource`, `useCreateProjectAction`) that keep hook order static and side-effect free.
- Data fetching is Suspense-first: resource reads call `use(promise)` and UI mounts `ProjectsBoundary` / `ProjectsError` to surface loading + retry states. New async work should plug into the resource layer rather than bespoke `useEffect` fetches.
- Mutations are modelled as React 19 Actions via `useActionState`, which gives us pending status, optimistic cache updates, and built-in `startTransition` semantics. When adding new mutations, co-locate optimistic `mutateProjectsResource` calls with toast messaging inside dedicated action hooks.

## Directory Strategy Refresher
- All v2 code lives under `src/features/project-manager-v2/`; legacy files in `src/features/project-manager/` remain untouched for feature-flag fallback.
- Folder taxonomy mirrors the plan documented in `docs/ProjectManagerV2_DirectoryLayout.md`: `data/` (Suspense resources), `state/` (Zustand store + provider), `actions/` (IPC mutations), `content/` (table rendering), `shell/` (layout + boundaries), `sidebar/`, `wizard/`, `utils/`, and `styles/`.
- Shared primitives stay outside the feature folder (`@/components/ui/*`, `@/lib/*`). If you need a new cross-feature helper, place it in `src/lib/` and update both v1/v2 call sites so the fallback path keeps working.

## Contribution Guidelines
1. Wrap any new UI inside existing providers (`ProjectManagerStoreProvider`, `ProjectsBoundary`) to preserve Suspense + selection wiring.
2. Prefer TanStack Table configuration in `table/` modules; avoid inline `useReactTable` calls so future column changes remain centralised.
3. When touching IPC, update the action hooks **and** the Vitest coverage under `src/test/features/project-manager-v2/actions/` to exercise success + failure cases.
4. Respect WeGentic palette tokens (`--color-tr-*`). New Tailwind classes should reference these CSS variables to maintain theming parity with v1.
5. Run `npm run lint` and the targeted shell tests (`npm run test -- --run src/test/features/project-manager-v2/**`) before opening PRs; Suspense errors surface quickly when providers are mis-ordered.

## Open Questions / Follow-ups
- Remote config wiring for the feature flag is pending Task 5.2.2; contributors adding new surfaces should guard them with `isProjectManagerV2Enabled()` until rollout completes.
- Wizard file validation still shares helpers with v1. Monitor for opportunities to consolidate into `wizard/utils/` once both paths stabilise.
- Track layout regressions against legacy styles via visual diffing once the sidebar modernization (Task 4) ships.
