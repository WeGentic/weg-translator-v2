import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ipc", () => ({
  getProjectDetails: vi.fn(),
  addFilesToProject: vi.fn(),
  removeProjectFile: vi.fn(),
  ensureProjectConversionsPlan: vi.fn(),
  updateConversionStatus: vi.fn(),
  convertXliffToJliff: vi.fn(),
  convertStream: vi.fn(),
  validateStream: vi.fn(),
  getAppSettings: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "auth-user", email: "tester@example.com", name: "Tester" },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    session: null,
  }),
}));

import {
  getProjectDetails,
  addFilesToProject,
  removeProjectFile,
  ensureProjectConversionsPlan,
  convertXliffToJliff,
  getAppSettings,
  type AppSettings,
  type EnsureConversionsPlan,
  type ProjectDetails,
  type ProjectListItem,
} from "@/ipc";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { ProjectOverview } from "./ProjectOverview";

const projectSummary: ProjectListItem = {
  projectId: "11111111-1111-1111-1111-111111111111",
  name: "Demo",
  slug: "demo",
  projectType: "translation" as const,
  status: "active" as const,
  fileCount: 2,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const details: ProjectDetails = {
  id: projectSummary.projectId,
  name: projectSummary.name,
  slug: projectSummary.slug,
  defaultSrcLang: "en-US",
  defaultTgtLang: "it-IT",
  rootPath: "/projects/demo",
  files: [
    {
      file: {
        id: "f1",
        originalName: "a.docx",
        storedRelPath: "a.docx",
        ext: "docx",
        sizeBytes: 1024,
        importStatus: "imported" as const,
        createdAt: "",
        updatedAt: "",
      },
      conversions: [
        {
          id: "c1",
          projectFileId: "f1",
          srcLang: "en-US",
          tgtLang: "it-IT",
          version: "2.1",
          paragraph: true,
          embed: true,
          status: "completed" as const,
          createdAt: "",
          updatedAt: "",
        },
      ],
    },
    {
      file: {
        id: "f2",
        originalName: "b.xliff",
        storedRelPath: "b.xliff",
        ext: "xliff",
        sizeBytes: 2048,
        importStatus: "imported" as const,
        createdAt: "",
        updatedAt: "",
      },
      conversions: [],
    },
  ],
};

const basePlan: EnsureConversionsPlan = {
  projectId: projectSummary.projectId,
  srcLang: details.defaultSrcLang ?? "en-US",
  tgtLang: details.defaultTgtLang ?? "it-IT",
  version: "2.1",
  tasks: [],
};

const baseSettings: AppSettings = {
  appFolder: "/projects/demo",
  appFolderExists: true,
  databasePath: "/projects/demo/app.db",
  databaseExists: true,
  projectsPath: "/projects/demo/projects",
  projectsPathExists: true,
  settingsFile: "/projects/demo/settings.json",
  settingsFileExists: true,
  defaultAppFolder: "/projects/demo",
  isUsingDefaultLocation: true,
  autoConvertOnOpen: true,
};

beforeEach(() => {
  vi.mocked(ensureProjectConversionsPlan).mockResolvedValue({ ...basePlan, tasks: [] });
  vi.mocked(convertXliffToJliff).mockResolvedValue({
    fileId: "c1",
    jliffAbsPath: "/projects/demo/jliff/demo-file1.jliff.json",
    jliffRelPath: "jliff/demo-file1.jliff.json",
    tagMapAbsPath: "/projects/demo/jliff/demo-file1.tags.json",
    tagMapRelPath: "jliff/demo-file1.tags.json",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProjectOverview", () => {
  it("renders files and conversion badges", async () => {
    vi.mocked(getProjectDetails).mockResolvedValue(details);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings });

    render(<ProjectOverview projectSummary={projectSummary} />);

    const title = await screen.findByRole("heading", { level: 2, name: projectSummary.name });
    expect(title).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.queryByText(/languages/i)).not.toBeInTheDocument();
    expect(screen.getByText("a.docx")).toBeInTheDocument();
    expect(screen.getByText("b.xliff")).toBeInTheDocument();

    // Badge shows completed
    expect(screen.getByText(/completed/)).toBeInTheDocument();
  });

  it("invokes IPC on add/remove actions", async () => {
    vi.mocked(getProjectDetails).mockResolvedValue(details);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings });
    vi.mocked(openDialog).mockResolvedValueOnce(["/abs/new.pptx"]);

    render(<ProjectOverview projectSummary={projectSummary} />);

    await screen.findByRole("list");

    // Add files flow
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add files/i }));
    const choose = await screen.findByRole("button", { name: /choose files…/i });
    await user.click(choose);

    await waitFor(() => expect(addFilesToProject).toHaveBeenCalled());

    // Remove file flow
    const remove = (await screen.findAllByRole("button", { name: /remove file/i }))[0];
    await user.click(remove);
    const confirm = await screen.findByRole("button", { name: /^remove$/i });
    await user.click(confirm);
    await waitFor(() => expect(removeProjectFile).toHaveBeenCalled());
  });

  it("shows tooltip title when auto-convert is disabled", async () => {
    vi.mocked(getProjectDetails).mockResolvedValue(details);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings, autoConvertOnOpen: false });

    render(<ProjectOverview projectSummary={projectSummary} />);

    const addButton = await screen.findByRole("button", { name: /add files/i });
    expect(addButton).toHaveAttribute(
      "title",
      expect.stringMatching(/disabled; conversions won’t start automatically/i),
    );
  });
});
