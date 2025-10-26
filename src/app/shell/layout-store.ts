import type { ReactNode } from "react";
import { createStore } from "zustand/vanilla";

import {
  activateSidebarTwoModule,
  clearSidebarTwoModules,
  createSidebarTwoRegistryState,
  deactivateSidebarTwoModule,
  hydrateSidebarTwoRegistry,
  registerSidebarTwoModule,
  serializeSidebarTwoRegistry,
  setSidebarTwoLegacyContent,
  unregisterSidebarTwoModule,
} from "./sidebar-two-registry/mutations";
import type {
  SidebarTwoModuleActivateOptions,
  SidebarTwoModuleClearFilter,
  SidebarTwoModuleDeactivateStrategy,
  SidebarTwoModuleDefinition,
  SidebarTwoRegistrySnapshot,
  SidebarTwoRegistryState,
} from "./sidebar-two-registry/types";
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

export interface FocusedProjectState {
  projectId: string;
  projectName: string;
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
  focusedProject: FocusedProjectState | null;
  sidebarTwoRegistry: SidebarTwoRegistryState;
  sidebarTwoFocusTarget: string | null;
  setFooter(partial: Partial<FooterState>): void;
  setBackground(partial: Partial<BackgroundState>): void;
  setSidebarOne(partial: Partial<SidebarOneState>): void;
  setSidebarTwo(partial: Partial<SidebarTwoState>): void;
  setMain(partial: Partial<MainState>): void;
  setFooterContent(content: ReactNode | null): void;
  setSidebarOneContent(content: ReactNode | null): void;
  setFocusedProject(focused: FocusedProjectState): void;
  clearFocusedProject(): void;
  applyConfig(config: LayoutConfig): void;
  registerSidebarTwoModule(definition: SidebarTwoModuleDefinition): void;
  unregisterSidebarTwoModule(id: string): void;
  activateSidebarTwoModule(options: SidebarTwoModuleActivateOptions): void;
  deactivateSidebarTwoModule(id: string, strategy?: SidebarTwoModuleDeactivateStrategy): void;
  clearSidebarTwoModules(filter: SidebarTwoModuleClearFilter): void;
  setSidebarTwoLegacyContent(content: ReactNode | null): void;
  setSidebarTwoFocusTarget(target: string | null): void;
  requestSidebarTwoFocus(): void;
  setSidebarTwoFocusTarget(target: string | null): void;
  requestSidebarTwoFocus(): void;
  serializeSidebarTwoModules(): SidebarTwoRegistrySnapshot;
  hydrateSidebarTwoModules(snapshot: SidebarTwoRegistrySnapshot | null | undefined): void;
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
  setFocusedProject: LayoutState["setFocusedProject"];
  clearFocusedProject: LayoutState["clearFocusedProject"];
  applyConfig: LayoutState["applyConfig"];
  registerSidebarTwoModule: LayoutState["registerSidebarTwoModule"];
  unregisterSidebarTwoModule: LayoutState["unregisterSidebarTwoModule"];
  activateSidebarTwoModule: LayoutState["activateSidebarTwoModule"];
  deactivateSidebarTwoModule: LayoutState["deactivateSidebarTwoModule"];
  clearSidebarTwoModules: LayoutState["clearSidebarTwoModules"];
  setSidebarTwoLegacyContent: LayoutState["setSidebarTwoLegacyContent"];
  setSidebarTwoFocusTarget: LayoutState["setSidebarTwoFocusTarget"];
  requestSidebarTwoFocus: LayoutState["requestSidebarTwoFocus"];
  serializeSidebarTwoModules: LayoutState["serializeSidebarTwoModules"];
  hydrateSidebarTwoModules: LayoutState["hydrateSidebarTwoModules"];
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
    focusedProject: null,
    sidebarTwoRegistry: createSidebarTwoRegistryState(),
    sidebarTwoFocusTarget: null,
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
  const store = createStore<LayoutState>((set, get) => ({
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
    setFocusedProject: (focused) =>
      set(() => ({
        focusedProject: {
          projectId: focused.projectId,
          projectName: focused.projectName,
        },
      })),
    clearFocusedProject: () =>
      set(() => ({
        focusedProject: null,
      })),
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
    registerSidebarTwoModule: (definition) =>
      set((state) => ({
        sidebarTwoRegistry: registerSidebarTwoModule(state.sidebarTwoRegistry, definition),
      })),
    unregisterSidebarTwoModule: (id) =>
      set((state) => ({
        sidebarTwoRegistry: unregisterSidebarTwoModule(state.sidebarTwoRegistry, id),
      })),
    activateSidebarTwoModule: (options) =>
      set((state) => ({
        sidebarTwoRegistry: activateSidebarTwoModule(state.sidebarTwoRegistry, options),
      })),
    deactivateSidebarTwoModule: (id, strategy) =>
      set((state) => ({
        sidebarTwoRegistry: deactivateSidebarTwoModule(state.sidebarTwoRegistry, id, strategy),
      })),
    clearSidebarTwoModules: (filter) =>
      set((state) => ({
        sidebarTwoRegistry: clearSidebarTwoModules(state.sidebarTwoRegistry, filter),
      })),
    setSidebarTwoLegacyContent: (content) =>
      set((state) => ({
        sidebarTwoRegistry: setSidebarTwoLegacyContent(state.sidebarTwoRegistry, content),
      })),
    setSidebarTwoFocusTarget: (target) => set({ sidebarTwoFocusTarget: target }),
    requestSidebarTwoFocus: () => {
      const { sidebarTwoFocusTarget } = get();
      if (!sidebarTwoFocusTarget) {
        return;
      }
      if (typeof document !== "undefined") {
        const element = document.getElementById(sidebarTwoFocusTarget);
        if (element) {
          element.focus();
        }
      }
    },
    serializeSidebarTwoModules: () => serializeSidebarTwoRegistry(get().sidebarTwoRegistry),
    hydrateSidebarTwoModules: (snapshot) =>
      set((state) => ({
        sidebarTwoRegistry: hydrateSidebarTwoRegistry(state.sidebarTwoRegistry, snapshot),
      })),
    reset: () => {
      set(() => createSnapshot());
    },
  }));

  if (initialConfig) {
    store.getState().applyConfig(initialConfig);
  }

  return store;
}
