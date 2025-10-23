import { use, useCallback, useMemo, useSyncExternalStore, useTransition } from "react";

import { listProjects, type ProjectListItem, type ProjectListQuery } from "@/core/ipc";

export const DEFAULT_PROJECTS_QUERY_LIMIT = 100;

export type ProjectsResourceStatus = "idle" | "pending" | "resolved" | "error";

export interface ProjectsResourceSnapshot {
  status: ProjectsResourceStatus;
  data: readonly ProjectListItem[];
  promise: Promise<readonly ProjectListItem[]> | null;
  error: Error | null;
  lastUpdatedAt: number;
}

export interface ProjectListResourceResult {
  projects: readonly ProjectListItem[];
  status: ProjectsResourceStatus;
  error: Error | null;
  lastUpdatedAt: number;
  isPending: boolean;
  refresh: (options?: RefreshOptions) => Promise<readonly ProjectListItem[]>;
  mutate: (updater: (projects: ProjectListItem[]) => ProjectListItem[]) => readonly ProjectListItem[];
  invalidate: () => void;
}

export interface RefreshOptions {
  immediate?: boolean;
}

type Listener = () => void;

type ProjectListQueryNormalized = {
  limit: number;
  offset: number;
};

interface ProjectListEntry {
  key: string;
  query: ProjectListQueryNormalized;
  status: ProjectsResourceStatus;
  data: readonly ProjectListItem[];
  promise: Promise<readonly ProjectListItem[]> | null;
  error: Error | null;
  lastUpdatedAt: number;
  snapshot: ProjectsResourceSnapshot;
  listeners: Set<Listener>;
}

const entries = new Map<string, ProjectListEntry>();

export function __resetProjectsResourceForTesting(): void {
  entries.clear();
}

function normalizeQuery(query?: ProjectListQuery): ProjectListQueryNormalized {
  const rawLimit = query?.limit;
  const rawOffset = query?.offset;

  const limit =
    typeof rawLimit === "number" && Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.floor(rawLimit)
      : DEFAULT_PROJECTS_QUERY_LIMIT;
  const offset =
    typeof rawOffset === "number" && Number.isFinite(rawOffset) && rawOffset >= 0
      ? Math.floor(rawOffset)
      : 0;

  return { limit, offset };
}

function serializeQuery(query: ProjectListQueryNormalized): string {
  return `${query.limit}:${query.offset}`;
}

function cloneProjects(projects: readonly ProjectListItem[]): ProjectListItem[] {
  return projects.map((project) => ({ ...project }));
}

function createEntry(query: ProjectListQueryNormalized, key: string): ProjectListEntry {
  const snapshot: ProjectsResourceSnapshot = {
    status: "idle",
    data: [],
    promise: null,
    error: null,
    lastUpdatedAt: 0,
  };

  return {
    key,
    query,
    status: "idle",
    data: [],
    promise: null,
    error: null,
    lastUpdatedAt: 0,
    snapshot,
    listeners: new Set(),
  };
}

function updateSnapshot(entry: ProjectListEntry): void {
  entry.snapshot = {
    status: entry.status,
    data: entry.data,
    promise: entry.promise,
    error: entry.error,
    lastUpdatedAt: entry.lastUpdatedAt,
  };
}

function notify(entry: ProjectListEntry): void {
  entry.listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("[projectsResource] failed to notify subscriber", error);
    }
  });
}

function ensureEntry(query: ProjectListQueryNormalized): ProjectListEntry {
  const key = serializeQuery(query);
  const existing = entries.get(key);
  if (existing) {
    return existing;
  }
  const entry = createEntry(query, key);
  entries.set(key, entry);
  return entry;
}

// Single entry fetch orchestrator: captures a shared promise so concurrent
// readers suspend on the same work, clones results to avoid accidental mutation,
// and writes a resolved snapshot back into the store before notifying listeners.
function startFetch(entry: ProjectListEntry): Promise<readonly ProjectListItem[]> {
  const request = listProjects(entry.query)
    .then((projects) => cloneProjects(projects))
    .then((projects) => {
      entry.data = projects;
      entry.status = "resolved";
      entry.error = null;
      entry.lastUpdatedAt = Date.now();
      updateSnapshot(entry);
      notify(entry);
      return projects;
    })
    .catch((unknownError) => {
      const error =
        unknownError instanceof Error ? unknownError : new Error("Failed to load projects resource.");
      entry.error = error;
      entry.status = "error";
      updateSnapshot(entry);
      notify(entry);
      throw error;
    });

  entry.promise = request;
  entry.status = "pending";
  entry.error = null;
  updateSnapshot(entry);
  notify(entry);

  return request;
}

function readEntry(entry: ProjectListEntry): Promise<readonly ProjectListItem[]> {
  if (entry.status === "idle") {
    return startFetch(entry);
  }

  if (entry.promise) {
    return entry.promise;
  }

  return startFetch(entry);
}

function refreshEntry(entry: ProjectListEntry): Promise<readonly ProjectListItem[]> {
  return startFetch(entry);
}

