# Plan: weg-translator-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Add a sub-header zone with language pair(s) badge inside ProjectViewContent."
- A-002: "Add a File Table with loaded project files."
- A-003: "Add an Artifact Table with artifact (xlf files)."
- A-004: "Add a Reference Table with reference file loaded."
- A-005: "Add an Instruction Table with Instruction file."
- A-006: "Each table will have its own file, css style and sub-folder."
- A-007: "Refactor and improve the project-view strictly according to progressive instructions without breaking existing functionality."

## New Features required
- F-001: "Language pair sub-header component integrated into ProjectView."
- F-002: "Modular project files table supporting existing file actions and filters."
- F-003: "Modular artifacts table presenting generated XLIFF artifacts."
- F-004: "Modular references table covering reference resources."
- F-005: "Modular instructions table covering guidance files."

## Codebase analysis (if needed according to user_request)
- File: src/modules/project-view/ProjectViewContent.tsx
- Kind: React component (TypeScript)
- Description: Current placeholder wrapper for project overview content, wires filters, roles, and statistics.
- Role: Acts as the main workspace body that will host header, filters, and future tables.
- Dependencies: ProjectViewLayout, ProjectViewAssetFilters, ProjectViewFilesSection, ProjectViewResourcesSection, shared UI primitives.

- File: src/modules/project-view/ProjectViewRoute.tsx
- Kind: React route controller (TypeScript)
- Description: Fetches project bundle, statistics, and orchestrates file operations exposed to the view.
- Role: Supplies ProjectViewContent with summary data, handlers, and busy state.
- Dependencies: Tauri IPC helpers (getProjectBundle, addFilesToProject, etc.), ProjectViewLayout, toast system.

- File: src/modules/project-view/views/ProjectViewFilesSection.tsx
- Kind: React component (TypeScript table)
- Description: Implements current TanStack table for project files, including sorting, selection, and actions.
- Role: Source for file table logic that needs to be modularized into a dedicated component and subfolder.
- Dependencies: @tanstack/react-table, lucide icons, shared UI components, PROJECT_FILE_ROLE_OPTIONS.

- File: src/modules/project-view/views/ProjectViewResourcesSection.tsx
- Kind: React component (TypeScript card grid)
- Description: Displays reference-style resources with simple filters and action buttons.
- Role: Will inform the mapping required for new reference/instruction/artifact tables.
- Dependencies: Shared UI components (Badge, Button, Tooltip), lucide icons, AssetFilters.

- File: src/modules/project-view/views/ProjectViewAssetFilters.tsx
- Kind: React component (TypeScript controls)
- Description: Renders the search, role filter, status filter, and grouping toggles for assets.
- Role: Provides filtering UI reused by files and will need alignment with new tables.
- Dependencies: Shared Input, Select, Button components; lucide icons.

- File: src/modules/project-view/layout/ProjectViewLayout.tsx
- Kind: Layout component (TypeScript)
- Description: Wraps the project view sections with header, toolbar, and content slots.
- Role: Provides structural container that ProjectViewContent must integrate with when adding sub-header.
- Dependencies: class-names utility, shared layout styling.

- File: docs/db-refactor-summary.md
- Kind: Documentation
- Description: Summarizes database schema pieces relevant to projects, files, artifacts, and related metadata.
- Role: Reference for aligning frontend tables with backend entities and terminology.
- Dependencies: None.

### Codebase insight summary
Existing project view still relies on legacy sections; ProjectViewContent has been reduced to a placeholder awaiting new composition. File management logic already exists in ProjectViewFilesSection within the views folder, suggesting a migration path into a dedicated files-table module. Resource listings are card-based, so new table components must reinterpret the same bundles into tabular datasets. Filters and actions flow from ProjectViewRoute through ProjectViewContent, so any refactor must preserve handler signatures and busy-state coordination.

### Relevant/Touched features
Project overview workspace, project file management actions (open, regenerate, remove), artifact lifecycle display, reference and instruction resource visibility, language pair metadata presentation, asset filtering UI.

