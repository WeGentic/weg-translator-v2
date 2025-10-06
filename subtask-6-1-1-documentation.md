# Subtask 6.1.1 – ProjectManagerView Interaction Tests

## Overview
- Introduced a dedicated Vitest + Testing Library suite at `src/test/features/project-manager-v2/view/ProjectManagerView.test.tsx` to cover the core interaction paths for the React 19 port of the Project Manager view.
- Exercised the feature-flagged `project-manager-v2` stack in isolation by mocking IPC calls (`listProjects`, `deleteProject`, `createProject`) and the toast channel while preserving UI fidelity via the live ShadCN components.

## Scenarios covered
1. **Initial load & polling** – verifies the first fetch uses the 100-item limit, asserts interval registration at 1.5s, and simulates the tick callback to ensure refreshes reuse the IPC layer.
2. **Error handling** – forces `listProjects` rejection and confirms the destructive alert banner with the backend message renders.
3. **Search and filter UX** – exercises the search textbox clear affordance and the status filter select, confirming zero-state messaging and filter-driven pruning.
4. **Selection synchronisation** – toggles row checkboxes, asserting footer badge updates and the payload passed to `useSidebarTwoContentSync` (via a hoisted mock) reflects the active selection.
5. **Delete dialog** – clicks the destructive row action and validates the target name propagates into the confirmation dialog stub.
6. **Wizard entry** – ensures the "New Project" button triggers the wizard modal and calls the optional `onCreateProject` callback hook.

## Implementation notes
- Leveraged `vi.hoisted` mocks to share IPC/toast/sidebar spies across tests while preserving React 19 hook expectations.
- Added pointer-capture and `scrollIntoView` no-ops in the test harness to emulate browser behaviour required by Radix `Select` components under JSDOM.
- Replaced manual fake-timer logic with an interval spy to avoid fighting concurrent React scheduling while still validating the polling cadence.

## Test execution
- Command: `npm run test -- --run src/test/features/project-manager-v2/view/ProjectManagerView.test.tsx`
- Outcome: suite passes (7/7) after the new coverage landed.

## Next steps
- Map the same scenarios onto an integration checklist once backend IPC wiring is available (Step 6.1.2).
- Extend coverage to cross-window selection behaviour if additional sidebar features land before release.
