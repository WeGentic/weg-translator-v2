import type { ComponentProps } from "react";

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { MainLayout } from "@/app/layout/MainLayout";
import { ProjectManagerRoute } from "@/features/project-manager-v2/ProjectManagerRoute";
import type { ProjectListItem } from "@/ipc";

const suspendedPromise = new Promise<never>(() => {
  // intentionally never resolves for Suspense testing
});

interface ResourceState {
  mode: "pending" | "resolved" | "error";
  projects: ProjectListItem[];
  error: Error | null;
}

const resourceState: ResourceState = {
  mode: "resolved",
  projects: [],
  error: null,
};

const runBatchDeleteMock = vi.fn();
const { refreshProjectsResourceMock, invalidateProjectsResourceMock } = vi.hoisted(() => ({
  refreshProjectsResourceMock: vi.fn<[], Promise<void>>(() => Promise.resolve()),
  invalidateProjectsResourceMock: vi.fn(),
}));

vi.mock("@/features/project-manager-v2/data", async () => {
  const actual = await vi.importActual<typeof import("@/features/project-manager-v2/data")>(
    "@/features/project-manager-v2/data",
  );
  return {
    ...actual,
    useProjectsResource: () => {
      if (resourceState.mode === "pending") {
        throw suspendedPromise;
      }
      if (resourceState.mode === "error") {
        throw resourceState.error ?? new Error("Failed to load projects");
      }
      return {
        projects: resourceState.projects,
        refresh: vi.fn(),
        invalidate: vi.fn(),
        isRefreshing: false,
        lastUpdatedAt: Date.now(),
        lastError: resourceState.error,
      };
    },
  };
});

vi.mock("@/features/project-manager-v2/data/projectsResource", async () => {
  const actual = await vi.importActual<typeof import("@/features/project-manager-v2/data/projectsResource")>(
    "@/features/project-manager-v2/data/projectsResource",
  );
  return {
    ...actual,
    refreshProjectsResource: refreshProjectsResourceMock,
    invalidateProjectsResource: invalidateProjectsResourceMock,
  };
});

vi.mock("@/features/project-manager-v2/actions/batchDeleteAction", () => ({
  useBatchDeleteProjectsAction: (options?: { onSuccess?: (completedIds: string[]) => void }) => ({
    state: { status: "idle", completedIds: [] as string[] },
    isPending: false,
    run: (payload: { projectIds: string[] }) => {
      runBatchDeleteMock(payload);
      options?.onSuccess?.(payload.projectIds);
    },
    action: vi.fn(),
  }),
}));

vi.mock("@/features/project-manager-v2/wizard/CreateProjectWizard", () => ({
  CreateProjectWizard: () => null,
}));

vi.mock("@/features/project-manager-v2/mutations/DeleteProjectDialog", () => ({
  DeleteProjectDialog: () => null,
}));

function renderProjectManagerRoute(props?: ComponentProps<typeof ProjectManagerRoute>) {
  return render(
    <MainLayout.Root>
      <MainLayout.SidebarTwo />
      <MainLayout.Main>
        <ProjectManagerRoute {...props} />
      </MainLayout.Main>
    </MainLayout.Root>
  );
}