## Plan

### Task 1

**Status**: COMPLETED
**Detailed description (scope/goals)**: Validate data contracts and UI requirements before restructuring ProjectViewContent to ensure all new components receive the fields they need.
**Feature required (optional)**: -
**Purpose/Outcome**: Confirm that summary, language pairs, file bundles, references, instructions, and artifacts expose the data necessary for the new sub-header and tables.

#### Step 1.1

**Status**: COMPLETED
**Description**: Review ProjectViewRoute and ProjectViewContent prop types to map available data to planned components.
**Codebase touched**: src/modules/project-view/ProjectViewRoute.tsx, src/modules/project-view/ProjectViewContent.tsx
**Sample snippets (optional)**: -
**What to do***: Inspect types such as ProjectViewWorkspaceProps and ProjectFileBundle to list required fields for sub-header badges and each table.
**How to**: Trace data assignments in ProjectViewRoute and compare with database DTOs documented in docs/db-refactor-summary.md.
**Check**: Ensure each planned component has confirmed data sources or note identified gaps.
**Gate (Exit Criteria)**: Documented mapping exists with no unresolved field gaps or blockers.
**Notes**:
- Sub-header inputs confirmed: `languagePairs` (ProjectLanguagePair[]) exposed via `ProjectViewWorkspaceProps` from `ProjectViewRoute` (`src/modules/project-view/ProjectViewRoute.tsx:392-420`) plus `subjectLine`, `summary`, `fileCount`, and `statistics?.lastActivity` for supplemental metadata (`ProjectViewContent.tsx:22-51`).
- Files table dataset: `files: ProjectFileBundle[]` carries `file` (uuid, filename, storedAt, type), `info` (sizeBytes, ext, counts), `languagePairs`, and nested `artifacts` entries with status/size fields (`src/shared/types/database.ts:166-210`). Existing `ProjectViewFilesSection` uses these fields for name, role, languages, status, and size; all required props already passed through `ProjectViewWorkspaceProps`.
- Artifact table source: `files[].artifacts` (ArtifactRecord) containing `artifactUuid`, `artifactType`, `status`, `sizeBytes`, `segmentCount`, `tokenCount` and implicit parent file metadata (`ProjectViewRoute.tsx:392-420`). No additional DTOs needed; `bundle.jobs` remains unused but available if future status correlations are required.
- References & instructions tables: `ProjectViewRoute` partitions `bundle.files` by `file.type` into `references`/`instructions` arrays with the full `ProjectFileBundle` shape (`ProjectViewRoute.tsx:372-388`). Supports listing filename, stored path, size, language pairs, and reuse of `onOpenFile`/`onRemoveFile` callbacks.
- Action handlers already flow through `ProjectViewWorkspaceProps` (`onOpenFile`, `onRemoveFile`, `onRegenerateFile`, `onRegenerateFiles`, `onChangeRole`, `onAddFiles`, `isBusy`), ensuring parity across future tables. No data gaps identified.

#### Step 1.2

