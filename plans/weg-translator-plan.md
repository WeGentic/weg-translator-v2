# Plan: weg-translator-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Open project will trigger a Project specific page, with the exact same layout as Project Manager page (Header, Toolbar, Content and Footer)"
- A-002: "Project-specific page will display ALL project data in a modern and visually appealing UI (compliant with app theme and style)"
- A-003: "Project-specific page will display xlf files generated"
- A-004: "Project-specific page will display References"
- A-005: "Project-specific page will display Instructions"
- A-006: "Project-specific page will allow to add/remove files"
- A-007: "Project-specific page will allow to change files roles"
- A-008: "Project-specific page will allow to regenerate xlf files"
- A-009: "Project-specific page will show detailed statistics"

## New Features required
- F-001: "Dedicated project overview route reachable from Project Manager selections"
- F-002: "Project overview layout layer mirroring existing Project Manager shell with reusable header, toolbar, content, and footer slots"
- F-003: "Data presentation components for project assets (files, references, instructions) with actionable controls"
- F-004: "Interactive workflows for project file management (add/remove, role changes, regeneration triggers)"
- F-005: "Project performance and translation statistics widgets aligned with design system"

## Codebase analysis (if needed according to user_request)
- File: docs/db-refactor-summary.md
- Kind: Documentation
- Description: Summarises v2 SQLite schema, entities, and IPC layers for projects, files, artifacts, and jobs.
- Role: Defines authoritative data model leveraged by frontend when presenting project-specific information.
- Dependencies: src-tauri/src/db/schema.rs, src/core/ipc/{projects,artifacts,jobs}.ts.

- File: src/modules/projects/components/wizard-v2/CreateProjectWizardV2.tsx
- Kind: React component (wizard orchestrator)
- Description: Handles project creation workflow, file ingestion, conversion planning, and feedback lifecycle.
- Role: Source for existing project data payload expectations and conversion status events.
- Dependencies: @tauri-apps plugins, '@/core/ipc', wizard hooks/components.

- File: src/modules/projects/ProjectManagerView.tsx
- Kind: React container view
- Description: Provides current project listing page with header, toolbar, table content, and footer patterns.
- Role: Canonical layout to replicate for project-specific page and navigation entry point when opening a project.
- Dependencies: '@/core/ipc', table UI modules, toast system, sidebar sync utilities.

### Codebase insight summary
Project listing currently loads via ProjectManagerView with polling and table controls; detail view route and UI do not yet exist. Wizard V2 clarifies expected project asset structure (files, language pairs, conversion events). Backend schema supports artifacts, jobs, and metadata required for the project overview.

### Relevant/Touched features
Project navigation, project data presentation, file management actions, translation artifact regeneration, statistics reporting.

## Plan

### Task 1

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Establish dedicated project overview routing and navigation entry triggered when a project is opened from the manager list.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Users land on a project-specific page with shared shell layout whenever they open an existing project.

#### Step 1.1

**Status**: NOT COMPLETED
**Description**: Map existing TanStack Router tree and define project detail route module.
**Codebase touched**: src/router, src/routes/projects/
**Sample snippets (optional)**: 
**What to do***: Inspect current file-based routing to identify insertion point and create route file with loader context.
**How to**: Review generated routeTree, scaffold new route file with params handling, and register layout reuse.
**Check**: Route resolves for `/projects/$projectId` (or equivalent) without breaking existing navigation.
**Gate (Exit Criteria)**: Project detail route appears in router tree and responds to navigation attempts.

#### Step 1.2

**Status**: NOT COMPLETED
**Description**: Wire ProjectManagerView open handlers to navigate to the new route with selected project id.
**Codebase touched**: src/modules/projects/ProjectManagerView.tsx, src/modules/projects/state
**Sample snippets (optional)**: 
**What to do***: Replace onOpenProject callback usage with router navigate call carrying project payload.
**How to**: Inject router navigation utilities, ensure selection preserves current filters/state as needed.
**Check**: Clicking "Open" or row double-click transitions to project overview.
**Gate (Exit Criteria)**: Navigation happens consistently from all open triggers without console errors.

#### Step 1.3

