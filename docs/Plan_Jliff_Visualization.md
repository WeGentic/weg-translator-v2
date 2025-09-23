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


Task 6 - Frontend Data Loading - Status: NOT COMPLETED

Step 6.1 - Extend `ProjectEditor` flow to fetch `ProjectDetails` → locate selected file’s latest completed conversion with both `jliffRelPath` and `tagMapRelPath`. - Status: NOT COMPLETED

Step 6.2 - Read artifacts via IPC (`read_project_artifact`), `JSON.parse` into `JliffRoot` and `TagsRoot`. - Status: NOT COMPLETED

Step 6.3 - Normalize into `SegmentRow[]` via `normalize(...)`. Store in component state (or a small editor-scoped store). - Status: NOT COMPLETED

Step 6.4 - Compute summary metrics (total segments, untranslated, placeholder mismatches) for header. - Status: NOT COMPLETED


Task 7 - Virtualized Segments Table (TanStack) - Status: NOT COMPLETED

Step 7.1 - Create `src/components/projects/editor/SegmentsTable.tsx` using TanStack Table v8:
- Columns: ID, Source (tokens), Target (editable), PH badge, Actions. - Status: NOT COMPLETED

Step 7.2 - Integrate `@tanstack/react-virtual` for rows; parent scroll container, estimate size 44–52px, absolute positioning per official example. - Status: NOT COMPLETED

Step 7.3 - Sorting/filtering row models and global fuzzy search via `@tanstack/match-sorter-utils` (`rankItem`) across `sourceRaw` + `targetRaw`. - Status: NOT COMPLETED

Step 7.4 - Use ShadCN table primitives from `src/components/ui/table.tsx` for consistent semantics and styles (sticky header optional). - Status: NOT COMPLETED


Task 8 - Token Rendering & Placeholder Chips - Status: NOT COMPLETED

Step 8.1 - Implement `TokenLine` to render `text` as escaped spans and `ph` as chip buttons with aria‑labels; include `data-ph` for testing. - Status: NOT COMPLETED

Step 8.2 - Implement `PhBadge` showing `source/target` counts; color OK vs WARN. - Status: NOT COMPLETED

Step 8.3 - Add row expansion region with `PlaceholderInspector` listing chips and `originalData` previews (read‑only textarea/mono, scrollable). - Status: NOT COMPLETED


Task 9 - Editing & Save (React 19 Actions) - Status: NOT COMPLETED

Step 9.1 - Implement `TargetEditor` (controlled textarea) with chip insertion at caret; intercept `{` typing to suggest palette or block raw braces if strict. - Status: NOT COMPLETED

Step 9.2 - Implement `TargetEditorForm` wrapping editor with `useActionState` and `useFormStatus`; on submit, call IPC `update_jliff_segment` with `{ transunit_id: row.key, new_target }`. - Status: NOT COMPLETED

Step 9.3 - On success, update local row `targetRaw` and re-tokenize; mark status `Translated` (or `Draft` if unsaved). - Status: NOT COMPLETED

Step 9.4 - Provide Actions column: copy source→target, Save, and optional “Insert missing placeholders”. - Status: NOT COMPLETED


Task 10 - QC, Filters, and Shortcuts - Status: NOT COMPLETED

Step 10.1 - Implement mismatch filter (only rows where `phCounts.equal === false`). - Status: NOT COMPLETED

Step 10.2 - Implement “Has placeholders” filter and “Status” filter. - Status: NOT COMPLETED

Step 10.3 - Keyboard: Alt+P opens placeholder palette; Enter on chip inserts at caret. - Status: NOT COMPLETED

Step 10.4 - Validate unknown/duplicate tokens in target; show inline warning indicator. - Status: NOT COMPLETED


Task 11 - Tests (TS/JS) - Status: NOT COMPLETED

Step 11.1 - Unit tests for `tokenizeInline` (offsets, multi‑placeholder lines, edge cases no placeholders). - Status: NOT COMPLETED

Step 11.2 - Unit tests for `normalize` join correctness (key mapping `u{unit}-s{seg}`, placeholders + originalData propagation). - Status: NOT COMPLETED

Step 11.3 - Component tests for `TokenLine` chips rendering and `PhBadge` parity. - Status: NOT COMPLETED

Step 11.4 - Editor insertion logic: inserting chip at caret, parity update. - Status: NOT COMPLETED


Task 12 - Performance & Accessibility - Status: NOT COMPLETED

Step 12.1 - Memoize tokenization per row; avoid re-renders with stable props and keys; use React 19 compiler benefits. - Status: NOT COMPLETED

Step 12.2 - Virtualize only rows; consider column virtualization later if needed. Keep row height estimate consistent. - Status: NOT COMPLETED

Step 12.3 - Chips as buttons with `aria-label="placeholder phN"`; announce insert/delete events. - Status: NOT COMPLETED