**Status**: COMPLETED
**Description**: Establish filtering and grouping expectations across all upcoming tables.
**Codebase touched**: src/modules/project-view/views/ProjectViewAssetFilters.tsx, src/modules/project-view/views/ProjectViewFilesSection.tsx
**Sample snippets (optional)**: -
**What to do***: Decide which tables reuse existing filters versus require tailored scopes.
**How to**: Analyze current filter logic and determine whether references, instructions, and artifacts share the same filter set or need scoped variants.
**Check**: Alignment documented with future implementation notes.
**Gate (Exit Criteria)**: Filter strategy agreed upon for each table without contradictions.
**Notes**:
- Global filter state (`AssetFilters`, `AssetGrouping`) will remain owned by `ProjectViewContent` so the shared toolbar keeps behaviour consistent (`src/modules/project-view/ProjectViewContent.tsx:58-77`).
- Files table consumes the full filter set and both grouping modes exactly as implemented in `ProjectViewFilesSection` today (`src/modules/project-view/views/ProjectViewFilesSection.tsx:53-146`).
- Artifacts table will respect `filters.search` (matching artifact filename or parent file) and `filters.status` (matching `ArtifactRecord.status` from `ProjectFileBundle.artifacts`). Role filtering narrows to `processable` artifacts; when a non-processable role is active, the table renders its empty state to keep expectations clear.
- References table uses `filters.search` + `filters.role`, mirroring the previous card view behaviour (`ProjectViewResourcesSection` search/role filtering). Status filter is ignored for references.
- Instructions table follows the same pattern as references: search + role only; status filter is ignored to avoid misleading results.
- Grouping toggle applies exclusively to the files table. Other tables remain in flat layouts and do not react to grouping changes; they will still receive the prop for parity but ignore it internally.

### Task 2

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Implement the language pair sub-header with badges and supporting styles.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Provide immediate visibility into project language pairs above the tables.

#### Step 2.1

**Status**: COMPLETED
**Description**: Create subfolder and styling scaffold for the sub-header component.
**Codebase touched**: src/modules/project-view/views/language-subheader/, src/modules/project-view/views/language-subheader/LanguageSubheader.module.css
**Sample snippets (optional)**: -
**What to do***: Add directory, CSS module, and index barrel ready for component implementation, adhering to naming conventions.
**How to**: Use filesystem operations to create files and import CSS with standard module pattern.
**Check**: Build runs without missing module errors after scaffold creation.
**Gate (Exit Criteria)**: Sub-header folder structure and CSS placeholder in place.
**Notes**:
- Added `views/language-subheader/` directory with CSS module scaffold defining layout hooks (`.root`, `.meta`, `.badges`, `.metrics`) to support upcoming layout (`src/modules/project-view/views/language-subheader/LanguageSubheader.module.css`).
- Created placeholder component file exporting `LanguageSubheader` to unblock imports for the next step (`LanguageSubheader.tsx`).
- Added barrel export (`index.ts`) so higher-level modules can import via `views/language-subheader`.

#### Step 2.2

**Status**: COMPLETED
**Description**: Implement LanguageSubheader component rendering badges with accessibility support.
**Codebase touched**: src/modules/project-view/views/language-subheader/LanguageSubheader.tsx
**Sample snippets (optional)**: -
**What to do***: Map language pair data into semantic markup using Badge, iconography, and aria labelling.
**How to**: Follow React 19 guidelines, avoid unnecessary memoization, and leverage helper utilities for formatting.
**Check**: Component renders badges only when data exists and passes linting.
**Gate (Exit Criteria)**: Component exports with typed props and unit snapshot or story ready if required.
**Notes**:
- Implemented `LanguageSubheader` with typed props covering language pairs, subject line, file count, and optional last-activity metadata (`LanguageSubheader.tsx`).
- Added labelled language badges with palette-based tone cycling, deduplicating source/target pairs and degrading to a placeholder when empty.
- Updated CSS module to support responsive layout, badge placeholders, and metric alignment while reusing palette variables (`LanguageSubheader.module.css`).

#### Step 2.3

**Status**: COMPLETED
**Description**: Integrate LanguageSubheader into ProjectViewContent layout.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx
**Sample snippets (optional)**: -
**What to do***: Import the new component, pass derived badge data, and place it within the header region alongside separators.
**How to**: Update layout JSX ensuring compliance with existing structure and avoid disrupting other elements.
**Check**: Visual layout shows sub-header in correct location and passes basic tests.
**Gate (Exit Criteria)**: ProjectViewContent renders sub-header without console warnings.
**Notes**:
- Replaced the placeholder hero markup with the new `LanguageSubheader`, wiring language pairs, subject line, file count, and formatted last-activity metadata (`src/modules/project-view/ProjectViewContent.tsx:24-87`, `100-116`).
- Simplified imports to remove unused legacy components and ensured the content section uses the existing `project-overview__hero` styling for visual continuity.
- Adjusted layout to remove the previous hero card wrapper, leaving the sub-header inline at the top of the content section (`ProjectViewContent.tsx:40-70`).
- Updated integration to pass only language pairs as the component now handles its own label and styling concerns.

