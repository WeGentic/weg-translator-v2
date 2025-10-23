import type { ComponentProps } from "react";

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MainLayout } from "@/app/shell/MainLayout";
import { ProjectManagerRoute } from "@/modules/project-manager/ProjectManagerRoute";
import { deleteProject, listProjects, type ProjectListItem } from "@/core/ipc";

const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/core/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/ipc")>();
  return {
    ...actual,
    listProjects: vi.fn(),
    deleteProject: vi.fn(),
  };
});

vi.mock("@/shared/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const listProjectsMock = vi.mocked(listProjects);
const deleteProjectMock = vi.mocked(deleteProject);

type WizardMockProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
};

const wizardState = vi.hoisted(() => ({ current: null as WizardMockProps | null }));

vi.mock("@/modules/wizards/project", () => ({
  CreateProjectWizardV2: (props: WizardMockProps) => {
    wizardState.current = props;
    if (!props.open) {
      return null;
    }
    return <div data-testid="project-manager-wizard">Wizard open</div>;
  },
}));

vi.mock("@/modules/project-manager/components/DeleteProjectDialog", () => ({
  DeleteProjectDialog: () => null,
}));

vi.mock("@/modules/project-manager/components/BatchDeleteConfirmDialog", () => ({
  BatchDeleteConfirmDialog: () => null,
}));

const suspendedPromise = new Promise<never>(() => {
  // never resolves; used to simulate a hanging resource fetch
});

let currentProjects: ProjectListItem[] = [];
let projectSequence = 0;

function makeProject(partial: Partial<ProjectListItem> = {}): ProjectListItem {
  projectSequence += 1;
  const now = new Date("2025-02-20T00:00:00.000Z").toISOString();
  return {
    projectId: partial.projectId ?? `project-${projectSequence}`,
    name: partial.name ?? `Project ${projectSequence}`,
    slug: partial.slug ?? `project-${projectSequence}`,
    projectType: partial.projectType ?? "translation",
    status: partial.status ?? "READY",
    activityStatus: partial.activityStatus ?? "running",
    fileCount: partial.fileCount ?? 1,
    subjects: partial.subjects ?? ["marketing"],
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    clientName: partial.clientName ?? null,
  };
}

function renderProjectManagerRoute(props?: ComponentProps<typeof ProjectManagerRoute>) {
  return render(
    <MainLayout.Root>
      <MainLayout.SidebarTwo />
      <MainLayout.Main>
        <ProjectManagerRoute {...props} />
      </MainLayout.Main>
    </MainLayout.Root>,
  );
}

beforeEach(() => {
  currentProjects = [];
  projectSequence = 0;
  listProjectsMock.mockReset();
  deleteProjectMock.mockReset();
  toastMock.mockReset();
  wizardState.current = null;

  listProjectsMock.mockImplementation(() => Promise.resolve(currentProjects));
  deleteProjectMock.mockResolvedValue(1);
});

afterEach(() => {
  cleanup();
});

describe("ProjectManagerRoute", () => {
  it("shows a skeleton while projects are loading", () => {
    listProjectsMock.mockImplementationOnce(() => suspendedPromise);

    renderProjectManagerRoute();

    expect(screen.getByRole("status", { name: "Loading projects" })).toBeInTheDocument();
  });

  it("renders projects once the list resolves", async () => {
    currentProjects = [
      makeProject({ name: "Alpha Project", slug: "alpha" }),
      makeProject({ name: "Beta Project", slug: "beta" }),
    ];

    renderProjectManagerRoute();

    expect(await screen.findByText("Alpha Project")).toBeInTheDocument();
    expect(screen.getByText("Beta Project")).toBeInTheDocument();
  });

  it("allows selecting rows via the header checkbox", async () => {
    currentProjects = [
      makeProject({ name: "Alpha Project" }),
      makeProject({ name: "Beta Project" }),
      makeProject({ name: "Gamma Project" }),
    ];

    const user = userEvent.setup();
    renderProjectManagerRoute();

    await screen.findByText("Alpha Project");

    const headerCheckbox = screen.getByRole("checkbox", { name: "Select all projects" });
    await user.click(headerCheckbox);

    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /Select project/ });
    for (const checkbox of rowCheckboxes) {
      expect(checkbox).toHaveAttribute("data-state", "checked");
    }

    const sidebar = await screen.findByRole("complementary", { name: "Secondary navigation" });
    await waitFor(() => {
      expect(sidebar).toHaveTextContent("Selected Projects");
      expect(sidebar).toHaveTextContent("3");
    });

    await user.click(rowCheckboxes[0]);

    await waitFor(() => {
      expect(sidebar).toHaveTextContent("Selected Projects");
      expect(sidebar).toHaveTextContent("2");
    });
  });

  it("filters projects using the search input", async () => {
    currentProjects = [
      makeProject({ name: "Alpha Project", slug: "alpha" }),
      makeProject({ name: "Beta Project", slug: "beta" }),
    ];

    const user = userEvent.setup();
    renderProjectManagerRoute();

    await screen.findByText("Alpha Project");

    const searchInput = screen.getByRole("textbox", { name: "Search projects" });
    await user.clear(searchInput);
    await user.type(searchInput, "Beta");

    await waitFor(() => {
      expect(screen.queryByText("Alpha Project")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Beta Project")).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "Clear search" });
    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
      expect(screen.getByText("Beta Project")).toBeInTheDocument();
    });
  });

  it("shows an error alert when loading projects fails", async () => {
    listProjectsMock.mockImplementationOnce(() => Promise.reject(new Error("Gateway timeout")));

    renderProjectManagerRoute();

    expect(await screen.findByText("Unable to load projects")).toBeInTheDocument();
    expect(screen.getByText("Gateway timeout")).toBeInTheDocument();
  });

  it("opens the project wizard when the new project action is triggered", async () => {
    currentProjects = [makeProject({ name: "Alpha Project" })];

    const user = userEvent.setup();
    const onCreateProject = vi.fn();

    renderProjectManagerRoute({ onCreateProject });

    await screen.findByText("Alpha Project");

    const createButton = screen.getByRole("button", { name: "Create new project" });
    await user.click(createButton);

    expect(onCreateProject).toHaveBeenCalledTimes(1);
    expect(wizardState.current?.open).toBe(true);
    expect(screen.getByTestId("project-manager-wizard")).toBeInTheDocument();

    act(() => {
      wizardState.current?.onOpenChange(false);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("project-manager-wizard")).not.toBeInTheDocument();
    });
  });
});
