import type { ReactNode } from "react";
import { createStore } from "zustand/vanilla";

export const DEFAULT_HEADER_HEIGHT = 64;
export const DEFAULT_FOOTER_HEIGHT = 50;
export const DEFAULT_SIDEMENU_COMPACT_WIDTH = 88;
export const DEFAULT_SIDEMENU_EXPANDED_WIDTH = 280;

export type SidemenuMode = "unmounted" | "hidden" | "compact" | "expanded";

export interface HeaderState {
  mounted: boolean;
  visible: boolean;
  height: number;
}

export interface FooterState {
  mounted: boolean;
  visible: boolean;
  height: number;
}

export interface BackgroundState {
  mounted: boolean;
  visible: boolean;
  element: ReactNode | null;
}

export interface SidemenuState {
  mounted: boolean;
  mode: SidemenuMode;
  compactWidth: number;
  expandedWidth: number;
}

export interface SidebarOneState {
  mounted: boolean;
  width: number;
}

export interface SidebarTwoState {
  mounted: boolean;
  visible: boolean;
  width: number;
}

export interface MainState {
  scrollable: boolean;
}

export interface LayoutConfig {
  header?: Partial<HeaderState>;
  footer?: Partial<FooterState>;
  background?: Partial<BackgroundState>;
  sidemenu?: Partial<SidemenuState>;
  sidebarOne?: Partial<SidebarOneState>;
  sidebarTwo?: Partial<SidebarTwoState>;
  main?: Partial<MainState>;
}

export interface LayoutState {
  header: HeaderState;
  footer: FooterState;
  background: BackgroundState;
  sidemenu: SidemenuState;
  sidebarOne: SidebarOneState;
  sidebarTwo: SidebarTwoState;
  main: MainState;
  headerContent: ReactNode | null;
  footerContent: ReactNode | null;
  sidemenuContent: ReactNode | null;
  sidebarOneContent: ReactNode | null;
  sidebarTwoContent: ReactNode | null;
  setHeader(partial: Partial<HeaderState>): void;
  setFooter(partial: Partial<FooterState>): void;
  setBackground(partial: Partial<BackgroundState>): void;
  setSidemenu(partial: Partial<SidemenuState>): void;
  setSidebarOne(partial: Partial<SidebarOneState>): void;
  setSidebarTwo(partial: Partial<SidebarTwoState>): void;
  setMain(partial: Partial<MainState>): void;
  setHeaderContent(content: ReactNode | null): void;
  setFooterContent(content: ReactNode | null): void;
  setSidemenuContent(content: ReactNode | null): void;
  setSidebarOneContent(content: ReactNode | null): void;
  setSidebarTwoContent(content: ReactNode | null): void;
  cycleSidemenu(): void;
  applyConfig(config: LayoutConfig): void;
  reset(): void;
}

export type LayoutStore = ReturnType<typeof createLayoutStore>;

export type LayoutActions = {
  setHeader: LayoutState["setHeader"];
  setFooter: LayoutState["setFooter"];
  setBackground: LayoutState["setBackground"];
  setSidemenu: LayoutState["setSidemenu"];
  setSidebarOne: LayoutState["setSidebarOne"];
  setSidebarTwo: LayoutState["setSidebarTwo"];
  setMain: LayoutState["setMain"];
  setHeaderContent: LayoutState["setHeaderContent"];
  setFooterContent: LayoutState["setFooterContent"];
  setSidemenuContent: LayoutState["setSidemenuContent"];
  setSidebarOneContent: LayoutState["setSidebarOneContent"];
  setSidebarTwoContent: LayoutState["setSidebarTwoContent"];
  cycleSidemenu: LayoutState["cycleSidemenu"];
  applyConfig: LayoutState["applyConfig"];
  reset: LayoutState["reset"];
};

function createSnapshot(): Omit<LayoutState, keyof LayoutActions> {
  return {
    header: {
      mounted: false,
      visible: true,
      height: DEFAULT_HEADER_HEIGHT,
    },
    footer: {
      mounted: false,
      visible: true,
      height: DEFAULT_FOOTER_HEIGHT,
    },
    background: {
      mounted: false,
      visible: true,
      element: null,
    },
    sidemenu: {
      mounted: false,
      mode: "unmounted",
      compactWidth: DEFAULT_SIDEMENU_COMPACT_WIDTH,
      expandedWidth: DEFAULT_SIDEMENU_EXPANDED_WIDTH,
    },
    sidebarOne: {
      mounted: false,
      width: 64,
    },
    sidebarTwo: {
      mounted: false,
      visible: true,
      width: 192,
    },
    main: {
      scrollable: true,
    },
    headerContent: null,
    footerContent: null,
    sidemenuContent: null,
    sidebarOneContent: null,
    sidebarTwoContent: null,
  };
}

function mergeHeader(current: HeaderState, patch: Partial<HeaderState>): HeaderState {
  return {
    mounted: patch.mounted ?? current.mounted,
    visible: patch.visible ?? current.visible,
    height: patch.height ?? current.height,
  };
}

