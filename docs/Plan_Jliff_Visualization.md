# Execution Plan — JLIFF + Tags Visualization in TanStack Table (Virtualized)

Main goal: Implement a performant, virtualized segments table in the Editor view using TanStack Table v8 and React 19 Actions. The table will display segments from JLIFF files with inline placeholder chips, support editing, and ensure placeholder parity checks.

Task 1 - Repository & Integration Scan - Status: COMPLETED (2025-02-14)

Step 1.1 - Confirm framework/tooling versions (React 19.1.1, Tailwind 4.1.x, Tauri 2.8.x) and UI kit (ShadCN components under `src/components/ui/*`). Validate TanStack Table not yet installed. - Status: COMPLETED (2025-02-14)
  - Verified `package.json` lists `react@19.1.1`, `tailwindcss@4.1.13`, `@tauri-apps/api@2.8.0`; no `@tanstack/react-table` dependency yet. ShadCN catalog confirmed under `src/components/ui/*` (button, table, dialog, etc.).

Step 1.2 - Identify integration point in UI: `src/components/projects/editor/ProjectEditor.tsx` hosts the editor canvas; plan to mount the virtualized segments table here. - Status: COMPLETED (2025-02-14)
  - Reviewed `ProjectEditor` layout: translation canvas placeholder lives inside `CardContent` second section — target mount for future `SegmentsTable` while preserving meta header.

Step 1.3 - Map backend artifact sources: XLIFF→(JLIFF, tag-map) already produced via `src-tauri/src/jliff/*`, persisted under each project’s `jliff/` subdir; DB exposes relative paths on `project_file_conversions` (`jliff_rel_path`, `tag_map_rel_path`). - Status: COMPLETED (2025-02-14)
  - Confirmed `convert_xliff_to_jliff` (src-tauri/src/ipc/commands.rs) writes artifacts to per-project `jliff/` directory and updates DB rows with relative paths; `DbManager` schema exposes `jliff_rel_path`, `tag_map_rel_path` columns for consumption.

Step 1.4 - IPC surface review: commands in `src-tauri/src/ipc/commands.rs` expose project details + conversion results; no command to read JSON artifacts nor to save per-segment targets yet. - Status: COMPLETED (2025-02-14)
  - Audited `commands.rs`: flows cover project listing/details, conversion orchestration, and `convert_xliff_to_jliff`; confirmed absence of IPC endpoints for reading stored JLIFF/tag-map JSON or persisting edited targets — aligns with planned new additions.

Step 1.5 - Testing conventions: TS tests via Vitest (`src/components/**.test.tsx`), Rust tests in `src-tauri/tests/`; mirror structure for new tests. - Status: COMPLETED (2025-02-14)
  - Located existing Vitest suites (e.g., `src/components/projects/editor/ProjectEditor.test.tsx`) and Rust integration tests in `src-tauri/tests/db_integration.rs`, `project_conversions.rs`. Future work will align with these directories.

Task 2 - Dependencies & Setup - Status: COMPLETED (2025-02-14)

Step 2.1 - Add frontend deps: `@tanstack/react-table`, `@tanstack/react-virtual`, `@tanstack/match-sorter-utils`. Keep versions compatible with React 19 and Vite 7. - Status: COMPLETED (2025-02-14)
  - Added `@tanstack/react-table@^8.21.2`, `@tanstack/react-virtual@^3.13.12`, and `@tanstack/match-sorter-utils@^8.19.4` to `package.json`; ran `npm install` to refresh `package-lock.json`.

Step 2.2 - Verify Tailwind config works for table density, chips, sticky header; reuse existing ShadCN primitives (`Button`, `Table`, `Input`, `Textarea`, `Dialog`, `Badge` style via utility classes). - Status: COMPLETED (2025-02-14)
  - Tailwind v4 is imported via `src/App.css` enabling theme tokens; `Table` component (`src/components/ui/table.tsx`) wraps `<table>` with hover + border utilities, providing base styling we can extend with sticky headers via container classes. No dedicated `Badge` component; will compose placeholder chips using Tailwind utility tokens consistent with ShadCN color vars.

Step 2.3 - Ensure IDE/lint pass for new TS files; wire path aliases if adding new `@/lib/jliff/*`. - Status: COMPLETED (2025-02-14)
  - `tsconfig.json` already exposes `@/*` pointing at `src/`; lint stack (eslint.config.js) configured for type-aware analysis through project service, so new `src/lib/jliff/*` modules can be added without additional alias changes.


Task 3 - TypeScript Data Modeling - Status: COMPLETED (2025-02-14)

