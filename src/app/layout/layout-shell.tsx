import type { PropsWithChildren } from "react";

import { useLayoutSelector } from "./layout-context";
import type { LayoutState } from "./layout-store";
import "./css-styles/layout-shell.css";

/**
 * Calculates the width that should be reserved for the sidemenu column given
 * the current {@link LayoutState.sidemenu} configuration.
 */
function calculateSidebarWidth(state: LayoutState["sidemenu"]): number {
  if (!state.mounted || state.mode === "unmounted") {
    return 0;
  }
  if (state.mode === "hidden") {
    return 0;
  }
  if (state.mode === "compact") {
    return state.compactWidth;
  }
  return state.expandedWidth;
}

/**
 * High-level frame that arranges the background surface and the grid used for
 * header, main content, sidemenu, and footer. Every slot component mounts
 * inside this shell so we can update layout metrics centrally.
 */
export function LayoutShell({ children }: PropsWithChildren) {
  const header = useLayoutSelector((state) => state.header);
  const footer = useLayoutSelector((state) => state.footer);
  const sidemenu = useLayoutSelector((state) => state.sidemenu);

  const headerHeight = header.mounted && header.visible ? header.height : 0;
  const footerHeight = footer.mounted && footer.visible ? footer.height : 0;
  const sidebarWidth = calculateSidebarWidth(sidemenu);

  // The grid template arranges three rows (header, main, footer) and two
  // columns (sidemenu + main content). We translate runtime state into CSS so
  // transitions and conditional mounting stay in sync automatically.
  const templateRows = `${headerHeight}px 1fr ${footerHeight}px`;
  const templateColumns = `${sidebarWidth}px minmax(0, 1fr)`;

  return (
    <div className="layout-shell">
      <BackgroundSurface />
      <div
        className="layout-shell__grid"
        style={{
          gridTemplateRows: templateRows,
          gridTemplateColumns: templateColumns,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Renders the currently active background layer underneath the grid. The
 * background may be driven by user configuration or by slot content supplied
 * through {@link MainLayout.Background}.
 */
function BackgroundSurface() {
  const background = useLayoutSelector((state) => state.background);

  if (!background.mounted || !background.visible) {
    return null;
  }

  return (
    <div className="layout-shell__background">
      {background.element ?? <div className="layout-shell__background-fallback" />}
    </div>
  );
}
