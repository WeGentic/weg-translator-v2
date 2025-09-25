import { useEffect, type PropsWithChildren } from "react";

import "./css-styles/layout-header.css";

import { useLayoutSelector, useLayoutStoreApi } from "./layout-context";
import { DEFAULT_HEADER_HEIGHT } from "./layout-store";

/**
 * Public props accepted by {@link LayoutHeader}. Slot components can override
 * visibility and height per usage, while the store still tracks the canonical
 * values for other parts of the UI (e.g. the grid shell).
 */
export interface LayoutHeaderProps extends PropsWithChildren {
  visible?: boolean;
  height?: number;
}

/**
 * Declarative header slot that registers itself with the layout store, keeps
 * the grid dimensions in sync, and renders either local children or previously
 * configured store content.
 */
export function LayoutHeader({ children, visible, height }: LayoutHeaderProps) {
  const layoutStore = useLayoutStoreApi();
  const header = useLayoutSelector((state) => state.header);
  const headerContent = useLayoutSelector((state) => state.headerContent);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setHeader({
      mounted: true,
      ...(visible !== undefined ? { visible } : {}),
      ...(height !== undefined ? { height } : {}),
    });
    return () => {
      store.getState().setHeader({
        mounted: false,
        height: height ?? DEFAULT_HEADER_HEIGHT,
      });
    };
  }, [layoutStore, visible, height]);

  const content = children ?? headerContent;

  if (!header.mounted || !content) {
    return null;
  }

  return (
    <header
      role="banner"
      className="layout-header"
      style={{
        gridColumn: "1 / span 2",
        gridRow: "1 / 2",
        visibility: header.visible ? "visible" : "hidden",
      }}
    >
      {content}
    </header>
  );
}