describe("ProjectManagerShell integration", () => {
  beforeEach(() => {
    resourceState.mode = "resolved";
    resourceState.projects = [];
    resourceState.error = null;
    runBatchDeleteMock.mockClear();
    refreshProjectsResourceMock.mockClear();
    invalidateProjectsResourceMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows skeleton fallback while the projects resource is pending", () => {
    resourceState.mode = "pending";

    renderProjectManagerRoute();

    expect(screen.getByLabelText("Loading projects")).toBeInTheDocument();
  });

  it("surfaces selection metrics and routes batch deletes through the shared store", async () => {
    resourceState.projects = [
      buildProject({
        projectId: "project-1",
        name: "Alpha Project",
        slug: "alpha",
        fileCount: 5,
        status: "active",
        activityStatus: "running",
      }),
      buildProject({
        projectId: "project-2",
        name: "Beta Project",
        slug: "beta",
        fileCount: 8,
        status: "archived",
        activityStatus: "completed",
      }),
    ];

    const user = userEvent.setup();
    renderProjectManagerRoute();

    await screen.findByText("Alpha Project");
    expect(screen.getByText("No selection")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Select Alpha Project"));

    expect(screen.getByText("1 selected · 5 files")).toBeInTheDocument();
    expect(screen.getByText(/5 files · 1 Active/i)).toBeInTheDocument();
    const toolbar = screen.getByRole("toolbar", { name: "Project actions" });
    expect(within(toolbar).getByRole("button", { name: "Delete 1" })).toBeInTheDocument();

    await user.click(within(toolbar).getByRole("button", { name: "Delete 1" }));

    expect(runBatchDeleteMock).toHaveBeenCalledWith({ projectIds: ["project-1"] });

    await waitFor(() => {
      expect(within(toolbar).queryByRole("button", { name: "Delete 1" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("No selection")).toBeInTheDocument();
  });

  it("supports selecting multiple rows and toggling selection from the header checkbox", async () => {
    resourceState.projects = [
      buildProject({ projectId: "project-1", name: "Alpha Project", fileCount: 5 }),
      buildProject({ projectId: "project-2", name: "Beta Project", fileCount: 8, status: "queued" }),
      buildProject({ projectId: "project-3", name: "Gamma Project", fileCount: 4, status: "completed" }),
    ];

    const user = userEvent.setup();
    renderProjectManagerRoute();

    await screen.findByText("Alpha Project");

    await user.click(screen.getByLabelText("Select Alpha Project"));
    await user.click(screen.getByLabelText("Select Beta Project"));

    expect(screen.getByText("2 selected · 13 files")).toBeInTheDocument();
    expect(screen.getByText(/13 files · 1 Active/i)).toBeInTheDocument();
    const toolbar = screen.getByRole("toolbar", { name: "Project actions" });
    expect(within(toolbar).getByRole("button", { name: "Delete 2" })).toBeInTheDocument();

    const headerCheckbox = screen.getByLabelText("Select all projects");

    await user.click(headerCheckbox);

    await waitFor(() => {
      expect(screen.getByText("3 selected · 17 files")).toBeInTheDocument();
    });
    expect(within(toolbar).getByRole("button", { name: "Delete 3" })).toBeInTheDocument();

    const panel = screen.getByRole("complementary");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent("Alpha Project");
    expect(panel).toHaveTextContent("Beta Project");
    expect(panel).toHaveTextContent("Gamma Project");
  });

  it("opens a selected project from the batch actions panel", async () => {
    const openProject = vi.fn();
    resourceState.projects = [
      buildProject({ projectId: "project-1", name: "Alpha Project", fileCount: 5 }),
      buildProject({ projectId: "project-2", name: "Beta Project", fileCount: 3 }),
    ];

    const user = userEvent.setup();
    renderProjectManagerRoute({ onOpenProject: openProject });

    await screen.findByText("Alpha Project");

    await user.click(screen.getByLabelText("Select Alpha Project"));

    const panel = screen.getByRole("complementary");
    const openButton = within(panel).getByRole("button", { name: "Open Alpha Project" });

    await user.click(openButton);

    expect(openProject).toHaveBeenCalledTimes(1);
    expect(openProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-1" }));
  });

  it("clears selection via toolbar action", async () => {
    resourceState.projects = [buildProject({ projectId: "project-3", name: "Gamma" })];

    const user = userEvent.setup();
    renderProjectManagerRoute();

    await screen.findByText("Gamma");

    await user.click(screen.getByLabelText("Select Gamma"));
    const toolbar = screen.getByRole("toolbar", { name: "Project actions" });
    expect(within(toolbar).getByRole("button", { name: "Delete 1" })).toBeInTheDocument();

    await user.click(within(toolbar).getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(within(toolbar).queryByRole("button", { name: "Delete 1" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("No selection")).toBeInTheDocument();
  });

  it("shows the overview card in the secondary sidebar when no projects are selected", async () => {
    resourceState.projects = [
      buildProject({ projectId: "project-1", name: "Alpha", status: "active", fileCount: 3, updatedAt: new Date().toISOString() }),
      buildProject({ projectId: "project-2", name: "Beta", status: "archived", fileCount: 2, updatedAt: new Date().toISOString() }),
    ];

    renderProjectManagerRoute();

    await screen.findByText("Alpha");

    const panel = screen.getByRole("complementary");
    expect(panel).toHaveTextContent("Project Overview");
    expect(panel).toHaveTextContent("Total Projects");
    expect(panel).toHaveTextContent("2");
    expect(panel).toHaveTextContent("Active");
    expect(panel).toHaveTextContent("1");
  });

  it("applies activity status filters and exposes the active filter count", async () => {
    resourceState.projects = [
      buildProject({ projectId: "project-1", name: "Alpha", activityStatus: "running" }),
      buildProject({ projectId: "project-2", name: "Beta", activityStatus: "completed" }),
    ];

    const user = userEvent.setup();
    renderProjectManagerRoute();

    await screen.findByText("Alpha");
    expect(screen.getByText("Beta")).toBeInTheDocument();

    const filterTrigger = screen.getByRole("button", { name: /Filters/ });
    await user.click(filterTrigger);

    await user.click(screen.getByRole("button", { name: "Running" }));

    await waitFor(() => {
      expect(screen.queryByText("Beta")).not.toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });

    expect(within(filterTrigger).getByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(screen.getByText("Beta")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(filterTrigger).not.toHaveTextContent(/\b1\b/);
    });
  });

  it("renders the projects error boundary fallback and retries on demand", async () => {
    resourceState.mode = "error";
    resourceState.error = new Error("Gateway timeout");

    const user = userEvent.setup();
    renderProjectManagerRoute();

    expect(await screen.findByText("Unable to load projects")).toBeInTheDocument();
    expect(screen.getByText(/Gateway timeout/)).toBeInTheDocument();

    resourceState.mode = "resolved";
    resourceState.projects = [];
    resourceState.error = null;

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(invalidateProjectsResourceMock).toHaveBeenCalledTimes(1);
      expect(refreshProjectsResourceMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("No projects yet")).toBeInTheDocument();
    });
  });
});

function buildProject(partial: Partial<ProjectListItem> = {}): ProjectListItem {
  const now = new Date("2025-02-20T00:00:00.000Z").toISOString();
  return {
    projectId: partial.projectId ?? crypto.randomUUID(),
    name: partial.name ?? "Example Project",
    slug: partial.slug ?? "example",
    projectType: partial.projectType ?? "translation",
    status: partial.status ?? "active",
    activityStatus: partial.activityStatus ?? "running",
    fileCount: partial.fileCount ?? 1,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}
