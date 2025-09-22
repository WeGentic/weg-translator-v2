import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ipc", () => ({
  getProjectDetails: vi.fn(),
  addFilesToProject: vi.fn(),
  removeProjectFile: vi.fn(),
  ensureProjectConversionsPlan: vi.fn(),
  updateConversionStatus: vi.fn(),
  convertStream: vi.fn(),
  validateStream: vi.fn(),
  getAppSettings: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import {
  getProjectDetails,
  addFilesToProject,
  removeProjectFile,
  ensureProjectConversionsPlan,
  getAppSettings,
} from "@/ipc";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { ProjectOverview } from "./ProjectOverview";

const projectSummary = {
  projectId: "11111111-1111-1111-1111-111111111111",
  name: "Demo",
  slug: "demo",
  projectType: "translation" as const,
  status: "active" as const,
  fileCount: 2,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const details = {
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

beforeEach(() => {
  vi.mocked(ensureProjectConversionsPlan).mockResolvedValue({ tasks: [] } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProjectOverview", () => {
  it("renders files and conversion badges", async () => {
    vi.mocked(getProjectDetails).mockResolvedValue(details as any);
    vi.mocked(getAppSettings).mockResolvedValue({ autoConvertOnOpen: true } as any);

    render(<ProjectOverview projectSummary={projectSummary as any} />);

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
    vi.mocked(getProjectDetails).mockResolvedValue(details as any);
    vi.mocked(getAppSettings).mockResolvedValue({ autoConvertOnOpen: true } as any);
    vi.mocked(openDialog).mockResolvedValueOnce(["/abs/new.pptx"]);

    render(<ProjectOverview projectSummary={projectSummary as any} />);

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
    vi.mocked(getProjectDetails).mockResolvedValue(details as any);
    vi.mocked(getAppSettings).mockResolvedValue({ autoConvertOnOpen: false } as any);

    render(<ProjectOverview projectSummary={projectSummary as any} />);

    const addButton = await screen.findByRole("button", { name: /add files/i });
    expect(addButton).toHaveAttribute(
      "title",
      expect.stringMatching(/disabled; conversions won’t start automatically/i),
    );
  });
});