**Status**: NOT COMPLETED
**Description**: Implement route loader/data hook fetching project bundle and related assets via IPC.
**Codebase touched**: src/core/ipc/projects.ts, src/core/ipc/artifacts.ts, src/shared/types/database.ts
**Sample snippets (optional)**: 
**What to do***: Compose data-fetching function retrieving project metadata, files, artifacts, references, instructions, and stats.
**How to**: Leverage existing IPC commands or add new ones to return aggregated project bundle; handle errors with toast/log.
**Check**: Loader returns structured data for seeded project; handles missing data gracefully.
**Gate (Exit Criteria)**: Route renders with actual project data payload available to UI components.

### Task 2

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Build project overview layout mirroring Project Manager shell while supporting project-specific contextual data.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Provide consistent user experience by reusing header, toolbar, content, and footer patterns.

#### Step 2.1

**Status**: NOT COMPLETED
**Description**: Abstract reusable layout primitives from ProjectManagerView for header/toolbar/content/footer.
**Codebase touched**: src/modules/projects/ProjectManagerHeader.tsx, ProjectManagerToolbar.tsx, ProjectManagerContent.tsx, shared layout utilities
**Sample snippets (optional)**: 
**What to do***: Identify shared sections, create composable layout wrapper or extract shell components with configurable props.
**How to**: Refactor existing layout into reusable components or shared hooks, ensuring no regression on manager view.
**Check**: Both manager and detail views render using shared layout primitives without UI drift.
**Gate (Exit Criteria)**: Shared shell component exported and consumed by both contexts with story/preview validation.

#### Step 2.2

**Status**: NOT COMPLETED
**Description**: Implement project overview page component consuming shared shell and rendering project metadata summary.
**Codebase touched**: src/modules/projects/views/ProjectOverviewPage.tsx (new), associated CSS module
**Sample snippets (optional)**: 
**What to do***: Compose page with hero section (project title, status, language pairs) and placeholders for assets/stats sections.
**How to**: Use React 19 patterns, Tailwind/shadcn components, and theme tokens for styling; ensure separate CSS file.
**Check**: Page renders with mocked data, respects responsive flex behavior, and passes linting.
**Gate (Exit Criteria)**: Project overview component integrated into route, matching shell layout expectations.

### Task 3

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Present project assets (XLIFF files, references, instructions) with actionable controls in organized sections.
**Feature required (optional)**: F-003
**Purpose/Outcome**: Users can inspect project assets quickly with modern, theme-compliant UI.

#### Step 3.1

**Status**: NOT COMPLETED
**Description**: Design and implement XLIFF files data grid with status indicators and row actions.
**Codebase touched**: src/modules/projects/components/files, src/shared/ui/data-table
**Sample snippets (optional)**: 
**What to do***: Create table columns (name, role, language pair, status, updated, actions) using existing table primitives.
**How to**: Extend tanstack table configuration, reuse table styling, add virtualization if required for density.
**Check**: Grid displays sample dataset, supports sorting/filters, and action buttons render.
**Gate (Exit Criteria)**: XLIFF table functional with placeholder callbacks for actions.

#### Step 3.2

**Status**: NOT COMPLETED
**Description**: Build reference and instruction sections with list/cards supporting file previews and metadata.
**Codebase touched**: src/modules/projects/components/references, src/modules/projects/components/instructions
**Sample snippets (optional)**: 
**What to do***: Create section headers, list items with download/open actions, and note support.
**How to**: Use shadcn list/card components, integrate theme colors, ensure accessibility.
**Check**: Sections render data from loader, handle empty states gracefully.
**Gate (Exit Criteria)**: References and instructions display correctly with actionable controls.

#### Step 3.3

**Status**: NOT COMPLETED
**Description**: Implement shared filtering, search, and grouping controls for assets.
**Codebase touched**: src/modules/projects/state, shared filter components
**Sample snippets (optional)**: 
**What to do***: Provide search input, tag filters (language pair, role), and toggles for grouping views.
**How to**: Reuse existing table controls state, extend hooks for project detail context.
**Check**: Filters update views without reloads; state persists while navigating within project page.
**Gate (Exit Criteria)**: Asset sections respond to filter controls with debounced updates.

### Task 4

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Enable project file management actions including add/remove, role changes, and regeneration workflows.
**Feature required (optional)**: F-004
**Purpose/Outcome**: Users can manage project assets end-to-end from the project overview page.

#### Step 4.1

