import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";

import { useLayoutStoreApi } from "@/app/layout/layout-context";
import type { SidebarTwoState } from "@/app/layout/layout-store";

export interface SidebarController {
  ensureMounted(): void;
  setContent(content: ReactNode, statePatch?: Partial<SidebarTwoState>): void;
  show(statePatch?: Partial<SidebarTwoState>): void;
  hide(): void;
  reset(): void;
}

function mergeSidebarPatch(patch?: Partial<SidebarTwoState>): Partial<SidebarTwoState> {
  if (!patch) {
    return {
      mounted: true,
      visible: true,
    };
  }

  return {
    mounted: patch.mounted ?? true,
    visible: patch.visible ?? true,
    width: patch.width,
  };
}

export function useSidebarController(): SidebarController {
  const layoutStore = useLayoutStoreApi();

  const ensureMounted = useCallback(() => {
    const store = layoutStore.getState();
    store.setSidebarTwo({ mounted: true, visible: true });
  }, [layoutStore]);

  const setContent = useCallback(
    (content: ReactNode, statePatch?: Partial<SidebarTwoState>) => {
      const store = layoutStore.getState();
      store.setSidebarTwo(mergeSidebarPatch(statePatch));
      store.setSidebarTwoContent(content);
    },
    [layoutStore],
  );

  const show = useCallback(
    (statePatch?: Partial<SidebarTwoState>) => {
      const store = layoutStore.getState();
      store.setSidebarTwo(mergeSidebarPatch(statePatch));
    },
    [layoutStore],
  );

  const hide = useCallback(() => {
    const store = layoutStore.getState();
    store.setSidebarTwo({ visible: false });
  }, [layoutStore]);

  const reset = useCallback(() => {
    const store = layoutStore.getState();
    store.setSidebarTwoContent(null);
    store.setSidebarTwo({ visible: false, mounted: false });
  }, [layoutStore]);

  return useMemo(
    () => ({
      ensureMounted,
      setContent,
      show,
      hide,
      reset,
    }),
    [ensureMounted, setContent, show, hide, reset],
  );
}
