import {
  createContext,
  use,
  useRef,
  type PropsWithChildren,
} from "react";
import type { SortingState } from "@tanstack/react-table";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import {
  PROJECT_MANAGER_DEFAULT_SEARCH,
  createDefaultProjectManagerFilters,
  createDefaultProjectManagerSorting,
} from "../config/defaults";
import {
  normalizeProjectFilterPreset,
  type ProjectFilterPreset,
} from "../data/projectFilters";

function createEmptySelection(): ReadonlySet<string> {
  return new Set();
}

function toSelection(ids: Iterable<string> | undefined): ReadonlySet<string> {
  if (!ids) {
    return createEmptySelection();
  }

  const next = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && id.length > 0) {
      next.add(id);
    }
  }
  return next;
}

export interface ProjectManagerViewSnapshot {
  search: string;
  selectedIds: ReadonlySet<string>;
  filters: ProjectFilterPreset;
  sorting: SortingState;
}

type ProjectFilterUpdate =
  | ProjectFilterPreset
  | ((current: ProjectFilterPreset) => ProjectFilterPreset);
type SortingStateUpdate = SortingState | ((current: SortingState) => SortingState);

export interface ProjectManagerViewActions {
  setSearch(this: void, value: string): void;
  clearSelection(this: void): void;
  toggleSelection(this: void, projectId: string): void;
  replaceSelection(this: void, projectIds: Iterable<string>): void;
  selectMany(this: void, projectIds: Iterable<string>): void;
  removeSelection(this: void, projectIds: Iterable<string>): void;
  pruneSelection(this: void, validProjectIds: Iterable<string>): void;
  setFilters(this: void, update: ProjectFilterUpdate): void;
  resetFilters(this: void): void;
  setSorting(this: void, update: SortingStateUpdate): void;
  resetSorting(this: void): void;
}

export type ProjectManagerState = ProjectManagerViewSnapshot & ProjectManagerViewActions;
export type ProjectManagerStore = StoreApi<ProjectManagerState>;

function createInitialSnapshot(): ProjectManagerViewSnapshot {
  return {
    search: PROJECT_MANAGER_DEFAULT_SEARCH,
    selectedIds: createEmptySelection(),
    filters: createDefaultProjectManagerFilters(),
    sorting: createDefaultProjectManagerSorting(),
  };
}

export function createProjectManagerStore(initialState?: Partial<ProjectManagerViewSnapshot>) {
  const snapshot = createInitialSnapshot();
  const initialSearch = typeof initialState?.search === "string" ? initialState.search : snapshot.search;
  const initialSelection = toSelection(initialState?.selectedIds);
  const initialFilters = normalizeProjectFilterPreset(initialState?.filters);
  const initialSorting = normalizeSortingState(initialState?.sorting);

  return createStore<ProjectManagerState>((set, get) => ({
    search: initialSearch,
    selectedIds: initialSelection,
    filters: initialFilters,
    sorting: initialSorting,
    setSearch: (value) => {
      const next = value ?? "";
      if (get().search === next) {
        return;
      }
      set({ search: next });
    },
    clearSelection: () => {
      if (get().selectedIds.size === 0) {
        return;
      }
      set({ selectedIds: createEmptySelection() });
    },
    toggleSelection: (projectId) => {
      if (!projectId) {
        return;
      }
      set((state) => {
        const next = new Set(state.selectedIds);
        if (next.has(projectId)) {
          next.delete(projectId);
        } else {
          next.add(projectId);
        }
        return { selectedIds: next };
      });
    },
    replaceSelection: (projectIds) => {
      set(() => ({ selectedIds: toSelection(projectIds) }));
    },
    selectMany: (projectIds) => {
      const incoming = Array.from(projectIds);
      if (incoming.length === 0) {
        return;
      }
      set((state) => {
        const next = new Set(state.selectedIds);
        for (const id of incoming) {
          if (typeof id === "string" && id.length > 0) {
            next.add(id);
          }
        }
        return { selectedIds: next };
      });
    },
    removeSelection: (projectIds) => {
      const incoming = Array.from(projectIds);
      if (incoming.length === 0) {
        return;
      }
      set((state) => {
        if (state.selectedIds.size === 0) {
          return state;
        }
        const next = new Set(state.selectedIds);
        let changed = false;
        for (const id of incoming) {
          if (next.delete(id)) {
            changed = true;
          }
        }
        if (!changed) {
          return state;
        }
        return { selectedIds: next };
      });
    },
    pruneSelection: (validProjectIds) => {
      const current = get().selectedIds;
      if (current.size === 0) {
        return;
      }

      const valid = new Set<string>();
      for (const id of validProjectIds) {
        if (typeof id === "string" && id.length > 0) {
          valid.add(id);
        }
      }

      if (valid.size === 0) {
        set({ selectedIds: createEmptySelection() });
        return;
      }

      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (valid.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });

      if (changed) {
        set({ selectedIds: next });
      }
    },
    setFilters: (update) => {
      set((state) => {
        const nextPreset = typeof update === "function" ? update(state.filters) : update;
        return { filters: normalizeProjectFilterPreset(nextPreset) };
      });
    },
    resetFilters: () => {
      set({ filters: createDefaultProjectManagerFilters() });
    },
    setSorting: (update) => {
      set((state) => {
        const nextSorting = typeof update === "function" ? update(state.sorting) : update;
        return { sorting: normalizeSortingState(nextSorting) };
      });
    },
    resetSorting: () => {
      set({ sorting: createDefaultProjectManagerSorting() });
    },
  }));
}

const ProjectManagerStoreContext = createContext<ProjectManagerStore | null>(null);

export interface ProjectManagerStoreProviderProps extends PropsWithChildren {
  store?: ProjectManagerStore;
  initialState?: Partial<ProjectManagerViewSnapshot>;
}

export function ProjectManagerStoreProvider({ children, store, initialState }: ProjectManagerStoreProviderProps) {
  const storeRef = useRef<ProjectManagerStore | null>(store ?? null);

  if (!storeRef.current) {
    storeRef.current = createProjectManagerStore(initialState);
  }

  return <ProjectManagerStoreContext value={storeRef.current}>{children}</ProjectManagerStoreContext>;
}

function useProjectManagerStoreContext(): ProjectManagerStore {
  const store = use(ProjectManagerStoreContext);
  if (!store) {
    throw new Error("ProjectManagerStore must be used within its provider.");
  }
  return store;
}

export function useProjectManagerSelector<T>(selector: (state: ProjectManagerState) => T): T {
  const store = useProjectManagerStoreContext();
  return useStore(store, selector);
}

export function useProjectManagerActions<T>(selector: (state: ProjectManagerState) => T): T {
  return useProjectManagerSelector(selector);
}

export function useProjectManagerStoreApi(): ProjectManagerStore {
  return useProjectManagerStoreContext();
}

function cloneSortingState(sorting: SortingState): SortingState {
  if (!Array.isArray(sorting)) {
    return createDefaultProjectManagerSorting();
  }
  return sorting
    .filter((entry) => entry && typeof entry.id === "string")
    .map((entry) => ({ id: entry.id, desc: Boolean(entry.desc) }));
}

function normalizeSortingState(sorting: SortingState | undefined): SortingState {
  const normalized = cloneSortingState(sorting ?? createDefaultProjectManagerSorting());
  if (normalized.length === 0) {
    return createDefaultProjectManagerSorting();
  }
  return normalized;
}

export { ProjectManagerStoreContext };
