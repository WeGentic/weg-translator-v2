# Step 4.4 Report — UI Validation Hardened

- **Scope**: Strengthened project creation UX so mandatory relationships (language pairs) are validated before invoking backend commands (A13, A20–A23).
- **Key Changes**:
  - Added `buildLanguagePairs` utility (`src/modules/projects/components/wizard-v2/utils/languagePairs.ts`) with exhaustive checks for BCP‑47 formatting, duplicate targets, and source/target clashes, surfacing friendly errors via `LanguagePairError`.
  - Wired the Create Project wizard to use the new helper before submission, blocking finalize when language selections are invalid and providing actionable toast feedback.
  - Captured automatic unit coverage (`languagePairs.test.ts`) to guarantee the validation contract.
- **Verification**: `pnpm test src/modules/projects/components/wizard-v2/utils/__tests__/languagePairs.test.ts` confirms the new validation covers expected scenarios; `pnpm lint` passes (UI hook warnings remain pre-existing).
- **Open Items**: Future work will replace the legacy `createProject` IPC with the new project bundle commands once file ingestion is migrated.
