# Task 2 Documentation — Layout Architecture Contracts

## Implemented modules
- `src/app/layout/layout-types.ts`
  - Declares `LayoutVisibility`, `BackgroundConfig`, `LayoutSlots`, and `LayoutStaticData`.
  - Provides slot source order metadata and augments TanStack Router `StaticDataRouteOption` with a `layout` property.
- `src/app/layout/sidemenu.ts`
  - Introduces discriminated `SidemenuState`, width defaults, and helpers (`cycleSidemenu`, `isExpanded`, `isCompact`, `isHidden`).

## Notes for downstream work
- Default sidemenu widths follow the existing Tailwind widths (`w-64`, `w-16` → 256px / 64px).
- Slot precedence will be enforced as `static-data` → `component-slot` → `global-default` when wiring the layout provider.
- Route modules can now safely type `staticData.layout` for per-route configuration.
