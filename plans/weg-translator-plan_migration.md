# Plan: weg-translator-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Refactor the Client wizard out of the Project Manager module so the feature lives under the Clients domain."
- A-002: "Separate every Client wizard related React file, hook, utility, and test from Project Manager and relocate them into src/modules/clients."
- A-003: "Move the wizard CSS rules into a new stylesheet within the Clients module and update imports to reference the new file."
- A-004: "Ensure all Project Manager references now target the relocated Client wizard and keep unit tests and mocks working after the move."

## New Features required
- F-001: "Clients module gains a self-contained Client creation wizard package (components, hooks, utils, types, tests)."
- F-002: "New wizard-specific stylesheet under clients module with updated import paths."

## Codebase analysis (if needed according to user_request)
- File: src/modules/project-manager/ProjectManagerView.tsx
- Kind: React view controller
- Description: Manages project list lifecycle, owns wizard open state, renders `CreateProjectWizardV2`, and coordinates table interactions.
- Role: Entry point for the Project Manager workspace supplying project CRUD controls and dialog orchestration.
- Dependencies: `CreateProjectWizardV2`, `ProjectManagerToolbar`, `ProjectsSelectionFooter`, IPC methods (`listProjects`, `deleteProject`), `useToast`, TanStack Router.

- File: src/modules/project-manager/components/wizard-v2/CreateProjectWizardV2.tsx
- Kind: React wizard orchestrator
- Description: High-level wizard container wiring steps, dialog, dropzone, finalize flow, IPC invocations, and progress overlays.
- Role: Provides full project creation workflow, wiring hooks (`useWizardClients`, `useWizardFiles`, `useWizardDropzone`) and exporting helper builders used in tests.
- Dependencies: Tauri `dialog`/`event` APIs, IPC commands (`createClientRecord`, `createProjectWithAssets` etc.), shared utils (`cn`), wizard hooks/components, CSS `./wizard-v2.css`.

- File: src/modules/project-manager/components/wizard-v2/hooks/useWizardClients.ts
- Kind: React hook
- Description: Fetches/maintains client list for the wizard, exposes refresh/upsert helpers with loading/error tracking.
- Role: Supplies client autocomplete data inside wizard.
- Dependencies: IPC `listClientRecords`, React state/effect APIs.

- File: src/modules/project-manager/components/wizard-v2/components/WizardNewClientDialog.tsx
- Kind: React component/dialog
- Description: Handles inline client creation form within wizard, validates inputs, calls `createClientRecord`, and notifies parent via callbacks.
- Role: Embedded client-creation UX invoked from wizard when user adds a new client.
- Dependencies: Wizard hooks/types, ShadCN dialog primitives, shared form helpers, wizard CSS classes.

- File: src/modules/project-manager/components/wizard-v2/wizard-v2.css
- Kind: CSS stylesheet
- Description: Defines layout/visual styling for dialog shell, autocomplete, footer controls, feedback overlay tied to wizard class names.
- Role: Ensures wizard presentation matches design; currently imported within `CreateProjectWizardV2`.
- Dependencies: Relies on global CSS variables defined in theme, uses `.wizard-v2-*` selectors referenced across wizard components.

- File: src/modules/clients/view/ClientsView.tsx
- Kind: React view shell
- Description: Renders clients workspace layout, toolbar, data table, dialogs for client CRUD.
- Role: Destination domain for wizard relocation; orchestrates Clients module UI.
- Dependencies: Clients toolbar/content components, CSS (`clients-view.css`), IPC hooks/events for client management.

### Codebase insight summary
Wizard assets are fully nested under `src/modules/project-manager/components/wizard-v2`, tightly coupled via relative imports and shared CSS class names referenced across the wizard components and dialog helpers. The Project Manager view imports the wizard directly and controls its visibility. Clients module currently lacks wizard files but already owns client CRUD dialogs, sharing IPC surface (`listClientRecords`, `createClientRecord`) with the wizard. Tests mock the wizard path under the Project Manager namespace, implying path updates are necessary post-move. CSS is scoped via `.wizard-v2-*` selectors, so relocating the stylesheet requires updating import paths without altering selector names.

### Relevant/Touched features
- Project creation wizard dialog and finalize flow.
- Client autocomplete and inline client creation within the wizard.
- Project Manager view integration hooks and tests.
- Clients module exports and dialog ecosystem.

## Plan

### Task 1

**Status**: COMPLETED
**Detailed description (scope/goals)**: Inventory existing wizard assets and map every dependency that must migrate to the Clients module.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Ensure no wizard dependency is left behind before relocating files.

#### Step 1.1

