import { useEffect, useRef } from "react";

import { useLayoutStoreApi } from "@/app/shell/layout-context";

import type { SidebarTwoModuleDefinition } from "@/app/shell/sidebar-two-registry/types";
import { dashboardQuickActionsModuleDefinition } from "./dashboardQuickActionsModule";
import { editorMenuModuleDefinition } from "./editorMenuModule";
import { resourceComingSoonModuleDefinition } from "./resourceComingSoonModule";

const coreDefinitions: ReadonlyArray<SidebarTwoModuleDefinition<unknown>> = [
  dashboardQuickActionsModuleDefinition as SidebarTwoModuleDefinition<unknown>,
  editorMenuModuleDefinition as SidebarTwoModuleDefinition<unknown>,
  resourceComingSoonModuleDefinition as SidebarTwoModuleDefinition<unknown>,
];

export function useRegisterCoreSidebarTwoModules() {
  const layoutStore = useLayoutStoreApi();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) {
      return;
    }
    const store = layoutStore.getState();
    for (const definition of coreDefinitions) {
      store.registerSidebarTwoModule(definition);
    }
    registeredRef.current = true;
  }, [layoutStore]);
}
