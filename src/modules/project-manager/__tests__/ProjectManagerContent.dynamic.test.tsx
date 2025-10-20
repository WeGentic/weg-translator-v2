import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectManagerContent } from "@/modules/project-manager/ProjectManagerContent";
import type { ProjectListItem } from "@/core/ipc";

const ITEMS: ProjectListItem[] = [
  {
    projectId: "1",
    name: "Pending Foo",
    slug: "pending",
    projectType: "translation",
    status: "READY",
    activityStatus: "pending",
    fileCount: 4,
    subjects: ["marketing"],
    clientName: "Wayne Corp",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    projectId: "2",
    name: "Completed Bar",
    slug: "completed",
    projectType: "translation",
    status: "COMPLETED",
    activityStatus: "completed",
    fileCount: 2,
    subjects: ["legal"],
    clientName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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

describe("ProjectManagerContent dynamic updates", () => {
  it("updates rendered rows when the items prop changes", () => {
    const { rerender } = render(<ProjectManagerContent items={ITEMS} />);

    expect(screen.getByText("Pending Foo")).toBeInTheDocument();
    expect(screen.getByText("Completed Bar")).toBeInTheDocument();

    rerender(
      <ProjectManagerContent
        items={ITEMS.filter((item) => item.activityStatus === "completed")}
      />,
    );

    expect(screen.getByText("Completed Bar")).toBeInTheDocument();
    expect(screen.queryByText("Pending Foo")).toBeNull();
  });
});