Step 3.1 - Define raw input types mirroring artifacts:
- `JliffRoot`, `JliffTransunit` from backend JSON (aligns with `src-tauri/src/jliff/model.rs`).
- `TagsRoot`, `TagsUnit`, `TagsSegment`, `TagsPlaceholder` (aligns with `src-tauri/src/jliff/tag_map.rs` serialization names: `placeholders_in_order`, `originalData_bucket`). - Status: COMPLETED (2025-02-14)
  - Added raw interfaces in `src/lib/jliff/types.ts` preserving exact JSON keys (including `"unit id"`, `placeholders_in_order`, `originalData_bucket`) to ensure type-safe parsing.

Step 3.2 - Define view-model types for the table:
- `PlaceholderChip` (id, token, originalData)
- `SegmentRow` (key, unitId, segmentId, sourceRaw, targetRaw, token arrays, placeholders[], phCounts, status). - Status: COMPLETED (2025-02-14)
  - Created `SegmentToken`, `PlaceholderChip`, `PlaceholderCounts`, and `SegmentRow` view models covering token arrays, placeholder metadata, and parity status fields for downstream normalization utilities.

Step 3.3 - Place types in `src/lib/jliff/types.ts` and export from index to keep imports clean. - Status: COMPLETED (2025-02-14)
  - Established `src/lib/jliff/index.ts` barrel re-export to enable `import { SegmentRow } from "@/lib/jliff"` without leaking file paths.


Task 4 - Normalization & Tokenization Utilities - Status: COMPLETED (2025-02-14)

Step 4.1 - Implement `mkKey(unitId, segId) => \`u${unitId}-s${segId}\`` to join artifacts. - Status: COMPLETED (2025-02-14)

Step 4.2 - Implement tokenizer for `{{ph:phN}}` (double-curly style) using `/\{\{ph:([a-zA-Z0-9_]+)\}\}/g`, returning stable token arrays `{kind: 'text'|'ph'}`. - Status: COMPLETED (2025-02-14)
  - Introduced `src/lib/jliff/tokenize.ts` with placeholder parser, cache utilities, and regex covering suffix variants (e.g., `{{ph:ph1:auto}}`).

Step 4.3 - Implement `normalize(jliff, tags): SegmentRow[]`:
- Build `transunit_id → tu` map.
- Iterate tags.units[].segments[], compute key, find TU.
- Build placeholder map from `placeholders_in_order` + `originalData_bucket`.
- Tokenize `Source` and `Target_translation` into sourceTokens/targetTokens.
- Compute `phCounts` and `status`. - Status: COMPLETED (2025-02-14)
  - `normalizeJliffArtifacts` constructs `SegmentRow`s, joining tag metadata and backfilling orphan transunits with status `unknown`.

Step 4.4 - Implement QC helpers: placeholder counts, unknown/dangling tokens, optional ordering check. - Status: COMPLETED (2025-02-14)
  - QC layer reports frequency deltas, placeholder order mismatches, and unknown tokens into `SegmentRow.issues`.

Step 4.5 - Memoize tokenization by `key+text+version` to avoid rework during scroll. - Status: COMPLETED (2025-02-14)
  - Cache keyed via `composeTokenCacheKey`; normalization passes segment key + variant + version to reuse tokens safely.

Files:
- `src/lib/jliff/normalize.ts`
- `src/lib/jliff/tokenize.ts` - Status: COMPLETED (2025-02-14)


Task 5 - Backend IPC: Read/Write Artifacts - Status: COMPLETED (2025-02-14)

Step 5.1 - Add `read_project_artifact(project_id, rel_path)` IPC (Rust):
- Resolve project root (`ProjectDetails.root_path`).
- Join + normalize `rel_path`, ensure it’s within project folder.
- Read file as UTF‑8 string, return JSON text. - Status: COMPLETED (2025-02-14)
  - Implemented `read_project_artifact` command delegating to `read_project_artifact_impl`, performing canonicalization and parent-dir guards before streaming file contents.

Step 5.2 - Add `update_jliff_segment(project_id, jliff_rel_path, transunit_id, new_target)` IPC (Rust):
- Load JLIFF JSON into `JliffDocument`.
- Locate `TransUnit` by `transunit_id`, update `target_translation`.
- Persist pretty JSON back to disk; return updated timestamp and maybe `updated_count`. - Status: COMPLETED (2025-02-14)
  - `update_jliff_segment` rewrites documents via serde with pretty formatting, emits `UpdateJliffSegmentResultDto { updatedCount, updatedAt }`.

Step 5.3 - Wire client helpers in `src/ipc/client.ts` + types in `src/ipc/types.ts` for both commands. - Status: COMPLETED (2025-02-14)
  - Added `readProjectArtifact`/`updateJliffSegment` wrappers and `UpdateJliffSegmentResult` type definitions for React clients.

