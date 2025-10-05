import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectManagerContent } from "@/features/project-manager/ProjectManagerContent";
import type { ProjectListItem } from "@/ipc";
import type { TableFilters } from "@/features/project-manager/types/types";

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

describe("ProjectManagerContent", () => {
  it("renders only progress-matching rows", () => {
    const items = [
      makeItem({ projectId: "1", name: "Running", activityStatus: "running" }),
      makeItem({ projectId: "2", name: "Completed", activityStatus: "completed" }),
      makeItem({ projectId: "3", name: "Failed", activityStatus: "failed" }),
    ];

    render(
      <ProjectManagerContent
        items={items}
        filters={{ ...DEFAULT_FILTERS, progress: "completed" }}
        selectedRows={new Set()}
      />,
    );

    expect(screen.queryByText("Running")).toBeNull();
    expect(screen.queryByText("Failed")).toBeNull();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });

  it("applies search string", () => {
    const items = [
      makeItem({ projectId: "alpha", name: "Alpha" }),
      makeItem({ projectId: "beta", name: "Beta", slug: "beta" }),
    ];

    render(
      <ProjectManagerContent
        items={items}
        filters={DEFAULT_FILTERS}
        search="alp"
        selectedRows={new Set()}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).toBeNull();
  });
});
