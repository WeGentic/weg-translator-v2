import type { ComponentType, ReactNode } from "react";

export type SidebarTwoModuleScope = "route" | "persistent" | "event";

export type SidebarTwoModuleSlot = "primary" | "secondary";

export type SidebarTwoActivationSource = "route" | "event" | "manual" | "legacy";

export interface SidebarTwoActivationContext<TPayload = unknown> {
  view: string;
  payload?: TPayload;
  activatedBy: SidebarTwoActivationSource;
  allowedViews: ReadonlyArray<string>;
}

export interface SidebarTwoModuleProps<TPayload = unknown> {
  context: SidebarTwoActivationContext<TPayload>;
  payload: TPayload | undefined;
  deactivate: () => void;
  requestFocus?: () => void;
}

export type SidebarTwoModuleComponent<TPayload = unknown> = ComponentType<SidebarTwoModuleProps<TPayload>>;

export type SidebarTwoModuleLoader<TPayload = unknown> =
  | { kind: "component"; component: SidebarTwoModuleComponent<TPayload> }
  | { kind: "factory"; factory: () => SidebarTwoModuleComponent<TPayload> }
  | { kind: "lazy"; loader: () => Promise<{ default: SidebarTwoModuleComponent<TPayload> }> };

export type SidebarTwoEventAction = "activate" | "deactivate";

export interface SidebarTwoEventResult<TPayload = unknown> {
  action?: SidebarTwoEventAction;
  payload?: TPayload;
  view?: string;
  allowedViews?: ReadonlyArray<string>;
}

export interface SidebarTwoEventTrigger<TPayload = unknown> {
  name: string;
  allowedViews?: ReadonlyArray<string>;
  mapEvent?: (event: CustomEvent<unknown>) => SidebarTwoEventResult<TPayload> | null | undefined;
}

export interface SidebarTwoModuleDefinition<TPayload = unknown> {
  id: string;
  label?: string;
  order?: number;
  scope: SidebarTwoModuleScope;
  slot?: SidebarTwoModuleSlot;
  routes?: ReadonlyArray<string>;
  trigger?: SidebarTwoEventTrigger<TPayload>;
  persist?: boolean;
  loader: SidebarTwoModuleLoader<TPayload>;
  serialize?: (payload: TPayload | undefined) => unknown;
  hydrate?: (snapshot: unknown) => TPayload | undefined;
  focusTargetId?: string;
}

export interface SidebarTwoActiveModule<TPayload = unknown> {
  id: string;
  definitionId: string;
  component: SidebarTwoModuleComponent<TPayload>;
  payload: TPayload | undefined;
  context: SidebarTwoActivationContext<TPayload>;
  order: number;
  persist: boolean;
  slot: SidebarTwoModuleSlot;
  focusTargetId?: string;
}

export interface SidebarTwoCachedModule<TPayload = unknown> {
  definitionId: string;
  payload: TPayload | undefined;
  snapshot: unknown;
  allowedViews: ReadonlyArray<string>;
  lastActiveAt: number;
}

export interface SidebarTwoRegistryState {
  definitions: Record<string, SidebarTwoModuleDefinition>;
  activeModules: SidebarTwoActiveModule[];
  stickyModules: Record<string, SidebarTwoCachedModule>;
  resolved: Record<string, SidebarTwoModuleComponent>;
  routeBindings: Record<string, string[]>;
  eventBindings: Record<string, string[]>;
  legacyContent: ReactNode | null;
}

export interface SidebarTwoRegistrySnapshotEntry {
  definitionId: string;
  payload: unknown;
  allowedViews: ReadonlyArray<string>;
  activatedBy: SidebarTwoActivationSource;
}

export interface SidebarTwoRegistrySnapshot {
  active: SidebarTwoRegistrySnapshotEntry[];
  cached: Array<SidebarTwoRegistrySnapshotEntry & { lastActiveAt: number }>;
}

export interface SidebarTwoModuleActivateOptions<TPayload = unknown> {
  id: string;
  view: string;
  payload?: TPayload;
  allowedViews?: ReadonlyArray<string>;
  activatedBy?: SidebarTwoActivationSource;
  sticky?: boolean;
}

export type SidebarTwoModuleDeactivateStrategy = "remove" | "cache";

export interface SidebarTwoModuleClearFilter {
  scope?: SidebarTwoModuleScope;
  viewKey?: string;
}
