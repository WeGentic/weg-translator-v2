# Shared Theme Extraction Documentation

## Objective
Record the approach for moving palette and semantic token CSS into `src/shared/styles/theme.css` while keeping Tailwind CSS 4 scanning accurate as modules shift folders.

## Key Decisions
- Retain Tailwind v4 automatic source detection and augment it with targeted `@source "./src/modules"` and `@source "./src/shared"` directives in the root stylesheet when shared UI primitives relocate.
- Split `src/App.css` into a lightweight bootstrap file that imports the new shared theme, ensuring both light and dark token sets remain centralized and reusable.
- House the existing `@theme inline` declarations inside the shared theme file so semantic tokens are published once and reused across modules without duplicating CSS variables.

## Next Steps
- After the shared file exists, verify Tailwind's compiled output still emits the same custom properties and that new module folders inherit the theme tokens automatically.
- Coordinate with asset inventory work (Task 4.3.3) to align icon/font placement with the shared theme rollout.
