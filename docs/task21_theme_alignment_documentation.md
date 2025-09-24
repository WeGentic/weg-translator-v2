# Task 21 — Theme Harmonization & Notification Quality (2025-09-24)

## Scope
- Applied Task 21 guidance to bring toast notifications in line with the shared theme palette and accessibility targets.
- Added duplicate-suppression logic so rapid segment saves refresh an existing toast instead of spamming multiple notifications.

## Key Changes
- Updated `ToastItem` styling to lean on ShadCN alert tokens, providing card-tinted backgrounds for default toasts and subtle destructive overlays for error cases (`src/components/ui/toast.tsx`).
- Reworked the toast controller to derive signatures and reuse matching IDs, preventing duplicate notifications while keeping timers and dismissal behaviour intact (`src/components/ui/toast.tsx`).

## Validation
- `npm run test:run -- ProjectEditor`

## Follow-up
- Once the broader theme review introduces updated motion/spacing tokens, revisit toast spacing/backdrop blur to ensure parity.
