import { useCallback, useEffect } from "react";
import { TbFolders } from "react-icons/tb";
import { FiSettings, FiEdit3 } from "react-icons/fi";
import { LayoutDashboard, Database } from "lucide-react";

import { BlankBackground, useLayoutStoreApi } from "@/app/layout";
import { type MenuItem } from "@/app/layout/main_elements";
import { useAppHealth } from "@/app/hooks/useAppHealth";
import { useGlobalNavigationEvents } from "@/app/hooks/useGlobalNavigationEvents";
import { useWorkspaceShell } from "@/app/hooks/useWorkspaceShell";
import { toProjectViewKey, type MainView } from "@/app/state/main-view";
import { EditorPanel, EditorPlaceholder } from "@/components/editor";
import { ProjectOverview } from "@/components/projects/overview/ProjectOverview";
import { ProjectOverviewPlaceholder } from "@/components/projects/overview/ProjectOverviewPlaceholder";
import { EnhancedAppSettingsPanel } from "@/components/settings/EnhancedAppSettingsPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ProjectListItem } from "@/ipc";
import { DashboardView } from "@/features/dashboard/DashboardView";
import { ResourcesView } from "@/features/resources/ResourcesView";
import { ProjectManagerRoute as ProjectManagerV2View } from "@/features/project-manager-v2";

const FIXED_MENU_ITEMS: MenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "projects", label: "Projects", icon: TbFolders },
  { key: "resource", label: "Resources", icon: Database },
  { key: "editor", label: "Editor", icon: FiEdit3 },
  { key: "settings", label: "Settings", icon: FiSettings },
];

export interface WorkspacePageProps {
  initialView?: MainView;
}

export function WorkspacePage({ initialView = "projects" }: WorkspacePageProps) {
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
        return <ProjectManagerV2View onOpenProject={handleProjectOpen} />;
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

      <div className="flex min-h-0 flex-1 overflow-hidden ">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{renderContent()}</div>
      </div>
    </div>
  );}
