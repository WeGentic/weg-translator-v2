import type { SidebarTwoModuleDefinition, SidebarTwoModuleProps } from "@/app/shell/sidebar-two-registry/types";
import { EditorMenu } from "@/app/shell/sidebar-two-content/EditorMenu";

export interface EditorMenuPayload {}

export const EDITOR_MENU_MODULE_ID = "editor:menu";

function EditorMenuModule(_props: SidebarTwoModuleProps<EditorMenuPayload>) {
  return <EditorMenu />;
}

export const editorMenuModuleDefinition: SidebarTwoModuleDefinition<EditorMenuPayload> = {
  id: EDITOR_MENU_MODULE_ID,
  label: "Editor Menu",
  scope: "route",
  routes: ["editor"],
  order: 1,
  loader: {
    kind: "component",
    component: EditorMenuModule,
  },
};
