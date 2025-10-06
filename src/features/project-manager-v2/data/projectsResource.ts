import { listProjects, type ProjectListItem, type ProjectListQuery, type ProjectsChangedPayload } from "@/ipc";
import { onProjectsUpdated } from "@/ipc/events";

export const DEFAULT_PROJECTS_QUERY_LIMIT = 100;

type ResourceStatus = "idle" | "pending" | "refreshing" | "resolved" | "rejected";

type NormalizedProjectsQuery = {
  limit: number;
  offset: number;
};

interface ProjectsResourceRecord {
  status: ResourceStatus;
  data: ProjectListItem[] | null;
  promise: Promise<ProjectListItem[]> | null;
  error: Error | null;
  lastError: Error | null;
  lastUpdatedAt: number | null;
  version: number;
}

interface FetchOptions {
  notifyStart: boolean;
  mode: "initial" | "refresh";
}

const resourceRecords = new Map<string, ProjectsResourceRecord>();
const resourceListeners = new Map<string, Set<() => void>>();

let projectsEventSubscribers = 0;
let projectsEventUnlisten: (() => void) | null = null;
let projectsEventSubscriptionPromise: Promise<void> | null = null;
let pendingEventUnsubscribe = false;

function normalizeQuery(query?: ProjectListQuery): NormalizedProjectsQuery {
  return {
    limit:
      query && typeof query.limit === "number" && Number.isFinite(query.limit)
        ? Math.max(0, Math.trunc(query.limit))
        : DEFAULT_PROJECTS_QUERY_LIMIT,
    offset:
      query && typeof query.offset === "number" && Number.isFinite(query.offset)
        ? Math.max(0, Math.trunc(query.offset))
        : 0,
  };
}

function toQueryKey(query: NormalizedProjectsQuery) {
  return `limit:${query.limit}|offset:${query.offset}`;
}

function parseQueryKey(key: string): NormalizedProjectsQuery {
  const segments = key.split("|");
  let limit = DEFAULT_PROJECTS_QUERY_LIMIT;
  let offset = 0;

  for (const segment of segments) {
    const [label, rawValue] = segment.split(":");
    if (!rawValue) continue;
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      continue;
    }
    if (label === "limit") {
      limit = parsed;
    } else if (label === "offset") {
      offset = parsed;
    }
  }

  return { limit, offset };
}

function getOrCreateRecord(key: string) {
  const existing = resourceRecords.get(key);
  if (existing) {
    return existing;
  }

  const fresh: ProjectsResourceRecord = {
    status: "idle",
    data: null,
    promise: null,
    error: null,
    lastError: null,
    lastUpdatedAt: null,
    version: 0,
  };

  resourceRecords.set(key, fresh);
  return fresh;
}

function notify(key: string) {
  const listeners = resourceListeners.get(key);
  if (!listeners) return;
  listeners.forEach((listener) => listener());
}

function toError(value: unknown) {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === "string") {
    return new Error(value);
  }

  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error("Unknown projects resource error");
  }
}

function handleProjectsUpdatedEvent(payload: ProjectsChangedPayload) {
  if (resourceRecords.size === 0) {
    return;
  }

  const keys = Array.from(resourceRecords.keys());

  for (const key of keys) {
    const query = parseQueryKey(key);
    refreshProjectsResource(query).catch((error) => {
      if (import.meta.env.DEV) {
        const normalized = toError(error);
        console.error("[projectsResource] Failed to refresh projects after event", {
          kind: payload.kind,
          projectId: payload.projectId,
          message: normalized.message,
        });
      }
    });
  }
}

function ensureProjectsEventListener() {
  if (typeof window === "undefined") {
    return;
  }

  if (projectsEventUnlisten || projectsEventSubscriptionPromise) {
    return;
  }

  projectsEventSubscriptionPromise = onProjectsUpdated(handleProjectsUpdatedEvent)
    .then((unlisten) => {
      projectsEventUnlisten = unlisten;

      if (pendingEventUnsubscribe && projectsEventUnlisten) {
        pendingEventUnsubscribe = false;
        const teardown = projectsEventUnlisten;
        projectsEventUnlisten = null;
        teardown();
      }
    })
    .catch((error) => {
      if (import.meta.env.DEV) {
        console.error("[projectsResource] Unable to subscribe to projects updates", error);
      }
    })
    .finally(() => {
      projectsEventSubscriptionPromise = null;
      pendingEventUnsubscribe = false;
    });
}

export function retainProjectsResourceEvents() {
  projectsEventSubscribers += 1;
  pendingEventUnsubscribe = false;
  if (projectsEventSubscribers === 1) {
    ensureProjectsEventListener();
  }
}

