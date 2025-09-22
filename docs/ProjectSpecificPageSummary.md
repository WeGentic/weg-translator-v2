# Project-Specific Page: Milestone Summary (Steps 16–22)

Scope
- Finalized paths/UX for XLIFF outputs and conversion flow.
- Added unit tests for DB conversions (Rust) and wizard/project page (TS).

What changed
- Output path: `<project.root_path>/xliff/` ensured at plan time; filenames `<stem>.<src>-<tgt>.xlf`.
- Supported inputs unified across app:
  - Convertible: doc, docx, ppt, pptx, xls, xlsx, odt, odp, ods, html, xml, dita, md
  - Already-converted: xlf, xliff, mqxliff, sdlxliff
- Frontend wizard and backend IPC share the same allowed set.
- Project Overview modal now clearly shows progress and logs; cancellation supported.
- When auto-convert is disabled, a banner appears with a shortcut to Settings, and the "Add files" button shows a tooltip explaining conversions won’t start automatically.

Tests added
- Rust (src-tauri/tests/project_conversions.rs):
  - Unique conversion per (file, src, tgt, version).
  - Status transitions (pending → running → completed) and xliff_rel_path persistence.
  - Pending list excludes XLIFF inputs; includes failed and missing conversions.
- TS:
  - Wizard validation for BCP‑47 and distinct languages.
  - ProjectOverview renders file rows and calls IPC on add/remove.

Next
- Docs polish and rollout checks (Plan steps 23–26), including migration order notes and feature flag.

Feature flag
- App setting: `autoConvertOnOpen` (default: true). Exposed via IPC `get_app_settings` and consumed by Project Overview to gate auto-conversion on open.
