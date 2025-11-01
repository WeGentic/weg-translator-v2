import type { SidebarTwoModuleDefinition, SidebarTwoModuleProps } from "@/app/shell/sidebar-two-registry/types";
import { ComingSoon } from "@/app/shell/sidebar-two-content/ComingSoon";

type ResourceComingSoonPayload = Record<string, never>;

export const RESOURCE_COMING_SOON_MODULE_ID = "resource:placeholder";

function ResourceComingSoonModule(props: SidebarTwoModuleProps<ResourceComingSoonPayload>) {
  void props;
  return <ComingSoon />;
}

export const resourceComingSoonModuleDefinition: SidebarTwoModuleDefinition<ResourceComingSoonPayload> = {
  id: RESOURCE_COMING_SOON_MODULE_ID,
  label: "Resources Placeholder",
  scope: "route",
  routes: ["resource"],
  order: 0,
  loader: {
    kind: "component",
    component: ResourceComingSoonModule,
  },
};
