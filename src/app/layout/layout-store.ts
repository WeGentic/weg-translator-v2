import type { ReactNode } from "react";
import { createStore } from "zustand/vanilla";

export const DEFAULT_HEADER_HEIGHT = 64;
export const DEFAULT_FOOTER_HEIGHT = 56;
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

export interface MainState {
  scrollable: boolean;
}

export interface LayoutConfig {
  header?: Partial<HeaderState>;
  footer?: Partial<FooterState>;
  background?: Partial<BackgroundState>;
  sidemenu?: Partial<SidemenuState>;
  main?: Partial<MainState>;
}

export interface LayoutState {
  header: HeaderState;
  footer: FooterState;
  background: BackgroundState;
  sidemenu: SidemenuState;
  main: MainState;
  headerContent: ReactNode | null;
  footerContent: ReactNode | null;
  sidemenuContent: ReactNode | null;
  setHeader(partial: Partial<HeaderState>): void;
  setFooter(partial: Partial<FooterState>): void;
  setBackground(partial: Partial<BackgroundState>): void;
  setSidemenu(partial: Partial<SidemenuState>): void;
  setMain(partial: Partial<MainState>): void;
  setHeaderContent(content: ReactNode | null): void;
  setFooterContent(content: ReactNode | null): void;
  setSidemenuContent(content: ReactNode | null): void;
  cycleSidemenu(): void;
  applyConfig(config: LayoutConfig): void;
  reset(): void;
}

export type LayoutStore = ReturnType<typeof createLayoutStore>;

function createSnapshot(): Pick<LayoutState, "header" | "footer" | "background" | "sidemenu" | "main"> {
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
    main: {
      scrollable: true,
    },
    headerContent: null,
    footerContent: null,
    sidemenuContent: null,
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
    setMain: (partial) =>
      set((state) => ({
        main: mergeMain(state.main, partial),
      })),
    setHeaderContent: (content) => set({ headerContent: content }),
    setFooterContent: (content) => set({ footerContent: content }),
    setSidemenuContent: (content) => set({ sidemenuContent: content }),
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

export type LayoutActions = {
  setHeader: LayoutState["setHeader"];
  setFooter: LayoutState["setFooter"];
  setBackground: LayoutState["setBackground"];
  setSidemenu: LayoutState["setSidemenu"];
  setMain: LayoutState["setMain"];
  setHeaderContent: LayoutState["setHeaderContent"];
  setFooterContent: LayoutState["setFooterContent"];
  setSidemenuContent: LayoutState["setSidemenuContent"];
  cycleSidemenu: LayoutState["cycleSidemenu"];
  applyConfig: LayoutState["applyConfig"];
  reset: LayoutState["reset"];
};

function nextSidemenuMode(current: SidemenuMode): SidemenuMode {
  switch (current) {
    case "expanded":
      return "compact";
    case "compact":
      return "hidden";
    case "hidden":
      return "expanded";
    case "unmounted":
    default:
      return "expanded";
  }
}
