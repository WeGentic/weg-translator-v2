import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectManagerContent } from "@/modules/projects/ProjectManagerContent";
import type { ProjectListItem } from "@/core/ipc";

const shouldRunBenchmarks = process.env.PROJECT_MANAGER_TABLE_BENCHMARK === "1";
const describeBench = shouldRunBenchmarks ? describe : describe.skip;

const PROJECT_COUNT = 250;
const sampleProjects = createProjects(PROJECT_COUNT);

function createProjects(count: number): ProjectListItem[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    const createdAt = new Date(now - index * 12 * 60 * 60 * 1000).toISOString();
    const updatedAt = new Date(now - index * 6 * 60 * 60 * 1000).toISOString();
    return {
      projectId: `project-${id}`,
      name: `Smoke Project ${id}`,
      slug: `smoke-project-${id}`,
      projectType: id % 2 === 0 ? "translation" : "rag",
      status: "active",
      activityStatus: (id % 4 === 0
        ? "failed"
        : id % 3 === 0
          ? "running"
          : id % 2 === 0
            ? "completed"
            : "pending") as ProjectListItem["activityStatus"],
      fileCount: (id % 7) + 1,
      createdAt,
      updatedAt,
    } satisfies ProjectListItem;
  });
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

describeBench("Project Manager table render benchmark", () => {
  it("v2 table renders 250 projects", () => {
    const start = performance.now();
    render(
      <ProjectManagerContent
        items={sampleProjects}
        onRequestDelete={vi.fn()}
        onOpenProject={vi.fn()}
      />,
    );
    const elapsed = performance.now() - start;
    console.info(`[benchmark] v2 table render (${PROJECT_COUNT} rows): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeGreaterThan(0);
  });
});
