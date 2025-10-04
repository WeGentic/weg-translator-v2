import type { ReactNode } from "react";
import { createStore } from "zustand/vanilla";

export const DEFAULT_FOOTER_HEIGHT = 50;

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
  footer?: Partial<FooterState>;
  background?: Partial<BackgroundState>;
  sidebarOne?: Partial<SidebarOneState>;
  sidebarTwo?: Partial<SidebarTwoState>;
  main?: Partial<MainState>;
}

export interface LayoutState {
  footer: FooterState;
  background: BackgroundState;
  sidebarOne: SidebarOneState;
  sidebarTwo: SidebarTwoState;
  main: MainState;
  footerContent: ReactNode | null;
  sidebarOneContent: ReactNode | null;
  sidebarTwoContent: ReactNode | null;
  setFooter(partial: Partial<FooterState>): void;
  setBackground(partial: Partial<BackgroundState>): void;
  setSidebarOne(partial: Partial<SidebarOneState>): void;
  setSidebarTwo(partial: Partial<SidebarTwoState>): void;
  setMain(partial: Partial<MainState>): void;
  setFooterContent(content: ReactNode | null): void;
  setSidebarOneContent(content: ReactNode | null): void;
  setSidebarTwoContent(content: ReactNode | null): void;
  applyConfig(config: LayoutConfig): void;
  reset(): void;
}

export type LayoutStore = ReturnType<typeof createLayoutStore>;
export type LayoutActions = {
  setFooter: LayoutState["setFooter"];
  setBackground: LayoutState["setBackground"];
  setSidebarOne: LayoutState["setSidebarOne"];
  setSidebarTwo: LayoutState["setSidebarTwo"];
  setMain: LayoutState["setMain"];
  setFooterContent: LayoutState["setFooterContent"];
  setSidebarOneContent: LayoutState["setSidebarOneContent"];
  setSidebarTwoContent: LayoutState["setSidebarTwoContent"];
  applyConfig: LayoutState["applyConfig"];
  reset: LayoutState["reset"];
};

function createSnapshot(): Omit<LayoutState, keyof LayoutActions> {
  return {
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
    footerContent: null,
    sidebarOneContent: null,
    sidebarTwoContent: null,
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

function mergeMain(current: MainState, patch: Partial<MainState>): MainState {
  return {
    scrollable: patch.scrollable ?? current.scrollable,
  };
}

export function createLayoutStore(initialConfig?: LayoutConfig) {
  const store = createStore<LayoutState>((set) => ({
    ...createSnapshot(),
    setFooter: (partial) =>
      set((state) => ({
        footer: mergeFooter(state.footer, partial),
      })),
    setBackground: (partial) =>
      set((state) => ({
        background: mergeBackground(state.background, partial),
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
    setFooterContent: (content) => set({ footerContent: content }),
    setSidebarOneContent: (content) => set({ sidebarOneContent: content }),
    setSidebarTwoContent: (content) => set({ sidebarTwoContent: content }),
    applyConfig: (config) => {
      if (config.footer) {
        set((state) => ({ footer: mergeFooter(state.footer, config.footer!) }));
      }
      if (config.background) {
        set((state) => ({ background: mergeBackground(state.background, config.background!) }));
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
