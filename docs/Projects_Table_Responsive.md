# Projects Table Responsive Notes

- Breakpoints
  - ≥ 1024px: show all columns (Name, Type, Files, Status, Updated, Created, Actions).
  - 768–1023px: hide Created; keep Name, Type, Files, Status, Updated, Actions.
  - < 640px: collapse Actions into menu (future); keep Name, Updated, Status; optionally hide Type.

- Alignment
  - Numbers/dates right-aligned; name left-aligned; badges center/left as per column.
  - Compact cell paddings `px-3 py-3.5`; header sized to keep first row visually separated.

- Toolbar
  - Non-sticky per feedback to avoid crowding header and first row.
  - Stacks items on small screens; filter controls shrink to fit.

- Overflow
  - Horizontal scroll appears on narrow widths via the `Table` container overflow.

