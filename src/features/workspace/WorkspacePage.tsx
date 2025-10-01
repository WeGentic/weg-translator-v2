import { useCallback, useEffect, useMemo, useRef } from "react";
import { TbFolders } from "react-icons/tb";
import { FiFileText, FiSettings, FiX } from "react-icons/fi";

import { BlankBackground, useLayoutStoreApi, type SidemenuMode } from "@/app/layout";
import { AppHeader, AppSidebar, WorkspaceFooter, type MenuItem } from "@/app/layout/main_elements";
import { useAppHealth } from "@/app/hooks/useAppHealth";
import { useGlobalNavigationEvents } from "@/app/hooks/useGlobalNavigationEvents";
import { useWorkspaceShell } from "@/app/hooks/useWorkspaceShell";
import {
  toEditorViewKey,
  toProjectViewKey,
  type MainView,
} from "@/app/state/main-view";
import {
  EditorFooterPlaceholder,
  EditorHeader,
  EditorPlaceholder,
  EditorSidebarPlaceholder,
} from "@/components/editor";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";
import { ProjectOverview } from "@/components/projects/overview/ProjectOverview";
import { ProjectOverviewPlaceholder } from "@/components/projects/overview/ProjectOverviewPlaceholder";
import { EnhancedAppSettingsPanel } from "@/components/settings/EnhancedAppSettingsPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderTitle } from "@/hooks/useHeaderTitle";
import type { ProjectListItem } from "@/ipc";

const SIDEMENU_COMPACT_WIDTH = 56;
const SIDEMENU_EXPANDED_WIDTH = 264;

const FIXED_MENU_ITEMS: MenuItem[] = [
  { key: "projects", label: "Projects", icon: TbFolders },
  { key: "settings", label: "Settings", icon: FiSettings },
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
  } = useWorkspaceShell();

  const layoutStore = useLayoutStoreApi();
  const editorSidemenuSnapshot = useRef<{
    mode: SidemenuMode;
    compactWidth: number;
    expandedWidth: number;
  } | null>(null);

  const isEditorView = Boolean(currentEditorProjectId);

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
        icon: FiFileText,
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
        icon: FiFileText,
        onClose: () => handleCloseEditor(projectId),
      } satisfies MenuItem;
    });
  }, [handleCloseEditor, openEditorIds, openProjectEditors]);

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

  const closeActiveEditor = useCallback(() => {
    if (!currentEditorProjectId) {
      return;
    }
    handleCloseEditor(currentEditorProjectId);
  }, [currentEditorProjectId, handleCloseEditor]);

  useEffect(() => {
    const store = layoutStore;
    if (isEditorView) {
      store.getState().setHeaderContent(
        <EditorHeader
          title={headerTitle}
          onCloseEditor={closeActiveEditor}
        />,
      );
    } else {
      store.getState().setHeaderContent(<AppHeader title={headerTitle} hideUser={!user} />);
    }
  }, [layoutStore, isEditorView, headerTitle, closeActiveEditor, user]);

  // Mount the sidemenu once and keep its mode stable across navigation
  useEffect(() => {
    const store = layoutStore;
    const currentMode = store.getState().sidemenu.mode;
    store.getState().setSidemenu({
      mounted: true,
      ...(currentMode === "unmounted" ? { mode: "expanded" as const } : {}),
      compactWidth: SIDEMENU_COMPACT_WIDTH,
      expandedWidth: SIDEMENU_EXPANDED_WIDTH,
    });
    return () => {
      store.getState().setSidemenu({ mounted: false, mode: "unmounted" });
    };
  }, [layoutStore]);

  useEffect(() => {
    const state = layoutStore.getState();
    if (isEditorView) {
      if (!editorSidemenuSnapshot.current) {
        editorSidemenuSnapshot.current = {
          mode: state.sidemenu.mode,
          compactWidth: state.sidemenu.compactWidth,
          expandedWidth: state.sidemenu.expandedWidth,
        };
      }
      const nextMode = state.sidemenu.mode === "hidden" ? "hidden" : "compact";
      layoutStore.getState().setSidemenu({
        mode: nextMode,
        compactWidth: SIDEMENU_COMPACT_WIDTH,
        expandedWidth: SIDEMENU_COMPACT_WIDTH,
      });
    } else if (editorSidemenuSnapshot.current) {
      const snapshot = editorSidemenuSnapshot.current;
      layoutStore.getState().setSidemenu({
        mode: snapshot.mode === "unmounted" ? "expanded" : snapshot.mode,
        compactWidth: snapshot.compactWidth,
        expandedWidth: snapshot.expandedWidth,
      });
      editorSidemenuSnapshot.current = null;
    }
  }, [isEditorView, layoutStore]);

  // Update sidemenu content when inputs change without resetting its mode
  useEffect(() => {
    const store = layoutStore;
    if (isEditorView) {
      store.getState().setSidemenuContent(<EditorSidebarPlaceholder />);
    } else {
      store.getState().setSidemenuContent(
        <AppSidebar
          fixedItems={FIXED_MENU_ITEMS}
          temporaryItems={temporaryProjectItems}
          editorItems={temporaryEditorItems}
          selectedKey={mainView}
          onSelect={handleSidebarSelect}
          floating={true}
          showToggleButton={false}
          header={
            <div className="flex w-full items-center gap-3 px-2">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-slate-400 text-[10px] font-semibold text-white">
                WT
              </div>
              <div className="flex flex-1 flex-col">
                <div className="text-sm font-bold">Weg Translator</div>
                <div className="text-xs text-muted-foreground">
                  {mainView === "projects"
                    ? "Projects"
                    : mainView === "settings"
                    ? "Settings"
                    : temporaryProjectItems.find((item) => item.key === mainView)?.label ??
                      temporaryEditorItems
                        .find((item) => item.key === mainView)
                        ?.label?.replace("Editor — ", "") ??
                      "Navigation"}
                </div>
              </div>
              <button
                className="app-sidebar__close-btn"
                onClick={() => layoutStore.getState().setSidemenu({ mode: "hidden" })}
                aria-label="Close sidebar"
                type="button"
              >
                <FiX className="size-4" />
              </button>
            </div>
          }
        />,
      );
    }

    return () => {
      store.getState().setSidemenuContent(null);
    };
  }, [
    layoutStore,
    isEditorView,
    temporaryProjectItems,
    temporaryEditorItems,
    mainView,
    handleSidebarSelect,
  ]);

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
    if (isEditorView) {
      store.getState().setFooterContent(<EditorFooterPlaceholder />);
    } else {
      store.getState().setFooterContent(<WorkspaceFooter health={health} />);
    }
  }, [layoutStore, isEditorView, health]);

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
      return <EditorPlaceholder projectName={activeEditorProject?.name} />;
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
        <div className="m-4 flex min-h-0 flex-1 flex-col overflow-y-auto">{renderContent()}</div>
      </div>
    </div>
  );
}