**Status**: COMPLETED
**Description**: Catalogue wizard components, hooks, utils, types, CSS, and tests under project-manager.
**Notes**: 
- Components: `CreateProjectWizardV2.tsx`, dialog + step components under `components/` (`WizardDetailsStep`, `WizardFilesStep`, `WizardFooter`, `WizardClientField`, `WizardNewClientDialog`, `WizardFeedbackOverlay`, `PhoneCountrySelect`).
- Hooks: `useWizardClients.ts`, `useWizardFiles.ts`, `useWizardDropzone.ts`, plus `useAddressAutocomplete.ts` helper.
- Utilities & constants: `utils.ts`, `constants.ts`, address/phone helpers, language pairs + project folder utils (with existing tests under `utils/__tests__/`).
- Styling: `wizard-v2.css`.
- Tests: `__tests__/finalize-utils.test.ts`, `utils/__tests__/languagePairs.test.ts`.
**Codebase touched**: src/modules/project-manager/components/wizard-v2/**
**Sample snippets (optional)**: N/A
**What to do***: Enumerate files, note inter-file imports, and flag shared exports consumed elsewhere.
**How to**: Use repository tree inspection (`rg --files`, `ls`) and read key files to record dependencies.
**Check**: Confirm list includes components, hooks, utils, types, constants, CSS, tests, and any public exports.
**Gate (Exit Criteria)**: Documented inventory showing every wizard artefact that must move.

#### Step 1.2

**Status**: COMPLETED
**Description**: Identify external consumers of wizard exports beyond the wizard folder.
**Codebase touched**: src/modules/project-manager/**/*.tsx, src/modules/project-manager/**/__tests__/*.ts?
**Sample snippets (optional)**: N/A
**What to do***: Search for imports referencing `wizard-v2` paths and record destinations.
**How to**: Run `rg "wizard-v2"` across src to capture import sites and note required updates.
**Check**: Ensure recordings include ProjectManagerView, tests, and any other modules using wizard helpers.
**Gate (Exit Criteria)**: Dependency map listing all import sites needing path adjustments.
**Notes**:
- `src/modules/project-manager/ProjectManagerView.tsx` imports `CreateProjectWizardV2` via local relative path.
- Vitest suites `ProjectManagerView.test.tsx` and `ProjectManagerShell.test.tsx` mock the wizard through `@/modules/project-manager/components/wizard-v2/CreateProjectWizardV2`.
- `src/modules/clients/view/ClientsView.tsx` pulls `WizardNewClientDialog` from the wizard components folder for inline reuse.

### Task 2

**Status**: COMPLETED
**Detailed description (scope/goals)**: Design the Clients module structure to host the wizard with clear folder layout and stylesheet location.
**Feature required (optional)**: F-001, F-002
**Purpose/Outcome**: Establish target directories and export surfaces before relocating code.

#### Step 2.1

**Status**: COMPLETED
**Description**: Define folder structure under `src/modules/clients` for wizard assets (components, hooks, utils, types, tests, styles).
**Codebase touched**: src/modules/clients/**
**Sample snippets (optional)**: N/A
**What to do***: Create planning notes detailing subfolders mirroring current wizard organisation, ensuring names align with Clients patterns.
**How to**: Review existing Clients module conventions and map equivalent directories (`components/wizard`, `hooks`, `styles` etc.).
**Check**: Structure maintains files under 300-500 LOC per guideline and follows React 19 module standards.
**Gate (Exit Criteria)**: Documented target structure ready for file moves.
**Notes**:
- Introduce `src/modules/clients/wizard/` as the root for the relocated package, retaining `CreateProjectWizardV2.tsx` alongside `index.ts`.
- Mirror current segmentation: `components/`, `hooks/`, `utils/`, and `__tests__/` directories (including nested `utils/__tests__`).
- Keep shared definitions (`types.ts`, `constants.ts`, `utils.ts`) at the wizard root for clear entry.
- Plan to place stylesheet within the wizard root (name to be finalized in Step 2.2) to keep assets colocated with React code.

#### Step 2.2

**Status**: COMPLETED
**Description**: Plan stylesheet relocation, including new filename and import points.
**Codebase touched**: src/modules/project-manager/components/wizard-v2/wizard-v2.css, src/modules/clients/**/*
**Sample snippets (optional)**: N/A
**What to do***: Decide on CSS file name under Clients (e.g., `client-wizard.css`) and determine which components will import it.
**How to**: Check Clients module styling practices (existing CSS files) and align naming; note updates required in wizard components.
**Check**: Plan ensures single source of wizard styles with updated relative paths.
**Gate (Exit Criteria)**: Style relocation strategy captured with target file path and import updates.
**Notes**:
- Relocate stylesheet to `src/modules/clients/wizard/client-wizard.css`, keeping class names intact to avoid regressions.
- Update `CreateProjectWizardV2.tsx` to import the new CSS file; confirm whether additional consumers (e.g., `WizardNewClientDialog`) require explicit imports once files move.
- Remove the old CSS file from the Project Manager module after relocation.

