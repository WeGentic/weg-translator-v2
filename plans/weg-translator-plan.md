# Plan: weg-translator-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Add Clients button in src/app/shell/layout-sidebar-two.tsx when in Dashboard view."
- A-002: "When user clicks on Clients button show the client view in Dashboard."
- A-003: "Client page structure will use the same src/modules/dashboard/view/ code, with custom content."
- A-004: "Header will prompt the user of client page; toolbar will have search, filter, and add new client button."
- A-005: "Content will show client table according to current SQL schema docs/db-refactor-summary.md."

## New Features required
- F-001: "Dashboard quick action that routes to Clients view."
- F-002: "Clients dashboard view composed of header, toolbar, and content sections."
- F-003: "Client data table with search, filters, and add-client workflow powered by v2 client IPC."

## Codebase analysis (if needed according to user_request)
- File: src/app/shell/layout-sidebar-two.tsx
- Kind: React layout component
- Description: Controls the secondary sidebar lifecycle, responds to navigation events, and renders view-specific content such as DashboardQuickActions.
- Role: Source of truth for sidebar visibility and the target location for injecting the Clients button and navigation trigger.
- Dependencies: useLayoutStoreApi, useLayoutSelector, DashboardQuickActions, EditorMenu, window CustomEvent "app:navigate".

- File: src/app/shell/sidebar-two-content/DashboardQuickActions.tsx
- Kind: React component with supporting style demo
- Description: Renders dashboard quick-action controls and demonstrates sidebar styling variants.
- Role: Provides the actual buttons rendered in sidebar two when on the dashboard view; natural place to surface the Clients CTA.
- Dependencies: lucide-react icons, sidebar-two CSS modules, window event dispatch pattern (commented examples).

- File: src/modules/workspace/WorkspacePage.tsx
- Kind: Main workspace container
- Description: Chooses which major view (dashboard, projects, etc.) is displayed based on internal state and listens to navigation events.
- Role: Must respond to Clients view selection and render the forthcoming Clients page; coordinates editor/project panes.
- Dependencies: useWorkspaceShell, useGlobalNavigationEvents, layout store, DashboardView, Projects, Resources, Settings modules.

- File: src/modules/workspace/hooks/useGlobalNavigationEvents.ts
- Kind: Custom hook
- Description: Subscribes to "app:navigate" CustomEvents to translate detail.view strings into MainView updates.
- Role: Needs to recognize the new "clients" view so navigation updates propagate correctly.
- Dependencies: MainView union, logger, toEditorViewKey.

- File: src/app/state/main-view.ts
- Kind: Type utility module
- Description: Defines the MainView union and helpers for project/editor keyed views.
- Role: Must include "clients" so type safety aligns with the new view.
- Dependencies: None beyond TypeScript primitives.

- File: src/app/shell/layout-sidebar-one.tsx
- Kind: React layout component
- Description: Renders primary navigation buttons and tracks active view via navigation events.
- Role: Needs awareness of the clients view to keep active state accurate (even if no dedicated button is added now).
- Dependencies: lucide-react icons, layout store, Button/Tooltip components.

- File: src/modules/dashboard/view/DashboardView.tsx
- Kind: React view wrapper
- Description: Composes header, toolbar, and content pieces for the dashboard area using shared layout classes.
- Role: Serves as structural reference for building the Clients view with matching layout semantics.
- Dependencies: DashboardHeader, DashboardToolbar, DashboardContent, global CSS.

- File: src/modules/projects/ProjectManagerContent.tsx
- Kind: React data grid component
- Description: Implements TanStack Table usage, sorting, and responsive grid layout for projects.
- Role: Provides patterns for building the clients table (table hooks, column builders, empty states, styling).
- Dependencies: @tanstack/react-table, shared table UI primitives, project-specific utilities.

- File: src/shared/types/database.ts
- Kind: Type definitions
- Description: Declares ClientRecord, CreateClientInput, and UpdateClientInput aligned with the SQL schema.
- Role: Primary source of truth for client fields to display; ensures table columns and forms match backend contracts.
- Dependencies: None.

- File: src/core/ipc/db/clients.ts
- Kind: IPC adapter module
- Description: Wraps safeInvoke calls for listing, creating, updating, and deleting client records against v2 commands.
- Role: Will power data fetching and mutations for the clients table and add-client flow.
- Dependencies: safeInvoke, CreateClientInput/UpdateClientInput, ClientRecord types.

- File: src/modules/projects/components/wizard-v2/hooks/useWizardClients.ts
- Kind: React hook
- Description: Fetches and caches client records for the project wizard, including optimistic updates after create.
- Role: Potential reusable data hook or reference for client fetching, deduplication, and refresh patterns.
- Dependencies: listClientRecords IPC, React state/effect hooks.

