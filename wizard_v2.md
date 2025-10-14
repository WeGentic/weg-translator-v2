# Wizard v2 - New Project Creation Flow

## Current Iteration

- Implemented a glassmorphic modal shell (`CreateProjectWizardV2`) rendered with ShadCN `Dialog`.
- Added bespoke styling class `.wizard-v2-modal` with imported CSS (`src/modules/projects/components/wizard-v2/wizard-v2.css`).
- The modal is centered, leverages backdrop blur for the overlay, and applies neumorphic shadows plus a thin accent outline via `::after`.
- Wired `CreateProjectWizardV2` into the Project Manager entry point (`src/modules/projects/ProjectManagerView.tsx`) so the New Project CTA opens the redesigned shell.
- Fixed centering by nesting the glass surface inside `DialogContent`, keeping Radix’s fixed positioning while preserving the glass styling.
- Introduced a header section with the “New Project Wizard” title and a gradient divider aligned with current glassmorphism trends.
- Repositioned the close control into the header row for alignment, replacing the default dialog close button with a bespoke glass toggle.
- Added form scaffolding with fields for name, source language (searchable combobox), multi-select target languages with chips, client, and notes using bespoke glassmorphic controls.
- Tightened the layout with compact typography, highlighted project name styling, and rebalanced field rows so client and specialisation share a line with notes spanning the width below.
- Refined target-language chips to use abbreviated labels and much smaller pills so multi-selection stays compact.
- Removed the legacy project-type field, widened the shell by ~15%, aligned input/combobox heights, and introduced mirrored language panels so source/target zones share equal height and improved affordances.
- Eliminated helper captions in language cards, added a compact badge showing the count of selections, and compressed panel/combobox sizing with smaller typography for the dual-language layout. Target chips now display only the uppercased language code.
- Added a centered “Done” control within the target picker and fixed wheel scrolling inside both language dropdowns for smoother navigation.
- No inner content is present yet; the shell provides padding and layout primitives for future steps.
- Added a bottom action bar with a ghost-styled Clear control and a primary Next control; Clear resets all form inputs/search state, and Next remains disabled until project name, source, target, and field selections are complete. Custom CSS covers hover/focus/disabled treatments aligned with the glassmorphic palette.
- Wrapped the disabled “Next” control in a tooltip that explains the required metadata (name, source, target, field) must be completed before continuing, giving immediate guidance when the CTA is inactive.
- Patched the tooltip to anchor around the disabled Next button via a wrapper span so the hint appears even though the button is non-interactive.
- Introduced step state (`details` → `files`) so the Next CTA transitions into a second-stage placeholder instead of doing nothing; the wizard preserves entered metadata, exposes a Back control, and keeps finalize actions disabled with explanatory tooltips until the file workflow ships.
- Replaced the placeholder with a fully themed file ingestion UI: glass dropzone supporting click or drag-and-drop, hidden file input trigger, and a datagrid that lists queued files with role selectors and remove affordances. State persists when returning to the details step.
- Tightened the files step visuals—dropzone, table, and controls now use denser spacing, reduced typography, extension badges, and compact role selectors so the layout feels lighter while still aligned with the palette. Image uploads auto-classify to the `Image` role and render as a read-only badge (no manual override).
- Standardised a leaner geometry across the shell: dialog itself clamps between 700–900px, stays perfectly centered, the interior scrolls when vertical space is tight, radii are reduced (controls, panels, chips, dropzones), and outside clicks / ESC no longer close the modal—only the header button does.
- Added a glassy creation feedback overlay with animated loader, success, and error states plus inline preview controls so stakeholders can simulate each outcome directly from step two.

## Feedback Log

- 2025-02-20: Base modal shell approved after centering adjustment.
- 2025-02-20: Tooltip guidance for disabled “Next” CTA approved.
- 2025-02-20: Step-two placeholder flow (Back + disabled finalize) approved.

## Next Focus

- Wire the file ingestion step to real project payloads (file dialog integration, validation, sidecar previews) and surface a progress header and summary that reflect backend readiness.
