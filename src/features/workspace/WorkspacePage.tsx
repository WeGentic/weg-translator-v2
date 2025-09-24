import { useCallback, useEffect, useMemo } from "react";
import { FileText, FolderKanban, Settings } from "lucide-react";

import { useLayoutActions, useLayoutSelector } from "@/app/layout/MainLayout";
import { useAppHealth } from "@/app/hooks/useAppHealth";
import { useGlobalNavigationEvents } from "@/app/hooks/useGlobalNavigationEvents";
import { useWorkspaceShell } from "@/app/hooks/useWorkspaceShell";
import {
  toEditorViewKey,
  toProjectViewKey,
  type MainView,
} from "@/app/state/main-view";
import { AppSidebar, type MenuItem } from "@/components/layout/sidebar/AppSidebar";
import { WorkspaceFooter } from "@/components/layout/footer/WorkspaceFooter";
import { AppHeader } from "@/components/layout/header/AppHeader";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";
import { ProjectEditor } from "@/components/projects/editor/ProjectEditor";
import { ProjectEditorPlaceholder } from "@/components/projects/editor/ProjectEditorPlaceholder";
import { ProjectOverview } from "@/components/projects/overview/ProjectOverview";
import { ProjectOverviewPlaceholder } from "@/components/projects/overview/ProjectOverviewPlaceholder";
import { AppSettingsPanel } from "@/components/settings/AppSettingsPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderTitle } from "@/hooks/useHeaderTitle";
import type { AppHealthReport, ProjectListItem } from "@/ipc";

const SIDEMENU_COMPACT_WIDTH = 112;
const SIDEMENU_EXPANDED_WIDTH = 264;

const FIXED_MENU_ITEMS: MenuItem[] = [
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "settings", label: "Settings", icon: Settings },
];

export function WorkspacePage() {
  const { user } = useAuth();
  const { health, systemError } = useAppHealth();

  const {
    mainView,
    setMainView,
    openEditorIds,
    openProjectOverviews,
    openProjectEditors,
    handleOpenProject,
    handleCloseOverview,
    handleCloseEditor,
    openEditorView,
    currentProjectId,
    currentEditorProjectId,
    activeProject,
    activeEditorProject,
    selectedFileId,
    setSelectedFileId,
  } = useWorkspaceShell();

  const setHeader = useLayoutActions((state) => state.setHeader);
  const setFooter = useLayoutActions((state) => state.setFooter);
  const setSidemenu = useLayoutActions((state) => state.setSidemenu);
  const setBackground = useLayoutActions((state) => state.setBackground);
  const setHeaderContent = useLayoutActions((state) => state.setHeaderContent);
  const setFooterContent = useLayoutActions((state) => state.setFooterContent);
  const setSidemenuContent = useLayoutActions((state) => state.setSidemenuContent);

  const headerTitle = useHeaderTitle({
    explicit:
      activeEditorProject
        ? `Editor — ${activeEditorProject.name}`
        : activeProject?.name ?? FIXED_MENU_ITEMS.find((item) => item.key === mainView)?.label ?? undefined,
  });

  const temporaryProjectItems: MenuItem[] = useMemo(
    () =>
      openProjectOverviews.map((project) => ({
        key: toProjectViewKey(project.projectId),
        label: project.name,
        icon: FileText,
        onClose: () => handleCloseOverview(project.projectId),
      })),
    [handleCloseOverview, openProjectOverviews],
  );

  const temporaryEditorItems: MenuItem[] = useMemo(() => {
    const lookup = new Map(openProjectEditors.map((project) => [project.projectId, project]));
    return openEditorIds.map((projectId) => {
      const project = lookup.get(projectId);
      return {
        key: toEditorViewKey(projectId),
        label: project ? `Editor — ${project.name}` : "Editor",
        icon: FileText,
        onClose: () => handleCloseEditor(projectId),
      } satisfies MenuItem;
    });
  }, [handleCloseEditor, openEditorIds, openProjectEditors]);

  const handleProjectOpen = useCallback((project: ProjectListItem) => {
    handleOpenProject(project);
  }, [handleOpenProject]);

  const focusEditor = useCallback(
    (projectId: string, fileId: string | null) => {
      if (projectId) {
        openEditorView(projectId);
      }
      setSelectedFileId(fileId);
    },
    [openEditorView, setSelectedFileId],
  );

  useGlobalNavigationEvents({
    onChangeView: setMainView,
    onFocusEditor: focusEditor,
  });

  const handleSidebarSelect = useCallback(
    (key: string) => {
      setMainView(key as MainView);
    },
    [setMainView],
  );

  useEffect(() => {
    setBackground({ mounted: true, visible: true, element: (
      <div className="h-full w-full bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_65%)]" />
    ) });
    return () => {
      setBackground({ element: null, mounted: false });
    };
  }, [setBackground]);

  useEffect(() => {
    setHeader({ mounted: true, visible: true, height: 64 });
    setHeaderContent(<AppHeader title={headerTitle} hideUser={!user} />);
    return () => {
      setHeaderContent(null);
      setHeader({ mounted: false });
    };
  }, [setHeader, setHeaderContent, headerTitle, user]);

  useEffect(() => {
    setSidemenu({
      mounted: true,
      mode: "expanded",
      compactWidth: SIDEMENU_COMPACT_WIDTH,
      expandedWidth: SIDEMENU_EXPANDED_WIDTH,
    });
    setSidemenuContent(
      <AppSidebar
        fixedItems={FIXED_MENU_ITEMS}
        temporaryItems={temporaryProjectItems}
        editorItems={temporaryEditorItems}
        selectedKey={mainView}
        onSelect={handleSidebarSelect}
        floating={false}
      />,
    );
    return () => {
      setSidemenuContent(null);
      setSidemenu({ mounted: false, mode: "unmounted" });
    };
  }, [
    setSidemenu,
    setSidemenuContent,
    temporaryProjectItems,
    temporaryEditorItems,
    mainView,
    handleSidebarSelect,
  ]);

  useEffect(() => {
    setFooter({ mounted: true, visible: true, height: 56 });
    setFooterContent(<WorkspaceFooter health={health} />);
    return () => {
      setFooterContent(null);
      setFooter({ mounted: false });
    };
  }, [setFooter, setFooterContent, health]);

  const renderContent = () => {
    if (mainView === "projects") {
      return <ProjectsPanel onOpenProject={handleProjectOpen} />;
    }

    if (mainView === "settings") {
      return (
        <div className="w-full p-6">
          <AppSettingsPanel />
        </div>
      );
    }

    if (currentEditorProjectId) {
      if (activeEditorProject) {
        return <ProjectEditor project={activeEditorProject} fileId={selectedFileId} />;
      }
      return <ProjectEditorPlaceholder projectId={currentEditorProjectId} />;
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{renderContent()}</div>
      </div>
    </div>
  );
}
