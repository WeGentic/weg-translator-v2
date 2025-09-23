import { useCallback, useMemo, useState } from "react";
import { FileText, FolderKanban, Settings } from "lucide-react";

import { useAppHealth } from "@/app/hooks/useAppHealth";
import { useGlobalNavigationEvents } from "@/app/hooks/useGlobalNavigationEvents";
import { useWorkspaceShell } from "@/app/hooks/useWorkspaceShell";
import {
  toEditorViewKey,
  toProjectViewKey,
  type MainView,
} from "@/app/state/main-view";
import { AppHeader } from "@/components/layout/header/AppHeader";
import { CollapsedHeaderBar } from "@/components/layout/header/CollapsedHeaderBar";
import { CollapsedFooterBar } from "@/components/layout/footer/CollapsedFooterBar";
import { WorkspaceFooter } from "@/components/layout/footer/WorkspaceFooter";
import { AppSidebar, type MenuItem } from "@/components/layout/sidebar/AppSidebar";
import { getNextSidebarState, type SidebarState } from "@/components/layout/sidebar/sidebar-state";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";
import { ProjectEditor } from "@/components/projects/editor/ProjectEditor";
import { ProjectEditorPlaceholder } from "@/components/projects/editor/ProjectEditorPlaceholder";
import { ProjectOverview } from "@/components/projects/overview/ProjectOverview";
import { ProjectOverviewPlaceholder } from "@/components/projects/overview/ProjectOverviewPlaceholder";
import { AppSettingsPanel } from "@/components/settings/AppSettingsPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderTitle } from "@/hooks/useHeaderTitle";
import { cn } from "@/lib/utils";
import type { ProjectListItem } from "@/ipc";

import "./App.css";

const FIXED_MENU_ITEMS: MenuItem[] = [
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "settings", label: "Settings", icon: Settings },
];

/**
 * Desktop application shell that wires together the workspace layout, navigation, and data entry.
 * The component composes small hooks so the React 19 compiler can optimise without manual memoisation.
 */
function App() {
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

  const [sidebarState, setSidebarState] = useState<SidebarState>("expanded");
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isFooterVisible, setIsFooterVisible] = useState(true);

  const cycleSidebarState = useCallback(() => {
    setSidebarState((prev) => getNextSidebarState(prev));
  }, []);

  const toggleFooter = useCallback(() => {
    setIsFooterVisible((prev) => !prev);
  }, []);

  const handleShowHeader = useCallback(() => {
    setIsHeaderVisible(true);
  }, []);

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

  const headerTitle = useHeaderTitle({
    explicit:
      activeEditorProject
        ? `Editor — ${activeEditorProject.name}`
        : activeProject?.name ?? FIXED_MENU_ITEMS.find((item) => item.key === mainView)?.label ?? undefined,
  });

  const contentPaddingClass = isHeaderVisible ? "pt-18" : "pt-6";
  const contentLeftPadClass = sidebarState === "expanded" ? "pl-64" : sidebarState === "compact" ? "pl-16" : "pl-0";

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

  /**
   * Resolves the main workspace content component for the currently selected view.
   */
  const renderMainContent = () => {
    if (mainView === "projects") {
      return <ProjectsPanel onOpenProject={handleProjectOpen} />;
    }

    if (mainView === "settings") {
      return (
        <div className="w-full overflow-y-auto p-6">
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
    <div className="flex min-h-screen flex-col bg-background/60">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only fixed left-3 top-3 z-[60] rounded-md border border-border/60 bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Skip to content
      </a>

      {isHeaderVisible ? (
        <AppHeader
          title={headerTitle}
          onToggleSidebar={cycleSidebarState}
          state={sidebarState}
          hideUser={!user}
        />
      ) : (
        <CollapsedHeaderBar onExpand={handleShowHeader} />
      )}

      <div className={cn("flex flex-1 flex-col", contentPaddingClass)}>
        <AppSidebar
          state={sidebarState}
          fixedItems={FIXED_MENU_ITEMS}
          temporaryItems={temporaryProjectItems}
          editorItems={temporaryEditorItems}
          selectedKey={mainView}
          onSelect={(key) => setMainView(key as MainView)}
          style={{
            top: isHeaderVisible ? "5rem" : "3.25rem",
            bottom: isFooterVisible ? "4.25rem" : "3.25rem",
          }}
        />

        <main id="main-content" role="main" className="contents">
          <div className={cn("flex flex-1 flex-col overflow-hidden", contentLeftPadClass)}>
            {systemError ? (
              <div className="px-6 pb-4">
                <Alert variant="destructive">
                  <AlertDescription>{systemError}</AlertDescription>
                </Alert>
              </div>
            ) : null}
            <div className="flex flex-1 overflow-hidden">{renderMainContent()}</div>
          </div>
        </main>
      </div>

      {isFooterVisible ? (
        <WorkspaceFooter health={health} onHide={() => setIsFooterVisible(false)} />
      ) : (
        <CollapsedFooterBar onExpand={toggleFooter} />
      )}
      </div>
  );
}

export default App;
