# Client Wizard Phone Field

## Current User Request Analysis
- Parsed the request to focus on styling, sizing, and behavior fixes for the client wizard phone input.
- Reviewed `WizardNewClientDialog.tsx` and associated styles to understand the current `react-phone-number-input` integration and custom CSS overrides.

## Problem Breakdown
- The phone field uses the default `PhoneInput` layout, resulting in styling inconsistencies with `.client-form-input`.
- Country selector has a fixed `min-width: 124px`, which exceeds the desired compact width.
- No inline dial code is shown inside the text input, so users can't confirm the prefix without opening the selector.
- Formatting relies on defaults without explicit masking feedback for each country; need to ensure the UI reflects formatted national numbers while keeping E.164 submission.
- Solution must stay type-safe, follow React 19 guidelines, and reuse existing utility logic without introducing unnecessary complexity.

## User Request
S1: Fix the Phone field in Client Wizard:
- Style must match precisely the one of Client name and other Text Input fields
- Country code selector is too large, reduce width
- Show non-editable country code in the input field
- Properly mask the number according to country
Completed: NOT COMPLETED

## Coding implementation
- Added `WizardPhoneContainer` to restructure the phone input layout, inject the dial code prefix, and forward accessibility attributes.
- Updated `WizardNewClientDialog.tsx` to pass the custom container, dial code memo, and stricter refs while keeping `react-phone-number-input` value handling unchanged.
- Reworked `client-wizard.css` phone field styles to align with `.client-form-input`, introduced prefix styling, and tightened the country selector width with overflow-safe rules.

## Notes
- `npm run lint -- --max-warnings=0` fails due to repository-wide ESLint flat-config migration errors (existing issue).
- `npm run typecheck` fails on pre-existing TypeScript errors in unrelated test/util files; new phone field code passes after adding explicit `HTMLInputElement` typing.
