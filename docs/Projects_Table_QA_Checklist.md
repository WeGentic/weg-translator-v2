# Projects Table QA Checklist

- Data loading
  - Loads initial projects without errors; polling updates do not jitter selection.
  - Refresh button triggers visible re-fetch without losing table state.
- Sorting
  - Default sort is Updated desc.
  - Clicking sortable headers toggles asc/desc; aria-sort reflects state.
- Global search
  - Debounced input filters rows fuzzily; clearing restores all.
- Filters
  - Status: Pending/Running/Completed/Failed; combinations behave as expected.
  - Type: Translation/RAG; date presets 24h/7d/30d filter by Updated.
  - Clear resets to All/Any.
- Row actions
  - Open project invokes callback; Delete opens confirmation, enforces exact name, and toasts results.
- Loading/empty/error
  - Skeleton shows during load; empty state CTA works; error alert appears and dismisses once resolved.
- Accessibility
  - Keyboard: headers togglable, actions focusable; tooltips do not trap focus.
  - Screen reader: aria-labels on actions; aria-sort correct.
- Responsive
  - Narrow: toolbar stacks; horizontal scroll available for table.
  - No layout jumps between polling updates.