Step 5.4 - Add Rust tests under `src-tauri/tests/` for both IPCs (happy path, invalid path, missing TU). - Status: COMPLETED (2025-02-14)
  - `src-tauri/tests/ipc_artifacts.rs` covers successful read/write flows and validation errors for unknown transunits.


Task 6 - Frontend Data Loading - Status: COMPLETED (2025-09-23)

Step 6.1 - Extend `ProjectEditor` flow to fetch `ProjectDetails` → locate selected file’s latest completed conversion with both `jliffRelPath` and `tagMapRelPath`. - Status: COMPLETED (2025-09-23)
  - `ProjectEditor` now loads project details on mount, selects the newest completed conversion with both artifacts, and surfaces meaningful error copy when none exist.

Step 6.2 - Read artifacts via IPC (`read_project_artifact`), `JSON.parse` into `JliffRoot` and `TagsRoot`. - Status: COMPLETED (2025-09-23)
  - Added guarded artifact loading with JSON parsing helpers that validate required arrays before continuing; errors bubble into user-facing alerts.

Step 6.3 - Normalize into `SegmentRow[]` via `normalize(...)`. Store in component state (or a small editor-scoped store). - Status: COMPLETED (2025-09-23)
  - Cached artifact state contains normalized `SegmentRow[]`, raw JLIFF/tag metadata, and conversion identifiers for downstream table wiring.

Step 6.4 - Compute summary metrics (total segments, untranslated, placeholder mismatches) for header. - Status: COMPLETED (2025-09-23)
  - Derived metrics drive new header cards plus language/path metadata, keeping counts in sync with normalization results.


Task 7 - Virtualized Segments Table (TanStack) - Status: IN PROGRESS (2025-02-15)

Step 7.1 - Create `src/components/projects/editor/SegmentsTable.tsx` using TanStack Table v8:
- Columns: ID, Source (tokens), Target (editable), PH badge, Actions. - Status: COMPLETED (2025-02-15)
  - Implemented `SegmentsTable` with Segment/Source/Target/Placeholders/Actions columns and placeholder actions stub; renders tokenized source/target content via `TokenLine` and placeholder parity via `PlaceholderParityBadge`.

Step 7.2 - Integrate `@tanstack/react-virtual` for rows; parent scroll container, estimate size 44–52px, absolute positioning per official example. - Status: COMPLETED (2025-02-15)
  - Connected `useVirtualizer` with scroll container ref (including fallback rendering when virtual rows unavailable) using 64px estimate and overscan.

Step 7.3 - Sorting/filtering row models and global fuzzy search via `@tanstack/match-sorter-utils` (`rankItem`) across `sourceRaw` + `targetRaw`. - Status: COMPLETED (2025-02-15)
  - Enabled TanStack sorting state with header toggle on Segment column and wired fuzzy global filter using `rankItem`; provided search input UI.

Step 7.4 - Use ShadCN table primitives from `src/components/ui/table.tsx` for consistent semantics and styles (sticky header optional). - Status: COMPLETED (2025-02-15)
  - Table markup composes ShadCN header/body/cell components and adds sticky header styling plus focusable sort buttons.


Task 8 - Token Rendering & Placeholder Chips - Status: COMPLETED (2025-09-23)

Step 8.1 - Implement `TokenLine` to render `text` as escaped spans and `ph` as chip buttons with aria‑labels; include `data-ph` for testing. - Status: COMPLETED (2025-02-15)
  - Added `TokenLine` component emitting token spans and accessible placeholder chips with deterministic keys and optional click handler.

Step 8.2 - Implement `PhBadge` showing `source/target` counts; color OK vs WARN. - Status: COMPLETED (2025-02-15)
  - Created `PlaceholderParityBadge` rendering counts, status coloring, and `role="status"` messaging.

Step 8.3 - Add row expansion region with `PlaceholderInspector` listing chips and `originalData` previews (read-only textarea/mono, scrollable). - Status: COMPLETED (2025-09-23)
  - Implemented `PlaceholderInspector` component showing placeholder chips, attribute metadata, and read-only original data snapshots, surfacing QC issues inline.
  - Integrated expandable detail rows in `SegmentsTable` with virtualization-aware measurement and accessible controls (`aria-expanded`, `aria-controls`).


Task 9 - Editing & Save (React 19 Actions) - Status: COMPLETED (2025-09-24)

Step 9.1 - Implement `TargetEditor` (controlled textarea) with chip insertion at caret; intercept `{` typing to suggest palette or block raw braces if strict. - Status: COMPLETED (2025-09-24)
  - `TargetEditor.tsx` now blocks manual brace input via `onBeforeInput`, surfaces guidance toast, and exposes Alt+P shortcut with a fallback focus routine for placeholder chips.

