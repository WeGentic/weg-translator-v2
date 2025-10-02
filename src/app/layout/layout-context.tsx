import {
  createContext,
  use,
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import { useStore } from "zustand";

import { createLayoutStore, type LayoutConfig, type LayoutState, type LayoutStore } from "./layout-store";

/**
 * Props accepted by the {@link LayoutProvider}. The optional {@link LayoutConfig}
 * allows callers to seed structural defaults (dimensions, visibility, etc.) for
 * every layout surface before any slot components mount.
 */
export interface LayoutProviderProps extends PropsWithChildren {
  config?: LayoutConfig;
}

/**
 * Shared context used by every layout-aware component. We expose the raw
 * {@link LayoutStore} instance so hooks can subscribe to slices of state using
 * Zustand's selectors without forcing unnecessary React renders.
 */
const LayoutStoreContext = createContext<LayoutStore | null>(null);

/**
 * Grants safe access to the layout store. We centralize the null-check here so
 * individual components can stay focused on their UI responsibilities.
 *
 * @throws Error when a consumer is rendered outside of {@link LayoutProvider}.
 */
function useLayoutStoreContext(): LayoutStore {
  const store = use(LayoutStoreContext);
  if (!store) {
    throw new Error("Layout components must be rendered within <MainLayout.Root>.");
  }
  return store;
}

/**
 * React context provider responsible for instantiating and configuring the
 * layout store. The store is created exactly once so we preserve referential
 * stability across renders while still allowing on-the-fly configuration
 * updates via {@link LayoutConfig}.
 */
export function LayoutProvider({ children, config }: LayoutProviderProps) {
  const storeRef = useRef<LayoutStore | undefined>(undefined);

  if (!storeRef.current) {
    // Lazily create the store so server components and Suspense-ready trees
    // don't pay the cost unless the layout actually mounts.
    storeRef.current = createLayoutStore(config);
  }

  const store = storeRef.current;

  useEffect(() => {
    if (config) {
      store.getState().applyConfig(config);
    }
  }, [store, config]);

  return <LayoutStoreContext value={store}>{children}</LayoutStoreContext>;
}

/**
 * Returns a reactive slice of the layout store. Components can pass any
 * selector that maps {@link LayoutState} to the minimal data they require,
 * ensuring we only re-render when those specific pieces change.
 */
export function useLayoutSelector<T>(selector: (state: LayoutState) => T): T {
  const store = useLayoutStoreContext();
  return useStore(store, selector);
}

/**
 * Convenience wrapper that mirrors {@link useLayoutSelector} but signals intent
 * to work with imperative actions (setters, commands) from the layout store.
 * This keeps the public API compatible with previous versions while embracing
 * React 19's compiler-managed memoization.
 */
export function useLayoutActions<T>(selector: (state: LayoutState) => T): T {
  return useLayoutSelector(selector);
}

/**
 * Exposes the underlying Zustand store for scenarios where components need to
 * dispatch multiple updates during a single render or effect without subscribing
 * to additional slices. The store reference is stable for the lifetime of the
 * provider.
 */
export function useLayoutStoreApi(): LayoutStore {
  return useLayoutStoreContext();
}

export { LayoutStoreContext };
