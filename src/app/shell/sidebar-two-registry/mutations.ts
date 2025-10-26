import { lazy } from "react";

import type {
  SidebarTwoActiveModule,
  SidebarTwoCachedModule,
  SidebarTwoModuleActivateOptions,
  SidebarTwoModuleClearFilter,
  SidebarTwoModuleDeactivateStrategy,
  SidebarTwoModuleDefinition,
  SidebarTwoModuleLoader,
  SidebarTwoRegistrySnapshot,
  SidebarTwoRegistryState,
} from "./types";
import {
  DEFAULT_ALLOWED_VIEWS,
  STICKY_CACHE_LIMIT,
} from "./registry-constants";

function dedupe(values: ReadonlyArray<string>): string[] {
  return Array.from(new Set(values));
}

function normaliseAllowedViews(input?: ReadonlyArray<string>): ReadonlyArray<string> {
  if (!input || input.length === 0) {
    return DEFAULT_ALLOWED_VIEWS;
  }
  return dedupe(input);
}

function resolveLoader<TPayload>(
  loader: SidebarTwoModuleLoader<TPayload>,
): SidebarTwoActiveModule<TPayload>["component"] {
  if (loader.kind === "component") {
    return loader.component;
  }
  if (loader.kind === "factory") {
    return loader.factory();
  }
  return lazy(loader.loader);
}

function pruneStickyModules(
  stickyModules: Record<string, SidebarTwoCachedModule>,
): Record<string, SidebarTwoCachedModule> {
  const entries = Object.entries(stickyModules);
  if (entries.length <= STICKY_CACHE_LIMIT) {
    return stickyModules;
  }
  const sorted = entries.sort(([, a], [, b]) => a.lastActiveAt - b.lastActiveAt);
  const trimmed = sorted.slice(sorted.length - STICKY_CACHE_LIMIT);
  return Object.fromEntries(trimmed);
}

export function createSidebarTwoRegistryState(): SidebarTwoRegistryState {
  return {
    definitions: {},
    activeModules: [],
    stickyModules: {},
    resolved: {},
    routeBindings: {},
    eventBindings: {},
    legacyContent: null,
  };
}

export function registerSidebarTwoModule(
  state: SidebarTwoRegistryState,
  definition: SidebarTwoModuleDefinition,
): SidebarTwoRegistryState {
  if (state.definitions[definition.id]) {
    return state;
  }

  const definitions = { ...state.definitions, [definition.id]: definition };
  const routeBindings = { ...state.routeBindings };
  const eventBindings = { ...state.eventBindings };

  if (definition.routes && definition.routes.length > 0) {
    for (const view of definition.routes) {
      const current = routeBindings[view] ?? [];
      routeBindings[view] = dedupe([...current, definition.id]);
    }
  }

  if (definition.trigger) {
    const current = eventBindings[definition.trigger.name] ?? [];
    eventBindings[definition.trigger.name] = dedupe([...current, definition.id]);
  }

  return {
    ...state,
    definitions,
    routeBindings,
    eventBindings,
  };
}

export function unregisterSidebarTwoModule(
  state: SidebarTwoRegistryState,
  id: string,
): SidebarTwoRegistryState {
  if (!state.definitions[id]) {
    return state;
  }

  const definitions = { ...state.definitions };
  delete definitions[id];

  const resolved = { ...state.resolved };
  delete resolved[id];

  const stickyModules = { ...state.stickyModules };
  delete stickyModules[id];

  const routeBindings = Object.fromEntries(
    Object.entries(state.routeBindings).map(([view, moduleIds]) => [
      view,
      moduleIds.filter((moduleId) => moduleId !== id),
    ]),
  );

  const eventBindings = Object.fromEntries(
    Object.entries(state.eventBindings).map(([name, moduleIds]) => [
      name,
      moduleIds.filter((moduleId) => moduleId !== id),
    ]),
  );

  const activeModules = state.activeModules.filter((module) => module.id !== id);

  return {
    ...state,
    definitions,
    resolved,
    stickyModules,
    routeBindings,
    eventBindings,
    activeModules,
  };
}

function upsertActiveModule(
  state: SidebarTwoRegistryState,
  module: SidebarTwoActiveModule,
): SidebarTwoActiveModule[] {
  const existingIndex = state.activeModules.findIndex((entry) => entry.id === module.id);
  if (existingIndex === -1) {
    return [...state.activeModules, module].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.id.localeCompare(b.id);
    });
  }

  const next = [...state.activeModules];
  next[existingIndex] = module;
  return next;
}