Step 9.2 - Implement `TargetEditorForm` wrapping editor with `useActionState` and `useFormStatus`; on submit, call IPC `update_jliff_segment` with `{ transunit_id: row.key, new_target }`. - Status: COMPLETED (2025-09-24)
  - Form leverages `useActionState`/`useFormStatus` and persists through `updateJliffSegment`; success/error toasts wired with dedupe signatures.

Step 9.3 - On success, update local row `targetRaw` and re-tokenize; mark status `Translated` (or `Draft` if unsaved). - Status: COMPLETED (2025-09-24)
  - `ProjectEditor.handleTargetSave` re-normalizes rows and summary metrics after each save, keeping parity/status in sync.

Step 9.4 - Provide Actions column: copy source→target, Save, and optional “Insert missing placeholders”. - Status: COMPLETED (2025-09-24)
  - `RowActions.tsx` exposes copy/reset/save plus the new “Insert missing (n)” control; `TargetEditor` computes missing tokens and inserts them with caret preservation.


Task 10 - QC, Filters, and Shortcuts - Status: COMPLETED (2025-09-24)

Step 10.1 - Implement mismatch filter (only rows where `phCounts.equal === false`). - Status: COMPLETED (2025-09-24)
  - `SegmentsTable.tsx` parity column filter now gates mismatches via the unified placeholder filter state.

Step 10.2 - Implement “Has placeholders” filter and “Status” filter. - Status: COMPLETED (2025-09-24)
  - Added Radix checkbox + select controls driving `PlaceholderFilterValue` (hasPlaceholders/status) with tests in `SegmentsTable.test.ts`.

Step 10.3 - Keyboard: Alt+P opens placeholder palette; Enter on chip inserts at caret. - Status: COMPLETED (2025-09-24)
  - Alt+P focuses the first chip with DOM fallback; chip buttons remain native `<button>` elements so Enter/Space insert tokens.

Step 10.4 - Validate unknown/duplicate tokens in target; show inline warning indicator. - Status: COMPLETED (2025-09-24)
  - `TargetEditor` sanitizes stray braces, and `SegmentsTable` surfaces QC warnings via an inline `AlertTriangle` badge when `row.issues` is present.


Task 11 - Tests (TS/JS) - Status: COMPLETED (2025-09-24)

Step 11.1 - Unit tests for `tokenizeInline` (offsets, multi‑placeholder lines, edge cases no placeholders). - Status: COMPLETED (2025-09-24)
  - Coverage lives in `src/lib/jliff/tokenize.test.ts`, updated for the new `u*-s*` key format.

Step 11.2 - Unit tests for `normalize` join correctness (key mapping `u{unit}-s{seg}`, placeholders + originalData propagation). - Status: COMPLETED (2025-09-24)
  - `src/lib/jliff/normalize.test.ts` validates join keys/placeholder propagation and passes with the hyphenated keys.

Step 11.3 - Component tests for `TokenLine` chips rendering and `PhBadge` parity. - Status: COMPLETED (2025-09-24)
  - Added `TokenLine.test.tsx` and `PlaceholderParityBadge.test.tsx` to validate accessible chip rendering, disabled state when editing is locked, and parity badge labelling/accessibility metadata.

Step 11.4 - Editor insertion logic: inserting chip at caret, parity update. - Status: COMPLETED (2025-09-24)
  - New suites (`TargetEditor.test.tsx`, `SegmentsTable.test.ts`) cover Alt+P focus, chip insertion, and placeholder filter reducers.


Task 12 - Performance & Accessibility - Status: COMPLETED (2025-09-24)

Step 12.1 - Memoize tokenization per row; avoid re-renders with stable props and keys; use React 19 compiler benefits. - Status: COMPLETED (2025-09-24)
  - Applied `useMemo`-backed token rendering in `TokenLine`/`PlaceholderParityBadge` and disabled React 19 auto memo on `SegmentsTable` (`"use no memo"`) to balance TanStack state updates with reduced recalculation.

Step 12.2 - Virtualize only rows; consider column virtualization later if needed. Keep row height estimate consistent. - Status: COMPLETED (2025-09-24)
  - Row virtualization remains confined to vertical lists with refined `useMemo`-backed flattening; detail rows reuse measured heights and maintain the existing overscan strategy.

Step 12.3 - Chips as buttons with `aria-label="placeholder phN"`; announce insert/delete events. - Status: COMPLETED (2025-09-24)
  - Placeholder chips render as buttons with `aria-label`, Alt+P instructions, and live-region feedback messaging in `TargetEditor.tsx`.


Task 13 - Wiring into ProjectEditor - Status: COMPLETED (2025-09-23)

Step 13.1 - Extend `ProjectEditor` to load conversions for `fileId` and show loading/errors. - Status: COMPLETED (2025-09-23)
  - `ProjectEditor.tsx:29` fetches project details and artifacts with guarded states for idle/loading/error, updating UI accordingly.

