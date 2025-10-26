import { useEffect, useState, type PropsWithChildren } from "react";
import { ChevronRight, FolderOpen, Settings, UserCircle, Plus, LayoutDashboard, FileText, Database } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/class-names";
import { useLayoutSelector, useLayoutStoreApi } from "./layout-context";

import "@/shared/styles/layout/layout-sidebar-one.css";
import "@/shared/styles/layout/logo-container.css";
import "@/shared/styles/layout/sidebar-buttons.css";

/**
 * Props for {@link LayoutSidebarOne}. Consumers can customize width and content.
 */
export interface LayoutSidebarOneProps extends PropsWithChildren {
  width?: number;
  onDashboardClick?: () => void;
  onProjectsClick?: () => void;
  onEditorClick?: () => void;
  onResourceClick?: () => void;
  onSettingsClick?: () => void;
  onUserAccountClick?: () => void;
  onCreateProjectClick?: () => void;
}

/**
 * Fixed width sidebar positioned on the left with Projects and Settings buttons.
 * This component is always visible and does not collapse.
 */
export function LayoutSidebarOne({
  children,
  width = 64,
  onDashboardClick,
  onProjectsClick,
  onEditorClick,
  onResourceClick,
  onSettingsClick,
  onUserAccountClick,
  onCreateProjectClick,
}: LayoutSidebarOneProps) {
  const layoutStore = useLayoutStoreApi();
  const sidebarOne = useLayoutSelector((state) => state.sidebarOne);
  const sidebarOneContent = useLayoutSelector((state) => state.sidebarOneContent);
  const sidebarTwo = useLayoutSelector((state) => state.sidebarTwo);
  const footer = useLayoutSelector((state) => state.footer);
  const [activeView, setActiveView] = useState<"dashboard" | "projects" | "editor" | "resource" | "settings" | "other">("dashboard");

  useEffect(() => {
    const store = layoutStore;
    store.getState().setSidebarOne({
      mounted: true,
      width,
    });
    return () => {
      store.getState().setSidebarOne({ mounted: false });
    };
  }, [layoutStore, width]);

  // Listen for navigation events to track the active view
  useEffect(() => {
    const handler: EventListener = (event) => {
      const custom = event as CustomEvent<{ view?: string } | undefined>;
      const view = custom.detail?.view;

      if (view === "dashboard") {
        setActiveView("dashboard");
      } else if (view === "projects" || view?.startsWith("project:")) {
        setActiveView("projects");
      } else if (view === "editor" || view?.startsWith("editor:")) {
        setActiveView("editor");
      } else if (view === "resource") {
        setActiveView("resource");
      } else if (view === "settings") {
        setActiveView("settings");
      }
    };

    window.addEventListener("app:navigate", handler);
    return () => window.removeEventListener("app:navigate", handler);
  }, []);

  const handleReopenSidebarTwo = () => {
    const store = layoutStore;
    store.getState().setSidebarTwo({ visible: true });
  };

  const content = children ?? sidebarOneContent;

  if (!sidebarOne.mounted) {
    return null;
  }

  const defaultContent = (
    <>
      {/* Logo header area - exactly 56px */}
      <div className="sidebar-one__logo" aria-label="Application logo">
        <div className="logo-container">
          <img
            src="/src/assets/LOGO-SVG.svg"
            alt="Tr-entic"
            width="28"
            height="28"
          />
        </div>
      </div>
      <div className="sidebar-one__logo-divider" aria-hidden="true" />

      <div className="sidebar-one__content">
        {/* Top navigation section */}
        <nav className="sidebar-one__nav p-4">
          {/* Reopen Sidebar_two button - only shown when Sidebar_two is hidden AND not on Settings view */}
          {sidebarTwo.mounted && !sidebarTwo.visible && activeView !== "settings" && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sidebar-one__button sidebar-one__button--reopen"
                    onClick={handleReopenSidebarTwo}
                    aria-label="Show sidebar"
                    type="button"
                  >
                    <div className="sidebar-one__button-container">
                      <ChevronRight className="size-5" aria-hidden="true" />
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Show sidebar
                </TooltipContent>
              </Tooltip>
              <div className="sidebar-one__logo-divider sidebar-one__reopen-divider" aria-hidden="true" />
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "sidebar-one__button",
                  activeView === "dashboard" && "sidebar-one__button--active"
                )}
                onClick={onDashboardClick}
                aria-label="Dashboard"
                aria-current={activeView === "dashboard" ? "page" : undefined}
                type="button"
              >
                <div className="sidebar-one__button-container">
                  <LayoutDashboard className="size-5" aria-hidden="true" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Dashboard
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "sidebar-one__button",
                  activeView === "projects" && "sidebar-one__button--active"
                )}
                onClick={onProjectsClick}
                aria-label="Projects"
                aria-current={activeView === "projects" ? "page" : undefined}
                type="button"
              >
                <div className="sidebar-one__button-container">
                  <FolderOpen className="size-5" aria-hidden="true" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Projects
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "sidebar-one__button",
                  activeView === "editor" && "sidebar-one__button--active"
                )}
                onClick={onEditorClick}
                aria-label="Editor"
                aria-current={activeView === "editor" ? "page" : undefined}
                type="button"
              >
                <div className="sidebar-one__button-container">
                  <FileText className="size-5" aria-hidden="true" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Editor
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "sidebar-one__button",
                  activeView === "resource" && "sidebar-one__button--active"
                )}
                onClick={onResourceClick}
                aria-label="Resource"
                aria-current={activeView === "resource" ? "page" : undefined}
                type="button"
              >
                <div className="sidebar-one__button-container">
                  <Database className="size-5" aria-hidden="true" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Resource
            </TooltipContent>
          </Tooltip>

          {/* Divider between Resource and Settings */}
          <div className="sidebar-one__nav-divider" aria-hidden="true" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className={cn(
                  "sidebar-one__button",
                  activeView === "settings" && "sidebar-one__button--active"
                )}
                onClick={onSettingsClick}
                aria-label="Settings"
                aria-current={activeView === "settings" ? "page" : undefined}
                type="button"
              >
                <div className="sidebar-one__button-container">
                  <Settings className="size-5" aria-hidden="true" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Settings
            </TooltipContent>
          </Tooltip>
        </nav>

        {/* Bottom section with quick actions and user account */}
        <div className="sidebar-one__bottom" style={{ marginBottom: footer.mounted && footer.visible ? `${footer.height}px` : '0' }}>
          {/* Top divider for Quick Actions section */}
          <div className="sidebar-one__divider-subtle" aria-hidden="true" />

          {/* Quick Action zone */}
          <div className="sidebar-one__quick-action-container">
            {onCreateProjectClick ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sidebar-one__button sidebar-one__button--quick-action"
                    onClick={onCreateProjectClick}
                    aria-label="Create project"
                    type="button"
                  >
                    <div className="sidebar-one__button-container">
                      <Plus className="size-5" aria-hidden="true" />
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  New project
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>

        
          {/* User Account button */}
          <div className="sidebar-one__user-account-container">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sidebar-one__button"
                  onClick={onUserAccountClick}
                  aria-label="User Account"
                  type="button"
                >
                  <div className="sidebar-one__button-container">
                    <UserCircle className="size-5" aria-hidden="true" />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                User Account
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className="sidebar-one"
      style={{
        gridColumn: "1 / 2",
        gridRow: "1 / -1",
        width: `${sidebarOne.width}px`,
      }}
    >

        {content ?? defaultContent}
 
    </aside>
  );
}
