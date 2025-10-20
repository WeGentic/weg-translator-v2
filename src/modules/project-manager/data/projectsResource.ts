import { listProjects, type ProjectListItem } from "@/core/ipc";

export const DEFAULT_PROJECTS_QUERY_LIMIT = 100;

type ProjectsResourceStatus = "idle" | "pending" | "resolved" | "error";

interface ProjectsResourceState {
  status: ProjectsResourceStatus;
  data: ProjectListItem[];
  promise: Promise<ProjectListItem[]> | null;
  error: Error | null;
  lastError: Error | null;
  lastUpdatedAt: number;
}

export interface ProjectsResourceSnapshot {
  status: ProjectsResourceStatus;
  data: ProjectListItem[];
  promise: Promise<ProjectListItem[]> | null;
  error: Error | null;
  lastError: Error | null;
  lastUpdatedAt: number;
}

const state: ProjectsResourceState = {
  status: "idle",
  data: [],
  promise: null,
  error: null,
  lastError: null,
  lastUpdatedAt: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("Failed to notify projects resource subscriber", error);
    }
  });
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function cloneProjects(projects: ProjectListItem[]): ProjectListItem[] {
  return projects.map((project) => ({ ...project }));
}

export function getProjectsResourceSnapshot(): ProjectsResourceSnapshot {
  return {
    status: state.status,
    data: cloneProjects(state.data),
    promise: state.promise,
    error: state.error,
    lastError: state.lastError,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}

export function mutateProjectsResource(
  updater: (projects: ProjectListItem[]) => ProjectListItem[],
): ProjectListItem[] {
  const current = cloneProjects(state.data);
  const next = updater(current);
  if (Array.isArray(next)) {
    state.data = cloneProjects(next);
    state.lastUpdatedAt = Date.now();
    state.status = "resolved";
    notify();
  }
  return cloneProjects(state.data);
}

export function setProjectsResource(projects: ProjectListItem[]): void {
  state.data = cloneProjects(projects);
  state.status = "resolved";
  state.error = null;
  state.lastUpdatedAt = Date.now();
  notify();
}

export async function refreshProjectsResource(): Promise<ProjectListItem[]> {
  const request = listProjects({ limit: DEFAULT_PROJECTS_QUERY_LIMIT });
  state.status = "pending";
  state.promise = request;
  notify();

  try {
    const projects = await request;
    setProjectsResource(projects);
    state.promise = null;
    return cloneProjects(state.data);
  } catch (unknownError) {
    const error =
      unknownError instanceof Error ? unknownError : new Error("Failed to load projects resource");
    state.error = error;
    state.lastError = error;
    state.status = "error";
    state.promise = null;
    notify();
    throw error;
  }
}

export function invalidateProjectsResource(): void {
  state.status = "idle";
  state.promise = null;
  notify();
}
