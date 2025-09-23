import { useEffect } from "react";

import { toEditorViewKey, type MainView } from "@/app/state/main-view";
import { logger } from "@/logging";

/**
 * Subscribes to the custom `app:navigate` browser event so child components can request top-level
 * navigation changes without drilling props through the entire tree.
 */
export function useGlobalNavigationEvents({
  onChangeView,
  onFocusEditor,
}: {
  onChangeView: (view: MainView) => void;
  onFocusEditor: (projectId: string, fileId: string | null) => void;
}) {
  useEffect(() => {
    const handler: EventListener = (event) => {
      const custom = event as CustomEvent<
        { view?: string; projectId?: string; fileId?: string } | undefined
      >;
      const view = custom.detail?.view;

      if (view === "settings" || view === "projects") {
        onChangeView(view as MainView);
        return;
      }

      if (view === "editor") {
        const projectId = custom.detail?.projectId;
        const fileId = custom.detail?.fileId ?? null;

        if (projectId) {
          void logger.debug?.(
            `Navigate: editor view for project=${projectId}${fileId ? ` file=${fileId}` : ""}`,
          );
          onFocusEditor(projectId, fileId);
          onChangeView(toEditorViewKey(projectId));
        } else {
          onChangeView("projects");
        }
      }
    };

    window.addEventListener("app:navigate", handler);
    return () => window.removeEventListener("app:navigate", handler);
  }, [onChangeView, onFocusEditor]);
}
