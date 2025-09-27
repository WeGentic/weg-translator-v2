# Projects Table Performance

Target: smooth interactions up to ~150–200 rows with 1.5s polling.

How to measure
- Build dev app and open the Projects page.
- Use Performance panel (Chromium) and record while:
  - Typing in global search (10 chars).
  - Toggling sort on Updated 5x.
  - Switching Status filter between values.
- Capture timings for scripting + rendering; aim < 50ms per interaction on modern hardware.

Implementation notes
- Table uses TanStack v8 row models and controlled state to avoid remounts.
- Fuzzy filter is global and debounced (250ms).
- No heavy date libs; Intl APIs used for formatting.
- Virtualization (react-virtual) is available if row counts exceed targets.

Tips if regressions found
- Memoize column defs and handlers; avoid recreating on every render.
- Consider narrowing global filter to applicable fields.
- Reduce re-renders by lifting state above polling effects (already done).