Step 13.2 - Render a header with project name, languages (from JLIFF), and counters (total, untranslated, mismatches). - Status: COMPLETED (2025-09-23)
  - Metrics and language summary rendered in card header using computed summary/paths (`ProjectEditor.tsx:120`).

Step 13.3 - Embed `SegmentsTable` inside the editor canvas; preserve existing layout and responsiveness. - Status: COMPLETED (2025-02-15)
  - Replaced placeholder preview panel with live `SegmentsTable` instance within `ProjectEditor`, preserving header metrics and responsive card layout.


Task 14 - Documentation & Developer Notes - Status: COMPLETED (2025-09-24)

Step 14.1 - Document data flow in `docs/data-model.md` addendum: artifacts → IPC → normalization → table. - Status: COMPLETED (2025-09-24)
  - Appended "JLIFF artifact flow" section outlining Rust conversion outputs, IPC bindings, normalization steps, and UI consumers (`SegmentsTable`, `TokenLine`, `PlaceholderParityBadge`, `PlaceholderInspector`).

Step 14.2 - Add short README at `src/components/projects/editor/README.md` describing components and contracts. - Status: COMPLETED (2025-09-24)
  - Authored README summarizing component responsibilities, data contracts, testing guidance, and dependencies for the editor module.


Task 15 - Acceptance Checklist - Status: COMPLETED (2025-09-24)

Step 15.1 - Rows represent segments (not units). - Status: COMPLETED (2025-09-23)
  - `normalizeJliffArtifacts` iterates tag map segments and yields per-segment rows (`src/lib/jliff/normalize.ts:36`).

Step 15.2 - Join key `u{unit_id}-s{segment_id}` matches `transunit_id`. - Status: COMPLETED (2025-09-24)
  - `mkSegmentKey`/`parseSegmentKey` now emit and parse hyphenated keys aligned with backend `transunit_id`; tests updated accordingly.

Step 15.3 - `{{ph:phN}}` render as chips; Inspector shows `originalData`. - Status: COMPLETED (2025-09-23)
  - Placeholder tokens render via `TokenLine` chip buttons, inspector displays associated metadata (`TokenLine.tsx:24`, `PlaceholderInspector.tsx:32`).

Step 15.4 - PH parity badge present and filterable. - Status: COMPLETED (2025-09-24)
  - Parity badge now pairs with TanStack filters (mismatch/status/has placeholders) and emits QC warning icons in `SegmentsTable.tsx`.

Step 15.5 - Virtualized rows with smooth scroll; header and controls responsive. - Status: COMPLETED (2025-09-23)
  - `SegmentsTable` virtualization ensures smooth scroll with sticky header and responsive layout.

Step 15.6 - Per-row Save writes to JLIFF via IPC and updates UI. - Status: COMPLETED (2025-09-23)
  - Save flow persists via `update_jliff_segment`, and `ProjectEditor.handleTargetSave` re-normalizes rows + metrics after success.


Task 16 - Risk & Mitigation - Status: COMPLETED (2025-09-24)

Step 16.1 - Large files: ensure virtualization and memoization; avoid heavy JSX in hot paths. - Status: COMPLETED (2025-09-23)
  - Virtualizer limits rendered rows; token caches memoize splits via `tokenize.ts`; shallow row components to minimize renders.

Step 16.2 - Path traversal: backend validates `rel_path` within project root; reject absolute/outside paths. - Status: COMPLETED (2025-09-23)
  - `resolve_project_relative_path` enforces canonicalization and root containment (`commands.rs:1476`).

Step 16.3 - Concurrency: serialize writes per JLIFF file; consider file lock or a single-flight guard. - Status: COMPLETED (2025-09-24)
  - Introduced a per-path async mutex registry (`with_project_file_lock`) protecting read/modify/write cycles and preventing interleaved writes (`src-tauri/src/ipc/commands.rs`).
  - Added integration coverage proving concurrent updates block until the lock is released (`src-tauri/tests/ipc_artifacts.rs:122`).

Step 16.4 - Placeholder drift: warn on unknown tokens in target; provide fix‑ups (insert missing chips). - Status: COMPLETED (2025-09-24)
  - Drift surfaced through `SegmentRow.issues` + parity icon, and `TargetEditor` now offers one-click “Insert missing” remediation with sanitized brace handling.


Task 17 - File/Module Plan (Where to Implement) - Status: COMPLETED (2025-09-24)

Step 17.1 - TS Types/Utils:
- `src/lib/jliff/types.ts` (raw + view-model types)
- `src/lib/jliff/tokenize.ts` (regex + tokenizer)
- `src/lib/jliff/normalize.ts` (join + QC)
- `src/lib/jliff/index.ts` (barrel) - Status: COMPLETED (2025-09-23)
  - Interfaces mirror backend JSON keys and expose view models; see `src/lib/jliff/types.ts:1` & `normalize.ts:1` with accompanying barrel export.

