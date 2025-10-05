import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { ProjectManagerContent } from "@/features/project-manager/ProjectManagerContent";
import type { ProjectListItem } from "@/ipc";
import type { TableFilters } from "@/features/project-manager/types/types";

const ITEMS: ProjectListItem[] = [
  {
    projectId: "1",
    name: "Pending Foo",
    slug: "pending",
    projectType: "translation",
    status: "active",
    activityStatus: "pending",
    fileCount: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    projectId: "2",
    name: "Completed Bar",
    slug: "completed",
    projectType: "translation",
    status: "active",
    activityStatus: "completed",
    fileCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_FILTERS: TableFilters = {
  progress: "all",
  projectType: "all",
  updatedWithin: "any",
};

afterEach(() => {
  cleanup();
});

describe("ProjectManagerContent dynamic filters", () => {
  it("updates rows when filters change", () => {
    const { rerender } = render(
      <ProjectManagerContent
        items={ITEMS}
        filters={DEFAULT_FILTERS}
        selectedRows={new Set()}
      />,
    );

    expect(screen.getByText("Pending Foo")).toBeInTheDocument();
    expect(screen.getByText("Completed Bar")).toBeInTheDocument();

    rerender(
      <ProjectManagerContent
        items={ITEMS}
        filters={{ ...DEFAULT_FILTERS, progress: "completed" }}
        selectedRows={new Set()}
      />,
    );

    expect(screen.getByText("Completed Bar")).toBeInTheDocument();
    expect(screen.queryByText("Pending Foo")).toBeNull();
  });
});
