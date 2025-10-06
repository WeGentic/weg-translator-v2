import { use, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { ProjectListItem, ProjectListQuery } from "@/ipc";

import {
  DEFAULT_PROJECTS_QUERY_LIMIT,
  getProjectsResourceSnapshot,
  getProjectsResourceVersion,
  invalidateProjectsResource,
  loadProjectsResource,
  refreshProjectsResource,
  releaseProjectsResourceEvents,
  retainProjectsResourceEvents,
  subscribeProjectsResource,
} from "./projectsResource";

export interface UseProjectsResourceOptions {
  limit?: number;
  offset?: number;
  suspend?: boolean;
}

export interface UseProjectsResourceResult {
  projects: ProjectListItem[];
  refresh: () => Promise<ProjectListItem[]>;
  invalidate: () => void;
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
  lastError: Error | null;
}

function normalizeOptions(options: Pick<UseProjectsResourceOptions, "limit" | "offset">): ProjectListQuery {
  return {
    limit:
      options.limit !== undefined ? Math.max(0, Math.trunc(options.limit)) : DEFAULT_PROJECTS_QUERY_LIMIT,
    offset: options.offset !== undefined ? Math.max(0, Math.trunc(options.offset)) : 0,
  };
}

function ensureSnapshot(query: ProjectListQuery) {
  let snapshot = getProjectsResourceSnapshot(query);

  if (snapshot.status === "idle" || snapshot.status === "rejected") {
    const promise = loadProjectsResource(query);
    snapshot = getProjectsResourceSnapshot(query);

    if (snapshot.status === "pending" && !snapshot.promise) {
      snapshot = {
        ...snapshot,
        promise,
      };
    }
  }

  return snapshot;
}

export function useProjectsResource(options: UseProjectsResourceOptions = {}): UseProjectsResourceResult {
  const { limit, offset, suspend: suspendOption } = options;
  const suspend = suspendOption ?? true;
  const query = useMemo(() => normalizeOptions({ limit, offset }), [limit, offset]);
  const refresh = useCallback(() => refreshProjectsResource(query), [query]);
  const invalidate = useCallback(() => invalidateProjectsResource(query), [query]);

  useEffect(() => {
    retainProjectsResourceEvents();
    return () => {
      releaseProjectsResourceEvents();
    };
  }, []);

  useSyncExternalStore(
    (listener) => subscribeProjectsResource(query, listener),
    () => getProjectsResourceVersion(query),
    () => getProjectsResourceVersion(query),
  );

  let snapshot = ensureSnapshot(query);

  if (snapshot.status === "pending") {
    const promise = snapshot.promise ?? loadProjectsResource(query);

    if (!suspend) {
      void promise;
    } else {
      void use(promise);
    }

    snapshot = getProjectsResourceSnapshot(query);
  }

  if (snapshot.status === "refreshing" || snapshot.status === "resolved") {
    const projects = snapshot.data ?? [];

    return {
      projects,
      refresh,
      invalidate,
      isRefreshing: snapshot.status === "refreshing",
      lastUpdatedAt: snapshot.lastUpdatedAt,
      lastError: snapshot.lastError,
    };
  }

  if (snapshot.status === "rejected") {
    throw snapshot.error ?? new Error("Failed to load projects");
  }

  if (suspend) {
    const promise = loadProjectsResource(query);
    void use(promise);
    const finalSnapshot = getProjectsResourceSnapshot(query);

    return {
      projects: finalSnapshot.data ?? [],
      refresh,
      invalidate,
      isRefreshing: finalSnapshot.status === "refreshing",
      lastUpdatedAt: finalSnapshot.lastUpdatedAt,
      lastError: finalSnapshot.lastError,
    };
  }

  return {
    projects: snapshot.data ?? [],
    refresh,
    invalidate,
    isRefreshing: snapshot.status === "refreshing",
    lastUpdatedAt: snapshot.lastUpdatedAt,
    lastError: snapshot.lastError,
  };
}