- File: docs/db-refactor-summary.md
- Kind: Documentation
- Description: Summarizes the v2 SQLite schema including the clients table fields and relationships.
- Role: Authoritative reference for which client attributes must appear in the table and filters.
- Dependencies: None.

### Codebase insight summary
Sidebar navigation relies on window-level "app:navigate" events, so any new view must be declared in MainView, recognized by useGlobalNavigationEvents, and update sidebar components that mirror active state. Dashboard quick actions currently render static buttons; inserting a Clients CTA there requires dispatching the same navigation event. Existing project tables use TanStack Table with shared Table components and color tokens, offering a blueprint for the clients grid. Client IPC adapters already exist, so the new view can reuse them without backend changes, but search/filter behaviors must be implemented client-side.

### Relevant/Touched features
- Workspace navigation state and event bus
- Dashboard quick actions UX
- Client IPC data layer
- Table rendering primitives and styles
- Layout theming tokens and CSS structure

## Plan

### Task 1

**Status**: COMPLETED
**Detailed description (scope/goals)**: Extend workspace navigation plumbing so "clients" becomes a first-class MainView and propagates through sidebars, event listeners, and view selection.
**Feature required (optional)**: F-001, F-002
**Purpose/Outcome**: Ensure the new Clients view can be entered and highlighted consistently when triggered from the dashboard button or future navigation sources.

#### Step 1.1

**Status**: COMPLETED
**Description**: Add the "clients" literal to MainView typing and teach global navigation hooks to accept it.
**Codebase touched**: src/app/state/main-view.ts, src/modules/workspace/hooks/useGlobalNavigationEvents.ts
**Sample snippets (optional)**: None yet.
**What to do***: Introduce "clients" to the MainView union and extend the conditional logic that maps event.detail.view to onChangeView calls.
**How to**: Update the type export, add a branch similar to existing "dashboard" or "projects" handlers, and keep logger usage intact.
**Check**: Trigger a CustomEvent("app:navigate", { detail: { view: "clients" } }) in devtools and verify no type errors or console warnings occur.
**Gate (Exit Criteria)**: MainView type includes "clients" and navigation events switch view state without hitting default fall-through.

#### Step 1.2

**Status**: COMPLETED
**Description**: Teach WorkspacePage and sidebar components to render and reflect the clients view.
**Codebase touched**: src/modules/workspace/WorkspacePage.tsx, src/app/shell/layout-sidebar-one.tsx, src/app/shell/layout-sidebar-two.tsx
**Sample snippets (optional)**: None yet.
**What to do***: Add a render branch for the Clients view, ensure activeView tracking handles "clients", and keep sidebar visibility rules intact.
**How to**: Insert conditional rendering before project/editor cases, update useState unions or switch statements, and maintain accessibility props.
**Check**: Manually simulate the view change and confirm sidebars do not hide unexpectedly and aria labels remain accurate.
**Gate (Exit Criteria)**: Clients view renders without runtime errors and sidebar active state reflects the new view.

### Task 2

**Status**: COMPLETED
**Detailed description (scope/goals)**: Surface a Clients quick-action button in the dashboard secondary sidebar that navigates to the new view with proper styling and accessibility.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Provide users an obvious entry point to client management from the dashboard.

#### Step 2.1

**Status**: COMPLETED
**Description**: Insert a Clients button within DashboardQuickActions styled consistently with existing sidebar buttons.
**Codebase touched**: src/app/shell/sidebar-two-content/DashboardQuickActions.tsx
**Sample snippets (optional)**: None yet.
**What to do***: Add a button element with appropriate iconography/text and ensure it respects sidebar-two-button classes.
**How to**: Follow existing button markup patterns and pick a lucide-react icon (e.g., Users) that aligns with design tokens.
**Check**: View the dashboard sidebar to confirm the button layout, hover, and focus behaviors match other quick actions.
**Gate (Exit Criteria)**: Clients button appears visually correct and accessible in the dashboard sidebar.

#### Step 2.2

**Status**: COMPLETED
**Description**: Wire the Clients button to dispatch navigation events and adjust sidebar-two state to show clients-specific content when active.
**Codebase touched**: src/app/shell/sidebar-two-content/DashboardQuickActions.tsx, src/app/shell/layout-sidebar-two.tsx
**Sample snippets (optional)**: None yet.
**What to do***: Attach an onClick handler that dispatches CustomEvent("app:navigate", { detail: { view: "clients" } }) and ensure sidebar content switches accordingly.
**How to**: Use window.dispatchEvent for navigation and extend getDynamicContent to render clients-specific sidebar content if needed (or fall back gracefully).
**Check**: Click the button in dev build and verify layout-sidebar-two updates its header/title to "Clients" (or planned label) and triggers main view change.
**Gate (Exit Criteria)**: Clients quick action reliably changes the main view without race conditions or stale sidebar state.

