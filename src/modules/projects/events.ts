import { getLayoutStoreInstance } from "@/app/shell/layout-context";

import type { FocusedProjectState } from "@/app/shell/layout-store";

export const PROJECT_FOCUS_EVENT = "projects:focus";
export const PROJECT_CLEAR_EVENT = "projects:clear";

export type ProjectFocusSource = "navigation" | "ipc" | "manual";

export interface ProjectFocusDetail {
  projectId: string;
  projectName: string;
  source?: ProjectFocusSource;
}

export type ProjectFocusEvent = CustomEvent<ProjectFocusDetail>;
export type ProjectClearEvent = CustomEvent<void>;

export const PROJECT_SELECTION_EVENT = "projects:selection";

export interface ProjectSelectionDetail {
  count: number;
  selectedIds: ReadonlyArray<string>;
  selectedNames: ReadonlyArray<string>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onClearSelection: () => void;
  onOpenProject: (projectId: string) => void;
  openingProjectId: string | null;
  view?: string;
  allowedViews?: ReadonlyArray<string>;
}

export type ProjectSelectionEvent = CustomEvent<ProjectSelectionDetail>;

export function ensureProjectName(rawName?: string | null): string {
  const trimmed = (rawName ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Project";
}

function updateLayoutStoreWithFocus(focused: FocusedProjectState | null) {
  const store = getLayoutStoreInstance();
  if (!store) {
    return;
  }
  const state = store.getState();
  if (!focused) {
    state.clearFocusedProject();
    return;
  }
  state.setFocusedProject(focused);
}

export function dispatchProjectFocus(detail: ProjectFocusDetail) {
  if (!detail.projectId) {
    console.warn("dispatchProjectFocus received an empty projectId. Event will be ignored.");
    return;
  }

  const projectName = ensureProjectName(detail.projectName);
  updateLayoutStoreWithFocus({ projectId: detail.projectId, projectName });

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ProjectFocusDetail>(PROJECT_FOCUS_EVENT, {
      detail: { ...detail, projectName },
    }),
  );
}

export function dispatchProjectClear() {
  updateLayoutStoreWithFocus(null);

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(PROJECT_CLEAR_EVENT));
}

export function dispatchProjectSelection(detail: ProjectSelectionDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ProjectSelectionDetail>(PROJECT_SELECTION_EVENT, {
      detail,
    }),
  );
}

export function dispatchProjectSelectionClear() {
  dispatchProjectSelection({
    count: 0,
    selectedIds: [],
    selectedNames: [],
    onBatchDelete: async () => {},
    onClearSelection: () => {},
    onOpenProject: () => {},
    openingProjectId: null,
  });
}
