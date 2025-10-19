import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProjectListItem } from "@/core/ipc";
import { ProjectManagerView } from "@/modules/projects/ProjectManagerView";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @eslint-react/hooks-extra/no-unnecessary-use-prefix */

type ListProjectsArgs = { limit?: number; offset?: number } | undefined;
type ToastPayload = { title?: string; description?: string; variant?: string };
type SidebarSyncArgs = {
  selectedRows: Set<string>;
  projects: ProjectListItem[];
  onBatchDelete: (ids: string[]) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  clearSelection: () => void;
};

const {
  listProjectsMock,
  deleteProjectMock,
  createProjectMock,
  toastMock,
  sidebarSyncMock,
} = vi.hoisted(() => ({
  listProjectsMock: vi.fn<(args?: ListProjectsArgs) => Promise<ProjectListItem[]>>(() =>
    Promise.resolve([]),
  ),
  deleteProjectMock: vi.fn<(id: string) => Promise<number>>(() => Promise.resolve(0)),
  createProjectMock: vi.fn<() => unknown>(),
  toastMock: vi.fn<(payload: ToastPayload) => void>(),
  sidebarSyncMock: vi.fn<(args: SidebarSyncArgs) => void>(),
}));

vi.mock("@/shared/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/core/ipc", () => ({
  listProjects: listProjectsMock,
  deleteProject: deleteProjectMock,
  createProject: createProjectMock,
}));

vi.mock("@/modules/projects/state/useSidebarTwoContentSync", () => ({
  useSidebarTwoContentSync: (args: SidebarSyncArgs) => {
    sidebarSyncMock(args);
  },
}));

let projectSequence = 0;

function buildProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  const now = "2025-01-01T00:00:00.000Z";
  return {
    projectId: overrides.projectId ?? `project-${++projectSequence}`,
    name: overrides.name ?? "Sample Project",
    slug: overrides.slug ?? "sample-project",
    projectType: overrides.projectType ?? "translation",
    status: overrides.status ?? "READY",
    activityStatus: overrides.activityStatus ?? "pending",
    fileCount: overrides.fileCount ?? 2,
    subjects: overrides.subjects ?? ["marketing"],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    clientName: overrides.clientName ?? null,
  } satisfies ProjectListItem;
}

