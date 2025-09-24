# Project editor components

This directory contains the virtualized translation editor used in the desktop app. Components are written for React 19 with the compiler enabled, Tailwind CSS utility classes, and ShadCN primitives.

## Composition

- **ProjectEditor.tsx** – orchestrates project/file loading, resolves JLIFF + tag-map artefacts over IPC, normalises them into `SegmentRow` data, and feeds UI state (filters, counters, scroll position) to the table.
- **SegmentsTable.tsx** – TanStack Table v8 instance with `@tanstack/react-virtual` row virtualization. Emits row-level actions via context props and exposes filter helpers under `__TEST_ONLY__` for Vitest.
- **TargetEditor.tsx** – React 19 action form responsible for editing a segment target. Coordinates with `RowActions` for quick commands and reconciles local state after IPC writes.
- **TokenLine.tsx** – renders tokenized segment strings, producing placeholder chips that surface IDs via `data-ph` attributes and invoke the supplied click handler when editing is allowed.
- **PlaceholderParityBadge.tsx** – summarises parity counts (source vs target) with status semantics consumed by filters and accessibility tooling.
- **PlaceholderInspector.tsx** – reveals structured metadata for selected placeholders, reusing the chip data built during normalization.
- **RowActions.tsx** – action bar shared by `TargetEditor` and table row affordances. Uses ShadCN buttons/selects and `useFormStatus` to respect pending states.

## Contracts & data expectations

- Every component consumes `SegmentRow` records from `src/lib/jliff`. Callers must provide memoized arrays to avoid unnecessary re-renders.
- `TokenLine` chips require placeholder tokens in the `{{ph:phN}}` convention emitted by the backend (`placeholder_style: "double-curly"`).
- IPC calls live under `src/ipc/client.ts`; components should never import Tauri APIs directly to keep testing straightforward.

## Testing

- Component behaviour is covered with Testing Library (see `*.test.tsx`). Utilities for tokenization and normalisation live in `src/lib/jliff` with dedicated Vitest suites.
- When adding new table filters or UI variants, prefer pure helper functions that can be asserted without rendering the entire table (as done with `placeholderFilter`).

Refer to `docs/data-model.md` for a full overview of artefact flow between the backend and the editor.
