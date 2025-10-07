import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectManagerContent } from "@/modules/projects/ProjectManagerContent";
import type { ProjectListItem } from "@/core/ipc";

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
      makeItem({ projectId: "1", name: "Running" }),
      makeItem({ projectId: "2", name: "Completed" }),
    ];

    render(<ProjectManagerContent items={items} />);

    expect(screen.getByRole("table", { name: /projects table/i })).toBeInTheDocument();
    expect(screen.getAllByText("Running")).not.toHaveLength(0);
    expect(screen.getAllByText("Completed")).not.toHaveLength(0);
  });

  it("shows empty state when no projects match", () => {
    render(<ProjectManagerContent items={[]} search="zzz" />);

    expect(screen.getByText(/No projects found/i)).toBeInTheDocument();
    expect(screen.getByText(/for "zzz"/i)).toBeInTheDocument();
  });
});
