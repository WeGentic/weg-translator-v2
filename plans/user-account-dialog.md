# User Account Dialog
                
## Current User Request Analysis
- Request: introduce a centered user-account dialog opened from the sidebar, displaying current user details and providing a logout control.
- Existing context: `LayoutSidebarOne` renders a `User Account` button without an assigned handler; authentication state and logout logic live in `src/app/providers/auth/AuthProvider.tsx` and are exposed via `useAuth`.

## Problem Breakdown
- Existing system review: auth state is supplied through React context (`useAuth`); UI dialogs leverage Radix-based primitives from `@/shared/ui/dialog`; sidebar click handlers are passed via props in `src/router/routes/__root.tsx`.
- Decomposition: build a focused dialog component, introduce styles, and connect open state to the sidebar trigger.
- Required building blocks: a new dialog component under `src/modules/auth/components`, a CSS module aligned with theme tokens, state wiring in the root route, and toast/error handling on logout.
- Risks & challenges: avoid blocking UI during logout, ensure focus management and accessibility, and respect theme color constraints.
- Maintainability: keep component under 300 lines, co-locate CSS, and export via module barrel for reuse.

## User Request
S1: Add a Centered dialog wired to User Account, showing User info and logout button
Completed: NOT COMPLETED

## Coding implementation
- Added `src/modules/auth/components/UserAccountDialog.tsx` implementing the centered dialog with profile details, logout handling, toast feedback, and navigation to `/login`.
- Introduced a staged logout flow with an in-dialog confirmation state, focus management, and inline error feedback.
- Crafted dedicated confirmation styling in `src/modules/auth/components/css/user-account-dialog.css` to highlight the destructive action while staying within theme tokens.
- Created companion styles in `src/modules/auth/components/css/user-account-dialog.css` using theme tokens for consistent branding.
- Wired the sidebar account button in `src/router/routes/__root.tsx` to toggle the dialog and render it within the layout tree; exported the component via `src/modules/auth/index.ts`.

## Notes
- `npm run typecheck` currently fails because of existing issues in unrelated wizard and IPC test files (array at() usage, wizard finalize typings). No new errors introduced by this work.
