import { describe, expect, it } from "vitest";

import { filterProjects } from "@/modules/project-manager/state/filterProjects";
import type { ProjectListItem } from "@/core/ipc";
import type { TableFilters } from "@/modules/project-manager/state/types";

function makeItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  const now = Date.now();
  return {
    projectId: overrides.projectId ?? "p1",
    name: overrides.name ?? "Alpha",
    slug: overrides.slug ?? "alpha",
    projectType: overrides.projectType ?? "translation",
    status: overrides.status ?? "active",
    activityStatus: overrides.activityStatus ?? "running",
    fileCount: overrides.fileCount ?? 3,
    createdAt: overrides.createdAt ?? new Date(now - 86400000).toISOString(),
    updatedAt: overrides.updatedAt ?? new Date(now - 3600000).toISOString(),
  };
}

const DEFAULT_FILTERS: TableFilters = {
  progress: "all",
  projectType: "all",
  updatedWithin: "any",
};

describe("filterProjects", () => {
  it("filters by activity status", () => {
    const items = [
      makeItem({ projectId: "1", activityStatus: "running" }),
      makeItem({ projectId: "2", activityStatus: "completed" }),
      makeItem({ projectId: "3", activityStatus: "failed" }),
    ];

    const filtered = filterProjects(items, { ...DEFAULT_FILTERS, progress: "completed" }, "");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.projectId).toBe("2");
  });

  it("filters by project type", () => {
    const items = [
      makeItem({ projectId: "1", projectType: "translation" }),
      makeItem({ projectId: "2", projectType: "rag" }),
    ];

    const filtered = filterProjects(items, { ...DEFAULT_FILTERS, projectType: "rag" }, "");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.projectId).toBe("2");
  });

  it("filters by updated within timeframe", () => {
    const now = Date.now();
    const items = [
      makeItem({ projectId: "recent", updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() }),
      makeItem({ projectId: "old", updatedAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString() }),
    ];

    const filtered = filterProjects(items, { ...DEFAULT_FILTERS, updatedWithin: "24h" }, "");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.projectId).toBe("recent");
  });

  it("applies fuzzy search after filters", () => {
    const items = [
      makeItem({ projectId: "running", name: "Running", activityStatus: "running" }),
      makeItem({ projectId: "completed", name: "Completed", activityStatus: "completed" }),
    ];

    const filtered = filterProjects(items, { ...DEFAULT_FILTERS, progress: "completed" }, "comp");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.projectId).toBe("completed");
  });

  it("filters by search term alone", () => {
    const items = [
      makeItem({ projectId: "alpha", name: "Alpha", slug: "alpha" }),
      makeItem({ projectId: "beta", name: "Beta", slug: "beta" }),
    ];

    const filtered = filterProjects(items, DEFAULT_FILTERS, "alp");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.projectId).toBe("alpha");
  });

  it("returns all items when no filters or search applied", () => {
    const items = [makeItem({ projectId: "1" }), makeItem({ projectId: "2" })];
    const filtered = filterProjects(items, DEFAULT_FILTERS, "");
    expect(filtered).toHaveLength(2);
  });
});
