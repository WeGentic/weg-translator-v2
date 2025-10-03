# Task 7 – Editor Panel Refactor

## Overview
- Introduced `EditorPanel` at `src/components/editor/EditorPanel.tsx`, wrapping the editor workspace in the shared `ThreeZonePanel` (header, toolbar, content, footer).
- Updated `EditorHeader` and `EditorFooterPlaceholder` to serve as slot content instead of layout overrides, and rewired `WorkspacePage` to mount the new panel when an editor session is active.

## Layout Highlights
- Header delivers title, optional project subtitle, back navigation (when available), and the existing close control.
- Toolbar implements stubbed search, navigation, filtering, and validation actions using ShadCN inputs/buttons, plus a live status pill.
- Content hosts the existing placeholder within a scrollable container so the future segment canvas inherits three-zone spacing.
- Footer reuses the status placeholder within the panel, keeping the global workspace footer for health telemetry.

## Follow-up Suggestions
- Replace the current placeholder with the real editor canvas once segment rendering is ready.
- Wire toolbar actions (`Find`, `Navigate`, `Validate`) to real commands and IPC flows.
- Persist toolbar selections (view mode, filters) per project to match user expectations.