export function activateSidebarTwoModule(
  state: SidebarTwoRegistryState,
  options: SidebarTwoModuleActivateOptions,
): SidebarTwoRegistryState {
  const definition = state.definitions[options.id];
  if (!definition) {
    return state;
  }

  const resolvedComponent =
    state.resolved[definition.id] ?? resolveLoader(definition.loader);

  const resolved = state.resolved[definition.id]
    ? state.resolved
    : { ...state.resolved, [definition.id]: resolvedComponent };

  const allowedViews = normaliseAllowedViews(
    options.allowedViews ??
      definition.trigger?.allowedViews ??
      (definition.scope === "route" ? [options.view] : definition.routes),
  );

  const persist = options.sticky ?? Boolean(definition.persist);

  const module: SidebarTwoActiveModule = {
    id: definition.id,
    definitionId: definition.id,
    component: resolvedComponent,
    payload: options.payload,
    context: {
      view: options.view,
      payload: options.payload,
      activatedBy: options.activatedBy ?? "manual",
      allowedViews,
    },
    order: definition.order ?? 0,
    persist,
    slot: definition.slot ?? "primary",
    focusTargetId: definition.focusTargetId,
  };

  const activeModules = upsertActiveModule(state, module);

  const stickyModules = { ...state.stickyModules };
  delete stickyModules[definition.id];

  return {
    ...state,
    resolved,
    activeModules,
    stickyModules,
  };
}

export function deactivateSidebarTwoModule(
  state: SidebarTwoRegistryState,
  id: string,
  strategy: SidebarTwoModuleDeactivateStrategy = "remove",
): SidebarTwoRegistryState {
  const current = state.activeModules.find((module) => module.id === id);
  if (!current) {
    return state;
  }

  const activeModules = state.activeModules.filter((module) => module.id !== id);
  const definition = state.definitions[current.definitionId];

  let stickyModules = { ...state.stickyModules };

  if (strategy === "cache" || current.persist) {
    const snapshot =
      definition?.serialize?.(current.payload) ?? current.payload;
    stickyModules = {
      ...stickyModules,
      [current.definitionId]: {
        definitionId: current.definitionId,
        payload: current.payload,
        snapshot,
        allowedViews: current.context.allowedViews,
        lastActiveAt: Date.now(),
      },
    };
    stickyModules = pruneStickyModules(stickyModules);
  } else if (stickyModules[current.definitionId]) {
    delete stickyModules[current.definitionId];
  }

  return {
    ...state,
    activeModules,
    stickyModules,
  };
}

export function clearSidebarTwoModules(
  state: SidebarTwoRegistryState,
  filter: SidebarTwoModuleClearFilter,
): SidebarTwoRegistryState {
  let next = state;
  for (const module of state.activeModules) {
    const definition = state.definitions[module.definitionId];
    if (!definition) {
      continue;
    }

    const matchesScope = filter.scope ? definition.scope === filter.scope : true;
    if (!matchesScope) {
      continue;
    }

    if (!filter.viewKey) {
      next = deactivateSidebarTwoModule(
        next,
        module.id,
        module.persist ? "cache" : "remove",
      );
      continue;
    }

    const allowed = module.context.allowedViews;
    const canStay =
      allowed.includes("*") || allowed.includes(filter.viewKey) || module.context.view === filter.viewKey;

    if (!canStay) {
      next = deactivateSidebarTwoModule(
        next,
        module.id,
        module.persist ? "cache" : "remove",
      );
      continue;
    }

    if (
      definition.scope === "route" &&
      module.context.view !== filter.viewKey
    ) {
      next = deactivateSidebarTwoModule(
        next,
        module.id,
        module.persist ? "cache" : "remove",
      );
    }
  }

  return next;
}

export function setSidebarTwoLegacyContent(
  state: SidebarTwoRegistryState,
  content: SidebarTwoRegistryState["legacyContent"],
): SidebarTwoRegistryState {
  if (state.legacyContent === content) {
    return state;
  }
  return {
    ...state,
    legacyContent: content,
  };
}

export function serializeSidebarTwoRegistry(
  state: SidebarTwoRegistryState,
): SidebarTwoRegistrySnapshot {
  const active = state.activeModules
    .filter((module) => module.persist)
    .map((module) => ({
      definitionId: module.definitionId,
      payload: module.payload,
      allowedViews: module.context.allowedViews,
      activatedBy: module.context.activatedBy,
    }));

  const cached = Object.values(state.stickyModules).map((entry) => ({
    definitionId: entry.definitionId,
    payload: entry.payload,
    allowedViews: entry.allowedViews,
    activatedBy: "manual" as const,
    lastActiveAt: entry.lastActiveAt,
  }));

  return { active, cached };
}

export function hydrateSidebarTwoRegistry(
  state: SidebarTwoRegistryState,
  snapshot: SidebarTwoRegistrySnapshot | null | undefined,
): SidebarTwoRegistryState {
  if (!snapshot) {
    return state;
  }

  const stickyModules: Record<string, SidebarTwoCachedModule> = {};
  for (const entry of snapshot.cached) {
    stickyModules[entry.definitionId] = {
      definitionId: entry.definitionId,
      payload: entry.payload,
      snapshot: entry.payload,
      allowedViews: entry.allowedViews,
      lastActiveAt: entry.lastActiveAt,
    };
  }

  return {
    ...state,
    stickyModules,
  };
}
