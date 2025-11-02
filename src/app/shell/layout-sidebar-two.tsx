import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/class-names";
import { CLIENT_VIEW_PREFIX } from "@/app/state/main-view";
import {
  CLIENT_CLEAR_EVENT,
  CLIENT_FOCUS_EVENT,
  type ClientFocusDetail,
} from "@/modules/clients/events";
import { PROJECT_CLEAR_EVENT, PROJECT_FOCUS_EVENT } from "@/modules/projects/events";
import {
  useLayoutActions,
  useLayoutSelector,
  useLayoutStoreApi,
  useSidebarTwoRegistrySelector,
} from "./layout-context";
import type { SidebarTwoActivationSource } from "./sidebar-two-registry/types";
import { useSidebarTwoEventBridge } from "./sidebar-two-registry/useSidebarTwoEventBridge";
import { useRegisterCoreSidebarTwoModules } from "./sidebar-two-modules/registerCoreSidebarTwoModules";

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
  const focusedProject = useLayoutSelector((state) => state.focusedProject);
  const currentViewRef = useRef<SidebarView>("projects");
  const projectViewTitle = "Project Workspace";

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useSidebarTwoEventBridge(currentViewRef);
  useRegisterCoreSidebarTwoModules();

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
      const custom = event as CustomEvent<
        { view?: string; clientName?: string; projectName?: string } | undefined
      >;
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
        const clientName = custom.detail?.clientName;
        setCurrentPage(clientName ? `Client: ${clientName}` : "Client");
        setCurrentView("client-detail");
        currentViewRef.current = "client-detail";
      } else if (view === "settings") {
        setCurrentPage("Settings");
        setCurrentView("settings");
      } else if (view === "editor" || view?.startsWith("editor:")) {
        setCurrentPage("Editor Menu");
        setCurrentView("editor");
      } else if (view?.startsWith("project:")) {
        setCurrentPage(projectViewTitle);
        setCurrentView("project");
        currentViewRef.current = "project";
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
      setCurrentPage(
        custom.detail.clientName.length > 0 ? `Client: ${custom.detail.clientName}` : "Client",
      );
      currentViewRef.current = "client-detail";
      setCurrentView("client-detail");
    };

    const handleClear = () => {
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

  useEffect(() => {
    const handleFocus = () => {
      setCurrentPage(projectViewTitle);
      currentViewRef.current = "project";
      setCurrentView("project");
    };

    const handleClear = () => {
      if (currentViewRef.current === "project") {
        currentViewRef.current = "projects";
        setCurrentPage("Projects");
        setCurrentView("projects");
      }
    };

    window.addEventListener(PROJECT_FOCUS_EVENT, handleFocus as EventListener);
    window.addEventListener(PROJECT_CLEAR_EVENT, handleClear);

    return () => {
      window.removeEventListener(PROJECT_FOCUS_EVENT, handleFocus as EventListener);
      window.removeEventListener(PROJECT_CLEAR_EVENT, handleClear);
    };
  }, []);

  useEffect(() => {
    if (focusedProject) {
      setCurrentPage(projectViewTitle);
      if (currentViewRef.current === "projects" || currentViewRef.current === "project") {
        currentViewRef.current = "project";
        setCurrentView("project");
      }
      return;
    }

    if (currentViewRef.current === "project") {
      currentViewRef.current = "projects";
      setCurrentPage("Projects");
      setCurrentView("projects");
    }
  }, [focusedProject]);

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

  const registryModules = useSidebarTwoRegistrySelector((state) => state.activeModules);
  const registryLegacyContent = useSidebarTwoRegistrySelector((state) => state.legacyContent);
const routeBindings = useSidebarTwoRegistrySelector((state) => state.routeBindings);
const { deactivateSidebarTwoModule, requestSidebarTwoFocus } = useLayoutActions((state) => ({
  deactivateSidebarTwoModule: (
    ...args: Parameters<typeof state.deactivateSidebarTwoModule>
  ) => state.deactivateSidebarTwoModule(...args),
  requestSidebarTwoFocus: (
    ...args: Parameters<typeof state.requestSidebarTwoFocus>
  ) => state.requestSidebarTwoFocus(...args),
}));

  useEffect(() => {
    const store = layoutStore.getState();
    const moduleIds = routeBindings[currentView] ?? [];
    for (const moduleId of moduleIds) {
      store.activateSidebarTwoModule({
        id: moduleId,
        view: currentView,
        activatedBy: "route",
      });
    }
    store.clearSidebarTwoModules({ scope: "route", viewKey: currentView });
  }, [currentView, layoutStore, routeBindings]);

  const modulesForCurrentView = useMemo(() => {
    const filtered = registryModules.filter((module) => {
      const allowed = module.context.allowedViews;
      return (
        allowed.includes("*") ||
        allowed.includes(currentView) ||
        module.context.view === currentView
      );
    });

    const priority = (source: SidebarTwoActivationSource) => {
      if (source === "route") {
        return 0;
      }
      if (source === "manual") {
        return 1;
      }
      if (source === "event") {
        return 2;
      }
      return 3;
    };

    return filtered
      .slice()
      .sort((a, b) => {
        const sourceComparison = priority(a.context.activatedBy) - priority(b.context.activatedBy);
        if (sourceComparison !== 0) {
          return sourceComparison;
        }
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return a.id.localeCompare(b.id);
      });
  }, [registryModules, currentView]);

  const renderedModules = useMemo(
    () =>
      modulesForCurrentView.map((module) => {
        const ModuleComponent = module.component;
        const handleDeactivate = () =>
          deactivateSidebarTwoModule(module.id, module.persist ? "cache" : "remove");
        return (
          <ModuleComponent
            key={module.id}
            context={module.context}
            payload={module.payload}
            deactivate={handleDeactivate}
            requestFocus={requestSidebarTwoFocus}
          />
        );
      }),
    [modulesForCurrentView, deactivateSidebarTwoModule, requestSidebarTwoFocus],
  );

  useEffect(() => {
    const focusTarget = modulesForCurrentView.find((module) => module.focusTargetId)?.focusTargetId ?? null;
    layoutStore.getState().setSidebarTwoFocusTarget(focusTarget);
  }, [layoutStore, modulesForCurrentView]);

  const content = useMemo(() => {
    if (children) {
      return children;
    }
    if (renderedModules.length > 0) {
      return renderedModules;
    }
    return registryLegacyContent;
  }, [children, renderedModules, registryLegacyContent]);

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
