import { useEffect, type ReactNode } from "react";

import { useLayoutStoreApi } from "./layout-context";
import type { BackgroundState } from "./layout-store";

/**
 * Props accepted by {@link LayoutBackground}. When `children` is supplied we
 * treat the slot as the definitive background element; otherwise we merge the
 * visibility/mount flags into the existing store state.
 */
export interface LayoutBackgroundProps {
  children?: ReactNode;
  visible?: boolean;
  mounted?: boolean;
}

/**
 * Background slot responsible for orchestrating transitions between injected
 * background React nodes and configuration-driven fallbacks.
 */
export function LayoutBackground({ children, visible, mounted = true }: LayoutBackgroundProps) {
  const layoutStore = useLayoutStoreApi();

  useEffect(() => {
    if (children === undefined) {
      return;
    }
    const store = layoutStore;
    store.getState().setBackground({
      mounted,
      element: children,
      ...(visible !== undefined ? { visible } : {}),
    });
    return () => {
      store.getState().setBackground({ element: null, mounted: false });
    };
  }, [layoutStore, children, visible, mounted]);

  useEffect(() => {
    if (children !== undefined) {
      return;
    }
    const patch: Partial<BackgroundState> = {};
    if (visible !== undefined) {
      patch.visible = visible;
    }
    if (mounted !== undefined) {
      patch.mounted = mounted;
    }
    if (Object.keys(patch).length > 0) {
      layoutStore.getState().setBackground(patch);
    }
  }, [layoutStore, children, visible, mounted]);

  return null;
}
