# Executive Summary

The Weg Translator frontend contains 55 files (162 occurrences) that depend on `useEffect` for bootstrapping, data fetching, router transitions, and DOM subscriptions. React 19 guidance and our codebase analysis show recurring lifecycle guards (`isMountedRef`, timer cleanups, manual event listeners) that hinder concurrency safety and React Compiler adoption. The proposed plan introduces four pillars—Resource layer, Event Store layer, Transition Orchestrator, and Form Action suite—to remove imperative effects while preserving functionality across Supabase auth, Tauri IPC bridges, and workspace UI. Success is defined by zero remaining `useEffect` imports, sustained feature parity, and a stable test suite.

# Key Decisions
- Adopt React Query-backed `createResource` helpers and suspense to replace manual fetch/poll effects in hooks (Req#2, Phase 2).
- Standardize DOM/Tauri subscriptions via `createEventStore` built on `useSyncExternalStore`, providing reusable, compiler-friendly hooks (Req#3, Phase 2).
- Rebuild transition logic with a finite-state controller and scheduler utilities, eliminating timer effects and aligning with TanStack Router events (Req#4, Phase 3).
- Convert auth and wizard workflows to React 19 Actions with debounced validation through shared schedulers (Req#5, Phase 3).
- Maintain log streaming, shell readiness, and error boundary behavior by refactoring providers with the new primitives (Req#1, Phase 1).

# Risks & Mitigations
- **Regression Scope**: Touches critical auth/project modules. Mitigation: phased rollout with feature flags, expanded Vitest coverage, QA regression (Task 7.2).
- **Concurrency Semantics**: New abstractions must handle concurrent renders. Mitigation: rely on `useSyncExternalStore`, suspense, and deterministic schedulers, backed by targeted tests (Tasks 1.3, 5.1).
- **Experimental APIs Stability**: React 19 resources/actions still evolving. Mitigation: wrap constructs with internal adapters to swap implementations if upstream APIs change.
- **Team Familiarity**: Developers need onboarding to new patterns. Mitigation: document utilities, provide migration notes (Task 7.3), and pair with internal workshops.

# Immediate Next Actions
1. Implement infrastructure utilities (`createResource`, `createEventStore`, scheduler) and migrate core providers (Tasks 1.x–2.x).
2. Draft RFC/tech review with stakeholders to validate assumptions around React 19 features and rollout sequencing.
3. Prepare QA test plan covering Supabase flows, translation history, and transition behaviors prior to Phase 2 migrations.
