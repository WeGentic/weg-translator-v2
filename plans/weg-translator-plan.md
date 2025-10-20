# Plan: weg-translator-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Refactor Projects directory" — enforce feature-oriented structure aligned with repository architecture.
- A-002: "Remove ANY unused code (files, folders)" — identify and eliminate dead assets within the Projects scope.
- A-003: "Separate ProjectOverview in another specific folder, on the same level as projects" — extract overview feature into its own module boundary.
- A-004: "Precisely move all related files in the new directory and arrange the code for best maintainability" — relocate dependent assets and reorganize exports for cohesion.
- A-005: "Provide detailed code comments and documentation" — augment source annotations and module docs for future maintainers.

## New Features required
- F-001: "Projects module cleanup workflow that detects and prunes unused exports, components, and styles."
- F-002: "Dedicated project-overview module housing overview route, UI, context, styles, and tests."
- F-003: "Refined shared exports/import mappings to integrate the extracted project overview feature."
- F-004: "Documentation and code comment enhancements covering Projects and Project Overview responsibilities."

## Codebase analysis (if needed according to user_request)
- File: src/modules/projects/index.ts
- Kind: Barrel export
- Description: Re-exports Project Manager and Project Overview entry points, state utilities, and UI tools.
- Role: Primary entry for other modules (e.g., workspace) to consume Projects functionality.
- Dependencies: src/modules/projects/ProjectManagerRoute.tsx, src/modules/projects/ProjectOverviewRoute.tsx, src/modules/projects/state/*.

- File: src/modules/projects/ProjectOverviewRoute.tsx
- Kind: React route/container
- Description: Hosts ProjectOverviewProvider, data fetching, and conditional rendering for the overview page.
- Role: Entry point for overview route; wires summary, bundle, and statistics to the presentation layer.
- Dependencies: src/modules/projects/routes/project-overview-context.tsx, src/modules/projects/views/ProjectOverviewPage.tsx, core IPC hooks.

- File: src/modules/projects/routes/project-overview-context.tsx
- Kind: React context provider
- Description: Declares ProjectOverviewContextValue interface and hook, enforcing provider usage.
- Role: Shares overview data across deeply nested child components.
- Dependencies: React, ProjectOverviewRoute.tsx.

- File: src/modules/projects/views/ProjectOverviewPage.tsx
- Kind: Composite React view
- Description: Composes layout, stats, asset filters, and resources sections; imports dedicated CSS file.
- Role: Presentation layer for overview route, bridging context data to UI widgets.
- Dependencies: ProjectOverviewStatsSection.tsx, ProjectOverviewAssetFilters.tsx, ProjectOverviewFilesSection.tsx, ProjectWorkspaceLayout.

- File: src/modules/projects/ui/overview/ProjectOverview.tsx
- Kind: React component
- Description: Renders workspace overview card using overview components and placeholders.
- Role: Consumed in WorkspacePage to display active project summary.
- Dependencies: components in src/modules/projects/ui/overview/components/*, shared UI primitives.

- File: src/modules/projects/ui/overview/components/OverviewHeader.tsx
- Kind: React component
- Description: Top-level header for overview card with project meta info and actions.
- Role: Shared subcomponent across overview UI; tightly coupled to ProjectOverview props.
- Dependencies: StatusBadge.tsx, OverviewAutoConvertBanner.tsx, shared design tokens.

- File: src/modules/projects/ui/overview/__tests__/ProjectOverview.test.tsx
- Kind: Vitest test suite
- Description: Validates overview rendering states, empty placeholders, and action flows via mocks.
- Role: Regression coverage ensuring overview UI remains functional after relocation.
- Dependencies: ProjectOverview.tsx, testing utilities under src/test.

- File: src/modules/workspace/WorkspacePage.tsx
- Kind: React container
- Description: Chooses main view content; imports ProjectOverview and ProjectOverviewPlaceholder directly from Projects module.
- Role: Integration point where module extraction will require import adjustments.
- Dependencies: "@/modules/projects/ui/overview/ProjectOverview", "@/modules/projects/ui/overview/ProjectOverviewPlaceholder", workspace state hooks.

- File: src/modules/projects/css/*
- Kind: Stylesheets
- Description: Houses CSS assets for Projects module, including overview-specific styles like ProjectOverviewPage.css.
- Role: Needs evaluation to separate overview-related styles into new module.
- Dependencies: Imported by components and views across Projects module.

### Codebase insight summary
Project overview logic spans multiple subdirectories (views, ui/overview, routes) within the Projects module, sharing context providers and CSS while being consumed externally via WorkspacePage. Barrel exports mix project manager and overview entry points, so extraction demands carefully updating import paths and possibly new barrels. Overview tests rely on module-resolved aliases that must follow the new directory.

### Relevant/Touched features
Projects module (manager + overview), Workspace module navigation, shared UI primitives, CSS tokens, testing utilities.

## Plan

### Task 1

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Audit the Projects module for unused exports, components, hooks, and styles, then remove or consolidate them safely.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Reduce dead code to simplify the subsequent extraction and prevent regressions.

#### Step 1.1

**Status**: NOT COMPLETED
**Description**: Inventory exports and references for Projects module artifacts to identify unused items.
**Codebase touched**: src/modules/projects, tsconfig.paths.json (read)
**Sample snippets (optional)**: None
**What to do***: Use tooling (ts-prune, `rg`, TypeScript compiler diagnostics) to map unused exports and cross-check with tests.
**How to**: Generate reports, verify false positives manually, and mark candidates for deletion.
**Check**: Documented list of confirmed unused files/functions without active references.
**Gate (Exit Criteria)**: Signed-off inventory ready for cleanup actions.

#### Step 1.2

**Status**: NOT COMPLETED
**Description**: Remove or refactor confirmed unused code paths while keeping functional exports intact.
**Codebase touched**: src/modules/projects/*, related CSS assets
**Sample snippets (optional)**: None
**What to do***: Delete redundant files, collapse barrels, and adjust imports to remove dead references.
**How to**: Apply incremental deletion with TypeScript build checks and ensure tests still compile.
**Check**: No TypeScript errors, lint passes, and runtime smoke test remains stable.
**Gate (Exit Criteria)**: Projects module tree free of unused artifacts.

### Task 2

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Extract the Project Overview feature into its own module directory parallel to Projects with cohesive structure.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Establish an isolated, maintainable Project Overview module aligned with feature-based architecture.

#### Step 2.1

**Status**: NOT COMPLETED
**Description**: Design the target folder structure and create the new project-overview module skeleton.
**Codebase touched**: src/modules/project-overview (new), src/modules/projects/index.ts (read)
**Sample snippets (optional)**: None
**What to do***: Define directory layout (routes, ui, state, css, tests) and scaffold index exports.
**How to**: Mirror existing overview assets while aligning with React 19 guidelines and perplexity best practices.
**Check**: Agreement on structure documented; empty scaffolding ready for migration.
**Gate (Exit Criteria)**: project-overview directory committed with placeholders and README outline.

#### Step 2.2

**Status**: NOT COMPLETED
**Description**: Relocate overview UI components, tests, and styles into the new module, preserving relative imports.
**Codebase touched**: src/modules/project-overview/ui/*, src/modules/project-overview/__tests__/*, src/modules/project-overview/css/*, src/modules/projects/ui/overview/*
**Sample snippets (optional)**: None
**What to do***: Move files, adjust import paths, and ensure CSS modules stay colocated with components.
**How to**: Use refactor-friendly tooling (git mv, apply_patch) and update path aliases where necessary.
**Check**: TypeScript build passes with updated imports; no duplicate definitions remain in Projects module.
**Gate (Exit Criteria)**: All overview presentation assets live under project-overview module.

#### Step 2.3

**Status**: NOT COMPLETED
**Description**: Migrate route/container logic and context providers to the new module.
**Codebase touched**: src/modules/project-overview/ProjectOverviewRoute.tsx, src/modules/project-overview/routes/project-overview-context.tsx, src/modules/projects/views/*
**Sample snippets (optional)**: None
**What to do***: Move provider, route, and page-level components; adjust to expose new barrel exports.
**How to**: Update file paths, ensure context is exported from new module index, and fix import consumers.
**Check**: Overview route renders correctly in dev environment with new module boundary.
**Gate (Exit Criteria)**: Projects module no longer hosts overview route/context files.

### Task 3

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Update all integration points and shared exports to reference the new module layout without breaking features.
**Feature required (optional)**: F-003
**Purpose/Outcome**: Maintain functionality while reflecting the refactored module boundaries.

#### Step 3.1

**Status**: NOT COMPLETED
**Description**: Adjust barrel exports and path aliases to surface Project Overview functionality from its new location.
**Codebase touched**: src/modules/projects/index.ts, src/modules/project-overview/index.ts, tsconfig.paths.json, package.json (workspaces config)
**Sample snippets (optional)**: None
**What to do***: Remove overview exports from Projects barrel, add forwarding exports or direct consumers to new module.
**How to**: Update TypeScript path mappings if needed and ensure bundler resolves new imports.
**Check**: Imports compile cleanly, and build/test pipelines succeed.
**Gate (Exit Criteria)**: Clean compile with updated module boundaries and no circular dependencies.

#### Step 3.2

**Status**: NOT COMPLETED
**Description**: Update consuming modules (workspace, routes, tests) to import from the new project-overview module.
**Codebase touched**: src/modules/workspace/WorkspacePage.tsx, src/modules/workspace/__tests__/*, src/modules/projects/ProjectManagerRoute.tsx
**Sample snippets (optional)**: None
**What to do***: Replace old import paths, ensure placeholders/components point to new module, and adjust mocks in tests.
**How to**: Perform targeted search/replace and rerun TypeScript + Vitest to catch missing references.
**Check**: Workspace renders Project Overview via new module without runtime errors.
**Gate (Exit Criteria)**: All consumers rely on project-overview module exclusively.

### Task 4

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Enhance documentation and inline comments to clarify module responsibilities post-refactor.
**Feature required (optional)**: F-004
**Purpose/Outcome**: Provide maintainers with guidance on module roles, data flow, and customization points.

#### Step 4.1

**Status**: NOT COMPLETED
**Description**: Add concise, high-value comments to complex areas (context providers, data transforms, async flows).
**Codebase touched**: src/modules/project-overview/**/*.tsx, src/modules/projects/**/*.ts(x)
**Sample snippets (optional)**: None
**What to do***: Identify non-obvious logic and document intent, assumptions, and side effects.
**How to**: Follow repository comment guidelines, referencing React 19 best practices for clarity.
**Check**: Code review confirms comments improve understanding without redundancy.
**Gate (Exit Criteria)**: Key complex sections annotated and lint rules satisfied.