describe("ProjectManagerView", () => {
  beforeEach(() => {
    projectSequence = 0;
    if (typeof window !== "undefined") {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      if (!Element.prototype.hasPointerCapture) {
        Element.prototype.hasPointerCapture = () => false;
      }
      if (!Element.prototype.setPointerCapture) {
        Element.prototype.setPointerCapture = () => {};
      }
      if (!Element.prototype.releasePointerCapture) {
        Element.prototype.releasePointerCapture = () => {};
      }
      if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = () => {};
      }
    }
    listProjectsMock.mockReset();
    deleteProjectMock.mockReset();
    createProjectMock.mockReset();
    toastMock.mockReset();
    sidebarSyncMock.mockReset();
    listProjectsMock.mockResolvedValue([]);
    deleteProjectMock.mockResolvedValue(1);
  });

  afterEach(() => {
    cleanup();
  });

  async function renderView(projects: ProjectListItem[] = []) {
    listProjectsMock.mockResolvedValue(projects);
    render(<ProjectManagerView />);
    await waitFor(() => expect(listProjectsMock).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    await screen.findByRole("table", { name: /projects table/i });
  }

  it("loads projects with the expected limit and schedules polling", async () => {
    const projects = [
      buildProject({ projectId: "alpha", name: "Alpha", activityStatus: "completed" }),
    ];
    const intervalSpy = vi.spyOn(window, "setInterval");

    await renderView(projects);

    expect(listProjectsMock).toHaveBeenCalledWith({ limit: 100 });
    await screen.findByText("Alpha");

    const pollingCall = intervalSpy.mock.calls.find(([, delay]) => delay === 1500);
    expect(pollingCall).toBeDefined();
    const intervalCallback = pollingCall?.[0] as (() => void) | undefined;
    expect(typeof intervalCallback).toBe("function");

    await act(async () => {
      intervalCallback?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(listProjectsMock).toHaveBeenCalledTimes(2);
    });

    intervalSpy.mockRestore();
  });

  it("surfaces load errors in the alert banner", async () => {
    listProjectsMock.mockRejectedValueOnce(new Error("Network unreachable"));
    render(<ProjectManagerView />);

    await screen.findByText("Could not load projects");
    expect(screen.getByText("Network unreachable")).toBeInTheDocument();
  });

  it("filters projects via search and reset controls", async () => {
    const projects = [
      buildProject({ projectId: "alpha", name: "Alpha Delta" }),
      buildProject({ projectId: "beta", name: "Beta" }),
    ];
    await renderView(projects);

    expect(await screen.findByText("Alpha Delta")).toBeInTheDocument();

    const user = userEvent.setup();
    const searchInput = screen.getByRole("textbox", { name: /search projects/i });

    await user.clear(searchInput);
    await user.type(searchInput, "zzz");

    await screen.findByText(/No projects found/i);
    expect(screen.getByText(/for "zzz"/i)).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: /clear search/i });
    await user.click(clearButton);

    await screen.findByText("Alpha Delta");
  });

  it("applies filter selections to the visible row set", async () => {
    const projects = [
      buildProject({ projectId: "alpha", name: "Alpha", activityStatus: "pending" }),
      buildProject({ projectId: "beta", name: "Beta", activityStatus: "completed" }),
    ];
    await renderView(projects);

    const user = userEvent.setup();

    await screen.findByText("Alpha");

    const comboboxes = screen.getAllByRole("combobox");
    const statusTrigger = comboboxes[0];
    await user.click(statusTrigger);

    const completedOption = await screen.findByRole("option", { name: "Completed" });
    await user.click(completedOption);

    await waitFor(() => {
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("updates footer and sidebar sync when rows are selected", async () => {
    const projects = [
      buildProject({ projectId: "alpha", name: "Alpha" }),
      buildProject({ projectId: "beta", name: "Beta" }),
    ];
    await renderView(projects);

    const user = userEvent.setup();

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).queryByText(/Selected:/i)).toBeNull();

    const alphaCheckbox = screen.getByRole("checkbox", { name: /Select project Alpha/i });
    await user.click(alphaCheckbox);

    await waitFor(() => {
      const calls = sidebarSyncMock.mock.calls;
      const lastArgs = calls.length > 0 ? (calls[calls.length - 1]?.[0] as SidebarSyncArgs | undefined) : undefined;
      expect(lastArgs?.selectedRows.size).toBe(1);
      expect(lastArgs?.selectedRows.has("alpha")).toBe(true);
    });

    expect(within(footer).getByText(/Selected:/i)).toBeInTheDocument();
    expect(within(footer).getByText("1")).toBeInTheDocument();
  });

  it("opens the delete dialog for the targeted project", async () => {
    const projects = [buildProject({ projectId: "alpha", name: "Alpha" })];
    await renderView(projects);

    const user = userEvent.setup();

    const deleteButton = screen.getByRole("button", { name: /Delete project Alpha/i });
    await user.click(deleteButton);

    const dialog = await screen.findByRole("dialog", { name: /Delete project/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Alpha/)).toBeInTheDocument();
  });

  it("toggles the wizard and invokes the create callback", async () => {
    const projects = [buildProject({ projectId: "alpha", name: "Alpha" })];
    listProjectsMock.mockResolvedValueOnce(projects);
    const onCreateProject = vi.fn();

    render(<ProjectManagerView onCreateProject={onCreateProject} />);
    await waitFor(() => expect(listProjectsMock).toHaveBeenCalled());

    const user = userEvent.setup();
    const newProjectButton = await screen.findByRole("button", { name: /New Project/i });
    await user.click(newProjectButton);

    const wizard = await screen.findByRole("dialog", { name: /Create new project/i });
    expect(wizard).toBeInTheDocument();
    expect(onCreateProject).toHaveBeenCalledTimes(1);
  });
});