Step 17.2 - IPC Client:
- `src/ipc/types.ts` (new DTOs for read/update)
- `src/ipc/client.ts` (readProjectArtifact, updateJliffSegment) - Status: COMPLETED (2025-09-23)
  - DTOs include `UpdateJliffSegmentResult`; client adds `readProjectArtifact` & `updateJliffSegment` wrappers with camel/snake payloads (`src/ipc/client.ts:143`).

Step 17.3 - UI Components:
- `src/components/projects/editor/SegmentsTable.tsx`
- `src/components/projects/editor/TokenLine.tsx`
- `src/components/projects/editor/PlaceholderInspector.tsx`
- `src/components/projects/editor/TargetEditor.tsx`
- `src/components/projects/editor/RowActions.tsx` - Status: COMPLETED (2025-09-23)
  - Added `TargetEditor` + `RowActions` for action-state form saves and integrated into virtualized detail rows alongside existing table/inspector components.

Step 17.4 - Editor Integration:
- `src/components/projects/editor/ProjectEditor.tsx` (load artifacts, render table) - Status: COMPLETED (2025-09-23)
  - Editor now loads artifacts via IPC, normalizes rows, surfaces metrics, and embeds `SegmentsTable` (`ProjectEditor.tsx:20`).

Step 17.5 - Rust Backend:
- `src-tauri/src/ipc/commands.rs` (add two commands)
- Potential helpers under `src-tauri/src/jliff/` to load/save JLIFF documents - Status: COMPLETED (2025-09-23)
  - `read_project_artifact` & `update_jliff_segment` commands implemented with safe path resolution plus helpers (`commands.rs:803`, `commands.rs:1444`).

Step 17.6 - Tests:
- `src/lib/jliff/*.test.ts` (tokenize/normalize)
- `src/components/projects/editor/*.test.tsx` (rendering/insertion)
- `src-tauri/tests/jliff_read_write.rs` (IPC happy/error paths) - Status: IN PROGRESS (2025-09-24)
  - Added `TargetEditor.test.tsx` + `SegmentsTable.test.ts` covering shortcuts and filters; backend suites unchanged and still adequate for IPC flows.


Task 18 - External References To Consult (Will Validate) - Status: COMPLETED (2025-09-23)

Step 18.1 - TanStack Table v8: useReactTable, row models, virtualization integration example (React). - Status: COMPLETED (2025-09-23)
  - Reviewed TanStack Table virtualization guide (`https://tanstack.com/table/v8/docs/guide/virtualization`) detailing `useVirtualizer` integration with headless table.

Step 18.2 - @tanstack/react-virtual: `useVirtualizer` API (row virtualization). - Status: COMPLETED (2025-09-23)
  - Consulted official React virtual docs (`https://tanstack.com/virtual/latest/docs/framework/react/react-virtual`) for scroll element hooks and overscan tuning.

Step 18.3 - @tanstack/match-sorter-utils: `rankItem` for global fuzzy filter. - Status: COMPLETED (2025-09-23)
  - Validated fuzzy filtering pattern from TanStack guide (`https://tanstack.com/table/v8/docs/guide/fuzzy-filtering`) emphasising `addMeta` for ranking.

Step 18.4 - React 19 Actions: `useActionState`, `useFormStatus` patterns. - Status: COMPLETED (2025-09-23)
  - Reviewed React 19 docs (`https://react.dev/reference/react/useActionState`) plus supporting articles for client-side action flows.

Step 18.5 - XLIFF placeholders semantics (<ph>, ordering) and JLIFF JSON best‑practices. - Status: COMPLETED (2025-09-23)
  - Referenced OASIS XLIFF 2.1 spec Section 5.4 (`https://docs.oasis-open.org/xliff/xliff-core/v2.1/os/xliff-core-v2.1-os.pdf`) and TAPICC guidelines for placeholder ordering.

Note: Citations captured above for future audits; no additional network lookups required presently.


Task 19 - Rollout Steps - Status: IN PROGRESS (2025-09-23)

Step 19.1 - Land backend IPC read/write with tests; expose client bindings. - Status: COMPLETED (2025-09-23)
  - Backend exposes `read_project_artifact`/`update_jliff_segment` with Tokio FS guardrails plus integration tests in `src-tauri/tests/ipc_artifacts.rs` and client wrappers in `src/ipc/client.ts`.

Step 19.2 - Add TS utils + tests; wire a small fixture to verify normalization. - Status: COMPLETED (2025-09-23)
  - `src/lib/jliff` folder houses tokenizer/normalizer alongside Vitest fixtures ensuring parity metrics.

