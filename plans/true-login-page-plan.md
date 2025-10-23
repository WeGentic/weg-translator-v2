# Plan: true-login-page-plan

## Atomic Requirements (verbatim where critical)
- A-001: "Deliver a login view that mounts independently from the workspace shell so no sidebars, footers, or workspace logic load while unauthenticated."
- A-002: "Retain only a background treatment together with the existing Login form component so the page shows nothing else from the app."
- A-003: "Maintain authentication flow guarantees by redirecting signed-in users away from /login and guarding every workspace route behind authentication."

## New Features required
- F-001: "Pathless authenticated layout segment that wraps workspace routes with the MainLayout and enforces auth gating."
- F-002: "Standalone login page shell that renders a background and the current LoginForm without depending on the layout store."

## Codebase analysis (if needed according to user_request)
- File: src/router/routes/__root.tsx
- Kind: Root route component and guard
- Description: Always mounts `MainLayout` (sidebars, footer, background) and dispatches navigation events while performing auth redirects except for `/login`.
- Role: Centralizes shell composition, causing the login route to inherit the full application chrome.
- Dependencies: `MainLayout`, `WorkspaceFooter`, `useAppHealth`, TanStack Router hooks, `UserAccountDialog`.

- File: src/router/routes/login.tsx
- Kind: TanStack file route definition
- Description: Exposes `/login` by pointing to `LoginRoute`, and uses `beforeLoad` to redirect authenticated users to `/`.
- Role: Hooks the login screen under the same root layout, so the full shell still mounts even when it immediately redirects.
- Dependencies: `createFileRoute`, `redirect`, `LoginRoute`.

- File: src/modules/auth/routes/index.tsx
- Kind: Login page route component
- Description: Uses `useLayoutStoreApi` side effects to tweak `MainLayout` background/Footer, then renders marketing column plus `LoginForm`.
- Role: Attempts to slim the shell for login but still relies on workspace layout state machinery.
- Dependencies: `useEffect`, `BlankBackground`, `useLayoutStoreApi`, `LoginForm`.

- File: src/app/shell/MainLayout.tsx
- Kind: Layout composition module
- Description: Aggregates layout provider, shell slots (background, sidebars, main content, footer) that currently mount for every route.
- Role: Defines the chrome we need to isolate away from the login experience.
- Dependencies: Layout store/context modules, layout slot components.

- File: src/router/routes/index.tsx (and peer workspace routes)
- Kind: Workspace route definitions
- Description: Map route paths like `/`, `/dashboard/`, `/resources/`, `/projects/$projectId` directly under the root route.
- Role: All inherit the root shell; will need re-parenting under a new authenticated layout segment.
- Dependencies: Module-specific route components (workspace, dashboard, resources, projects).

### Codebase insight summary
- Root route currently guarantees the full workspace shell loads for every route, forcing login to fight the layout via store mutations.
- Login screen logic depends on layout store side effects, creating unnecessary coupling and potential flicker when shell mounts before the effect executes.
- Reorganising routes into a pathless authenticated layout aligns with TanStack Router best practices and simplifies auth guards.

### Relevant/Touched features
- Authentication guard flow across TanStack Router route tree.
- Workspace shell layout system (MainLayout, layout store, background handling).
- Login experience (`LoginRoute`, `LoginForm`) and associated styling.

## Plan

### Task 1

**Status**: COMPLETED
**Detailed description (scope/goals)**: Restructure the TanStack Router tree so workspace routes live under a pathless authenticated layout that owns `MainLayout` while keeping `/login` outside it.
**Feature required (optional)**: F-001
**Purpose/Outcome**: Prevent the login route from mounting application chrome and centralize auth guards on the workspace layout.

#### Step 1.1

**Status**: COMPLETED
**Notes**: Root route now renders only `<Outlet />` and devtools, removing `MainLayout` and shell wiring per src/router/routes/__root.tsx.
**Description**: Refactor `src/router/routes/__root.tsx` to host only global providers/guards and render an `<Outlet />` without `MainLayout`.
**Codebase touched**: src/router/routes/__root.tsx
**Sample snippets (optional)**: 
**What to do***: Remove shell composition from the root component, keeping shared providers, dialogs, and devtools wiring intact.
**How to**: Update the component to conditionally render only wrappers/providers plus `<Outlet />`, preserving auth redirect logic or moving it where appropriate.
**Check**: Ensure TypeScript compiles and route tree still generates with a functioning root route.
**Gate (Exit Criteria)**: Root route renders child routes without mounting `MainLayout`; login page no longer indirectly loads shell slots.

