import { useEffect, useState } from "react";

import type { SidebarTwoModuleDefinition, SidebarTwoModuleProps } from "@/app/shell/sidebar-two-registry/types";
import { DashboardQuickActions } from "@/app/shell/sidebar-two-content/DashboardQuickActions";
import {
  CLIENT_CLEAR_EVENT,
  CLIENT_FOCUS_EVENT,
  type ClientFocusDetail,
} from "@/modules/clients/events";

export interface DashboardQuickActionsPayload {
  focusedClient?: ClientFocusDetail | null;
  view?: "dashboard" | "clients" | "client-detail";
}

export const DASHBOARD_QUICK_ACTIONS_MODULE_ID = "dashboard:quick-actions";

function DashboardQuickActionsModule({ context }: SidebarTwoModuleProps<DashboardQuickActionsPayload>) {
  const [focusedClient, setFocusedClient] = useState<ClientFocusDetail | null>(
    context.payload?.focusedClient ?? null,
  );

  useEffect(() => {
    const handleFocus = (event: Event) => {
      const custom = event as CustomEvent<ClientFocusDetail>;
      setFocusedClient(custom.detail);
    };

    const handleClear = () => {
      setFocusedClient(null);
    };

    window.addEventListener(CLIENT_FOCUS_EVENT, handleFocus as EventListener);
    window.addEventListener(CLIENT_CLEAR_EVENT, handleClear);

    return () => {
      window.removeEventListener(CLIENT_FOCUS_EVENT, handleFocus as EventListener);
      window.removeEventListener(CLIENT_CLEAR_EVENT, handleClear);
    };
  }, []);

  const activeView = (() => {
    if (context.view === "client-detail") {
      return "client-detail" as const;
    }
    if (context.view === "clients") {
      return "clients" as const;
    }
    return "dashboard" as const;
  })();

  return <DashboardQuickActions activeView={activeView} focusedClient={focusedClient} />;
}

export const dashboardQuickActionsModuleDefinition: SidebarTwoModuleDefinition<DashboardQuickActionsPayload> = {
  id: DASHBOARD_QUICK_ACTIONS_MODULE_ID,
  label: "Dashboard Quick Actions",
  scope: "route",
  routes: ["dashboard", "clients", "client-detail"],
  order: 0,
  loader: {
    kind: "component",
    component: DashboardQuickActionsModule,
  },
};

