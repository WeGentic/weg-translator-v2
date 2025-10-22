# client-wizard-inputs

## Current User Request Analysis
- The user needs the client wizard address field switched from a textarea to a single-line input matching the styling of existing fields (client name, email).
- Existing implementation in `src/modules/wizards/client/components/WizardNewClientDialog.tsx` uses a textarea with autocomplete logic; phone field uses custom layout that diverges visually from other inputs defined in `client-form.css`.

## Problem Breakdown
- Address autocomplete hook `useAddressAutocomplete` currently targets `HTMLTextAreaElement`, so generalizing it is necessary before swapping to an input.
- Wizard dialog must render the address field with the shared `Input` component and preserve accessibility attributes for the suggestion panel.
- Phone field requires styling parity (background, border, focus states) with `.client-form-input`, likely via class adjustments and CSS tweaks.
- Need to ensure modifications stay cohesive with React 19 guidelines, keep files scoped, and avoid breaking existing behaviors.
- Changes should be minimal, maintainable, and aligned with current design tokens under `client-form.css` and `client-wizard.css`.

## User Request
S1: Fix/Improve src/modules/wizards/client:
- Address field must be an input like Client name and Email
- Fix phone and apply same exact style as Client name, Contact email and VAT number
Completed: NOT COMPLETED

## Coding implementation
- Generalized `useAddressAutocomplete` to accept `HTMLInputElement | HTMLTextAreaElement`, renaming refs to `fieldRef` and keeping keyboard navigation intact.
- Swapped the address textarea in `WizardNewClientDialog.tsx` for a styled single-line `Input`, adding combobox ARIA attributes and unique suggestion IDs.
- Replaced the bespoke phone UI with `react-phone-number-input`, wiring it into the wizard, controlling country selection, and styling the library’s container/select/input so they match the existing client form look and layout.

## Notes
- Added dependency `react-phone-number-input`; `npm run typecheck` still fails because of existing `.at` usage in unrelated test files.
