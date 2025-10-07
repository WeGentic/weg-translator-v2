import { useEffect } from "react";

import { useLayoutStoreApi } from "./layout-context";
import type { LayoutConfig } from "./layout-store";

/**
 * Props accepted by {@link LayoutController}. The provided config will be
 * merged into the store immediately and whenever the object identity changes.
 */
export interface LayoutControllerProps {
  config: LayoutConfig;
}

/**
 * Lightweight helper component that allows route-level static data to patch the
 * layout configuration without needing direct access to the store.
 */
export function LayoutController({ config }: LayoutControllerProps) {
  const layoutStore = useLayoutStoreApi();

  useEffect(() => {
    layoutStore.getState().applyConfig(config);
  }, [layoutStore, config]);

  return null;
}
