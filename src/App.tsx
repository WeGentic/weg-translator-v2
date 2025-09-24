import { useCallback, useMemo, type CSSProperties } from "react";
import { FileText, FolderKanban, Settings } from "lucide-react";

import { useAppHealth } from "@/app/hooks/useAppHealth";
import { useGlobalNavigationEvents } from "@/app/hooks/useGlobalNavigationEvents";
import { useWorkspaceShell } from "@/app/hooks/useWorkspaceShell";
import { useFooterVisible, useHeaderVisible, useSidemenuState } from "@/app/layout/layout-store";
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

  const headerVisible = useHeaderVisible();
  const footerVisible = useFooterVisible();
  const sidemenu = useSidemenuState();

  const sidebarState = sidemenu.kind;

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

  const FLOAT_HEADER_HEIGHT_REM = 3.5;
  const FLOAT_HEADER_OFFSET_REM = 0.75;
  const COLLAPSED_HEADER_HEIGHT_REM = 2.5;
  const FOOTER_HEIGHT_REM = 3.5;
  const COLLAPSED_FOOTER_HEIGHT_REM = 2.5;
  const SIDEBAR_MARGIN_REM = 0.75;
  const headerInsetRem = headerVisible ? FLOAT_HEADER_HEIGHT_REM + FLOAT_HEADER_OFFSET_REM : 0;
  const footerInsetRem = footerVisible ? FOOTER_HEIGHT_REM : COLLAPSED_FOOTER_HEIGHT_REM;

  const contentTopInset = `${headerInsetRem}rem`;
  const contentBottomInset = `${footerInsetRem}rem`;

  const contentViewportStyle: CSSProperties = {
    paddingTop: contentTopInset,
    paddingBottom: `${SIDEBAR_MARGIN_REM}rem`,
    height: `calc(100dvh - ${contentBottomInset})`,
  };

  const sidebarTopInset = headerVisible ? contentTopInset : `${COLLAPSED_HEADER_HEIGHT_REM}rem`;
  const sidebarBottomInset = footerVisible ? contentBottomInset : `${COLLAPSED_FOOTER_HEIGHT_REM}rem`;

  const sidebarWidthRem =
    sidebarState === "expanded"
      ? sidemenu.width / 16
      : sidebarState === "compact"
        ? sidemenu.width / 16
        : 0;

  const horizontalOffsetRem = sidebarWidthRem + SIDEBAR_MARGIN_REM;

  const contentFrameStyle: CSSProperties = {
    paddingLeft: `${horizontalOffsetRem}rem`,
    paddingRight: `${SIDEBAR_MARGIN_REM}rem`,
  };

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
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background/60">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only fixed left-3 top-3 z-[60] rounded-md border border-border/60 bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Skip to content
      </a>

      {headerVisible ? (
        <AppHeader title={headerTitle} hideUser={!user} />
      ) : (
        <CollapsedHeaderBar />
      )}

      <div className={cn("relative flex flex-1 min-h-0 flex-col overflow-hidden")} style={contentViewportStyle}>
        <AppSidebar
          fixedItems={FIXED_MENU_ITEMS}
          temporaryItems={temporaryProjectItems}
          editorItems={temporaryEditorItems}
          selectedKey={mainView}
          onSelect={(key) => setMainView(key as MainView)}
          style={{
            top: sidebarTopInset,
            bottom: sidebarBottomInset,
          }}
        />

        <main id="main-content" role="main" className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
          <div className="flex flex-1 min-h-0 flex-col" style={contentFrameStyle}>
            {systemError ? (
              <div className="flex-shrink-0 px-6 pb-4">
                <Alert variant="destructive">
                  <AlertDescription>{systemError}</AlertDescription>
                </Alert>
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {renderMainContent()}
              </div>
            </div>
          </div>
        </main>
      </div>

      {footerVisible ? <WorkspaceFooter health={health} /> : <CollapsedFooterBar />}
    </div>
  );
}

export default App;