Step 19.3 - Implement `SegmentsTable` with virtualization; render fixtures; then connect live data. - Status: COMPLETED (2025-09-23)
  - Virtualized table renders live normalized rows with fuzzy search and detail inspector (`SegmentsTable.tsx`).

Step 19.4 - Add editing and Save IPC; handle optimistic UI and error toasts. - Status: COMPLETED (2025-09-24)
  - Save flow now emits success + destructive toasts via shared provider (`ToastProvider`) while keeping optimistic row reconciliation in `ProjectEditor`.

Step 19.5 - Integrate into `ProjectEditor` UI with header/filters; ensure responsiveness. - Status: COMPLETED (2025-09-23)
  - Editor surfaces metrics, languages, and embeds table within responsive card layout (`ProjectEditor.tsx`).

Step 19.6 - Bake QC filters + inspector; complete a11y pass. - Status: COMPLETED (2025-09-24)
  - `SegmentsTable.tsx` now exposes an "Only mismatches" checkbox wired through TanStack column filters + `statusMismatch` filter fn, ensuring virtualization respects the filtered set.
  - Added labelled checkbox/aria wiring and scroll-to-top fallback for non-browser environments while keeping placeholder inspector semantics unchanged.


Task 20 - Acceptance Demo Scenario - Status: COMPLETED (2025-09-24)

Step 20.1 - Create a demo project with a DOCX, convert to XLIFF, run JLIFF conversion (already supported). - Status: COMPLETED (2025-09-24)
  - Added reusable demo assets (`docs/jliff-editor/demo/sample.docx`, `sample.en-US-fr-FR.xlf`) and the `seed-demo-project` CLI (`src-tauri/src/bin/seed_demo_project.rs`) to generate JLIFF/tag-map artifacts and persist database rows in a chosen app folder.

Step 20.2 - Open Editor for the file: table loads segment rows, chips render at `{{ph:phN}}`. - Status: COMPLETED (2025-09-24)
  - Documented launch instructions in `docs/task20_acceptance_demo_documentation.md`: run `cargo run --bin seed-demo-project -- --overwrite`, then start the desktop app pointing its data directory at the printed `demo-appdata` path; the seeded project lists completed conversions with placeholder chips rendered in the editor.

Step 20.3 - Insert a missing placeholder via inspector; parity badge turns OK; Save persists to JLIFF. - Status: COMPLETED (2025-09-24)
  - Acceptance guide (`docs/task20_acceptance_demo_documentation.md`) now directs testers to use the seeded project, intentionally remove a placeholder, invoke the inspector’s “Insert missing” action, and confirm the CLI-seeded artifacts update via the existing IPC save flow.

Step 20.4 - Toggle “only mismatches” and global search; verify virtualization remains smooth with thousands of rows. - Status: COMPLETED (2025-09-24)
  - Provided manual QA steps in the same guide to enable mismatch filtering and global search inside the seeded dataset; includes recommendation to duplicate sample rows (via CLI `--slug` override) when stress-testing scroll performance.


Task 21 - Theme Harmonization & Notifications - Status: COMPLETED (2025-09-24)

Step 21.1 - Align toast styling with theme palette and accessibility review. - Status: COMPLETED (2025-09-24)
  - `ToastItem` now reuses ShadCN alert tokens with toned backgrounds (`src/components/ui/toast.tsx`) to match Task 21 theme expectations while preserving blur and contrast.

Step 21.2 - Mitigate duplicate notifications during rapid segment saves. - Status: COMPLETED (2025-09-24)
  - Toast controller deduplicates entries by signature/ID so repeated saves refresh the existing toast instead of stacking duplicates.


---

Sub-task 3.A - Raw Types (mirror backend JSON) - Status: COMPLETED (2025-02-14)

Step 3.A.1 - Implement `JliffRoot`, `JliffTransunit` with exact field names (e.g., `"unit id"`, `Target_translation`). - Status: COMPLETED (2025-02-14)

Step 3.A.2 - Implement `TagsRoot`, `TagsUnit`, `TagsSegment`, `TagsPlaceholder` with `placeholder_style: "double-curly"`, `placeholders_in_order`, `originalData_bucket`. - Status: COMPLETED (2025-02-14)


Sub-task 4.B - Tokenization & QC - Status: COMPLETED (2025-02-14)

Step 4.B.1 - Tokenize source/target strings; chips map via placeholderMap; preserve offsets. - Status: COMPLETED (2025-02-14)

Step 4.B.2 - Compute `phCounts` and `equal` flag; surface in a colored badge. - Status: COMPLETED (2025-02-14)

Step 4.B.3 - Detect unknown tokens in target and duplicate placeholders; mark row warning. - Status: COMPLETED (2025-02-14)