### Task 3

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Build the modular ProjectFilesTable component with dedicated styles while preserving current functionality.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Offer a maintainable table module for project files that supports selection, filters, and actions.

#### Step 3.1

**Status**: NOT COMPLETED
**Description**: Set up files-table subfolder with CSS module and entry point.
**Codebase touched**: src/modules/project-view/views/files-table/, src/modules/project-view/views/files-table/ProjectFilesTable.module.css, src/modules/project-view/views/files-table/index.ts
**Sample snippets (optional)**: -
**What to do***: Create directory, style sheet, and exporting index.
**How to**: Move or replace existing ProjectViewFilesSection assets into the new structure.
**Check**: Import paths resolve and build continues to compile.
**Gate (Exit Criteria)**: New folder structure exists and is referenced without errors.
**Notes**:
- Scaffolded `views/files-table/` directory with CSS module and barrel export; placeholder component currently renders a neutral message while accepting the full prop contract (`ProjectFilesTable.tsx`).
- Styling file introduces root/placeholder classes aligned with the project palette, ready for richer layouts in Step 3.3.
- No consumers updated yet—the legacy `ProjectViewFilesSection` remains until the refactor in Step 3.2.

#### Step 3.2

**Status**: COMPLETED
**Description**: Refactor ProjectViewFilesSection logic into ProjectFilesTable component.
**Codebase touched**: src/modules/project-view/views/files-table/ProjectFilesTable.tsx
**Sample snippets (optional)**: -
**What to do***: Reimplement TanStack table configuration, selection handling, and action callbacks within the new component.
**How to**: Transfer code, rename types as needed, ensure React 19 compiler friendliness, and trim unused exports.
**Check**: TypeScript passes, existing features (sorting, selection, actions) remain intact in local smoke test.
**Gate (Exit Criteria)**: Component exported and consumed by ProjectViewContent with no regressions.
**Notes**:
- Ported legacy table logic into `ProjectFilesTable`, preserving sorting, role changes, selection, and action callbacks while satisfying lint constraints (`src/modules/project-view/views/files-table/ProjectFilesTable.tsx`).
- Added grouping branch via `GroupedFilesView` and helper utilities (status, size, formatting) ensuring parity with the previous implementation.
- Updated `ProjectViewContent` to render the new component and removed the old `ProjectViewFilesSection` module; placeholder state setters renamed for future integration while keeping TypeScript clean (`ProjectViewContent.tsx`).
- Verification: `pnpm typecheck`.
- Follow-up adjustments applied compact styling (title + table) and simplified columns per latest guidance (removed status/updated, compact language text).

#### Step 3.3

**Status**: NOT COMPLETED
**Description**: Apply scoped styling aligning with WeGentic palette and accessibility guidance.
**Codebase touched**: src/modules/project-view/views/files-table/ProjectFilesTable.module.css
**Sample snippets (optional)**: -
**What to do***: Port necessary styles from ProjectViewPage.css or craft new ones to support layout and states.
**How to**: Use CSS variables defined in App.css, ensure focus indicators, and minimize overrides.
**Check**: Visual QA confirms consistent appearance; lint/style checks pass.
**Gate (Exit Criteria)**: Table styling integrated and no style regressions detected.

### Task 4

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Implement the artifacts table to display generated XLIFF artifacts in a dedicated module.
**Feature required (optional)**: F-003
**Purpose/Outcome**: Surface artifact metadata and status for each file in a structured table.

#### Step 4.1

