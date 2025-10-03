import { useCallback, useEffect } from "react";
import { TbFolders } from "react-icons/tb";
import { FiSettings, FiEdit3 } from "react-icons/fi";

import { BlankBackground, useLayoutStoreApi } from "@/app/layout";
import { AppHeader, WorkspaceFooter, type MenuItem } from "@/app/layout/main_elements";
import { useAppHealth } from "@/app/hooks/useAppHealth";
import { useGlobalNavigationEvents } from "@/app/hooks/useGlobalNavigationEvents";
import { useWorkspaceShell } from "@/app/hooks/useWorkspaceShell";
import { toProjectViewKey } from "@/app/state/main-view";
import { EditorPanel, EditorPlaceholder } from "@/components/editor";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";
import { ProjectOverview } from "@/components/projects/overview/ProjectOverview";
import { ProjectOverviewPlaceholder } from "@/components/projects/overview/ProjectOverviewPlaceholder";
import { EnhancedAppSettingsPanel } from "@/components/settings/EnhancedAppSettingsPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderTitle } from "@/hooks/useHeaderTitle";
import type { ProjectListItem } from "@/ipc";

const FIXED_MENU_ITEMS: MenuItem[] = [
  { key: "projects", label: "Projects", icon: TbFolders },
  { key: "editor", label: "Editor", icon: FiEdit3 },
  { key: "settings", label: "Settings", icon: FiSettings },
];

export function WorkspacePage() {
  const { user } = useAuth();
  const { health, systemError } = useAppHealth();

  const {
    mainView,
    setMainView,
    handleOpenProject,
    handleCloseEditor,
    openEditorView,
    currentProjectId,
    currentEditorProjectId,
    activeProject,
    activeEditorProject,
  } = useWorkspaceShell();

  const layoutStore = useLayoutStoreApi();

  const headerTitle = useHeaderTitle({
    explicit:
      activeEditorProject
        ? `Editor — ${activeEditorProject.name}`
        : activeProject?.name ?? FIXED_MENU_ITEMS.find((item) => item.key === mainView)?.label ?? undefined,
  });

  const handleProjectOpen = useCallback((project: ProjectListItem) => {
    handleOpenProject(project);
  }, [handleOpenProject]);

  const focusEditor = useCallback(
    (projectId: string, _fileId: string | null) => {
      void _fileId;
      if (projectId) {
        openEditorView(projectId);
      }
    },
    [openEditorView],
  );

  const handleCloseEditorPlaceholder = useCallback(() => {
    setMainView("projects");
  }, [setMainView]);

  useGlobalNavigationEvents({
    onChangeView: setMainView,
    onFocusEditor: focusEditor,
  });

  useEffect(() => {
    const store = layoutStore;
    store.getState().setBackground({
      mounted: true,
      visible: true,
      element: <BlankBackground/>
    });
    return () => {
      store.getState().setBackground({ element: null, mounted: false });
    };
  }, [layoutStore]);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setHeader({ mounted: true, visible: true, height: 64 });
    return () => {
      store.getState().setHeaderContent(null);
      store.getState().setHeader({ mounted: false });
    };
  }, [layoutStore]);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setHeaderContent(<AppHeader title={headerTitle} hideUser={!user} />);
  }, [layoutStore, headerTitle, user]);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setFooter({ mounted: true, visible: true, height: 56 });
    return () => {
      store.getState().setFooterContent(null);
      store.getState().setFooter({ mounted: false });
    };
  }, [layoutStore]);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setFooterContent(<WorkspaceFooter health={health} />);
  }, [layoutStore, health]);

  const renderContent = () => {
    if (mainView === "projects") {
      return <ProjectsPanel onOpenProject={handleProjectOpen} />;
    }

    if (mainView === "settings") {
      return <EnhancedAppSettingsPanel />;
    }

    if (mainView === "editor") {
      return (
        <EditorPanel onCloseEditor={handleCloseEditorPlaceholder} statusLabel="Idle">
          <EditorPlaceholder />
        </EditorPanel>
      );
    }

    if (currentEditorProjectId) {
      const backTarget = currentProjectId ? toProjectViewKey(currentProjectId) : null;

      return (
        <EditorPanel
          projectName={activeEditorProject?.name}
          documentName={activeEditorProject?.name}
          onBackToOverview={backTarget ? () => setMainView(backTarget) : undefined}
          onCloseEditor={() => {
            handleCloseEditor(currentEditorProjectId);
          }}
        >
          <EditorPlaceholder projectName={activeEditorProject?.name} />
        </EditorPanel>
      );
    }

    if (currentProjectId) {
      if (activeProject) {
        return <ProjectOverview projectSummary={activeProject} />;
      }
      return <ProjectOverviewPlaceholder project={activeProject} />;
    }

    return (
      <div className="flex w-full items-center justify-center p-6">
        <div className="rounded-xl border border-border/60 bg-background/70 p-8 text-center text-sm text-muted-foreground shadow-sm">
          {FIXED_MENU_ITEMS.find((item) => item.key === mainView)?.label} coming soon
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      {systemError ? (
        <div className="px-6 pb-4">
          <Alert variant="destructive">
            <AlertDescription>{systemError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden mb-12">
        <div className="my-2 flex min-h-0 flex-1 flex-col overflow-y-auto">{renderContent()}</div>
      </div>
    </div>
  );
}
