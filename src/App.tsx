import { useEffect } from "react";

import { useAppHealth } from "@/app/hooks/useAppHealth";
import { useGlobalNavigationEvents } from "@/modules/workspace/hooks";
import { useWorkspaceShell } from "@/modules/workspace/state";
import { CollapsedFooterBar, WorkspaceFooter } from "@/app/shell/main_elements";
import { ProjectsPanel } from "@/modules/projects/ProjectsPanel";
import { EnhancedAppSettingsPanel } from "@/modules/settings";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import type { ProjectListItem } from "@/core/ipc";
import { AppProviders } from "@/app/providers";

import "./App.css";

/**
 * Legacy shell retained for storybook-style previews. The main application now
 * relies on TanStack Router + workspace routes under `src/routes/`.
 */
export function LegacyApp() {
  const { health, systemError } = useAppHealth();
  const {
    mainView,
    setMainView,
    openProjectOverviews,
    openProjectEditors,
    handleOpenProject,
    handleCloseOverview,
    handleCloseEditor,
    currentProjectId,
    currentEditorProjectId,
    activeProject,
    activeEditorProject,
  } = useWorkspaceShell();

  useGlobalNavigationEvents({
    onChangeView: setMainView,
    onFocusEditor: (projectId: string) => {
      if (projectId) {
        // Keep focus wiring for compatibility, even though legacy shell is hidden.
        handleCloseEditor(projectId);
      }
    },
  });

  useEffect(() => {
    void openProjectOverviews;
    void openProjectEditors;
    void handleCloseOverview;
  }, [openProjectOverviews, openProjectEditors, handleCloseOverview]);

  const handleProjectOpen = (project: ProjectListItem) => {
    handleOpenProject(project);
  };

  const renderContent = () => {
    if (mainView === "projects") {
      return <ProjectsPanel onOpenProject={handleProjectOpen} />;
    }

    if (mainView === "settings") {
      return (
        <div className="w-full p-6">
          <EnhancedAppSettingsPanel />
        </div>
      );
    }

    if (currentEditorProjectId) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Editor placeholder for {activeEditorProject?.name ?? "project"}
        </div>
      );
    }

    if (currentProjectId && activeProject) {
      return <ProjectsPanel onOpenProject={handleProjectOpen} />;
    }

    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Legacy dashboard placeholder
      </div>
    );
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background/60">
      {systemError ? (
        <div className="px-6 pb-4">
          <Alert variant="destructive">
            <AlertDescription>{systemError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-auto p-4">{renderContent()}</main>
      </div>

      <div className="border-t border-border/60 bg-background/80 shadow-sm">
        <WorkspaceFooter health={health} />
      </div>

      <CollapsedFooterBar />
    </div>
  );
}

export default function App() {
  return (
    <AppProviders>
      <LegacyApp />
    </AppProviders>
  );
}