**Status**: NOT COMPLETED
**Description**: Define artifact data mapping from ProjectFileBundle.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx, src/shared/types/database.ts
**Sample snippets (optional)**: -
**What to do***: Determine which fields (artifact status, size, updated timestamps) will populate the table rows.
**How to**: Inspect artifact structures in bundles and cross-reference docs/db-refactor-summary.md for naming.
**Check**: Mapping drafted without missing attributes.
**Gate (Exit Criteria)**: Documented field list ready for component implementation.

#### Step 4.2

**Status**: NOT COMPLETED
**Description**: Create artifacts-table subfolder with component and CSS module.
**Codebase touched**: src/modules/project-view/views/artifacts-table/, src/modules/project-view/views/artifacts-table/ProjectArtifactsTable.tsx, src/modules/project-view/views/artifacts-table/ProjectArtifactsTable.module.css, src/modules/project-view/views/artifacts-table/index.ts
**Sample snippets (optional)**: -
**What to do***: Scaffold new component replicating needed columns (name, status, size, updated, actions if any).
**How to**: Use semantic table markup, integrate icons, and reuse shared UI elements.
**Check**: Component compiles with typed props and placeholder data renders as expected.
**Gate (Exit Criteria)**: Artifacts table module ready for integration.

#### Step 4.3

**Status**: NOT COMPLETED
**Description**: Connect artifacts table to ProjectViewContent and filter inputs.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx
**Sample snippets (optional)**: -
**What to do***: Pass filtered artifact dataset into the new component, reuse existing filter state as appropriate.
**How to**: Derive dataset within ProjectViewContent or dedicated selector hook, ensure memoization where beneficial.
**Check**: Rendering includes correct row counts and responds to filter changes.
**Gate (Exit Criteria)**: Artifact table visible with live data and no runtime errors.

### Task 5

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Deliver a references table module for supporting documents.
**Feature required (optional)**: F-004
**Purpose/Outcome**: Present reference resources with clear metadata and available actions.

#### Step 5.1

**Status**: NOT COMPLETED
**Description**: Specify schema for reference rows based on ProjectFileBundle.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx
**Sample snippets (optional)**: -
**What to do***: Decide on columns such as filename, role, languages, size, updated, and open/remove actions.
**How to**: Review current resource card fields and align names with documentation.
**Check**: Column list agreed and documented.
**Gate (Exit Criteria)**: Reference schema ready for use.

#### Step 5.2

**Status**: NOT COMPLETED
**Description**: Implement ReferenceTable component and styles in its own subfolder.
**Codebase touched**: src/modules/project-view/views/references-table/ProjectReferencesTable.tsx, src/modules/project-view/views/references-table/ProjectReferencesTable.module.css, src/modules/project-view/views/references-table/index.ts
**Sample snippets (optional)**: -
**What to do***: Build table component with accessible markup, optional action buttons, and empty states.
**How to**: Follow React 19 best practices, import shared Badge/Button, and reuse formatting helpers.
**Check**: Component compiles and story or test verifies rendering with sample data.
**Gate (Exit Criteria)**: Reference table component ready for integration.

#### Step 5.3

**Status**: NOT COMPLETED
**Description**: Wire references table into ProjectViewContent with appropriate filters and handlers.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx
**Sample snippets (optional)**: -
**What to do***: Provide data props and action callbacks (open, remove) from ProjectViewRoute through ProjectViewContent.
**How to**: Ensure optional handlers remain guarded to prevent undefined calls.
**Check**: Interaction works in local run without errors.
**Gate (Exit Criteria)**: References table active with expected interactions.

### Task 6

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Create the instructions table for instruction files in a modular fashion.
**Feature required (optional)**: F-005
**Purpose/Outcome**: Display instruction file metadata and ensure consistent UX with other resource tables.

#### Step 6.1