Task 13 - Wiring into ProjectEditor - Status: NOT COMPLETED

Step 13.1 - Extend `ProjectEditor` to load conversions for `fileId` and show loading/errors. - Status: NOT COMPLETED

Step 13.2 - Render a header with project name, languages (from JLIFF), and counters (total, untranslated, mismatches). - Status: NOT COMPLETED

Step 13.3 - Embed `SegmentsTable` inside the editor canvas; preserve existing layout and responsiveness. - Status: NOT COMPLETED


Task 14 - Documentation & Developer Notes - Status: NOT COMPLETED

Step 14.1 - Document data flow in `docs/data-model.md` addendum: artifacts → IPC → normalization → table. - Status: NOT COMPLETED

Step 14.2 - Add short README at `src/components/projects/editor/README.md` describing components and contracts. - Status: NOT COMPLETED


Task 15 - Acceptance Checklist - Status: NOT COMPLETED

Step 15.1 - Rows represent segments (not units). - Status: NOT COMPLETED

Step 15.2 - Join key `u{unit_id}-s{segment_id}` matches `transunit_id`. - Status: NOT COMPLETED

Step 15.3 - `{{ph:phN}}` render as chips; Inspector shows `originalData`. - Status: NOT COMPLETED

Step 15.4 - PH parity badge present and filterable. - Status: NOT COMPLETED

Step 15.5 - Virtualized rows with smooth scroll; header and controls responsive. - Status: NOT COMPLETED

Step 15.6 - Per-row Save writes to JLIFF via IPC and updates UI. - Status: NOT COMPLETED


Task 16 - Risk & Mitigation - Status: NOT COMPLETED

Step 16.1 - Large files: ensure virtualization and memoization; avoid heavy JSX in hot paths. - Status: NOT COMPLETED

Step 16.2 - Path traversal: backend validates `rel_path` within project root; reject absolute/outside paths. - Status: NOT COMPLETED

Step 16.3 - Concurrency: serialize writes per JLIFF file; consider file lock or a single-flight guard. - Status: NOT COMPLETED

Step 16.4 - Placeholder drift: warn on unknown tokens in target; provide fix‑ups (insert missing chips). - Status: NOT COMPLETED


Task 17 - File/Module Plan (Where to Implement) - Status: NOT COMPLETED

Step 17.1 - TS Types/Utils:
- `src/lib/jliff/types.ts` (raw + view-model types)
- `src/lib/jliff/tokenize.ts` (regex + tokenizer)
- `src/lib/jliff/normalize.ts` (join + QC)
- `src/lib/jliff/index.ts` (barrel) - Status: NOT COMPLETED

Step 17.2 - IPC Client:
- `src/ipc/types.ts` (new DTOs for read/update)
- `src/ipc/client.ts` (readProjectArtifact, updateJliffSegment) - Status: NOT COMPLETED

Step 17.3 - UI Components:
- `src/components/projects/editor/SegmentsTable.tsx`
- `src/components/projects/editor/TokenLine.tsx`
- `src/components/projects/editor/PlaceholderInspector.tsx`
- `src/components/projects/editor/TargetEditor.tsx`
- `src/components/projects/editor/RowActions.tsx` - Status: NOT COMPLETED

Step 17.4 - Editor Integration:
- `src/components/projects/editor/ProjectEditor.tsx` (load artifacts, render table) - Status: NOT COMPLETED

Step 17.5 - Rust Backend:
- `src-tauri/src/ipc/commands.rs` (add two commands)
- Potential helpers under `src-tauri/src/jliff/` to load/save JLIFF documents - Status: NOT COMPLETED

Step 17.6 - Tests:
- `src/lib/jliff/*.test.ts` (tokenize/normalize)
- `src/components/projects/editor/*.test.tsx` (rendering/insertion)
- `src-tauri/tests/jliff_read_write.rs` (IPC happy/error paths) - Status: NOT COMPLETED


Task 18 - External References To Consult (Will Validate) - Status: NOT COMPLETED

Step 18.1 - TanStack Table v8: useReactTable, row models, virtualization integration example (React). - Status: NOT COMPLETED

Step 18.2 - @tanstack/react-virtual: `useVirtualizer` API (row virtualization). - Status: NOT COMPLETED

Step 18.3 - @tanstack/match-sorter-utils: `rankItem` for global fuzzy filter. - Status: NOT COMPLETED

Step 18.4 - React 19 Actions: `useActionState`, `useFormStatus` patterns. - Status: NOT COMPLETED

Step 18.5 - XLIFF placeholders semantics (<ph>, ordering) and JLIFF JSON best‑practices. - Status: NOT COMPLETED

Note: Network access is restricted in this environment. I will validate the above against official docs once online or if approval is granted for web lookup.


Task 19 - Rollout Steps - Status: NOT COMPLETED

Step 19.1 - Land backend IPC read/write with tests; expose client bindings. - Status: NOT COMPLETED