function mergeFooter(current: FooterState, patch: Partial<FooterState>): FooterState {
  return {
    mounted: patch.mounted ?? current.mounted,
    visible: patch.visible ?? current.visible,
    height: patch.height ?? current.height,
  };
}

function mergeBackground(current: BackgroundState, patch: Partial<BackgroundState>): BackgroundState {
  return {
    mounted: patch.mounted ?? current.mounted,
    visible: patch.visible ?? current.visible,
    element: patch.element ?? current.element,
  };
}

function mergeSidemenu(current: SidemenuState, patch: Partial<SidemenuState>): SidemenuState {
  return {
    mounted: patch.mounted ?? current.mounted,
    mode: patch.mode ?? current.mode,
    compactWidth: patch.compactWidth ?? current.compactWidth,
    expandedWidth: patch.expandedWidth ?? current.expandedWidth,
  };
}

function mergeMain(current: MainState, patch: Partial<MainState>): MainState {
  return {
    scrollable: patch.scrollable ?? current.scrollable,
  };
}

function mergeSidebarOne(current: SidebarOneState, patch: Partial<SidebarOneState>): SidebarOneState {
  return {
    mounted: patch.mounted ?? current.mounted,
    width: patch.width ?? current.width,
  };
}

function mergeSidebarTwo(current: SidebarTwoState, patch: Partial<SidebarTwoState>): SidebarTwoState {
  return {
    mounted: patch.mounted ?? current.mounted,
    visible: patch.visible ?? current.visible,
    width: patch.width ?? current.width,
  };
}

export function createLayoutStore(initialConfig?: LayoutConfig) {
  const store = createStore<LayoutState>((set) => ({
    ...createSnapshot(),
    setHeader: (partial) =>
      set((state) => ({
        header: mergeHeader(state.header, partial),
      })),
    setFooter: (partial) =>
      set((state) => ({
        footer: mergeFooter(state.footer, partial),
      })),
    setBackground: (partial) =>
      set((state) => ({
        background: mergeBackground(state.background, partial),
      })),
    setSidemenu: (partial) =>
      set((state) => ({
        sidemenu: mergeSidemenu(state.sidemenu, partial),
      })),
    setSidebarOne: (partial) =>
      set((state) => ({
        sidebarOne: mergeSidebarOne(state.sidebarOne, partial),
      })),
    setSidebarTwo: (partial) =>
      set((state) => ({
        sidebarTwo: mergeSidebarTwo(state.sidebarTwo, partial),
      })),
    setMain: (partial) =>
      set((state) => ({
        main: mergeMain(state.main, partial),
      })),
    setHeaderContent: (content) => set({ headerContent: content }),
    setFooterContent: (content) => set({ footerContent: content }),
    setSidemenuContent: (content) => set({ sidemenuContent: content }),
    setSidebarOneContent: (content) => set({ sidebarOneContent: content }),
    setSidebarTwoContent: (content) => set({ sidebarTwoContent: content }),
    cycleSidemenu: () =>
      set((state) => ({
        sidemenu: {
          ...state.sidemenu,
          mounted: true,
          mode: nextSidemenuMode(state.sidemenu.mode),
        },
      })),
    applyConfig: (config) => {
      if (config.header) {
        set((state) => ({ header: mergeHeader(state.header, config.header!) }));
      }
      if (config.footer) {
        set((state) => ({ footer: mergeFooter(state.footer, config.footer!) }));
      }
      if (config.background) {
        set((state) => ({ background: mergeBackground(state.background, config.background!) }));
      }
      if (config.sidemenu) {
        set((state) => ({ sidemenu: mergeSidemenu(state.sidemenu, config.sidemenu!) }));
      }
      if (config.sidebarOne) {
        set((state) => ({ sidebarOne: mergeSidebarOne(state.sidebarOne, config.sidebarOne!) }));
      }
      if (config.sidebarTwo) {
        set((state) => ({ sidebarTwo: mergeSidebarTwo(state.sidebarTwo, config.sidebarTwo!) }));
      }
      if (config.main) {
        set((state) => ({ main: mergeMain(state.main, config.main!) }));
      }
    },
    reset: () => {
      set(() => createSnapshot());
    },
  }));

  if (initialConfig) {
    store.getState().applyConfig(initialConfig);
  }

  return store;
}

export const DEFAULT_LAYOUT_SIDEMENU_WIDTHS = {
  compact: DEFAULT_SIDEMENU_COMPACT_WIDTH,
  expanded: DEFAULT_SIDEMENU_EXPANDED_WIDTH,
} as const;

function nextSidemenuMode(current: SidemenuMode): SidemenuMode {
  switch (current) {
    case "expanded":
      return "compact";
    case "compact":
      return "expanded"; // Toggle between expanded/compact when visible
    case "hidden":
      return "expanded"; // When hidden, show in expanded mode
    case "unmounted":
    default:
      return "expanded";
  }
}
