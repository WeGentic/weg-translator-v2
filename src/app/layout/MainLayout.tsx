import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { useStore } from "zustand";

import {
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_FOOTER_HEIGHT,
  createLayoutStore,
  type LayoutConfig,
  type LayoutState,
  type LayoutStore,
  type SidemenuMode,
  type BackgroundState,
} from "./layout-store";

interface LayoutRootProps extends PropsWithChildren {
  config?: LayoutConfig;
}

interface HeaderProps extends PropsWithChildren {
  visible?: boolean;
  height?: number;
}

interface FooterProps extends PropsWithChildren {
  visible?: boolean;
  height?: number;
}

interface SidemenuProps extends PropsWithChildren {
  mode?: SidemenuMode;
  compactWidth?: number;
  expandedWidth?: number;
}

interface BackgroundProps {
  children?: ReactNode;
  visible?: boolean;
  mounted?: boolean;
}

interface MainProps extends PropsWithChildren {
  scroll?: "auto" | "hidden";
}

interface LayoutControllerProps {
  config: LayoutConfig;
}

const LayoutStoreContext = createContext<LayoutStore | null>(null);

function useLayoutStoreSelector<T>(selector: (state: LayoutState) => T): T {
  const store = useContext(LayoutStoreContext);
  if (!store) {
    throw new Error("MainLayout components must be rendered within <MainLayout.Root>");
  }
  return useStore(store, selector);
}

function useLayoutStoreActions<T>(selector: (state: LayoutState) => T): T {
  return useLayoutStoreSelector(selector);
}

function LayoutProvider({ children, config }: LayoutRootProps) {
  const storeRef = useRef<LayoutStore>();

  if (!storeRef.current) {
    storeRef.current = createLayoutStore(config);
  }

  const store = storeRef.current;

  useEffect(() => {
    if (config) {
      store.getState().applyConfig(config);
    }
  }, [store, config]);

  return <LayoutStoreContext.Provider value={store}>{children}</LayoutStoreContext.Provider>;
}

function calculateSidebarWidth(state: LayoutState["sidemenu"]): number {
  if (!state.mounted || state.mode === "unmounted") {
    return 0;
  }
  if (state.mode === "hidden") {
    return 0;
  }
  if (state.mode === "compact") {
    return state.compactWidth;
  }
  return state.expandedWidth;
}

