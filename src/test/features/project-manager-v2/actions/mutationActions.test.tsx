import { vi } from "vitest";

interface ProjectListItemMock {
  projectId: string;
  name: string;
  slug: string;
  projectType: "translation" | "rag";
  status: "active" | "archived";
  activityStatus: "pending" | "running" | "completed" | "failed";
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ToastPayload {
  title?: string;
  description?: string;
  variant?: string;
}

type CreateProjectResponseMock = {
  projectId: string;
  slug: string;
  folder: string;
  fileCount: number;
};

type CreateProjectRequestMock = {
  name: string;
  projectType: "translation" | "rag";
  defaultSrcLang: string;
  defaultTgtLang: string;
  files: string[];
};

const {
  toastMock,
  createProjectMock,
  deleteProjectMock,
  resourceState,
  mutateProjectsResourceMock,
  refreshProjectsResourceMock,
  getProjectsResourceSnapshotMock,
} = vi.hoisted(() => {
  const resourceState = { projects: [] as ProjectListItemMock[] };
  const toastMock = vi.fn<(payload: ToastPayload) => void>();
  const createProjectMock = vi.fn<(request: CreateProjectRequestMock) => Promise<CreateProjectResponseMock>>();
  const deleteProjectMock = vi.fn<(projectId: string) => Promise<number>>();
  const mutateProjectsResourceMock = vi.fn(
    (updater: (projects: ProjectListItemMock[]) => ProjectListItemMock[]) => {
      const next = updater(resourceState.projects.slice());
      resourceState.projects = Array.isArray(next) ? next.slice() : resourceState.projects.slice();
      return resourceState.projects;
    },
  );
  const refreshProjectsResourceMock = vi.fn(() => Promise.resolve(resourceState.projects.slice()));
  const getProjectsResourceSnapshotMock = vi.fn(() => ({
    status: "resolved" as const,
    data: resourceState.projects.slice(),
    promise: null,
    error: null,
    lastError: null,
    lastUpdatedAt: Date.now(),
  }));

  return {
    toastMock,
    createProjectMock,
    deleteProjectMock,
    resourceState,
    mutateProjectsResourceMock,
    refreshProjectsResourceMock,
    getProjectsResourceSnapshotMock,
  };
});

vi.mock("@/components/ui/use-toast", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/ipc", () => ({
  createProject: createProjectMock,
  deleteProject: deleteProjectMock,
}));

vi.mock("@/features/project-manager-v2/data/projectsResource", () => ({
  mutateProjectsResource: mutateProjectsResourceMock,
  refreshProjectsResource: refreshProjectsResourceMock,
  getProjectsResourceSnapshot: getProjectsResourceSnapshotMock,
  DEFAULT_PROJECTS_QUERY_LIMIT: 100,
}));

import { cleanup, act, render } from "@testing-library/react";
import { startTransition } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  useBatchDeleteProjectsAction,
  useCreateProjectAction,
  useDeleteProjectAction,
} from "@/features/project-manager-v2/actions";

function renderHook<T>(hook: () => T) {
  const result: { current: T | null } = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  render(<TestComponent />);
  if (result.current === null) {
    throw new Error("Hook did not return a value");
  }
  return result;
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function resetResource(projects: ProjectListItemMock[]) {
  resourceState.projects = projects.slice();
}

function buildProject(partial: Partial<ProjectListItemMock> = {}): ProjectListItemMock {
  const now = new Date().toISOString();
  return {
    projectId: partial.projectId ?? crypto.randomUUID(),
    name: partial.name ?? "Example",
    slug: partial.slug ?? "example",
    projectType: partial.projectType ?? "translation",
    status: partial.status ?? "active",
    activityStatus: partial.activityStatus ?? "pending",
    fileCount: partial.fileCount ?? 1,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

describe("project manager v2 mutation actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    toastMock.mockReset();
    createProjectMock.mockReset();
    deleteProjectMock.mockReset();
    mutateProjectsResourceMock.mockClear();
    refreshProjectsResourceMock.mockClear();
    getProjectsResourceSnapshotMock.mockClear();
    resetResource([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("optimistically inserts and replaces project on create success", async () => {
    resetResource([buildProject({ projectId: "existing" })]);
    createProjectMock.mockResolvedValue({
      projectId: "server-id",
      slug: "new-project",
      folder: "/tmp/new-project",
      fileCount: 2,
    });

    const hook = renderHook(() => useCreateProjectAction());
    await act(async () => {
      startTransition(() => {
        hook.current?.action({
          name: "New Project",
          projectType: "translation",
          srcLang: "en-US",
          tgtLang: "it-IT",
          files: ["/tmp/file.xlf"],
        });
      });
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(resourceState.projects[0]).toMatchObject({ projectId: "server-id", slug: "new-project" });
    expect(resourceState.projects).toHaveLength(2);
    expect(mutateProjectsResourceMock).toHaveBeenCalledTimes(2);
    expect(refreshProjectsResourceMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Project created" }),
    );
  });

  it("rolls back optimistic entry on create failure", async () => {
    resetResource([buildProject({ projectId: "existing" })]);
    createProjectMock.mockRejectedValue(new Error("network failed"));

    const hook = renderHook(() => useCreateProjectAction());
    await act(async () => {
      startTransition(() => {
        hook.current?.action({
          name: "Broken Project",
          projectType: "translation",
          srcLang: "en-US",
          tgtLang: "it-IT",
          files: ["/tmp/file.xlf"],
        });
      });
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(resourceState.projects).toHaveLength(1);
    expect(resourceState.projects[0].projectId).toBe("existing");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("removes project from cache on delete success", async () => {
    const alpha = buildProject({ projectId: "alpha", name: "Alpha" });
    const beta = buildProject({ projectId: "beta", name: "Beta" });
    resetResource([alpha, beta]);
    deleteProjectMock.mockResolvedValue(1);

    const hook = renderHook(() => useDeleteProjectAction());
    await act(async () => {
      startTransition(() => {
        hook.current?.run({ projectId: "alpha", projectName: "Alpha" });
      });
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(resourceState.projects.map((p) => p.projectId)).toEqual(["beta"]);
    expect(refreshProjectsResourceMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Project deleted" }),
    );
  });

  it("restores snapshot when delete fails", async () => {
    const alpha = buildProject({ projectId: "alpha" });
    const beta = buildProject({ projectId: "beta" });
    resetResource([alpha, beta]);
    deleteProjectMock.mockResolvedValue(0);

    const hook = renderHook(() => useDeleteProjectAction());
    await act(async () => {
      startTransition(() => {
        hook.current?.run({ projectId: "alpha", projectName: "Alpha" });
      });
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(resourceState.projects.map((p) => p.projectId)).toEqual(["alpha", "beta"]);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("handles partial batch delete with rollback", async () => {
    const alpha = buildProject({ projectId: "alpha" });
    const beta = buildProject({ projectId: "beta" });
    const gamma = buildProject({ projectId: "gamma" });
    resetResource([alpha, beta, gamma]);
    deleteProjectMock.mockImplementation((id: string) => {
      if (id === "beta") {
        return Promise.reject(new Error("backend failure"));
      }
      return Promise.resolve(1);
    });

    const hook = renderHook(() => useBatchDeleteProjectsAction());
    await act(async () => {
      startTransition(() => {
        hook.current?.run({ projectIds: ["alpha", "beta", "gamma"] });
      });
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(resourceState.projects.map((p) => p.projectId)).toEqual(["beta"]);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Batch delete failed" }),
    );
  });
});
