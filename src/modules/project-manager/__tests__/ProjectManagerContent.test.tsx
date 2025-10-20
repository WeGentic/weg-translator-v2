import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectManagerContent } from "@/modules/project-manager/ProjectManagerContent";
import type { ProjectListItem } from "@/core/ipc";

function makeItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  const now = Date.now();
  return {
    projectId: overrides.projectId ?? "p1",
    name: overrides.name ?? "Alpha",
    slug: overrides.slug ?? "alpha",
    projectType: overrides.projectType ?? "translation",
    status: overrides.status ?? "READY",
    activityStatus: overrides.activityStatus ?? "running",
    fileCount: overrides.fileCount ?? 3,
    subjects: overrides.subjects ?? ["marketing"],
    createdAt: overrides.createdAt ?? new Date(now - 86400000).toISOString(),
    updatedAt: overrides.updatedAt ?? new Date(now - 3600000).toISOString(),
    clientId: overrides.clientId ?? null,
    clientName: overrides.clientName ?? null,
  } satisfies ProjectListItem;
}

beforeEach(() => {
  if (typeof window !== "undefined") {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

afterEach(() => {
  cleanup();
});

describe("ProjectManagerContent", () => {
  it("renders the provided projects", () => {
    const items = [
      makeItem({ projectId: "1", name: "Running", status: "READY" }),
      makeItem({
        projectId: "2",
        name: "Completed",
        status: "IN_PROGRESS",
        subjects: ["legal"],
        clientName: "Globex Corp",
      }),
    ];

    render(<ProjectManagerContent items={items} />);

    expect(screen.getByRole("table", { name: /projects table/i })).toBeInTheDocument();
    expect(screen.getAllByText("Running")).not.toHaveLength(0);
    expect(screen.getAllByText("Completed")).not.toHaveLength(0);
    expect(screen.getAllByText("Marketing & Creative")).not.toHaveLength(0);
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText(/Client: N\.A\./i)).toBeInTheDocument();
    expect(screen.getByText(/Client: Globex Corp/i)).toBeInTheDocument();
  });

  it("shows empty state when no projects match", () => {
    render(<ProjectManagerContent items={[]} search="zzz" />);

    expect(screen.getByText(/No projects found/i)).toBeInTheDocument();
    expect(screen.getByText(/for "zzz"/i)).toBeInTheDocument();
  });
});
