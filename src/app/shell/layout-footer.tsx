import { useEffect, type PropsWithChildren } from "react";

import "@/shared/styles/layout/layout-footer.css";

import { useLayoutSelector, useLayoutStoreApi } from "./layout-context";
import { DEFAULT_FOOTER_HEIGHT } from "./layout-store";

/**
 * Public props accepted by {@link LayoutFooter}. Visibility and height are
 * optional overrides that persist while the component is mounted.
 */
export interface LayoutFooterProps extends PropsWithChildren {
  visible?: boolean;
  height?: number;
}

/**
 * Footer slot that synchronizes its lifecycle with the layout store and falls
 * back to globally configured content when no children are provided.
 */
export function LayoutFooter({ children, visible, height }: LayoutFooterProps) {
  const layoutStore = useLayoutStoreApi();
  const footer = useLayoutSelector((state) => state.footer);
  const footerContent = useLayoutSelector((state) => state.footerContent);

  useEffect(() => {
    const store = layoutStore;
    store.getState().setFooter({
      mounted: true,
      ...(visible !== undefined ? { visible } : {}),
      ...(height !== undefined ? { height } : {}),
    });
    return () => {
      store.getState().setFooter({
        mounted: false,
        height: height ?? DEFAULT_FOOTER_HEIGHT,
      });
    };
  }, [layoutStore, visible, height]);

  const content = children ?? footerContent;

  if (!footer.mounted || !content) {
    return null;
  }

  return (
    <footer
      role="contentinfo"
      className="layout-footer"
      style={{
        visibility: footer.visible ? "visible" : "hidden",
      }}
    >
      {content}
    </footer>
  );
}