### Task 3

**Status**: COMPLETED
**Detailed description (scope/goals)**: Relocate wizard implementation files to the Clients module and adjust intra-wizard imports.
**Feature required (optional)**: F-001, F-002
**Purpose/Outcome**: Achieve a functioning wizard residing under Clients with consistent internal references.

#### Step 3.1

**Status**: COMPLETED
**Description**: Move React components, hooks, utils, constants, and types into the new Clients wizard directories.
**Codebase touched**: src/modules/project-manager/components/wizard-v2/**, src/modules/clients/**
**Sample snippets (optional)**: N/A
**What to do***: Physically relocate files preserving relative structure, update import paths to new module namespace, and ensure alias usage (`@/modules/clients`).
**How to**: Use `mv`/editor refactors, update TypeScript imports, and run TypeScript compiler for quick checks.
**Check**: Components compile with new paths, no lingering references to old project-manager directory.
**Gate (Exit Criteria)**: Wizard code exists solely under Clients module with lint/TS free of unresolved imports.
**Notes**:
- Migrated the full wizard package into `src/modules/clients/wizard`, keeping components, hooks, utils, and tests intact.
- Normalized internal imports (`CreateProjectWizardV2` and `WizardDetailsStep` now reference shared Project Manager config/resources via `@/modules/project-manager/...` aliases).
- Verified no residual `wizard-v2` folder remains in the Project Manager module.

#### Step 3.2

**Status**: COMPLETED
**Description**: Relocate wizard stylesheet to Clients module and fix CSS imports.
**Codebase touched**: src/modules/project-manager/components/wizard-v2/wizard-v2.css, src/modules/clients/**/*
**Sample snippets (optional)**: N/A
**What to do***: Create new CSS file in Clients folder, move contents, update import in wizard container and any other components referencing it.
**How to**: Copy CSS content, adjust relative paths in TypeScript `import "./..."`, ensure naming aligns with Clients conventions.
**Check**: Build step references the new CSS path; old file removed from Project Manager module.
**Gate (Exit Criteria)**: CSS referenced from Clients module only; no stale imports remain.
**Notes**:
- Renamed stylesheet to `src/modules/clients/wizard/client-wizard.css` and removed it from the Project Manager tree.
- Updated `CreateProjectWizardV2` to import the new CSS file; no other modules referenced the old filename.

#### Step 3.3

**Status**: COMPLETED
**Description**: Update barrel exports and module indices to expose the wizard from Clients module.
**Codebase touched**: src/modules/clients/index.ts, src/modules/clients/view/index.ts, new wizard index files
**Sample snippets (optional)**: N/A
**What to do***: Export relocated wizard where necessary for sharing with Project Manager, maintaining single entry points.
**How to**: Adjust existing index files or add new ones to re-export wizard components/hooks.
**Check**: Project Manager can import wizard via Clients module path without deep traversal.
**Gate (Exit Criteria)**: Clients module exports include wizard entry point with TypeScript errors resolved.
**Notes**:
- Added `src/modules/clients/wizard/index.ts` exposing the wizard component, helper utilities, and associated types.
- Updated `src/modules/clients/index.ts` to re-export the wizard package, enabling consumers to import from `@/modules/clients`.

### Task 4

**Status**: COMPLETED
**Detailed description (scope/goals)**: Rewire integrations, tests, and documentation references to the new Clients wizard location.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Ensure application and automated tests use the relocated wizard without breakage.

#### Step 4.1

**Status**: COMPLETED
**Description**: Update Project Manager view and related components to import wizard from Clients module.
**Codebase touched**: src/modules/project-manager/ProjectManagerView.tsx, other project-manager files referencing wizard
**Sample snippets (optional)**: N/A
**What to do***: Modify import statements and props usage to point at Clients wizard entry point.
**How to**: Replace old `@/modules/project-manager/components/wizard-v2/...` imports with new Clients paths.
**Check**: Render logic remains unchanged aside from import paths; TypeScript compile passes.
**Gate (Exit Criteria)**: Project Manager builds with new wizard path and no unused imports.
**Notes**:
- `ProjectManagerView` now imports `CreateProjectWizardV2` from `@/modules/clients/wizard`.
- `ClientsView` swaps its wizard dialog import to the same Clients entry point.

#### Step 4.2