export function releaseProjectsResourceEvents() {
  if (projectsEventSubscribers === 0) {
    return;
  }

  projectsEventSubscribers -= 1;

  if (projectsEventSubscribers > 0) {
    return;
  }

  if (projectsEventUnlisten) {
    const teardown = projectsEventUnlisten;
    projectsEventUnlisten = null;
    teardown();
  } else if (projectsEventSubscriptionPromise) {
    pendingEventUnsubscribe = true;
  }
}

function startFetch(
  key: string,
  query: NormalizedProjectsQuery,
  { notifyStart, mode }: FetchOptions,
) {
  const record = getOrCreateRecord(key);
  const isBackground = mode === "refresh" && record.data !== null;

  const promise = listProjects(query).then(
    (projects) => {
      record.status = "resolved";
      record.data = projects;
      record.promise = null;
      record.error = null;
      record.lastError = null;
      record.lastUpdatedAt = Date.now();
      record.version += 1;
      notify(key);
      return projects;
    },
    (error) => {
      const normalizedError = toError(error);

      if (isBackground && record.data !== null) {
        record.status = "resolved";
        record.promise = null;
        record.lastError = normalizedError;
        record.version += 1;
        notify(key);
      } else {
        record.status = "rejected";
        record.data = null;
        record.promise = null;
        record.error = normalizedError;
        record.lastError = null;
        record.lastUpdatedAt = null;
        record.version += 1;
        notify(key);
      }

      throw normalizedError;
    },
  );

  record.promise = promise;
  record.error = null;
  record.lastError = null;
  record.lastUpdatedAt = isBackground ? record.lastUpdatedAt : null;
  record.status = isBackground ? "refreshing" : "pending";

  if (notifyStart && isBackground) {
    record.version += 1;
    notify(key);
  }

  return promise;
}

function getKeyedParts(query?: ProjectListQuery) {
  const normalized = normalizeQuery(query);
  const key = toQueryKey(normalized);
  return { key, normalized };
}

export function loadProjectsResource(query?: ProjectListQuery) {
  const { key, normalized } = getKeyedParts(query);
  const record = getOrCreateRecord(key);

  if (record.promise) {
    return record.promise;
  }

  const mode: FetchOptions["mode"] = record.data !== null ? "refresh" : "initial";
  return startFetch(key, normalized, { notifyStart: false, mode });
}

export function refreshProjectsResource(query?: ProjectListQuery) {
  const { key, normalized } = getKeyedParts(query);
  const record = getOrCreateRecord(key);

  if (record.promise) {
    return record.promise;
  }

  const mode: FetchOptions["mode"] = record.data !== null ? "refresh" : "initial";
  return startFetch(key, normalized, { notifyStart: true, mode });
}

export function invalidateProjectsResource(query?: ProjectListQuery) {
  const { key } = getKeyedParts(query);
  const record = getOrCreateRecord(key);

  if (record.promise) {
    // let the in-flight request settle but mark the cache stale
    record.promise = null;
  }

  record.status = "idle";
  record.data = null;
  record.error = null;
  record.lastError = null;
  record.lastUpdatedAt = null;
  record.version += 1;
  notify(key);
}

export function mutateProjectsResource(
  updater: (projects: ProjectListItem[]) => ProjectListItem[],
  query?: ProjectListQuery,
) {
  const { key } = getKeyedParts(query);
  const record = getOrCreateRecord(key);

  const base = record.data ?? [];
  const next = updater(base);

  record.data = next;
  record.status = "resolved";
  record.promise = null;
  record.error = null;
  record.lastError = null;
  record.lastUpdatedAt = Date.now();
  record.version += 1;
  notify(key);
}

export function subscribeProjectsResource(query: ProjectListQuery | undefined, listener: () => void) {
  const { key } = getKeyedParts(query);
  let listeners = resourceListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    resourceListeners.set(key, listeners);
  }
  listeners.add(listener);

  return () => {
    const current = resourceListeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      resourceListeners.delete(key);
    }
  };
}

export function getProjectsResourceSnapshot(query?: ProjectListQuery) {
  const { key } = getKeyedParts(query);
  const record = getOrCreateRecord(key);
  return {
    status: record.status,
    data: record.data,
    promise: record.promise,
    error: record.error,
    lastError: record.lastError,
    lastUpdatedAt: record.lastUpdatedAt,
    isRefreshing: record.status === "refreshing",
  } as const;
}

export function getProjectsResourceVersion(query?: ProjectListQuery) {
  const { key } = getKeyedParts(query);
  return getOrCreateRecord(key).version;
}

export type ProjectsResourceStatus = ResourceStatus;
