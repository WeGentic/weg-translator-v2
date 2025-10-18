import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/class-names";
import { CLIENT_VIEW_PREFIX } from "@/app/state/main-view";
import {
  CLIENT_CLEAR_EVENT,
  CLIENT_FOCUS_EVENT,
  type ClientFocusDetail,
} from "@/modules/clients/events";
import { useLayoutSelector, useLayoutStoreApi } from "./layout-context";
import { DashboardQuickActions } from "./sidebar-two-content/DashboardQuickActions";
import { EditorMenu } from "./sidebar-two-content/EditorMenu";
import { ComingSoon } from "./sidebar-two-content/ComingSoon";

import "@/shared/styles/layout/layout-sidebar-two.css";

/**
 * Props for {@link LayoutSidebarTwo}. Consumers can customize width, visibility, and content.
 */
export interface LayoutSidebarTwoProps extends PropsWithChildren {
  width?: number;
  visible?: boolean;
}

/**
 * Secondary sidebar positioned directly after Sidebar_one.
 * Width is 3x Sidebar_one (192px by default). Can be toggled visible/hidden.
 * Full height, minimal styling, clean container ready for content.
 */
export function LayoutSidebarTwo({
  children,
  width = 192,
  visible = true,
}: LayoutSidebarTwoProps) {
  const layoutStore = useLayoutStoreApi();
  const sidebarTwo = useLayoutSelector((state) => state.sidebarTwo);
  const sidebarTwoContent = useLayoutSelector((state) => state.sidebarTwoContent);
  type SidebarView =
    | "projects"
    | "dashboard"
    | "resource"
    | "clients"
    | "settings"
    | "editor"
    | "project"
    | "client-detail";

  const [currentPage, setCurrentPage] = useState<string>("Projects");
  const [currentView, setCurrentView] = useState<SidebarView>("projects");
  const [focusedClient, setFocusedClient] = useState<ClientFocusDetail | null>(null);
  const currentViewRef = useRef<SidebarView>("projects");

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setSidebarTwo({
      mounted: true,
      visible,
      width,
    });
    return () => {
      store.getState().setSidebarTwo({ mounted: false });
    };
  }, [layoutStore, width, visible]);

  // Listen for navigation events to update the page title and current view
  useEffect(() => {
    const handler: EventListener = (event) => {
      const custom = event as CustomEvent<{ view?: string; clientName?: string } | undefined>;
      const view = custom.detail?.view;

      if (view === "projects") {
        setCurrentPage("Projects");
        setCurrentView("projects");
      } else if (view === "dashboard") {
        setCurrentPage("Quick Actions");
        setCurrentView("dashboard");
      } else if (view === "resource") {
        setCurrentPage("Resources");
        setCurrentView("resource");
      } else if (view === "clients") {
        setCurrentPage("Quick Actions");
        setCurrentView("clients");
      } else if (view?.startsWith(CLIENT_VIEW_PREFIX)) {
        const clientId = view.slice(CLIENT_VIEW_PREFIX.length);
        const clientName = custom.detail?.clientName;
        setCurrentPage(clientName ? `Client: ${clientName}` : "Client");
        setCurrentView("client-detail");
        currentViewRef.current = "client-detail";
        setFocusedClient((previous) => ({
          clientUuid: clientId,
          clientName: clientName ?? previous?.clientName ?? "Client",
        }));
      } else if (view === "settings") {
        setCurrentPage("Settings");
        setCurrentView("settings");
      } else if (view === "editor" || view?.startsWith("editor:")) {
        setCurrentPage("Editor Menu");
        setCurrentView("editor");
      } else if (view?.startsWith("project:")) {
        // Extract project name if available
        const projectName = view.split(":")[1];
        setCurrentPage(projectName ? `Project: ${projectName}` : "Project");
        setCurrentView("project");
      } else if (view) {
        setCurrentPage(view.charAt(0).toUpperCase() + view.slice(1));
        setCurrentView("projects");
      }
    };

    window.addEventListener("app:navigate", handler);
    return () => window.removeEventListener("app:navigate", handler);
  }, []);

  // Listen for custom sidebar title updates (for dynamic content like Overview vs Projects)
  useEffect(() => {
    const handler: EventListener = (event) => {
      const custom = event as CustomEvent<{ title?: string } | undefined>;
      const title = custom.detail?.title;
      if (title) {
        setCurrentPage(title);
      }
    };

    window.addEventListener("sidebar-two:title", handler);
    return () => window.removeEventListener("sidebar-two:title", handler);
  }, []);

  useEffect(() => {
    const handleFocus = (event: Event) => {
      const custom = event as CustomEvent<ClientFocusDetail>;
      setFocusedClient(custom.detail);
      setCurrentPage(
        custom.detail.clientName.length > 0 ? `Client: ${custom.detail.clientName}` : "Client",
      );
      currentViewRef.current = "client-detail";
      setCurrentView("client-detail");
    };

    const handleClear = () => {
      setFocusedClient(null);
      const wasFocused = currentViewRef.current === "client-detail";
      if (wasFocused) {
        currentViewRef.current = "clients";
      }
      setCurrentPage((previous) => (wasFocused ? "Quick Actions" : previous));
      setCurrentView((previous) => (wasFocused ? "clients" : previous));
    };

    window.addEventListener(CLIENT_FOCUS_EVENT, handleFocus as EventListener);
    window.addEventListener(CLIENT_CLEAR_EVENT, handleClear);

    return () => {
      window.removeEventListener(CLIENT_FOCUS_EVENT, handleFocus as EventListener);
      window.removeEventListener(CLIENT_CLEAR_EVENT, handleClear);
    };
  }, []);

  // Auto-hide sidebar when on Settings view
  useEffect(() => {
    const store = layoutStore;
    if (currentView === "settings") {
      store.getState().setSidebarTwo({ visible: false });
    } else if (!sidebarTwo.visible) {
      // Restore visibility when leaving Settings (unless manually hidden)
      store.getState().setSidebarTwo({ visible: true });
    }
  }, [currentView, layoutStore, sidebarTwo.visible]);

  const handleToggleVisibility = () => {
    const store = layoutStore;
    const currentVisible = store.getState().sidebarTwo.visible;
    store.getState().setSidebarTwo({ visible: !currentVisible });
  };

  /**
   * Get dynamic content based on current view
   */
  const getDynamicContent = () => {
    // Children prop always takes highest priority
    if (children) {
      return children;
    }

    // Return view-specific content based on current route
    switch (currentView) {
      case "dashboard":
        return <DashboardQuickActions activeView="dashboard" />;
      case "clients":
        return (
          <DashboardQuickActions
            activeView="clients"
            focusedClient={focusedClient}
          />
        );
      case "client-detail":
        return (
          <DashboardQuickActions
            activeView="client-detail"
            focusedClient={focusedClient}
          />
        );
      case "editor":
        return <EditorMenu />;
      case "resource":
        return <ComingSoon />;
      case "projects":
      case "project":
        // Projects view uses sidebarTwoContent from context (the project manager content)
        return sidebarTwoContent;
      default:
        // Fallback to sidebarTwoContent for any other view
        return sidebarTwoContent;
    }
  };

  const content = getDynamicContent();

  if (!sidebarTwo.mounted) {
    return null;
  }

  const isVisible = sidebarTwo.visible;

  return (
    <aside
      role="complementary"
      aria-label="Secondary navigation"
      className="sidebar-two"
      style={{
        gridColumn: "2 / 3",
        gridRow: "1 / -1",
        width: isVisible ? `${sidebarTwo.width}px` : "0px",
        visibility: isVisible ? "visible" : "hidden",
        opacity: isVisible ? 1 : 0,
      }}
    >
      {isVisible && (
        <>
          {/* Header Zone */}
          <header className="sidebar-two__header">
            <div className="sidebar-two__header-content">
              {/* Dynamic Page Text */}
              <div className="sidebar-two__page-title" aria-live="polite" aria-atomic="true">
                <span className="sidebar-two__page-title-text">{currentPage}</span>
              </div>
              

              {/* Hide/Unhide Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                className="sidebar-two__toggle-button"
                onClick={handleToggleVisibility}
                aria-label={isVisible ? "Hide sidebar" : "Show sidebar"}
                aria-pressed={isVisible}
                type="button"
              >
                <div className={cn("sidebar-two__toggle-icon-wrapper", !isVisible && "sidebar-two__toggle-icon-wrapper--hidden")}>
                  <ChevronLeft className="sidebar-two__toggle-icon" aria-hidden="true" />
                </div>
              </Button>
            </div>

           
          </header>
          {/* Horizontal Separator */}
          <div className="sidebar-one__logo-divider" aria-hidden="true" />

          {/* Scrollable Content Area */}
          <div className="sidebar-two__content">
            {content ?? (
              <div className="sidebar-two__placeholder">
                {/* Empty placeholder for future content */}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
