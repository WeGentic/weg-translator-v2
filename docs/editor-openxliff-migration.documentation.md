# Editor & OpenXLIFF Relocation Summary

## Scope
- Established `src/modules/editor` with barrel exports for the editor panel, header/footer placeholders, and placeholder content.
- Relocated the OpenXLIFF utilities into `src/modules/projects/ui/tools` to align conversion workflows with the projects domain.

## Integration Notes
- Workspace and panel tests now import editor primitives from `@/modules/editor`, maintaining the same APIs.
- OpenXLIFF UI still depends on `@/core/ipc` adapters; the projects module re-exports the tool for future routing.

## Follow-ups
- Wire the OpenXLIFF panel into projects tooling when UX flows are defined.
- Evaluate extracting editor toolbar logic into dedicated hooks/services once real data wiring begins.