Step 19.2 - Add TS utils + tests; wire a small fixture to verify normalization. - Status: NOT COMPLETED

Step 19.3 - Implement `SegmentsTable` with virtualization; render fixtures; then connect live data. - Status: NOT COMPLETED

Step 19.4 - Add editing and Save IPC; handle optimistic UI and error toasts. - Status: NOT COMPLETED

Step 19.5 - Integrate into `ProjectEditor` UI with header/filters; ensure responsiveness. - Status: NOT COMPLETED

Step 19.6 - Bake QC filters + inspector; complete a11y pass. - Status: NOT COMPLETED


Task 20 - Acceptance Demo Scenario - Status: NOT COMPLETED

Step 20.1 - Create a demo project with a DOCX, convert to XLIFF, run JLIFF conversion (already supported). - Status: NOT COMPLETED

Step 20.2 - Open Editor for the file: table loads segment rows, chips render at `{{ph:phN}}`. - Status: NOT COMPLETED

Step 20.3 - Insert a missing placeholder via inspector; parity badge turns OK; Save persists to JLIFF. - Status: NOT COMPLETED

Step 20.4 - Toggle “only mismatches” and global search; verify virtualization remains smooth with thousands of rows. - Status: NOT COMPLETED


---

Sub-task 3.A - Raw Types (mirror backend JSON) - Status: COMPLETED (2025-02-14)

Step 3.A.1 - Implement `JliffRoot`, `JliffTransunit` with exact field names (e.g., `"unit id"`, `Target_translation`). - Status: COMPLETED (2025-02-14)

Step 3.A.2 - Implement `TagsRoot`, `TagsUnit`, `TagsSegment`, `TagsPlaceholder` with `placeholder_style: "double-curly"`, `placeholders_in_order`, `originalData_bucket`. - Status: COMPLETED (2025-02-14)


Sub-task 4.B - Tokenization & QC - Status: COMPLETED (2025-02-14)

Step 4.B.1 - Tokenize source/target strings; chips map via placeholderMap; preserve offsets. - Status: COMPLETED (2025-02-14)

Step 4.B.2 - Compute `phCounts` and `equal` flag; surface in a colored badge. - Status: COMPLETED (2025-02-14)

Step 4.B.3 - Detect unknown tokens in target and duplicate placeholders; mark row warning. - Status: COMPLETED (2025-02-14)


Sub-task 7.C - Table & Virtualizer Wiring - Status: NOT COMPLETED

Step 7.C.1 - Define `ColumnDef<SegmentRow>[]` for ID/Source/Target/PH/Actions; disable sorting for actions. - Status: NOT COMPLETED

Step 7.C.2 - Build `useReactTable` with core/sorted/filtered row models; wire global filter via `rankItem`. - Status: NOT COMPLETED

Step 7.C.3 - Build `useVirtualizer({ count, getScrollElement, estimateSize })`; render only virtual rows. - Status: NOT COMPLETED


Sub-task 9.D - Save Flow - Status: NOT COMPLETED

Step 9.D.1 - `TargetEditorForm` uses `useActionState` to call IPC and return `{ ok, error? }`. - Status: NOT COMPLETED

Step 9.D.2 - `SaveButton` reads `useFormStatus` to show pending/disable. - Status: NOT COMPLETED

Step 9.D.3 - On success, reconcile local row; on error, toast error via existing alert pattern. - Status: NOT COMPLETED


Sub-task 13.E - ProjectEditor Integration - Status: NOT COMPLETED

Step 13.E.1 - When `fileId` changes, re-fetch conversions, load artifacts, normalize, and scroll to top. - Status: NOT COMPLETED

Step 13.E.2 - Header shows: project name/ID, source/target languages (from JLIFF root), counters (total, untranslated, mismatches). - Status: NOT COMPLETED


References (to validate when online) - Status: NOT COMPLETED

Step R.1 - TanStack Table v8 docs/examples (virtualized rows). - Status: NOT COMPLETED

Step R.2 - @tanstack/react-virtual docs for `useVirtualizer`. - Status: NOT COMPLETED

Step R.3 - React 19 actions/useFormStatus release notes and API. - Status: NOT COMPLETED

Step R.4 - XLIFF <ph> semantics and JLIFF background material. - Status: NOT COMPLETED


Notes on Codebase Alignment (“correct formatting representation”)
- Backend already emits placeholders with `placeholder_style: "double-curly"` and a per-segment `originalData_bucket` (WordprocessingML snippets). The Inspector will display the snippet as read‑only evidence rather than attempting to render formatting.
- DB columns `jliff_rel_path` and `tag_map_rel_path` exist; we will resolve absolute paths using `ProjectDetails.root_path` on the client or in IPC for reads/writes.
- UI should use existing ShadCN components under `src/components/ui/*` to maintain consistency.