### Task 3

**Status**: COMPLETED
**Detailed description (scope/goals)**: Implement the Clients dashboard view with dedicated header, toolbar, and content sections mirroring DashboardView structure.
**Feature required (optional)**: F-002, F-003
**Purpose/Outcome**: Deliver a cohesive clients page that matches existing layout conventions and surfaces required controls.

#### Step 3.1

**Status**: COMPLETED
**Description**: Scaffold Clients view components and route exports paralleling the dashboard module structure.
**Codebase touched**: New file: src/modules/clients/view/ClientsView.tsx, New file: src/modules/clients/view/ClientsHeader.tsx, New file: src/modules/clients/view/ClientsToolbar.tsx, New file: src/modules/clients/view/ClientsContent.tsx, New file: src/modules/clients/view/index.ts
**Sample snippets (optional)**: None yet.
**What to do***: Create React components that wrap the shared layout classes and export a ClientsView entrypoint.
**How to**: Copy structural patterns from DashboardView but swap in new component names and aria labels referencing clients.
**Check**: Ensure TypeScript compilation passes and the view renders placeholder content before wiring data.
**Gate (Exit Criteria)**: Clients view components exist with baseline JSX and can be imported by WorkspacePage.

#### Step 3.2

**Status**: COMPLETED
**Description**: Implement the header component to introduce the clients area and align with UX copy expectations.
**Codebase touched**: src/modules/clients/view/ClientsHeader.tsx
**Sample snippets (optional)**: None yet.
**What to do***: Render semantic header markup with descriptive text (e.g., "Clients") and divider consistent with dashboard styling.
**How to**: Reuse CSS classes from DashboardHeader, adjusting text and aria-labels to reflect the clients context.
**Check**: Inspect the header in the app to confirm typography and spacing match design tokens.
**Gate (Exit Criteria)**: Header component displays correct copy and passes accessibility linting.

#### Step 3.3

**Status**: COMPLETED
**Description**: Build the toolbar with search input, filter control, and Add Client button, including dialog trigger wiring.
**Codebase touched**: src/modules/clients/view/ClientsToolbar.tsx, src/modules/projects/components/wizard-v2/components/WizardNewClientDialog.tsx (reuse hook-up), src/modules/projects/components/wizard-v2/hooks/useWizardClients.ts (reference), potential new file for toolbar state helpers
**Sample snippets (optional)**: None yet.
**What to do***: Compose inputs/buttons using shared UI primitives, provide controlled state props, and hook Add button to open an existing or new client dialog.
**How to**: Leverage Button, Input, Select components, reuse WizardNewClientDialog if workable, and manage state via props lifted to ClientsView.
**Check**: Interact with the toolbar to verify focus order, keyboard support, and that dialog opens/closes as expected.
**Gate (Exit Criteria)**: Toolbar exposes search/filter/add controls with functioning interactions and accessible labels.

#### Step 3.4

**Status**: COMPLETED
**Description**: Implement ClientsContent to render the clients table using TanStack Table with schema-aligned columns and empty states.
**Codebase touched**: src/modules/clients/view/ClientsContent.tsx, New file: src/modules/clients/view/components/ClientsTable.tsx, New file: src/modules/clients/view/components/columns.ts, src/shared/ui/table (read-only usage)
**Sample snippets (optional)**: None yet.
**What to do***: Configure useReactTable with ClientRecord data, define columns (name, email, phone, address, vatNumber, note), and add empty-state messaging referencing search/filter context.
**How to**: Follow ProjectManagerContent patterns, incorporate getFilteredRowModel for search, and use table primitives for markup.
**Check**: Load sample data ensuring columns render correctly, sorting/filtering respond, and empty state copy references clients.
**Gate (Exit Criteria)**: ClientsContent renders a fully functional table hooked to TanStack Table and respects layout constraints.

### Task 4

**Status**: COMPLETED
**Detailed description (scope/goals)**: Connect data fetching, styling, and quality gates to finalize the clients experience.
**Feature required (optional)**: F-003
**Purpose/Outcome**: Deliver polished behavior with optimized styling and regression coverage.

#### Step 4.1

