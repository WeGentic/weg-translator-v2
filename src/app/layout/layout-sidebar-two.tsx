import { useEffect, useState, type PropsWithChildren } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLayoutSelector, useLayoutStoreApi } from "./layout-context";

import "./css-styles/layout-sidebar-two.css";

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
  const [currentPage, setCurrentPage] = useState<string>("Projects");

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

  // Listen for navigation events to update the page title
  useEffect(() => {
    const handler: EventListener = (event) => {
      const custom = event as CustomEvent<{ view?: string } | undefined>;
      const view = custom.detail?.view;

      if (view === "projects") {
        setCurrentPage("Projects");
      } else if (view === "settings") {
        setCurrentPage("Settings");
      } else if (view === "editor" || view?.startsWith("editor:")) {
        setCurrentPage("Editor");
      } else if (view?.startsWith("project:")) {
        // Extract project name if available
        const projectName = view.split(":")[1];
        setCurrentPage(projectName ? `Project: ${projectName}` : "Project");
      } else if (view) {
        // Capitalize first letter of any other view
        setCurrentPage(view.charAt(0).toUpperCase() + view.slice(1));
      }
    };

    window.addEventListener("app:navigate", handler);
    return () => window.removeEventListener("app:navigate", handler);
  }, []);

  const handleToggleVisibility = () => {
    const store = layoutStore;
    const currentVisible = store.getState().sidebarTwo.visible;
    store.getState().setSidebarTwo({ visible: !currentVisible });
  };

  const content = children ?? sidebarTwoContent;

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
