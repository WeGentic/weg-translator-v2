import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectsDataTable } from "@/components/projects/table";
import type { ProjectListItem } from "@/ipc";

function makeItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    projectId: overrides.projectId ?? "p1",
    name: overrides.name ?? "Alpha",
    slug: overrides.slug ?? "alpha",
    projectType: overrides.projectType ?? "translation",
    status: overrides.status ?? "active",
    activityStatus: overrides.activityStatus ?? "running",
    fileCount: overrides.fileCount ?? 3,
    createdAt: overrides.createdAt ?? new Date(Date.now() - 86400000).toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

describe("ProjectsDataTable", () => {
  it("renders only rows matching progress filter", () => {
    const items: ProjectListItem[] = [
      makeItem({ projectId: "1", name: "Running", activityStatus: "running" }),
      makeItem({ projectId: "2", name: "Completed", activityStatus: "completed" }),
      makeItem({ projectId: "3", name: "Failed", activityStatus: "failed" }),
    ];

    render(
      <ProjectsDataTable
        items={items}
        filters={{ progress: "completed", projectType: "all", updatedWithin: "any" }}
        onFiltersChange={() => {}}
      />,
    );

    expect(screen.queryByText("Running")).toBeNull();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Failed")).toBeNull();
  });

  it("fires row action callbacks", async () => {
    const items: ProjectListItem[] = [makeItem({ projectId: "9", name: "Project Nine" })];
    const onOpen = vi.fn();
    const onDelete = vi.fn();

    render(<ProjectsDataTable items={items} onOpenProject={onOpen} onRequestDelete={onDelete} />);

    const openBtn = await screen.findByLabelText("Open project Project Nine");
    openBtn.click();
    expect(onOpen).toHaveBeenCalledWith("9");

    const delBtn = await screen.findByLabelText("Delete project Project Nine");
    delBtn.click();
    expect(onDelete).toHaveBeenCalledWith("9", "Project Nine");
  });
});

