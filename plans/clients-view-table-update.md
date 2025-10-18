# Clients View Table Update

## Current User Request Analysis
- Existing clients table currently renders address, VAT, and note columns via `buildClientColumns` and applies uppercase styling to header labels that must be removed.
- Need to introduce an actions column with icon buttons (Open, Edit, Delete) that aligns with current UI components and React 19 compiler constraints.
- Follow-up request adds a leading checkbox selection column, removes horizontal padding around the table wrapper, and requires tooltips on action buttons using the shared tooltip primitives.
- Latest request requires the Delete action to launch a confirmation dialog (matching project deletion UX) that demands retyping the client email before removal.
- Most recent request adds an Edit flow that should open a populated client form with a “Save” submit action.
- New requirement: keep the Clients quick-action button visually active while the clients surface is open, remove the header helper text, and introduce a close control that returns the user to the dashboard (clearing the active button state).

## Problem Breakdown
- Determine where client columns and row shaping live (`src/modules/clients/view/components/columns.tsx`) and update types plus mapping after removing address/vat/note fields.
- Confirm that hiding these fields does not impact data fetching or storage logic elsewhere in the module.
- Implement an actions column using shared button + Lucide icon primitives with accessible labelling and minimal render churn.
- Adjust table header rendering in `ClientsTable` to eliminate uppercase transformations.
- Review styling to ensure the table layout remains balanced after column changes and adheres to maintainability goals.
- Extend the client table configuration to control TanStack Table row selection state with Radix checkboxes, ensuring accessible labelling and minimal re-renders.
- Update `clients-view.css` to drop lateral padding and validate that the layout still snaps to the surrounding shell.
- Wrap new action buttons with the shared tooltip components so hover/focus hints match the rest of the application.
- Build a dedicated client deletion dialog component that mirrors the projects implementation, invoking the existing IPC removal command and updating the local table state after successful confirmation.
- Provide an edit dialog that reuses the client form, pre-fills values from the selected client, saves via IPC update, and refreshes local cache using the existing upsert helper.
- Ensure sidebar quick actions reflect the active clients state, simplify the clients header copy, and wire a close button that navigates back to the dashboard and reverts sidebar styling.

## User Request
S1: Focus on Clients view and provide these improvements/features/fixes:
- Do not show Address, Vat and Note, Remove all uppercase in Table header
- Add an action column with Icon buttons Open, Edit, Delete (no function for now)
S2: Add a checkbox column on the left, remove table side margins, and introduce tooltips on action buttons.
S3: Delete client should open the alert dialog requiring client email confirmation prior to deletion.
S4: Edit client opens a pre-filled form with a Save button.
S5: Highlight Clients quick action while active, remove header helper text, and add a close control returning to Dashboard.
Completed: NOT COMPLETED

## Coding implementation
- Updated `src/modules/clients/view/components/columns.tsx` to drop address/VAT/note columns, add an actions column with accessible icon buttons, and keep column headers in sentence case.
- Ran `npm run typecheck` to confirm the updated types and table configuration compile cleanly.
- Added a selection checkbox column, tooltip-wrapped action buttons, and adjusted header meta in `src/modules/clients/view/components/columns.tsx`.
- Controlled TanStack row selection state via `src/modules/clients/view/ClientsContent.tsx` and removed table padding in `src/modules/clients/view/clients-view.css`.
- Ensured table colspans respect visible columns by updating `src/modules/clients/view/components/ClientsTable.tsx` and re-ran `npm run typecheck`.
- Implemented `DeleteClientDialog` with email confirmation, wired the Delete action button to open it, and pruned local cache entries after successful deletion. Re-validated with `npm run typecheck`.
- Introduced `EditClientDialog` and associated callbacks, pre-filling client data, persisting via IPC update, refreshing the local cache, and ensuring the action button opens the form with a "Save" submission.
- Added sidebar-two active-state wiring, simplified the clients header copy, and implemented a close control that routes back to the dashboard while resetting session state.

## Notes