**Status**: COMPLETED
**Description**: Adjust unit tests and mocks referencing the old wizard path.
**Codebase touched**: src/modules/project-manager/__tests__/**/*.test.tsx, wizard-specific tests
**Sample snippets (optional)**: N/A
**What to do***: Update jest/vitest mocks and direct imports to match new Clients module path; relocate wizard tests if required.
**How to**: Refactor import strings in tests, move wizard test files alongside relocated code, ensure Vitest configurations still resolve modules.
**Check**: Tests compile/run referencing new locations; no residual imports referencing project-manager wizard path.
**Gate (Exit Criteria)**: Test suite references Clients wizard paths exclusively.
**Notes**:
- Updated `ProjectManagerView` and `ProjectManagerShell` tests to mock `@/modules/clients/wizard`.
- Wizard tests already moved with the feature in Step 3.1; no additional relocation required.

#### Step 4.3

**Status**: COMPLETED
**Description**: Review documentation or plan files pointing to old wizard paths.
**Codebase touched**: plans/**, docs/** referencing CreateProjectWizardV2
**Sample snippets (optional)**: N/A
**What to do***: Search for path mentions, update if necessary to prevent stale guidance.
**How to**: Use `rg "project-manager/components/wizard-v2"` in plans/docs and adjust to new Clients path.
**Check**: Documentation matches new structure; no outdated instructions remain.
**Gate (Exit Criteria)**: Updated references validated or noted for follow-up if out of scope.
**Notes**:
- Reviewed `plans/` and `docs/`; only the active migration plan/report referenced the former path (retained for historical context within the plan). No other documentation required updates.

### Task 5

**Status**: COMPLETED
**Detailed description (scope/goals)**: Validate the refactor via linting, tests, and manual smoke plan.
**Feature required (optional)**: F-001, F-002
**Purpose/Outcome**: Confirm relocation does not introduce regressions.

#### Step 5.1

**Status**: COMPLETED
**Description**: Run automated checks (type-check, lint, vitest) focusing on Clients/Project Manager modules.
**Codebase touched**: tooling scripts (npm), src/**
**Sample snippets (optional)**: N/A
**What to do***: Execute relevant npm scripts (e.g., `npm run lint`, `npm run test -- project-manager clients`) after refactor.
**How to**: Use project scripts, investigate and resolve any failures stemming from path updates.
**Check**: All checks pass; failures addressed or triaged.
**Gate (Exit Criteria)**: Documented successful run or explicit issues queued if unresolved.
**Notes**:
- `npm run typecheck` and `npm run test:run` both pass after relocation.
- `npm run lint` still surfaces existing project-wide errors (unused variables in `project-view` module) plus numerous pre-existing warnings; no new wizard-related lint errors observed. Logged for follow-up outside this migration.

#### Step 5.2

**Status**: COMPLETED
**Description**: Outline manual verification steps for QA (wizard launch from Project Manager, client creation, file upload).
**Codebase touched**: N/A (process task)
**Sample snippets (optional)**: N/A
**What to do***: Enumerate manual test cases verifying wizard opens via Project Manager but is sourced from Clients module.
**How to**: Draft checklist covering open/close dialog, client autocomplete, file drop, finalize flow handshake.
**Check**: Checklist covers key user paths impacted by relocation.
**Gate (Exit Criteria)**: Manual verification plan documented and shared.
**Notes**:
- QA checklist:
  1. Launch Project Manager view, trigger “New project” and confirm wizard dialog renders (imported from Clients module).
  2. In wizard details step, invoke inline “Add client” dialog, create a client, ensure it appears in the autocomplete.
  3. Drop/upload files in the files step, assign roles, and proceed to finalize preview without errors.
  4. Complete creation to ensure project list refreshes and success toast appears; repeat to verify closing/cancellation resets wizard state.

### Task 6

**Status**: COMPLETED
**Detailed description (scope/goals)**: Resolve outstanding ESLint errors caused by unused props in Project View components so `npm run lint` can succeed post-migration.
**Feature required (optional)**: N/A
**Purpose/Outcome**: Restore a passing lint run by addressing the reported `@typescript-eslint/no-unused-vars` violations.

#### Step 6.1

**Status**: COMPLETED
**Description**: Update `ProjectViewContent` (and related files if necessary) to silence unused destructured props while keeping linter rules intact.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx (possible supporting files)
**Sample snippets (optional)**: N/A
**What to do***: Review the destructured props causing errors, remove unused bindings or prefix with `_` per lint convention, ensuring component behaviour is unaffected.
**How to**: Inspect the component to confirm which props are unused, adjust destructuring/passing accordingly, and rerun ESLint.
**Check**: `npm run lint` no longer reports `no-unused-vars` errors; only pre-existing warnings may remain.
**Gate (Exit Criteria)**: Lint command fails only due to previously acknowledged warnings, not new errors.
**Notes**:
- Simplified `ProjectViewContent` destructuring to only pull used props and dropped unused state setters; lint now succeeds with existing project warnings.
