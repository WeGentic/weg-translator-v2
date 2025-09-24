# Task 5 Documentation — Route-Level Layout Configuration

## Overview
- `LayoutProvider` now reads TanStack Router matches via `useMatches()` and aggregates any `staticData.layout` definitions (parent → child precedence).
- On navigation (`location.href`), the provider resets slot registrations, seeds static `slots`, and synchronizes the layout store (header/footer visibility, sidemenu state, background).
- Default fallbacks remain sensible when no layout static data is present (header/footer visible, sidemenu expanded, default background).

## Implementation highlights
- Helper utilities (`collectLayoutStaticData`, `resolveSidemenuState`, `backgroundEquals`, `sidemenuEquals`) ensure deterministic merging and avoid redundant state writes.
- Sidemenu state reverts to expanded when leaving routes that hide it, while preserving user toggles within the same route session.
- Background updates leverage `DEFAULT_LAYOUT_BACKGROUND` to guarantee a baseline surface when routes do not specify overrides.
