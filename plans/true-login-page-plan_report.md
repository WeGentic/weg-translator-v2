# true-login-page-plan — Progress Report

## Task 1 — Routing Restructure
- **Step 1.1 (Completed)**: Simplified `src/router/routes/__root.tsx` so it now only renders `<Outlet />` and devtools, removing `MainLayout` and shell-specific hooks. Auth guard logic remains pending re-homing in pathless layout.
- **Step 1.2 (Completed)**: Introduced `src/router/routes/_app.tsx` as the authenticated layout, reinstating the workspace shell plus auth redirect to `/login`.
- **Step 1.3 (Completed)**: Reparented workspace routes under `_app/` and regenerated `src/router/routeTree.gen.ts` using `@tanstack/router-cli`.

## Task 2 — Login Page Shell
- **Step 2.1 (Completed)**: Removed layout store dependencies and introduced the standalone `login-page` shell in `src/modules/auth/routes/index.tsx`.
- **Step 2.2 (Completed)**: Auth shell styled through `src/modules/auth/routes/login-page.css`, using project gradient tokens and dedicated panel layout.
- **Step 2.3 (Completed)**: Pruned the marketing column so the login page now shows only the background treatment and `LoginForm`.

## Task 3 — Auth Flow Validation
- **Step 3.1 (Completed)**: Adjusted auth guards—`__root` no longer redirects, `_app` now derives redirect from `location.searchStr`, and `/login` bounces signed-in users to their pending target.
- **Step 3.2 (Completed)**: Added `src/test/app/router/auth-routing.test.tsx` to cover login isolation and redirect fallbacks.
- **Step 3.3 (Completed)**: Documented QA coverage via automated scenarios (redirects, shell isolation) given non-interactive CLI environment.

## Task 4 — Branding Assets
- **Step 4.1 (Completed)**: Login page now sources `LOGO-SVG.svg` and `LOGIN_BACKGROUND_.png`, applying responsive styling for both assets.
