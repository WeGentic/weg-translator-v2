import { useLayoutStoreApi } from "@/app/layout";
import { AppSidebar, type MenuItem } from "@/app/layout/main_elements";
import { FiBarChart2, FiBookOpen, FiGrid, FiMessageSquare, FiX } from "react-icons/fi";

const editorItems: MenuItem[] = [
  { key: "editor:segments", label: "Segments", icon: FiGrid },
  { key: "editor:glossary", label: "Glossary", icon: FiBookOpen },
  { key: "editor:comments", label: "Comments", icon: FiMessageSquare },
  { key: "editor:insights", label: "Insights", icon: FiBarChart2 },
];

const defaultSelection = editorItems[0]?.key ?? "editor:segments";
const noopSelect = () => {};

/**
 * Editor mode reuses the standard sidebar chrome so the compact rail stays
 * visually consistent with project navigation, while filling it with temporary
 * placeholders until editor tooling ships.
 */
export function EditorSidebarPlaceholder() {
  const layoutStore = useLayoutStoreApi();

  return (
    <AppSidebar
      fixedItems={editorItems}
      temporaryItems={[]}
      editorItems={[]}
      selectedKey={defaultSelection}
      onSelect={noopSelect}
      floating={true}
      showToggleButton={false}
      header={
        <div className="flex w-full items-center gap-3 px-2">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-primary/20 text-[10px] font-semibold text-primary">
            Ed
          </div>
          <div className="flex flex-1 flex-col">
            <div className="text-sm font-bold">Editor tools</div>
            <div className="text-xs text-muted-foreground">Placeholder navigation</div>
          </div>
          <button
            className="app-sidebar__close-btn"
            onClick={() => layoutStore.getState().setSidemenu({ mode: "hidden" })}
            aria-label="Hide sidebar"
            type="button"
          >
            <FiX className="size-4" />
          </button>
        </div>
      }
      footer={
        <div className="px-2 pb-3 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
          Editor sidebar placeholder
        </div>
      }
    />
  );
}

export default EditorSidebarPlaceholder;