#### Step 4.2

**Status**: NOT COMPLETED
**Description**: Produce updated module-level documentation outlining responsibilities and integration instructions.
**Codebase touched**: src/modules/project-overview/README.md (new), src/modules/projects/README.md (update if exists), plans/report references
**Sample snippets (optional)**: None
**What to do***: Write concise README or doc entries describing module API, state ownership, and extension points.
**How to**: Use existing doc templates; ensure links and instructions align with repo conventions.
**Check**: Documentation reviewed, stored with code, and linked from relevant barrels if needed.
**Gate (Exit Criteria)**: Accessible docs committed alongside code changes.

### Task 5

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Validate the refactor through automated and manual testing to ensure stability.
**Feature required (optional)**: 
**Purpose/Outcome**: Confirm no regressions in Projects, Workspace, or overview flows.

#### Step 5.1

**Status**: NOT COMPLETED
**Description**: Run and extend automated tests covering Projects and Project Overview behavior.
**Codebase touched**: src/modules/project-overview/__tests__/*, src/modules/workspace/__tests__/*, package.json scripts
**Sample snippets (optional)**: None
**What to do***: Update existing tests for new paths, add coverage for relocated components, and execute Vitest suite.
**How to**: Use `npm run test -- --runInBand` (or equivalent) after adjusting mocks.
**Check**: Tests pass and capture key scenarios (active project, placeholder, stats).
**Gate (Exit Criteria)**: Test suite green with meaningful coverage notes.

#### Step 5.2

**Status**: NOT COMPLETED
**Description**: Perform manual QA focusing on project selection, overview rendering, and code splitting.
**Codebase touched**: Tauri dev runtime, QA checklist
**Sample snippets (optional)**: None
**What to do***: Launch app, navigate through workspace, ensure overview loads, and verify removed code has no side effects.
**How to**: Use dev build (`npm run tauri dev`) and verify logs for errors while exercising flows.
**Check**: No runtime warnings, UI consistent with theme, navigation intact.
**Gate (Exit Criteria)**: QA notes recorded with zero blocking issues.
