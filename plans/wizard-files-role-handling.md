# wizard-files-role-handling
        
## Current User Request Analysis
- Wizard files step must assign the `UNDEFINED` role to newly added files and allow users to map them to explicit roles before finalizing.
- Finalize action must stay disabled while any queued file keeps the `UNDEFINED` role; role options include Translation, References, Instructions, OCR (restricted), and Image (restricted).

## Problem Breakdown
- Determine how roles are modelled today (`FileRoleValue`, constants, wizard hooks) and extend them to cover `undefined` and `ocr` while keeping compatibility with draft storage and finalize payload builders.
- Update role inference/defaulting logic so `appendPaths` stores new entries with `undefined`, adjust sanitizers, persistence, and tests accordingly; ensure CSS tokens exist for new role badges.
- Refresh the WizardFilesStep UI to surface the unassigned state, limit selectable options based on file extension (reuse existing `IMAGE_EXTENSIONS`; need guidance for OCR-eligible extensions), and keep accessibility intact.
- Extend finalize readiness checks (and payload validation) to block when any draft file remains `undefined`; confirm downstream IPC contracts (Rust side) only receive supported role values.
- OCR eligibility confirmed as `IMAGE_EXTENSIONS ∪ {PDF}`, so option gating relies on the existing image set plus PDF.

## User Request
S1: src/modules/wizards/project -> src/modules/wizards/project/components/WizardFilesStep.tsx Implement these features:
- when user load a new file, automatically set to UNDEFINED
- do not activate FINALIZE button if any file is still set to UNDEFINED, user have to choose an active role (TRANSLATION, REFERENCES, INSTRUCTIONS, OCR (show the choice only for some specified extension), IMAGE (show the choice only for some specified extensions)
Completed: COMPLETED
        
## Coding implementation
- Added new role vocabulary (`undefined`, `ocr`) across wizard types, constants, and draft persistence; default onboarding now stores `undefined` so every file requires an explicit assignment.
- Reworked the file table select to derive eligible roles per extension, surfacing OCR (image set + PDF) and Image options only when allowed; new styling shows a warning treatment for unassigned files.
- Hardened finalize logic to reject pending roles, and ensured backend DTOs/SQLite aggregations understand the new OCR role with its dedicated storage directory.
- Extended TypeScript and Rust statistics payloads to track OCR totals, updated downstream UI to render the counts, and refreshed unit tests to cover the new validation rules and persistence cases.

## Notes
- `pnpm vitest run src/modules/wizards/project` passes (16 tests).
- `cargo test` runs but `tests/db_integration.rs` fails in this environment because the SQLite test migrations expect `translation_jobs` tables that are missing; no schema changes were applied as part of this work.
