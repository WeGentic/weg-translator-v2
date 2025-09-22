# Task 2 — Project Overview Compact Header

Status: Completed

Changes
- Removed the Languages card from the Overview.
- Added compact header with project name, slug, src→tgt, file count, created/updated.
- Kept “Add files” action aligned to the right.
- Extracted standalone components: `OverviewHeader` and `OverviewAutoConvertBanner`.

Files Updated
- src/components/projects/overview/ProjectOverview.tsx
- src/components/projects/overview/components/OverviewHeader.tsx (new)
- src/components/projects/overview/components/OverviewAutoConvertBanner.tsx (new)

Notes
- Header displays file count from `details.files.length` when available; falls back to `project.fileCount`.
