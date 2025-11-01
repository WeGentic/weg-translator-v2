import { useEffect } from "react";

import { useLayoutStoreApi } from "../layout-context";
import { useSidebarTwoRegistrySelector } from "../layout-context";
import type { SidebarTwoEventResult } from "./types";

type ViewRef = {
  current: string;
};

function resolveTargetView(
  result: SidebarTwoEventResult<unknown> | null | undefined,
  currentViewRef: ViewRef,
  fallbackRoutes: ReadonlyArray<string> | undefined,
): string {
  if (result?.view && result.view.length > 0) {
    return result.view;
  }

  if (currentViewRef.current && currentViewRef.current.length > 0) {
    return currentViewRef.current;
  }

  if (fallbackRoutes && fallbackRoutes.length > 0) {
    return fallbackRoutes[0];
  }

  return "projects";
}

/**
 * Hooks browser-level CustomEvents into the sidebar registry. Modules that
 * declare `trigger` metadata are activated or deactivated whenever their
 * corresponding events fire.
 */
export function useSidebarTwoEventBridge(currentViewRef: ViewRef) {
  const layoutStore = useLayoutStoreApi();
  const eventBindings = useSidebarTwoRegistrySelector((state) => state.eventBindings);

  useEffect(() => {
    const handlers = new Map<string, EventListener>();

    for (const eventName of Object.keys(eventBindings)) {
      if (handlers.has(eventName)) {
        continue;
      }

      const handler: EventListener = (event) => {
        const store = layoutStore.getState();
        const registry = store.sidebarTwoRegistry;
        const moduleIds = registry.eventBindings[eventName] ?? [];
        if (moduleIds.length === 0) {
          return;
        }

        for (const moduleId of moduleIds) {
          const definition = registry.definitions[moduleId];
          if (!definition?.trigger) {
            continue;
          }

          if (!(event instanceof CustomEvent)) {
            continue;
          }

          const custom: CustomEvent<unknown> = event;
          const fallbackResult: SidebarTwoEventResult<unknown> = {
            payload: custom.detail,
          };
          const result = definition.trigger.mapEvent?.(custom) ?? fallbackResult;

          if (!result) {
            continue;
          }

          const action = result.action ?? "activate";

          if (action === "deactivate") {
            store.deactivateSidebarTwoModule(moduleId, definition.persist ? "cache" : "remove");
            continue;
          }

          const targetView = resolveTargetView(result, currentViewRef, definition.routes);
          store.activateSidebarTwoModule({
            id: moduleId,
            view: targetView,
            payload: result.payload,
            allowedViews: result.allowedViews ?? definition.trigger.allowedViews,
            activatedBy: "event",
          });
        }
      };

      handlers.set(eventName, handler);
      window.addEventListener(eventName, handler);
    }

    return () => {
      for (const [eventName, handler] of handlers) {
        window.removeEventListener(eventName, handler);
      }
    };
  }, [layoutStore, eventBindings, currentViewRef]);
}
