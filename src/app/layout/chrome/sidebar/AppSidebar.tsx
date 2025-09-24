import type { ComponentType, CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";

import { useLayoutSelector } from "@/app/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Describes a navigation affordance rendered in the application sidebar.
 * The optional {@link MenuItem.onClose} handler enables detachable tabs.
 */
export type MenuItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  route?: string;
  badge?: number | string;
  onClose?: () => void;
};

const EMPTY_MENU_ITEMS: MenuItem[] = [];

/**
 * Props contract for {@link AppSidebar}; exported so consuming components can share the shape.
 */
type AppSidebarProps = {
  fixedItems: MenuItem[];
  temporaryItems?: MenuItem[];
  editorItems?: MenuItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  className?: string;
  floating?: boolean;
  style?: CSSProperties;
};

/**
 * Application sidebar that unifies workspace navigation, open project tabs, and editor shortcuts.
 * The component remains purely presentational so the React Compiler can optimise re-renders.
 */
export function AppSidebar({
  fixedItems,
  temporaryItems = EMPTY_MENU_ITEMS,
  editorItems = EMPTY_MENU_ITEMS,
  selectedKey,
  onSelect,
  className,
  floating = true,
  style,
}: AppSidebarProps) {
  const sidemenu = useLayoutSelector((state) => state.sidemenu);
  const mode = sidemenu.mode;

  if (!sidemenu.mounted || mode === "unmounted" || mode === "hidden") {
    return null;
  }

  const container = cn(
    floating && "fixed left-3 top-0 z-40",
    "flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-transparent shadow-lg backdrop-blur transition-[width] duration-200",
    className,
  );

  const effectiveMode = mode === "compact" ? "compact" : "expanded";
  const sidebarWidth = effectiveMode === "compact" ? sidemenu.compactWidth : sidemenu.expandedWidth;

  const settingsItem = fixedItems.find((item) => item.key === "settings");
  const topFixedItems = fixedItems.filter((item) => item.key !== "settings");

  /**
   * Renders a nav item while accounting for compact mode, badges, and optional close affordance.
   */
  const renderItem = (
    item: MenuItem,
    options?: { isTemporary?: boolean; className?: string; children?: ReactNode },
  ) => {
    const isTemporary = options?.isTemporary ?? false;
    const active = selectedKey === item.key;
    const closable = isTemporary && typeof item.onClose === "function";

    return (
      <li
        key={item.key}
        className={cn("list-none", closable && "group relative", options?.className)}
      >
        <Button
          variant={active ? "secondary" : "ghost"}
          size="sm"
          data-active={active}
          className={cn(
            "relative w-full justify-start px-3",
            mode === "compact" && "justify-center px-0",
            "before:absolute before:left-1 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary/70 before:opacity-0 before:transition-opacity",
            "data-[active=true]:before:opacity-100 hover:before:opacity-60",
            isTemporary && mode !== "compact" && "pl-6",
            closable && mode !== "compact" && "pr-9",
          )}
          aria-current={active ? "page" : undefined}
          aria-label={item.label}
          title={mode === "compact" ? item.label : undefined}
          onClick={() => onSelect(item.key)}
          type="button"
        >
          <item.icon className="size-4" aria-hidden="true" />
          <span className={cn("ml-2 truncate", mode === "compact" && "sr-only")}>{item.label}</span>
          {typeof item.badge !== "undefined" ? (
            <span
              className={cn(
                "ml-auto rounded-full bg-muted px-1.5 text-[10px] leading-none text-muted-foreground",
                mode === "compact" && "sr-only",
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </Button>
        {closable ? (
          <button
            type="button"
            className={cn(
              "absolute right-2 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md border border-transparent bg-background/80 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:border-border/60 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active && "opacity-100",
              "group-hover:opacity-100",
              mode === "compact" && "right-1.5",
            )}
            aria-label={`Close ${item.label}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              item.onClose?.();
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
        {options?.children}
      </li>
    );
  };

  return (
    <aside className={container} aria-hidden={false} style={{ width: sidebarWidth, ...style }}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <nav role="navigation" aria-label="Project navigation" className="flex min-h-0 flex-col gap-3 p-2">
          <div className="space-y-1" aria-label="Projects">
            <p
              className={cn(
                "px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                mode === "compact" && "sr-only",
              )}
            >
              Project
            </p>
            <ul className="flex max-h-full flex-col gap-1 overflow-y-auto pr-1" role="list">
              {topFixedItems
                .filter((item) => item.key === "projects")
                .map((item) => {
                  const children = temporaryItems.length > 0 ? (
                    <ul
                      className={cn(
                        "mt-1 flex flex-col gap-1 border-l border-border/40 pl-3",
                        mode === "compact" && "pl-2",
                      )}
                      role="list"
                    >
                      {temporaryItems.map((temp) =>
                        renderItem(temp, {
                          isTemporary: true,
                          className: mode !== "compact" ? "pl-2" : undefined,
                        }),
                      )}
                    </ul>
                  ) : null;

                  return renderItem(item, { children });
                })}
            </ul>
          </div>
        </nav>

        <nav role="navigation" aria-label="Editor navigation" className="flex min-h-0 flex-col gap-2 p-2 pt-0">
          <div className="space-y-1" aria-label="Editor">
            <p
              className={cn(
                "px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                mode === "compact" && "sr-only",
              )}
            >
              Editor
            </p>
            <ul className="flex max-h-full flex-col gap-1 overflow-y-auto pr-1" role="list">
              {editorItems.map((item) => renderItem(item, { isTemporary: true }))}
            </ul>
          </div>
        </nav>
      </div>

      {settingsItem ? (
        <div className="sticky bottom-0 border-t border-border bg-transparent p-2">
          <ul role="list">
            {renderItem(settingsItem)}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

export default AppSidebar;
