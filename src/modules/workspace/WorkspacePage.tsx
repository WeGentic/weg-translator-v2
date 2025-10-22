import { useCallback, useEffect } from "react";
import { TbFolders } from "react-icons/tb";
import { FiSettings, FiEdit3 } from "react-icons/fi";
import { LayoutDashboard, Database, UsersRound } from "lucide-react";

import { BlankBackground, useLayoutStoreApi } from "@/app/shell";
import { type MenuItem } from "@/app/shell/main_elements";
import { useAppHealth } from "@/app/hooks/useAppHealth";
import { useGlobalNavigationEvents } from "@/modules/workspace/hooks";
import { useWorkspaceShell } from "@/modules/workspace/state";
import { parseClientIdFromKey, toProjectViewKey, type MainView } from "@/app/state/main-view";
import { EditorPanel, EditorPlaceholder } from "@/modules/editor";
import { ProjectView, ProjectViewPlaceholder } from "@/modules/project-view";
import { EnhancedAppSettingsPanel } from "@/modules/settings";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import type { ProjectListItem } from "@/core/ipc";
import { DashboardView } from "@/modules/dashboard";
import { ResourcesView } from "@/modules/resources";
import { ProjectManagerRoute } from "@/modules/project-manager";
import { ClientsView } from "@/modules/clients";
import { ClientDetailsView } from "@/modules/clients/view/ClientDetailsView";

const FIXED_MENU_ITEMS: MenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "projects", label: "Projects", icon: TbFolders },
  { key: "resource", label: "Resources", icon: Database },
  { key: "clients", label: "Clients", icon: UsersRound },
  { key: "editor", label: "Editor", icon: FiEdit3 },
  { key: "settings", label: "Settings", icon: FiSettings },
];

export interface WorkspacePageProps {
  initialView?: MainView;
}

export function WorkspacePage({ initialView = "dashboard" }: WorkspacePageProps) {
  const { systemError } = useAppHealth();

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
  } = useWorkspaceShell(initialView);

  const layoutStore = useLayoutStoreApi();

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
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: mainView },
      }),
    );
  }, [mainView]);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setBackground({
      mounted: true,
      visible: true,
      element: <BlankBackground />,
    });
    return () => {
      store.getState().setBackground({ element: null, mounted: false });
    };
  }, [layoutStore]);

  const renderContent = () => {
    if (mainView === "dashboard") {
      return <DashboardView />;
    }
    if (mainView === "projects") {
      return <ProjectManagerRoute onOpenProject={handleProjectOpen} />;
    }

    if (mainView === "clients") {
      return <ClientsView />;
    }

    const activeClientId = parseClientIdFromKey(mainView);
    if (activeClientId) {
      return (
        <ClientDetailsView
          clientUuid={activeClientId}
          onBack={() => {
            setMainView("clients");
          }}
        />
      );
    }

    if (mainView === "resource") {
      return <ResourcesView />;
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
        return <ProjectView projectSummary={activeProject} />;
      }
      return <ProjectViewPlaceholder project={activeProject} />;
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

      <div className="flex min-h-0 flex-1 overflow-hidden ">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{renderContent()}</div>
      </div>
    </div>
  );}