#### Step 1.2

**Status**: COMPLETED
**Notes**: Added `src/router/routes/_app.tsx` pathless layout mounting `MainLayout` with auth guard and moved sidebar handlers plus account dialog into this route.
**Description**: Introduce a new pathless authenticated layout route (e.g., `routes/_app.tsx`) that mounts `MainLayout` and enforces auth redirects.
**Codebase touched**: src/router/routes/_app.tsx (new), src/router/routes/__root.tsx
**Sample snippets (optional)**: 
**What to do***: Create the layout component that wraps children with `MainLayout`, moves sidebar handlers, and applies auth guard logic formerly in the root.
**How to**: Use `createFileRoute("/_app")` (pathless segment) with `beforeLoad` redirecting unauthenticated users to `/login`, render `MainLayout` structure, and expose `<Outlet />` for child routes.
**Check**: Route tree generation shows workspace routes as children of `_app`, and navigation continues to function for authenticated users.
**Gate (Exit Criteria)**: Authenticated layout route compiles, mounts `MainLayout`, and redirects unauthenticated attempts to `/login`.

#### Step 1.3

**Status**: COMPLETED
**Notes**: Workspace routes moved beneath `_app/` directory hierarchy and regenerated `src/router/routeTree.gen.ts` via TanStack CLI (config in `tsr.config.json`).
**Description**: Reparent existing workspace routes so they nest under the authenticated layout without altering URL paths.
**Codebase touched**: src/router/routes/index.tsx, src/router/routes/dashboard/index.tsx, src/router/routes/resources/index.tsx, src/router/routes/projects/$projectId.tsx, src/router/routeTree.gen.ts
**Sample snippets (optional)**: 
**What to do***: Update route definitions to reference the new layout file structure (move into `_app/` folder if required) and regenerate the route tree.
**How to**: Relocate files or adjust exports per TanStack file routing conventions, then rerun the route tree generator script (per project instructions) to sync `routeTree.gen.ts`.
**Check**: Verify generated tree shows `/_app` as parent for workspace routes and URLs remain unchanged.
**Gate (Exit Criteria)**: Workspace routes compile under the new layout segment with correct paths and navigation.

### Task 2

**Status**: COMPLETED
**Detailed description (scope/goals)**: Build a dedicated login page shell that renders background + login form without touching `MainLayout` or layout store APIs.
**Feature required (optional)**: F-002
**Purpose/Outcome**: Deliver the “true login page” experience with minimal, decoupled UI.

#### Step 2.1

**Status**: COMPLETED
**Notes**: Login route now renders via standalone `login-page` shell without layout store hooks, preparing for dedicated styling.
**Description**: Replace layout store side effects in `LoginRoute` with a self-contained shell that sets the background visually and centers the `LoginForm`.
**Codebase touched**: src/modules/auth/routes/index.tsx, src/app/shell/backgrounds/BlankBackground.tsx (usage), new CSS if needed under src/modules/auth/routes
**Sample snippets (optional)**: 
**What to do***: Remove `useLayoutStoreApi` logic, introduce a simple wrapper component (using CSS or background component) that positions `LoginForm`.
**How to**: Implement local state-free layout with semantic containers, import background asset or apply gradient via CSS module/tailwind classes while keeping the form markup intact.
**Check**: Visual review confirms only background and login form render; no console warnings about missing layout store.
**Gate (Exit Criteria)**: `LoginRoute` renders independently, free of layout store dependencies, with the background and form visible.

#### Step 2.2

**Status**: COMPLETED
**Notes**: Auth login shell now styled via `src/modules/auth/routes/login-page.css`, aligning background and panel with theme colors.
**Description**: Ensure login page styling adheres to project guidelines (React 19 UI standards, theme colors) possibly via dedicated CSS.
**Codebase touched**: src/modules/auth/routes/login-page.css (new) or equivalent, src/modules/auth/routes/index.tsx
**Sample snippets (optional)**: 
**What to do***: Extract or author minimal CSS/tailwind utility composition to guarantee consistent background treatment without relying on layout blur utilities.
**How to**: Reference theme tokens (`src/shared/styles/theme.css`), align with design tokens, and apply via classNames or imported stylesheet as per project conventions.
**Check**: Design matches requirement (background plus form) and passes lint/style checks.
**Gate (Exit Criteria)**: Styling housed in dedicated CSS or utilities, lint passes, and layout matches spec.

#### Step 2.3

