import { useEffect, useRef } from "react";

import { useLayoutStoreApi } from "@/app/shell/layout-context";
import type { SidebarTwoModuleDefinition } from "@/app/shell/sidebar-two-registry/types";
import { projectSelectionModuleDefinition } from "./projectSelectionModule";
import { projectFocusModuleDefinition } from "./projectFocusModule";

const moduleDefinitions: ReadonlyArray<SidebarTwoModuleDefinition<unknown>> = [
  projectFocusModuleDefinition as SidebarTwoModuleDefinition<unknown>,
  projectSelectionModuleDefinition as SidebarTwoModuleDefinition<unknown>,
];

export function useRegisterProjectSidebarModules() {
  const layoutStore = useLayoutStoreApi();
  const hasRegisteredRef = useRef(false);

  useEffect(() => {
    if (hasRegisteredRef.current) {
      return;
    }
    const store = layoutStore.getState();
    for (const definition of moduleDefinitions) {
      store.registerSidebarTwoModule(definition);
    }
    hasRegisteredRef.current = true;
  }, [layoutStore]);
}
