import { useEffect, type PropsWithChildren } from "react";

import "./css-styles/layout-sidemenu.css";

import { useLayoutSelector, useLayoutStoreApi } from "./layout-context";
import type { SidemenuMode } from "./layout-store";

/**
 * Props for {@link LayoutSidemenu}. Consumers can toggle modes and custom
 * widths to accommodate different navigation footprints.
 */
export interface LayoutSidemenuProps extends PropsWithChildren {
  mode?: SidemenuMode;
  compactWidth?: number;
  expandedWidth?: number;
}

/**
 * Navigation slot that manages sidemenu visibility, sizing, and content. The
 * layout grid relies on this component to publish its lifecycle state so the
 * shell can reserve the correct column width.
 */
export function LayoutSidemenu({ children, mode, compactWidth, expandedWidth }: LayoutSidemenuProps) {
  const layoutStore = useLayoutStoreApi();
  const sidemenu = useLayoutSelector((state) => state.sidemenu);
  const sidemenuContent = useLayoutSelector((state) => state.sidemenuContent);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setSidemenu({
      mounted: true,
      ...(mode ? { mode } : {}),
      ...(compactWidth !== undefined ? { compactWidth } : {}),
      ...(expandedWidth !== undefined ? { expandedWidth } : {}),
    });
    return () => {
      store.getState().setSidemenu({ mounted: false, mode: "unmounted" });
    };
  }, [layoutStore, mode, compactWidth, expandedWidth]);

  const content = children ?? sidemenuContent;

  if (!sidemenu.mounted || sidemenu.mode === "unmounted" || !content) {
    return null;
  }

  const isHidden = sidemenu.mode === "hidden";

  return (
    <aside
      role="navigation"
      className="layout-sidemenu"
      style={{
        gridColumn: "3 / 4",
        gridRow: "2 / 3",
        visibility: isHidden ? "hidden" : "visible",
      }}
    >
      {content}
    </aside>
  );
}