**Status**: NOT COMPLETED
**Description**: Determine instruction row requirements and empty state messaging.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx
**Sample snippets (optional)**: -
**What to do***: Identify columns and actions (open, remove) plus copy for empty table.
**How to**: Reference existing instruction handling logic or card displays if any.
**Check**: Requirements captured and validated against stakeholder notes.
**Gate (Exit Criteria)**: Instruction table spec finalized.

#### Step 6.2

**Status**: NOT COMPLETED
**Description**: Implement InstructionsTable component with scoped styles.
**Codebase touched**: src/modules/project-view/views/instructions-table/ProjectInstructionsTable.tsx, src/modules/project-view/views/instructions-table/ProjectInstructionsTable.module.css, src/modules/project-view/views/instructions-table/index.ts
**Sample snippets (optional)**: -
**What to do***: Build table component mirroring reference pattern with instruction-specific copy.
**How to**: Reuse shared helpers, ensure accessible semantics, and manage optional actions.
**Check**: Rendered output passes lint/tests and handles empty data gracefully.
**Gate (Exit Criteria)**: Instructions table module ready for integration.

#### Step 6.3

**Status**: NOT COMPLETED
**Description**: Integrate instructions table into ProjectViewContent.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx
**Sample snippets (optional)**: -
**What to do***: Feed instructions data and connect open/remove callbacks if available.
**How to**: Align with filter decisions and maintain responsive layout.
**Check**: Table appears with correct data and respects busy state disabling.
**Gate (Exit Criteria)**: Instructions table operational without regressions.

### Task 7

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Finalize composition, shared utilities, and regression coverage after introducing new components.
**Feature required (optional)**: -
**Purpose/Outcome**: Ensure the refactored project view is cohesive, styled, and tested.

#### Step 7.1

**Status**: NOT COMPLETED
**Description**: Update shared utilities for formatting and reuse across tables.
**Codebase touched**: src/modules/project-view/utils/, src/shared/utils/
**Sample snippets (optional)**: -
**What to do***: Consolidate formatting helpers (size, timestamps, language formatting) to avoid duplication.
**How to**: Extract functions from existing sections into reusable utilities with tests if warranted.
**Check**: Utilities used by all new tables; dead code removed.
**Gate (Exit Criteria)**: Helper utilities centralized and referenced cleanly.

#### Step 7.2

**Status**: NOT COMPLETED
**Description**: Compose all new components within ProjectViewContent including layout, filters, and busy states.
**Codebase touched**: src/modules/project-view/ProjectViewContent.tsx
**Sample snippets (optional)**: -
**What to do***: Arrange header, filters, and table stack within layout, ensuring responsive design and consistent spacing.
**How to**: Use existing layout components, separators, and ensure compatibility with scroll containers.
**Check**: Manual verification ensures no overlapping UI and filter interactions update all relevant tables.
**Gate (Exit Criteria)**: ProjectViewContent renders complete experience without console warnings.

#### Step 7.3

**Status**: NOT COMPLETED
**Description**: Add or update tests/documentation to cover new components.
**Codebase touched**: src/modules/project-view/__tests__/, src/modules/project-view/views/**, docs/
**Sample snippets (optional)**: -
**What to do***: Write component-level tests or stories validating critical rendering paths; update README if needed.
**How to**: Use Vitest and React Testing Library for components, ensure snapshots or assertions for table output.
**Check**: Tests pass locally and CI scripts succeed.
**Gate (Exit Criteria)**: Test suite updated with coverage for new tables/sub-header; documentation reflects changes.

#### Step 7.4

**Status**: NOT COMPLETED
**Description**: Perform end-to-end regression sweep within the desktop app environment.
**Codebase touched**: src/modules/project-view/ProjectViewRoute.tsx, overall project
**Sample snippets (optional)**: -
**What to do***: Run app, validate workflows (adding files, regenerating, viewing tables) to catch integration issues.
**How to**: Launch Tauri dev environment, interact with UI, monitor console/log output.
**Check**: No regressions observed in file actions or data refresh.
**Gate (Exit Criteria)**: QA sign-off recorded; ready for implementation phase.
