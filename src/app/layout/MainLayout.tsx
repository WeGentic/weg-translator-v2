import type { PropsWithChildren } from "react";

import { LayoutProvider } from "./layout-context";
import { LayoutBackground } from "./layout-background";
import { LayoutController } from "./layout-controller";
import { LayoutFooter } from "./layout-footer";
import { LayoutHeader } from "./layout-header";
import { LayoutMain } from "./layout-main";
import { LayoutShell } from "./layout-shell";
import { LayoutSidemenu } from "./layout-sidemenu";
import type { LayoutConfig } from "./layout-store";

/**
 * Props accepted by {@link LayoutRoot}. We keep this separate from
 * {@link LayoutProviderProps} to document that `config` is the only public
 * customization point for the root shell.
 */
export interface LayoutRootProps extends PropsWithChildren {
  config?: LayoutConfig;
}

/**
 * Root composition for the layout system. It wires the {@link LayoutProvider}
 * to the {@link LayoutShell} so downstream consumers can declaratively mount
 * slot components without worrying about store lifecycles.
 */
export function LayoutRoot({ children, config }: LayoutRootProps) {
  return (
    <LayoutProvider config={config}>
      <LayoutShell>{children}</LayoutShell>
    </LayoutProvider>
  );
}

/**
 * Aggregated export that mirrors the previous object-based API. Existing call
 * sites can continue using dot notation while the implementation details live
 * in focused modules.
 */
export const MainLayout = {
  Root: LayoutRoot,
  Header: LayoutHeader,
  Footer: LayoutFooter,
  Sidemenu: LayoutSidemenu,
  Background: LayoutBackground,
  Main: LayoutMain,
  Controller: LayoutController,
} as const;

export { useLayoutActions, useLayoutSelector, useLayoutStoreApi } from "./layout-context";
export type { LayoutProviderProps } from "./layout-context";
export type { LayoutConfig, LayoutState, SidemenuMode } from "./layout-store";