**Status**: NOT COMPLETED
**Description**: Implement add/remove file operations using Tauri dialogs and IPC commands.
**Codebase touched**: src/core/ipc/projects.ts, src/modules/projects/components/files/actions
**Sample snippets (optional)**: 
**What to do***: Provide buttons/menus to launch file picker, append metadata, and call backend; support removal with confirmation.
**How to**: Reuse wizard dropzone logic where possible; ensure optimistic UI with rollback on failure.
**Check**: Adding/removing files updates UI and persists after refresh.
**Gate (Exit Criteria)**: File list reflects backend state changes reliably.

#### Step 4.2

**Status**: NOT COMPLETED
**Description**: Support role reassignment for files (source, reference, glossary, etc.).
**Codebase touched**: src/modules/projects/components/files/actions, src/core/ipc/projects.ts
**Sample snippets (optional)**: 
**What to do***: Provide inline dropdown or modal to change role enum and persist via IPC update.
**How to**: Hook into backend update endpoints, validate role transitions, update UI state post-success.
**Check**: Role changes visible immediately and persisted after reload.
**Gate (Exit Criteria)**: Role update flow passes manual regression tests without errors.

#### Step 4.3

**Status**: NOT COMPLETED
**Description**: Expose regenerate XLIFF action for single and batch selections with progress feedback.
**Codebase touched**: src/core/ipc/artifacts.ts, src/modules/projects/components/files/actions, toast/notification system
**Sample snippets (optional)**: 
**What to do***: Add regenerate buttons, queue backend conversion tasks, display progress overlay similar to wizard finalize.
**How to**: Subscribe to project:create progress events or dedicated channels; surface status to UX with toasts/overlays.
**Check**: Regeneration triggers conversions and updates artifact status indicators.
**Gate (Exit Criteria)**: Users receive success/failure feedback and artifacts refresh in UI post-process.

### Task 5

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Surface project statistics and health indicators for translation progress.
**Feature required (optional)**: F-005
**Purpose/Outcome**: Provide actionable insights (counts, progress, warnings) aligned with design guidance.

#### Step 5.1

**Status**: NOT COMPLETED
**Description**: Define statistics dataset (counts, progress metrics, warnings) sourced from backend.
**Codebase touched**: src/core/ipc/projects.ts, src/shared/types/statistics.ts (new)
**Sample snippets (optional)**: 
**What to do***: Identify required metrics (files by status, word counts, token usage) and ensure backend exposes aggregated endpoint.
**How to**: Extend IPC commands or create new aggregator to compute stats on demand.
**Check**: Stats endpoint returns expected schema for sample project.
**Gate (Exit Criteria)**: API contract documented and available to frontend without errors.

#### Step 5.2

**Status**: NOT COMPLETED
**Description**: Implement UI widgets (cards, charts) displaying computed statistics in theme-conformant style.
**Codebase touched**: src/modules/projects/components/stats, associated CSS
**Sample snippets (optional)**: 
**What to do***: Create stat cards with totals, progress bars, and alerts for issues; ensure responsiveness.
**How to**: Use shadcn card components, integrate theme tokens, apply accessible color coding.
**Check**: Widgets render real data, adjust gracefully to varying lengths, and align with layout spacing.
**Gate (Exit Criteria)**: Stats section passes design review and usability check.

### Task 6

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Validate implementation quality with automated tests, accessibility review, and manual QA.
**Feature required (optional)**: 
**Purpose/Outcome**: Ensure reliability, prevent regressions, and confirm UX meets requirements.

#### Step 6.1

**Status**: NOT COMPLETED
**Description**: Author unit/integration tests for data loaders, state hooks, and UI components.
**Codebase touched**: src/test, src/modules/projects/__tests__
**Sample snippets (optional)**: 
**What to do***: Write Vitest/react-testing-library suites covering critical paths and error states.
**How to**: Mock IPC responses, simulate user interactions, assert UI updates and accessibility roles.
**Check**: Tests pass locally and integrate with CI.
**Gate (Exit Criteria)**: Coverage targets met and new tests stable.

#### Step 6.2

**Status**: NOT COMPLETED
**Description**: Execute manual QA, UX validation, and performance sanity checks.
**Codebase touched**: Application runtime, QA checklist docs
**Sample snippets (optional)**: 
**What to do***: Run through user flows (open project, manage files, regenerate, review stats), capture issues, verify styling.
**How to**: Use desktop builds, inspect logs, collaborate with design for adjustments.
**Check**: No blocking defects; UI adheres to theme and accessibility guidelines.
**Gate (Exit Criteria)**: QA sign-off recorded and outstanding issues tracked.
