# Sub-task 3.1 Documentation — React 19 Data Flow Alignment

Date: 2025-02-15

## Scope
Sub-task 3.1 focused on adapting the `ProjectManagerContent` layer for the `project-manager-v2` module so that all filtering and search logic is centralised in the view while maintaining the existing UX.

## Implementation Notes
- Added `src/features/project-manager-v2/ProjectManagerContent.tsx`, mirroring the legacy layout but consuming the pre-filtered `items` array provided by the view. The component no longer imports `filterProjects`, eliminating the double computation flagged during Task 1.
- Introduced a pure `toProjectRow` helper to normalise `ProjectListItem` payloads into the table row shape while keeping raw timestamps for TanStack sorting.
- Preserved controlled/uncontrolled fallbacks for `sorting` and `selectedRows`, allowing the component to operate both as a controlled child (v2 view) and standalone fallback for potential storybook/tests.

## Behavioural Parity
- `ProjectsTableGrid` receives the same `search` prop for empty state messaging, and footer counts now use `items.length`, which already reflects active filters.
- Selection state shape (`Set<string>`) and callback signatures remain unchanged, ensuring compatibility with `useSidebarTwoContentSync`.

## Risks & Follow-ups
- The selector currently rebuilds the `tableRows` array on each render; once the React Compiler reaches parity with TanStack Table (see Sub-task 3.2 notes), we can revisit memo strategy if profiler data suggests optimisations.

## Validation
- `npx eslint src/features/project-manager-v2/ProjectManagerContent.tsx`

## Next Steps
Proceed to Sub-task 3.2 to revisit column definitions, TanStack table configuration, and compiler directives.
