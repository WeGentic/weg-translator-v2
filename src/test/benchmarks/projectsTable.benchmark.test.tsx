import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectManagerContent as LegacyProjectManagerContent } from "@/features/project-manager/ProjectManagerContent";
import { ProjectManagerContent as V2ProjectManagerContent } from "@/features/project-manager-v2/content/ProjectManagerContent";
import { ProjectManagerStoreProvider } from "@/features/project-manager-v2/state";
import type { ProjectListItem } from "@/ipc";

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

describeBench("Project Manager table render benchmarks", () => {
  afterEach(() => {
    cleanup();
  });

  it("legacy table renders 250 projects", () => {
    const start = performance.now();
    render(
      <LegacyProjectManagerContent
        items={sampleProjects}
        onOpenProject={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    const elapsed = performance.now() - start;
    console.info(`[benchmark] legacy table render (${PROJECT_COUNT} rows): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeGreaterThan(0);
  });

  it("v2 table renders 250 projects", () => {
    const start = performance.now();
    render(
      <ProjectManagerStoreProvider>
        <V2ProjectManagerContent
          projects={sampleProjects}
          onRequestDelete={vi.fn()}
          onOpenProject={vi.fn()}
        />
      </ProjectManagerStoreProvider>,
    );
    const elapsed = performance.now() - start;
    console.info(`[benchmark] v2 table render (${PROJECT_COUNT} rows): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeGreaterThan(0);
  });
});