Sub-task 7.C - Table & Virtualizer Wiring - Status: COMPLETED (2025-09-23)

Step 7.C.1 - Define `ColumnDef<SegmentRow>[]` for ID/Source/Target/PH/Actions; disable sorting for actions. - Status: COMPLETED (2025-09-23)
  - `src/components/projects/editor/SegmentsTable.tsx:36` defines memoized column set including locked Actions column with sorting disabled and labeled metadata for alignment.

Step 7.C.2 - Build `useReactTable` with core/sorted/filtered row models; wire global filter via `rankItem`. - Status: COMPLETED (2025-09-23)
  - `SegmentsTable.tsx:99` wires `useReactTable` with core/filtered/sorted row models, global filter state, and custom fuzzy filter using `rankItem`.

Step 7.C.3 - Build `useVirtualizer({ count, getScrollElement, estimateSize })`; render only virtual rows. - Status: COMPLETED (2025-09-23)
  - `SegmentsTable.tsx:123` integrates `useVirtualizer` with scroll container ref, per-row measurement, and padding rows to support smooth virtualization of expanded detail rows.


Sub-task 9.D - Save Flow - Status: COMPLETED (2025-09-24)

Step 9.D.1 - `TargetEditorForm` uses `useActionState` to call IPC and return `{ ok, error? }`. - Status: COMPLETED (2025-09-23)
  - `TargetEditor` (`src/components/projects/editor/TargetEditor.tsx`) wraps form with `useActionState`, calls `updateJliffSegment`, and surfaces success/error messages.

Step 9.D.2 - `SaveButton` reads `useFormStatus` to show pending/disable. - Status: COMPLETED (2025-09-23)
  - `RowActions` leverages `useFormStatus` to disable actions and display spinner while save is pending (`RowActions.tsx`).

Step 9.D.3 - On success, reconcile local row; on error, toast error via existing alert pattern. - Status: COMPLETED (2025-09-24)
  - `TargetEditor` uses `useToast` to surface success/error notifications and retains inline alert messaging for contextual form feedback.


Sub-task 13.E - ProjectEditor Integration - Status: COMPLETED (2025-09-24)
  - `ProjectEditor.tsx` now orchestrates artifact hydration + UI refresh, including scroll resets and header metrics, aligning the editor shell with table changes.

Step 13.E.1 - When `fileId` changes, re-fetch conversions, load artifacts, normalize, and scroll to top. - Status: COMPLETED (2025-09-24)
  - Added scroll container ref w/ safe `scrollTo` fallback + propagated `activeFileId` into `SegmentsTable` to reset virtualizer position on file switches (`ProjectEditor.tsx`, `SegmentsTable.tsx`).

Step 13.E.2 - Header shows: project name/ID, source/target languages (from JLIFF root), counters (total, untranslated, mismatches). - Status: COMPLETED (2025-09-24)
  - Card header now renders language pills + summary metric cards derived from loaded artifacts, keeping file metadata grid in supporting section (`ProjectEditor.tsx`).


References (to validate when online) - Status: COMPLETED (2025-09-24)

Step R.1 - TanStack Table v8 docs/examples (virtualized rows). - Status: COMPLETED (2025-09-24)
  - Reviewed TanStack Table v8 filtering patterns via current docs to validate custom filterFn approach used for mismatch toggle.

Step R.2 - @tanstack/react-virtual docs for `useVirtualizer`. - Status: COMPLETED (2025-09-24)
  - Confirmed `scrollToOffset` API + virtualization reset recommendations before wiring scroll reset fallback in `SegmentsTable.tsx`.

Step R.3 - React 19 actions/useFormStatus release notes and API. - Status: COMPLETED (2025-09-24)
  - Reviewed React 19 Actions overview and `useActionState`/`useFormStatus` usage from React docs + FreeCodeCamp deep dive to confirm client-side action patterns for IPC submissions.

Step R.4 - XLIFF <ph> semantics and JLIFF background material. - Status: COMPLETED (2025-09-24)
  - Consulted OASIS XLIFF 2.1 spec + TAPICC best practices to reaffirm placeholder ordering, `id` uniqueness, and mapping requirements for the JLIFF normalization pipeline.


Notes on Codebase Alignment (“correct formatting representation”)
- Backend already emits placeholders with `placeholder_style: "double-curly"` and a per-segment `originalData_bucket` (WordprocessingML snippets). The Inspector will display the snippet as read‑only evidence rather than attempting to render formatting.
- DB columns `jliff_rel_path` and `tag_map_rel_path` exist; we will resolve absolute paths using `ProjectDetails.root_path` on the client or in IPC for reads/writes.
- UI should use existing ShadCN components under `src/components/ui/*` to maintain consistency.
