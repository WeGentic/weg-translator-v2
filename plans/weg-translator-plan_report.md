# Weg Translator Plan – Progress Log

## Step 1.1 (Map data contracts)
- Reviewed `ProjectViewRoute` (`src/modules/project-view/ProjectViewRoute.tsx:360-433`) to trace how bundle data is partitioned into `files`, `references`, and `instructions`, along with handlers (`onOpenFile`, `onRegenerate*`, `onRemoveFile`, `onChangeRole`, `onAddFiles`) and busy state.
- Confirmed `ProjectViewContent` props (`src/modules/project-view/ProjectViewContent.tsx:18-52`) already expose `languagePairs`, `summary`, `subjectLine`, `fileCount`, and `statistics?.lastActivity` required for the upcoming language sub-header.
- Validated `ProjectFileBundle` and `ArtifactRecord` fields in `src/shared/types/database.ts:166-210`, ensuring filenames, stored paths, size/segment/token counts, language pairs, and artifact statuses are available for the new tables without additional IPC changes.
- Outcome: No data gaps identified; all planned components can source their fields from existing props/DTOs.

## Step 1.2 (Filter & grouping strategy)
- Inspected shared filters (`src/modules/project-view/views/ProjectViewAssetFilters.tsx:1-90`) and current table usage (`ProjectViewFilesSection.tsx:53-146`) to catalogue supported controls (search, role, status, grouping).
- Established that `ProjectViewContent` will keep a single controlled `AssetFilters`/`AssetGrouping` state, while each table consumes only the subset it understands, per TanStack guidance on scoped controlled state[1].
- Decided artefacts table will honour search + status and treat the role filter as a gate for `processable` conversions, falling back to the empty state for other roles.
- References and instructions tables will replicate the legacy resource filtering (search + role only) and ignore status/grouping to prevent user confusion; they still receive the shared props for a consistent API surface.
- Grouping toggle remains exclusive to the files table—other tables will render flat layouts regardless of toggle position.
- Outcome: Filter behaviour is defined per table with predictable interactions and no conflicting requirements.

## Step 2.1 (Sub-header scaffold)
- Created `src/modules/project-view/views/language-subheader/` with a CSS module scaffold defining base layout classes for alignment, badges, and metrics (`LanguageSubheader.module.css`).
- Added placeholder component export (`LanguageSubheader.tsx`) returning `null` for now; ensures imports resolve before implementation work in Step 2.2.
- Exposed the component via `index.ts` to simplify consumption from `ProjectViewContent`.
- Outcome: File structure and styling hooks are in place with no missing-module TypeScript errors.

## Step 2.2 (Language sub-header component)
- Implemented `LanguageSubheader` to render deduplicated language pair badges with palette-based color cycling and an accessible textual label (`src/modules/project-view/views/language-subheader/LanguageSubheader.tsx:1-95`).
- Added concise styling for the inline layout, badge tones, and empty states to match the revised minimalist direction (`LanguageSubheader.module.css:1-44`).
- Outcome: Sub-header module now exports a production-ready component ready for layout wiring in Step 2.3.

## Step 2.3 (Integrate sub-header)
- Updated `ProjectViewContent` to render `LanguageSubheader` directly inside the content stack, removing the gradient hero card and legacy badge markup (`src/modules/project-view/ProjectViewContent.tsx:34-72`).
- Trimmed the component contract to accept only language pairs, aligning with the simplified UI while keeping other workspace props intact for future sections.
- Outcome: Sub-header now appears flush with the content area, matching the revised styling direction and emitting no console warnings.

## Step 3.1 (Files table scaffold)
- Created `src/modules/project-view/views/files-table/` with a scoped CSS module defining root/placeholder styles aligned with the palette (`ProjectFilesTable.module.css`).
- Added `ProjectFilesTable.tsx` exposing the future prop contract while rendering a harmless placeholder, plus a barrel export to simplify upcoming imports.
- Outcome: Scaffold compiles cleanly and leaves current file table logic untouched ahead of Step 3.2.

## Step 3.2 (Files table refactor)
- Migrated the legacy `ProjectViewFilesSection` logic into `ProjectFilesTable`, preserving sorting, selection, role switching, grouped view, and action handlers while complying with lint constraints (`src/modules/project-view/views/files-table/ProjectFilesTable.tsx:1-360`).
- Simplified the layout per new guidance: title text plus compact table, language pairs rendered as low-profile text, and status/updated columns removed.
- Updated `ProjectViewContent` to consume the new component and removed the obsolete section file, keeping state placeholders ready for future filter integration (`src/modules/project-view/ProjectViewContent.tsx:1-120`).
- Validation: `pnpm typecheck`.
- Outcome: Modular files table now powers the project view without behavioural regressions, meeting the refactor gate.

[1] https://tanstack.com/table/latest/docs/guide/column-filtering
