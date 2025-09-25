import type { ComponentType, CSSProperties, ReactNode } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { FiX, FiChevronRight } from "react-icons/fi";

import { useLayoutSelector, useLayoutActions } from "../../MainLayout";
import { Button } from "../../../../components/ui/button";
import { cn } from "../../../../lib/utils";
import "../../css-styles/chrome/sidebar/app-sidebar.css";

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
  children?: MenuItem[];
  shortcut?: string;
  notification?: boolean;
  disabled?: boolean;
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
  showToggleButton?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
};

/**
 * Application sidebar with clean, professional design.
 * Focused on usability and performance over flashy animations.
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
  showToggleButton = false,
  header,
  footer,
  showHeader = true,
  showFooter = true,
}: AppSidebarProps) {
  const sidemenu = useLayoutSelector((state) => state.sidemenu);
  const cycleSidemenu = useLayoutActions((state) => state.cycleSidemenu);
  const headerState = useLayoutSelector((state) => state.header);
  const footerState = useLayoutSelector((state) => state.footer);
  const mode = sidemenu.mode;
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const projectsItemRef = useRef<HTMLLIElement | null>(null);
  const [tooltip, setTooltip] = useState<null | { key: string; top: number; left: number; label: string }>(null);
  const [projectsMenuPos, setProjectsMenuPos] = useState<null | { top: number; left: number }>(null);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        cycleSidemenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleSidemenu]);

  const handleItemHover = useCallback((key: string) => setHoveredItem(key), []);
  const handleItemLeave = useCallback(() => setHoveredItem(null), []);
  const closeProjectsMenu = useCallback(() => setShowProjectsMenu(false), []);

  // Close the compact projects menu on outside click or Escape
  useEffect(() => {
    if (!showProjectsMenu) return;
    const onDown = (e: MouseEvent) => {
      const el = projectsItemRef.current;
      if (el && !el.contains(e.target as Node)) {
        setShowProjectsMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowProjectsMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showProjectsMenu]);

  // Ensure menu closes when leaving compact mode
  useEffect(() => {
    if (mode !== "compact" && showProjectsMenu) {
      setShowProjectsMenu(false);
    }
  }, [mode, showProjectsMenu]);

  // const allItems = [...fixedItems, ...temporaryItems, ...editorItems];

  if (!sidemenu.mounted || mode === "unmounted") {
    return null;
  }

  const container = cn(
    "app-sidebar",
    "app-sidebar--elevated",
    floating && "app-sidebar--floating",
    mode === "compact" && "app-sidebar--compact",
    className,
  );

  const effectiveMode = mode === "compact" ? "compact" : "expanded";
  const sidebarWidth = effectiveMode === "compact" ? sidemenu.compactWidth : sidemenu.expandedWidth;

  const settingsItem = fixedItems.find((item) => item.key === "settings");
  const topFixedItems = fixedItems.filter((item) => item.key !== "settings");

  /** Renders a nav item with clean, professional interactions. */
  const renderItem = (
    item: MenuItem,
    options?: { isTemporary?: boolean; className?: string; children?: ReactNode; index?: number },
  ) => {
    const isTemporary = options?.isTemporary ?? false;
    const active = selectedKey === item.key;
    const closable = isTemporary && typeof item.onClose === "function";
    const isHovered = hoveredItem === item.key;
    const isCompact = mode === "compact";
    const isCompactChip = isCompact && isTemporary;

    // Derive an initial for compact chips (project/editor specific views)
    const computeInitial = (label: string) => {
      const trimmed = label.trim();
      // Prefer the right-hand side of an em dash if present (e.g., "Editor — ProjectName")
      const dashSplit = trimmed.split("—");
      const focus = dashSplit.length > 1 ? dashSplit[dashSplit.length - 1] : trimmed;
      const name = focus.trim();
      return name ? name.charAt(0).toUpperCase() : "?";
    };
    const initial = computeInitial(item.label);

    return (
      <li
        key={item.key}
        className={cn(
          "app-sidebar__item",
          closable && "app-sidebar__item--closable",
          options?.className
        )}
        ref={item.key === "projects" ? projectsItemRef : undefined}
        onMouseEnter={() => handleItemHover(item.key)}
        onMouseLeave={handleItemLeave}
      >
        <div className="relative">
          <Button
            variant="ghost"
            size={isCompact ? "icon" : "sm"}
            data-active={active}
            disabled={item.disabled}
            className={cn(
              "app-sidebar__link",
              isCompact && "app-sidebar__link--compact",
              isCompactChip && "app-sidebar__link--chip",
              isTemporary && !isCompact && "app-sidebar__link--temporary",
              closable && !isCompact && "app-sidebar__link--closable",
              item.disabled && "app-sidebar__link--disabled"
            )}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            title={isCompact ? item.label : undefined}
            onClick={(e) => {
              if (item.disabled) return;
              // Primary click: always navigate
              onSelect(item.key);
              // Optional: open submenu on modified click
              if (
                isCompact &&
                item.key === "projects" &&
                (e.altKey || e.shiftKey)
              ) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setProjectsMenuPos({ top: rect.top + rect.height / 2 - 12, left: rect.right + 8 });
                setShowProjectsMenu(true);
              }
            }}
            onContextMenu={(e) => {
              // In compact mode: right-click on Projects opens its menu; right-click on temporary/editor chip closes it
              if (isCompact && item.key === "projects") {
                e.preventDefault();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setProjectsMenuPos({ top: rect.top + rect.height / 2 - 12, left: rect.right + 8 });
                setShowProjectsMenu(true);
              } else if (isCompact && closable) {
                e.preventDefault();
                item.onClose?.();
              }
            }}
            onMouseEnter={(e) => {
              if (isCompact) {
                setHoveredItem(item.key);
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const tip = isTemporary ? `${item.label} — right-click to close` : item.label;
                setTooltip({ key: item.key, top: rect.top + rect.height / 2, left: rect.right + 8, label: tip });
              }
            }}
            onMouseLeave={() => {
              if (isCompact) {
                setHoveredItem(null);
                setTooltip(null);
              }
            }}
            onFocus={(e) => {
              if (isCompact) {
                handleItemHover(item.key);
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const tip = isTemporary ? `${item.label} — right-click to close` : item.label;
                setTooltip({ key: item.key, top: rect.top + rect.height / 2, left: rect.right + 8, label: tip });
              }
            }}
            onBlur={() => { handleItemLeave(); setTooltip(null); }}
            type="button"
          >
            {/* Icon or Compact Chip */}
            <div className="relative flex items-center justify-center">
              {isCompactChip ? (
                <span className="app-sidebar__initial" aria-hidden="true">{initial}</span>
              ) : (
                <item.icon className={cn("app-sidebar__icon", isCompact ? "size-5" : "size-4")} aria-hidden="true" />
              )}
              {item.notification && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[color:var(--color-sidebar-primary)]" />
              )}
            </div>

            {/* Label */}
            {mode !== "compact" && (
              <span className="app-sidebar__label">
                {item.label}
              </span>
            )}

            {/* Keyboard shortcut */}
            {item.shortcut && mode !== "compact" && (
              <span className="app-sidebar__shortcut">
                {item.shortcut}
              </span>
            )}

            {/* Badge */}
            {typeof item.badge !== "undefined" && mode !== "compact" && (
              <span className="app-sidebar__badge">
                {item.badge}
              </span>
            )}
          </Button>

          {/* Per-item tooltip removed; we use a global fixed tooltip for compact */}

          {/* Compact Projects menu */}
          {mode === "compact" && item.key === "projects" && showProjectsMenu && (
            <div className="app-sidebar__menu" role="menu" aria-label="Open project views" style={projectsMenuPos ? { position: 'fixed', top: projectsMenuPos.top, left: projectsMenuPos.left } : undefined}>
              <div className="app-sidebar__menu-header">Projects</div>
              <ul role="list">
                <li>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedKey === "projects"}
                    className={cn(
                      "app-sidebar__menu-item",
                      selectedKey === "projects" && "app-sidebar__menu-item--active"
                    )}
                    onClick={() => {
                      onSelect("projects");
                      closeProjectsMenu();
                    }}
                  >
                    All Projects
                  </button>
                </li>
                {temporaryItems.map((temp) => (
                  <li key={temp.key}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedKey === temp.key}
                      className={cn(
                        "app-sidebar__menu-item",
                        selectedKey === temp.key && "app-sidebar__menu-item--active"
                      )}
                      onClick={() => {
                        onSelect(temp.key);
                        closeProjectsMenu();
                      }}
                    >
                      {temp.label}
                    </button>
                  </li>
                ))}
              </ul>
              {editorItems.length > 0 && (
                <>
                  <div className="app-sidebar__menu-header" style={{marginTop: 6}}>Editors</div>
                  <ul role="list">
                    {editorItems.map((ed) => (
                      <li key={ed.key}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={selectedKey === ed.key}
                          className={cn(
                            "app-sidebar__menu-item",
                            selectedKey === ed.key && "app-sidebar__menu-item--active"
                          )}
                          onClick={() => {
                            onSelect(ed.key);
                            closeProjectsMenu();
                          }}
                        >
                          {ed.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        {mode !== "compact" && closable && (active || isHovered) && (
          <button
            type="button"
            className={cn(
              "app-sidebar__close-button",
            )}
            aria-label={`Close ${item.label}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              item.onClose?.();
            }}
          >
            <FiX className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}

        {options?.children}
      </li>
    );
  };

  const topOffset = headerState.mounted && headerState.visible ? headerState.height + 16 : 16;
  const bottomOffset = footerState.mounted && footerState.visible ? footerState.height + 16 : 16;
  const floatingStyle: CSSProperties | undefined = floating
    ? { top: topOffset, bottom: bottomOffset }
    : undefined;

  const defaultHeader = (
    <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-sidebar-foreground)]/90">
      <span className="inline-flex size-2.5 rounded-[4px] bg-[color:var(--color-sidebar-primary)] shadow-[0_0_0_3px] shadow-[color:var(--color-sidebar-primary)/15%]" />
      <span>Workspace</span>
    </div>
  );
  const renderHeader = showHeader && mode !== "compact";

  return (
    <aside
      className={container}
      aria-hidden={mode === "hidden"}
      style={{ width: sidebarWidth, ...floatingStyle, ...style }}
    >
      {/* Toggle button */}
      {showToggleButton && floating && (
        <button
          className="app-sidebar__toggle-button"
          onClick={cycleSidemenu}
          aria-label={`${mode === 'compact' ? 'Expand' : 'Collapse'} sidebar`}
          title={`Toggle sidebar (⌘B)`}
        >
          <div
            style={{
              transform: `rotate(${mode === 'compact' ? 0 : 180}deg)`,
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <FiChevronRight className="size-4" />
          </div>
        </button>
      )}

      {renderHeader && (
        <div className="app-sidebar__header">
          {header ?? defaultHeader}
        </div>
      )}

      <div className="app-sidebar__body">
        <nav role="navigation" aria-label="Project navigation" className="app-sidebar__nav">
          <div className="app-sidebar__section" aria-label="Projects">
            <p className={cn("app-sidebar__section-title", mode === "compact" && "sr-only")}>Project</p>
            <ul className="app-sidebar__list" role="list">
              {topFixedItems
                .filter((item) => item.key === "projects")
                .map((item, index) => {
              const children = mode !== "compact" && temporaryItems.length > 0 ? (
                <ul
                  className={cn(
                    "app-sidebar__temporary-list"
                  )}
                  role="list"
                >
                      {temporaryItems.map((temp, tempIndex) =>
                        renderItem(temp, {
                          isTemporary: true,
                          className: mode !== "compact" ? "app-sidebar__nested-item" : undefined,
                          index: tempIndex + 1,
                        }),
                      )}
                    </ul>
                  ) : null;

                  return renderItem(item, { children, index });
                })}
              {/* In compact mode, render temporary project views as chips below */}
              {mode === "compact" && temporaryItems.map((temp, idx) => (
                renderItem(temp, { isTemporary: true, className: "", index: idx })
              ))}
            </ul>
          </div>
        </nav>
        <div className="app-sidebar__divider" aria-hidden="true" />
        
        <nav
          role="navigation"
          aria-label="Editor navigation"
          className={cn("app-sidebar__nav", "app-sidebar__nav--tight", "app-sidebar__nav--no-top-padding")}
        >
          <div className="app-sidebar__section" aria-label="Editor">
            <p className={cn("app-sidebar__section-title", mode === "compact" && "sr-only")}>Editor</p>
            <ul className="app-sidebar__list" role="list">
              {editorItems.map((item, index) => renderItem(item, { isTemporary: true, index }))}
            </ul>
          </div>
        </nav>
      </div>

      {(showFooter || settingsItem) && (
        <div className="app-sidebar__footer">
          {footer}
          {settingsItem && (
            <ul role="list" className={cn(footer && "mt-2") }>
              {renderItem(settingsItem, { index: 0 })}
            </ul>
          )}
        </div>
      )}

      {/* Global fixed tooltip for compact mode */}
      {mode === "compact" && tooltip && hoveredItem === tooltip.key && !showProjectsMenu && (
        <div
          className="app-sidebar__tooltip"
          role="tooltip"
          style={{ position: 'fixed', top: tooltip.top, left: tooltip.left, transform: 'translateY(-50%)' }}
        >
          {tooltip.label}
        </div>
      )}
    </aside>
  );
}

export default AppSidebar;
