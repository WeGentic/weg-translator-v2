import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PROJECTS_QUERY_LIMIT,
  __resetProjectsResourceForTesting,
  getProjectsResourceSnapshot,
  invalidateProjectsResource,
  mutateProjectsResource,
  refreshProjectsResource,
} from "@/modules/project-manager/data/projectsResource";
import type { ProjectListItem } from "@/core/ipc";
import { listProjects } from "@/core/ipc";

vi.mock("@/core/ipc", () => ({
  listProjects: vi.fn(),
}));

const listProjectsMock = vi.mocked(listProjects);

let projectIndex = 0;

function makeProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  const now = new Date().toISOString();
  return {
    projectId: overrides.projectId ?? `project-${projectIndex++}`,
    name: overrides.name ?? "Sample Project",
    slug: overrides.slug ?? "sample-project",
    projectType: overrides.projectType ?? "translation",
    status: overrides.status ?? "READY",
    activityStatus: overrides.activityStatus ?? "running",
    fileCount: overrides.fileCount ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    clientId: overrides.clientId ?? null,
    clientName: overrides.clientName ?? null,
    notes: overrides.notes ?? null,
    subjects: overrides.subjects ?? [],
  };
}

describe("projectsResource", () => {
beforeEach(() => {
  listProjectsMock.mockReset();
  __resetProjectsResourceForTesting();
  projectIndex = 0;
});

  it("refreshes the resource and stores a resolved snapshot", async () => {
    const firstProject = makeProject({ projectId: "p-1", name: "First" });
    listProjectsMock.mockResolvedValueOnce([firstProject]);

    const result = await refreshProjectsResource();

    expect(listProjectsMock).toHaveBeenCalledWith({ limit: DEFAULT_PROJECTS_QUERY_LIMIT, offset: 0 });
    expect(result).toHaveLength(1);
    expect(result[0]?.projectId).toBe("p-1");

    const snapshot = getProjectsResourceSnapshot();
    expect(snapshot.status).toBe("resolved");
    expect(snapshot.error).toBeNull();
    expect(snapshot.data).toEqual([firstProject]);
    expect(snapshot.data).not.toBe(result); // ensure snapshot clones data
  });

  it("optimistically mutates projects and keeps snapshot in sync", async () => {
    const initial = makeProject({ projectId: "initial" });
    listProjectsMock.mockResolvedValueOnce([initial]);
    await refreshProjectsResource();

    const mutated = mutateProjectsResource((projects) => [
      ...projects,
      makeProject({ projectId: "mutated", name: "Mutated" }),
    ]);

    expect(mutated).toHaveLength(2);
    expect(mutated.find((project) => project.projectId === "mutated")).toBeDefined();

    const snapshot = getProjectsResourceSnapshot();
    expect(snapshot.status).toBe("resolved");
    expect(snapshot.data).toHaveLength(2);
    expect(snapshot.data.find((project) => project.projectId === "mutated")).toBeDefined();
  });

  it("invalidates the resource and triggers a refetch on next refresh", async () => {
    listProjectsMock.mockResolvedValueOnce([makeProject({ projectId: "first" })]);
    await refreshProjectsResource();

    invalidateProjectsResource();
    const invalidated = getProjectsResourceSnapshot();
    expect(invalidated.status).toBe("idle");

    listProjectsMock.mockResolvedValueOnce([makeProject({ projectId: "second" })]);
    const refreshed = await refreshProjectsResource();
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0]?.projectId).toBe("second");
  });

  it("captures errors from listProjects and exposes them via the snapshot", async () => {
    listProjectsMock.mockRejectedValueOnce(new Error("load failed"));

    await expect(refreshProjectsResource()).rejects.toThrow("load failed");

    const snapshot = getProjectsResourceSnapshot();
    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.message).toBe("load failed");
  });
});