function LayoutShell({ children }: PropsWithChildren) {
  const header = useLayoutStoreSelector((state) => state.header);
  const footer = useLayoutStoreSelector((state) => state.footer);
  const sidemenu = useLayoutStoreSelector((state) => state.sidemenu);

  const headerHeight = header.mounted && header.visible ? header.height : 0;
  const footerHeight = footer.mounted && footer.visible ? footer.height : 0;
  const sidebarWidth = calculateSidebarWidth(sidemenu);

  const templateRows = `${headerHeight}px 1fr ${footerHeight}px`;
  const templateColumns = `${sidebarWidth}px minmax(0, 1fr)`;

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <BackgroundSurface />
      <div
        className="grid h-full w-full overflow-hidden"
        style={{
          gridTemplateRows: templateRows,
          gridTemplateColumns: templateColumns,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BackgroundSurface() {
  const background = useLayoutStoreSelector((state) => state.background);

  if (!background.mounted || !background.visible) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      {background.element ?? <div className="h-full w-full bg-neutral-950" />}
    </div>
  );
}

function Header({ children, visible, height }: HeaderProps) {
  const setHeader = useLayoutStoreActions((state) => state.setHeader);
  const header = useLayoutStoreSelector((state) => state.header);
  const headerContent = useLayoutStoreSelector((state) => state.headerContent);

  useEffect(() => {
    setHeader({
      mounted: true,
      ...(visible !== undefined ? { visible } : {}),
      ...(height !== undefined ? { height } : {}),
    });
    return () => {
      setHeader({ mounted: false, height: height ?? DEFAULT_HEADER_HEIGHT });
    };
  }, [setHeader, visible, height]);

  const content = children ?? headerContent;

  if (!header.mounted || !content) {
    return null;
  }

  return (
    <header
      role="banner"
      className="flex h-full w-full items-center justify-between"
      style={{
        gridColumn: "1 / span 2",
        gridRow: "1 / 2",
        visibility: header.visible ? "visible" : "hidden",
      }}
    >
      {content}
    </header>
  );
}

function Footer({ children, visible, height }: FooterProps) {
  const setFooter = useLayoutStoreActions((state) => state.setFooter);
  const footer = useLayoutStoreSelector((state) => state.footer);
  const footerContent = useLayoutStoreSelector((state) => state.footerContent);

  useEffect(() => {
    setFooter({
      mounted: true,
      ...(visible !== undefined ? { visible } : {}),
      ...(height !== undefined ? { height } : {}),
    });
    return () => {
      setFooter({ mounted: false, height: height ?? DEFAULT_FOOTER_HEIGHT });
    };
  }, [setFooter, visible, height]);

  const content = children ?? footerContent;

  if (!footer.mounted || !content) {
    return null;
  }

  return (
    <footer
      role="contentinfo"
      className="flex h-full w-full items-center justify-between"
      style={{
        gridColumn: "1 / span 2",
        gridRow: "3 / 4",
        visibility: footer.visible ? "visible" : "hidden",
      }}
    >
      {content}
    </footer>
  );
}

function Sidemenu({ children, mode, compactWidth, expandedWidth }: SidemenuProps) {
  const setSidemenu = useLayoutStoreActions((state) => state.setSidemenu);
  const sidemenu = useLayoutStoreSelector((state) => state.sidemenu);
  const sidemenuContent = useLayoutStoreSelector((state) => state.sidemenuContent);

  useEffect(() => {
    setSidemenu({
      mounted: true,
      ...(mode ? { mode } : {}),
      ...(compactWidth !== undefined ? { compactWidth } : {}),
      ...(expandedWidth !== undefined ? { expandedWidth } : {}),
    });
    return () => {
      setSidemenu({ mounted: false, mode: "unmounted" });
    };
  }, [setSidemenu, mode, compactWidth, expandedWidth]);

  const content = children ?? sidemenuContent;

  if (!sidemenu.mounted || sidemenu.mode === "unmounted" || !content) {
    return null;
  }

  const isHidden = sidemenu.mode === "hidden";

  return (
    <aside
      role="navigation"
      className="flex h-full w-full flex-col"
      style={{
        gridColumn: "1 / 2",
        gridRow: "2 / 3",
        visibility: isHidden ? "hidden" : "visible",
      }}
    >
      {content}
    </aside>
  );
}

function Background({ children, visible, mounted = true }: BackgroundProps) {
  const setBackground = useLayoutStoreActions((state) => state.setBackground);

  useEffect(() => {
    if (children === undefined) {
      return;
    }
    setBackground({
      mounted,
      element: children,
      ...(visible !== undefined ? { visible } : {}),
    });
    return () => {
      setBackground({ element: null, mounted: false });
    };
  }, [setBackground, children, visible, mounted]);

  useEffect(() => {
    if (children !== undefined) {
      return;
    }
    const patch: Partial<BackgroundState> = {};
    if (visible !== undefined) {
      patch.visible = visible;
    }
    if (mounted !== undefined) {
      patch.mounted = mounted;
    }
    if (Object.keys(patch).length > 0) {
      setBackground(patch);
    }
  }, [children, visible, mounted, setBackground]);

  return null;
}

function Main({ children, scroll = "auto" }: MainProps) {
  const sidemenu = useLayoutStoreSelector((state) => state.sidemenu);
  const gridColumn = !sidemenu.mounted || sidemenu.mode === "unmounted" ? "1 / span 2" : "2 / 3";

  return (
    <section
      role="main"
      className="flex h-full w-full flex-col overflow-hidden bg-transparent"
      style={{ gridColumn, gridRow: "2 / 3" }}
    >
      <div className={scroll === "auto" ? "flex-1 overflow-y-auto" : "flex-1 overflow-hidden"}>{children}</div>
    </section>
  );
}

function Controller({ config }: LayoutControllerProps) {
  const applyConfig = useLayoutStoreActions((state) => state.applyConfig);

  useEffect(() => {
    applyConfig(config);
  }, [applyConfig, config]);

  return null;
}

export const MainLayout = {
  Root: ({ children, config }: LayoutRootProps) => (
    <LayoutProvider config={config}>
      <LayoutShell>{children}</LayoutShell>
    </LayoutProvider>
  ),
  Header,
  Footer,
  Sidemenu,
  Background,
  Main,
  Controller,
};

export type { LayoutConfig, SidemenuMode };
export function useLayoutSelector<T>(selector: (state: LayoutState) => T): T {
  return useLayoutStoreSelector(selector);
}

export function useLayoutActions<T>(selector: (state: LayoutState) => T): T {
  return useLayoutStoreActions(selector);
}