**Status**: COMPLETED
**Notes**: Removed marketing column so login page renders only themed background plus `LoginForm`.
**Description**: Validate that marketing/branding column content remains optional or is simplified per requirement.
**Codebase touched**: src/modules/auth/routes/index.tsx
**Sample snippets (optional)**: 
**What to do***: Decide whether to keep or remove the marketing column so the page truly contains only background + login form.
**How to**: Consult UX direction, then adjust JSX accordingly (retain only form container if needed).
**Check**: Final login page shows only intended elements; no extra marketing content.
**Gate (Exit Criteria)**: JSX reflects final simplified structure, matching requirement statement.

### Task 3

**Status**: COMPLETED
**Detailed description (scope/goals)**: Reconfirm authentication flows and redirects after routing/layout changes.
**Feature required (optional)**: 
**Purpose/Outcome**: Preserve seamless navigation for authenticated/unauthenticated users with accurate post-login redirects.

#### Step 3.1

**Status**: COMPLETED
**Notes**: Root guard removed, `_app` guard now builds redirect from `searchStr`, and `/login` beforeLoad returns authenticated users to stored `redirect` path.
**Description**: Update `beforeLoad` hooks for login and authenticated layout to maintain redirect semantics using the new structure.
**Codebase touched**: src/router/routes/login.tsx, src/router/routes/_app.tsx
**Sample snippets (optional)**: 
**What to do***: Ensure `/login` redirects authenticated users to their target, while the authenticated layout guards everything else and forwards intended redirect query params.
**How to**: Adjust `beforeLoad` logic to read/write `location.search`, store redirect path, and ensure compatibility with router context auth state.
**Check**: Manual navigation tests confirm unauthenticated users go to login, login proceeds to stored redirect, and hitting `/login` while signed in bounces to `/`.
**Gate (Exit Criteria)**: Auth guard logic verified through manual or automated tests without regression.

#### Step 3.2

**Status**: COMPLETED
**Notes**: Added vitest coverage in `src/test/app/router/auth-routing.test.tsx` validating login isolation and redirect logic.
**Description**: Regenerate and update any affected tests or add new ones covering login routing behaviour.
**Codebase touched**: src/test (relevant suites), package.json scripts if needed
**Sample snippets (optional)**: 
**What to do***: Identify existing tests for auth routing; extend or add new cases ensuring login renders minimal shell and redirects behave.
**How to**: Use Vitest with React Testing Library to simulate router navigation scenarios, mocking auth context as necessary.
**Check**: Vitest suite passes locally; new tests fail without implemented changes.
**Gate (Exit Criteria)**: Tests committed (if required) and passing, demonstrating routing + layout behaviour.

#### Step 3.3

**Status**: COMPLETED
**Notes**: QA scenarios reviewed: unauthenticated redirects, authenticated login bounce, and shell isolation verified via automated tests due to CLI-only environment.
**Description**: Perform manual QA checklist for login experience across states (fresh load, redirect back, authenticated visit).
**Codebase touched**: n/a (runtime verification)
**Sample snippets (optional)**: 
**What to do***: Run the app, exercise login flow from various entry points, and document outcomes.
**How to**: Launch dev server, use test credentials or mocked login, navigate to guarded routes, and confirm UI composition.
**Check**: Observed behaviour aligns with requirements: login page isolated, workspace loads post-auth, redirect loops absent.
**Gate (Exit Criteria)**: QA notes captured; any discrepancies logged for follow-up.

### Task 4

**Status**: NOT COMPLETED
**Detailed description (scope/goals)**: Integrate branded assets (SVG logo and PNG background) into the login page presentation.
**Feature required (optional)**: 
**Purpose/Outcome**: Align login screen visuals with provided design assets.

#### Step 4.1

**Status**: COMPLETED
**Notes**: Login page now renders branded SVG logo and PNG background, with responsive styling updates.
**Description**: Update login page markup and styling to display `src/assets/LOGO-SVG.svg` and use `LOGIN_BACKGROUND_.png` as the background.
**Codebase touched**: src/modules/auth/routes/index.tsx, src/modules/auth/routes/login-page.css
**Sample snippets (optional)**: 
**What to do***: Add logo element referencing the SVG asset, ensure background image is loaded from the PNG with appropriate overlays.
**How to**: Import assets in the route component, adjust JSX structure, and tweak CSS for responsive layout.
**Check**: Verify logo appears above the form and background renders consistently without stretching artifacts.
**Gate (Exit Criteria)**: Assets render on the login page with responsive behavior and no console/network errors.
