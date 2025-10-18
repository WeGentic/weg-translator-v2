import type { MainView } from "@/app/state/main-view";
import { CLIENT_VIEW_PREFIX, EDITOR_VIEW_PREFIX, PROJECT_VIEW_PREFIX } from "@/app/state/main-view";

const STORAGE_KEY = "weg-translator:workspace:next-view";

export function queueWorkspaceMainView(view: MainView): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, view);
}

export function consumeQueuedWorkspaceMainView(): MainView | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const value = window.sessionStorage.getItem(STORAGE_KEY);
  if (!value) {
    return undefined;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);

  if (isMainView(value)) {
    return value;
  }

  return undefined;
}

function isMainView(value: string): value is MainView {
  return (
    value === "dashboard"
    || value === "projects"
    || value === "clients"
    || value === "resource"
    || value === "settings"
    || value === "editor"
    || value.startsWith(PROJECT_VIEW_PREFIX)
    || value.startsWith(EDITOR_VIEW_PREFIX)
    || value.startsWith(CLIENT_VIEW_PREFIX)
  );
}