// Optimistic mutation helper: works on cloned arrays to keep the store immutable,
// stamps a fresh timestamp for consumers, and immediately notifies subscribers.
function mutateEntry(
  entry: ProjectListEntry,
  updater: (projects: ProjectListItem[]) => ProjectListItem[],
): readonly ProjectListItem[] {
  const draft = cloneProjects(entry.data);
  const result = updater(draft);
  if (!Array.isArray(result)) {
    return entry.data;
  }

  const next = cloneProjects(result);
  entry.data = next;
  entry.status = "resolved";
  entry.error = null;
  entry.lastUpdatedAt = Date.now();
  entry.promise = Promise.resolve(next);
  updateSnapshot(entry);
  notify(entry);
  return next;
}

function invalidateEntry(entry: ProjectListEntry): void {
  entry.status = "idle";
  entry.promise = null;
  entry.error = null;
  updateSnapshot(entry);
  notify(entry);
}

const projectListStore = {
  ensure(query: ProjectListQueryNormalized): ProjectListEntry {
    return ensureEntry(query);
  },
  subscribe(query: ProjectListQueryNormalized, listener: Listener): () => void {
    const entry = projectListStore.ensure(query);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  },
  getSnapshot(query: ProjectListQueryNormalized): ProjectsResourceSnapshot {
    const entry = projectListStore.ensure(query);
    return entry.snapshot;
  },
  read(query: ProjectListQueryNormalized): Promise<readonly ProjectListItem[]> {
    const entry = projectListStore.ensure(query);
    return readEntry(entry);
  },
  refresh(query: ProjectListQueryNormalized): Promise<readonly ProjectListItem[]> {
    const entry = projectListStore.ensure(query);
    return refreshEntry(entry);
  },
  mutate(
    updater: (projects: ProjectListItem[]) => ProjectListItem[],
    query: ProjectListQueryNormalized,
  ): readonly ProjectListItem[] {
    const entry = projectListStore.ensure(query);
    return mutateEntry(entry, updater);
  },
  invalidate(query: ProjectListQueryNormalized): void {
    const entry = projectListStore.ensure(query);
    invalidateEntry(entry);
  },
};

export function useProjectListResource(query?: ProjectListQuery): ProjectListResourceResult {
  const normalizedQuery = useMemo(
    () => normalizeQuery(query),
    [query],
  );

  const subscribe = useCallback(
    (listener: Listener) => projectListStore.subscribe(normalizedQuery, listener),
    [normalizedQuery],
  );

  const getSnapshot = useCallback(
    () => projectListStore.getSnapshot(normalizedQuery),
    [normalizedQuery],
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const promise = useMemo(
    () => projectListStore.read(normalizedQuery),
    [normalizedQuery],
  );

  const projects = use(promise);

  const [isRefreshPending, startRefreshTransition] = useTransition();

  const refresh = useCallback(
    (options?: RefreshOptions) => {
      if (options?.immediate) {
        return projectListStore.refresh(normalizedQuery);
      }

      return new Promise<readonly ProjectListItem[]>((resolve, reject) => {
        startRefreshTransition(() => {
          projectListStore.refresh(normalizedQuery).then(resolve, reject);
        });
      });
    },
    [normalizedQuery, startRefreshTransition],
  );

  const mutate = useCallback(
    (updater: (projects: ProjectListItem[]) => ProjectListItem[]) =>
      projectListStore.mutate(updater, normalizedQuery),
    [normalizedQuery],
  );

  const invalidate = useCallback(
    () => projectListStore.invalidate(normalizedQuery),
    [normalizedQuery],
  );

  const isPending = snapshot.status === "pending" || isRefreshPending;

  return useMemo(
    () => ({
      projects,
      status: snapshot.status,
      error: snapshot.error,
      lastUpdatedAt: snapshot.lastUpdatedAt,
      isPending,
      refresh,
      mutate,
      invalidate,
    }),
    [projects, snapshot.status, snapshot.error, snapshot.lastUpdatedAt, isPending, refresh, mutate, invalidate],
  );
}

export function getProjectsResourceSnapshot(query?: ProjectListQuery): ProjectsResourceSnapshot {
  const normalizedQuery = normalizeQuery(query);
  const entry = projectListStore.ensure(normalizedQuery);
  return {
    status: entry.status,
    data: cloneProjects(entry.data),
    promise: entry.promise,
    error: entry.error,
    lastUpdatedAt: entry.lastUpdatedAt,
  };
}

export function refreshProjectsResource(query?: ProjectListQuery): Promise<readonly ProjectListItem[]> {
  const normalizedQuery = normalizeQuery(query);
  return projectListStore.refresh(normalizedQuery);
}

export function mutateProjectsResource(
  updater: (projects: ProjectListItem[]) => ProjectListItem[],
  query?: ProjectListQuery,
): readonly ProjectListItem[] {
  const normalizedQuery = normalizeQuery(query);
  return projectListStore.mutate(updater, normalizedQuery);
}

export function invalidateProjectsResource(query?: ProjectListQuery): void {
  const normalizedQuery = normalizeQuery(query);
  projectListStore.invalidate(normalizedQuery);
}