**Status**: COMPLETED
**Description**: Implement client data hook that loads, filters, and refreshes client records from IPC.
**Codebase touched**: New file: src/modules/clients/hooks/useClientsData.ts, src/core/ipc/db/clients.ts (read-only), src/modules/clients/view/ClientsView.tsx
**Sample snippets (optional)**: None yet.
**What to do***: Create a hook that fetches listClientRecords, applies search/filter logic, and exposes handlers for refresh post-dialog.
**How to**: Use useEffect for initial load, memoize filtered results, and support future pagination via optional params.
**Check**: Confirm the hook handles loading/error states and integrates with toolbar controls without infinite loops.
**Gate (Exit Criteria)**: ClientsView consumes the hook and renders responsive results for varying search/filter inputs.

#### Step 4.2

**Status**: COMPLETED
**Description**: Apply dedicated CSS modules for clients view and ensure adherence to palette tokens.
**Codebase touched**: New file: src/modules/clients/view/clients-view.css, src/modules/clients/view/ClientsView.tsx (import), shared styles references
**Sample snippets (optional)**: None yet.
**What to do***: Author CSS for toolbar layout, table wrappers, and responsive spacing while reusing existing variables.
**How to**: Mirror dashboard CSS structure, adjust selectors for clients components, and keep file under 300 lines.
**Check**: Visual QA in light/dark modes, verify no clashes with global classes.
**Gate (Exit Criteria)**: Styling file loads without side effects and clients page matches design tokens.

#### Step 4.3

**Status**: COMPLETED
**Description**: Add automated checks covering clients hook logic and navigation wiring, then run project lint/type/test suites.
**Codebase touched**: New file: src/modules/clients/__tests__/useClientsData.test.tsx (or similar), workspace tests updates if needed
**Sample snippets (optional)**: None yet.
**What to do***: Write unit tests for search/filter behavior, extend WorkspacePage test to assert clients navigation, and execute pnpm lint/typecheck/test.
**How to**: Use Vitest with Testing Library for hook testing, dispatch CustomEvent in WorkspacePage test, document commands in PR notes.
**Check**: Ensure tests fail before implementation, pass after, and command outputs show no regressions.
**Gate (Exit Criteria)**: Test suite validates new logic and standard quality commands succeed locally.

### Task 5

**Status**: IN_PROGRESS
**Detailed description (scope/goals)**: Polish the Clients dashboard by matching the Projects data grid look-and-feel and ensuring client records load accurately from the SQL-backed IPC layer.
**Feature required (optional)**: F-002, F-003
**Purpose/Outcome**: Deliver a consistent, reliable clients table experience that mirrors existing project UI standards.

#### Step 5.1

**Status**: COMPLETED
**Description**: Align ClientsTable styling with `ProjectsTableGrid`, including header gradients, row hover/selection behaviors, and container spacing.
**Codebase touched**: src/modules/clients/view/components/ClientsTable.tsx, src/modules/clients/view/clients-view.css, shared table styles (read-only)
**Sample snippets (optional)**: None yet.
**What to do***: Port the Projects grid class structure to ClientsTable, reuse shared CSS tokens/utility classes, and remove ad-hoc wrappers that deviate from the standard layout.
**How to**: Compare className usage between the two tables, extract any missing utility classes, and verify responsive behavior at different viewport sizes.
**Check**: Visual QA confirms the clients table matches Projects table aesthetics and retains accessibility.
**Gate (Exit Criteria)**: Clients table renders with identical structure and interaction cues as ProjectsTableGrid.

#### Step 5.2

**Status**: COMPLETED
**Description**: Correct client data-fetching logic so the SQL dataset is mapped without missing or stale fields, and refresh flows stay in sync after mutations.
**Codebase touched**: src/modules/clients/hooks/useClientsData.ts, src/core/ipc/db/clients.ts, related types/tests
**Sample snippets (optional)**: None yet.
**What to do***: Audit the IPC response mapping, ensure pagination/sorting assumptions match backend shape, and adjust the hook to prevent stale caching or mismatched IDs.
**How to**: Reproduce the faulty fetch scenario, update the mapper/hook, and cover with unit tests.
**Check**: Console shows accurate client rows sourced from the database; tests guard against regressions.
**Gate (Exit Criteria)**: Clients list reflects the real dataset consistently after initial load and refreshes.

#### Step 5.3

**Status**: IN_PROGRESS
**Description**: Re-run validation commands and update automated coverage if new logic was added.
**Codebase touched**: package scripts (execution only), src/modules/clients/__tests__ (if needed)
**Sample snippets (optional)**: None yet.
**What to do***: Execute `pnpm typecheck`, `pnpm lint`, `pnpm test`, and add assertions covering the fixed data mapping if gaps exist.
**How to**: Extend existing clients hook tests or add new cases for malformed data; document command outcomes.
**Check**: All quality gates succeed locally; tests fail when data mapping regresses.
**Gate (Exit Criteria)**: Commands pass and new test cases (if any) validate the fixes.
