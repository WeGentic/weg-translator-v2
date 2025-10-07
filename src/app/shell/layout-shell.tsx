import type { PropsWithChildren } from "react";

import { useLayoutSelector } from "./layout-context";
import type { SidebarOneState, SidebarTwoState } from "./layout-store";
import "@/shared/styles/layout/layout-shell.css";

/**
 * Calculates the width for the new fixed sidebar one.
 */
function calculateSidebarOneWidth(state: SidebarOneState): number {
  if (!state.mounted) {
    return 0;
  }
  return state.width;
}

/**
 * Calculates the width for sidebar two.
 */
function calculateSidebarTwoWidth(state: SidebarTwoState): number {
  if (!state.mounted || !state.visible) {
    return 0;
  }
  return state.width;
}

/**
 * High-level frame that arranges the background surface, sidebar rails, and
 * main content. Every slot component mounts inside this shell so layout metrics
 * stay coordinated.
 */
export function LayoutShell({ children }: PropsWithChildren) {
  const sidebarOne = useLayoutSelector((state) => state.sidebarOne);
  const sidebarTwo = useLayoutSelector((state) => state.sidebarTwo);

  // Footer is now position:fixed, so it should not reserve grid space (set to 0)
  const footerHeight = 0;
  const sidebarOneWidth = calculateSidebarOneWidth(sidebarOne);
  const sidebarTwoWidth = calculateSidebarTwoWidth(sidebarTwo);

  // The grid template arranges two rows (main content and a spacer for the fixed footer)
  // and three columns (sidebarOne + sidebarTwo + main content). We translate runtime
  // state into CSS so transitions and conditional mounting stay in sync automatically.
  const templateRows = `1fr ${footerHeight}px`;
  const templateColumns = `${sidebarOneWidth}px ${sidebarTwoWidth}px minmax(0, 1fr)`;

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
