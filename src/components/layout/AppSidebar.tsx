import type { ComponentType, CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SidebarState } from "./WorkspaceSidebar";

export type MenuItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  route?: string;
  badge?: number | string;
  onClose?: () => void;
};

const EMPTY_MENU_ITEMS: MenuItem[] = [];

type AppSidebarProps = {
  state: SidebarState;
  fixedItems: MenuItem[];
  temporaryItems?: MenuItem[];
  editorItems?: MenuItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  className?: string;
  floating?: boolean;
  style?: CSSProperties;
};

export function AppSidebar({
  state,
  fixedItems,
  temporaryItems = EMPTY_MENU_ITEMS,
  editorItems = EMPTY_MENU_ITEMS,
  selectedKey,
  onSelect,
  className,
  floating = true,
  style,
}: AppSidebarProps) {
  if (state === "hidden") return null;

  const container = cn(
    floating && "fixed left-3 z-40",
    "flex w-64 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-lg backdrop-blur transition-[width] duration-200",
    state === "compact" && "w-16",
    className,
  );

  const settingsItem = fixedItems.find((i) => i.key === "settings");
  const topFixedItems = fixedItems.filter((i) => i.key !== "settings");

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
            // layout
            "relative w-full justify-start px-3",
            state === "compact" && "justify-center px-0",
            // active indicator bar (modern nav affordance)
            "before:absolute before:left-1 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary/70 before:opacity-0 before:transition-opacity",
            "data-[active=true]:before:opacity-100 hover:before:opacity-60",
            isTemporary && state !== "compact" && "pl-6",
            closable && state !== "compact" && "pr-9",
          )}
          aria-current={active ? "page" : undefined}
          aria-label={item.label}
          title={state === "compact" ? item.label : undefined}
          onClick={() => onSelect(item.key)}
          type="button"
        >
          <item.icon className="size-4" aria-hidden="true" />
          <span className={cn("ml-2 truncate", state === "compact" && "sr-only")}>{item.label}</span>
          {typeof item.badge !== "undefined" ? (
            <span
              className={cn(
                "ml-auto rounded-full bg-muted px-1.5 text-[10px] leading-none text-muted-foreground",
                state === "compact" && "sr-only",
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
              state === "compact" && "right-1.5",
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
    <aside className={container} aria-hidden={false} style={style}>
      <div className="flex min-h-0 flex-1 flex-col">
        <nav role="navigation" aria-label="Project navigation" className="flex min-h-0 flex-col gap-3 p-2">
          <div className="space-y-1" aria-label="Projects">
            <p
              className={cn(
                "px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                state === "compact" && "sr-only",
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
                        state === "compact" && "pl-2",
                      )}
                      role="list"
                    >
                      {temporaryItems.map((temp) =>
                        renderItem(temp, {
                          isTemporary: true,
                          className: state !== "compact" ? "pl-2" : undefined,
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
                state === "compact" && "sr-only",
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
        <div className="sticky bottom-0 border-t border-border bg-background/70 p-2">
          <ul role="list">
            {renderItem(settingsItem)}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

export default AppSidebar;
