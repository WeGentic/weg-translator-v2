import { render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo, type ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/ipc", () => ({
  getProjectDetails: vi.fn(),
  addFilesToProject: vi.fn(),
  removeProjectFile: vi.fn(),
  ensureProjectConversionsPlan: vi.fn(),
  updateConversionStatus: vi.fn(),
  convertXliffToJliff: vi.fn(),
  getAppSettings: vi.fn(),
  convertStream: vi.fn(),
  validateStream: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
  }),
}));

vi.mock("@/modules/projects/ui/overview/components/dialogs/RemoveFileDialog", () => ({
  RemoveFileDialog: ({
    open,
    onOpenChange,
    onConfirm,
  }: {
    open: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onConfirm: () => void;
  }) => {
    useEffect(() => {
      if (open) {
        onConfirm();
        onOpenChange(false);
      }
    }, [open, onConfirm, onOpenChange]);
    return null;
  },
}));

vi.mock("@/app/providers", () => {
  const useAuth = () =>
    useMemo(
      () => ({
        user: { id: "auth-user", email: "tester@example.com", name: "Tester" },
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        session: null,
      }),
      [],
    );

  return { useAuth };
});

import {
  getProjectDetails,
  addFilesToProject,
  removeProjectFile,
  ensureProjectConversionsPlan,
  updateConversionStatus,
  convertXliffToJliff,
  getAppSettings,
  convertStream,
  validateStream,
  type AppSettings,
  type EnsureConversionsPlan,
  type ProjectDetails,
  type ProjectListItem,
} from "@/core/ipc";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { ProjectOverview } from "@/modules/projects/ui/overview/ProjectOverview";
import { ToastProvider } from "@/shared/ui/toast";

function renderWithProviders(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const projectSummary: ProjectListItem = {
  projectId: "11111111-1111-1111-1111-111111111111",
  name: "Demo",
  slug: "demo",
  projectType: "translation" as const,
  status: "active" as const,
  activityStatus: "pending" as const,
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
  theme: "auto",
  uiLanguage: "en",
  defaultSourceLanguage: "en-US",
  defaultTargetLanguage: "es-ES",
  defaultXliffVersion: "2.1",
  showNotifications: true,
  enableSoundNotifications: false,
  maxParallelConversions: 4,
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
  vi.mocked(removeProjectFile).mockResolvedValue(1);
  vi.mocked(convertStream).mockResolvedValue({
    ok: true,
    code: 0,
    signal: 0,
    stdout: "",
    stderr: "",
    knownError: undefined,
    message: undefined,
  });
  vi.mocked(validateStream).mockResolvedValue({
    ok: true,
    code: 0,
    signal: 0,
    stdout: "",
    stderr: "",
    knownError: undefined,
    message: undefined,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProjectOverview", () => {
  it("renders files and conversion badges", async () => {
    vi.mocked(getProjectDetails).mockResolvedValue(details);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings });

    renderWithProviders(<ProjectOverview projectSummary={projectSummary} />);

    const title = await screen.findByRole("heading", { name: projectSummary.name });
    expect(title).toBeInTheDocument();
    // file grid renders as a data table in the new UI
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText(/languages/i)).not.toBeInTheDocument();
    expect(screen.getByText("a.docx")).toBeInTheDocument();
    expect(screen.getByText("b.xliff")).toBeInTheDocument();

    // Badge shows conversion completion state
    expect(screen.getByText(/^ready$/i)).toBeInTheDocument();
    expect(screen.getByText(/en-US\s*→\s*it-IT/i)).toBeInTheDocument();
  });

  it("shows error details when a conversion fails", async () => {
    const failingDetails: ProjectDetails = {
      ...details,
      files: [
        {
          file: {
            id: "f9",
            originalName: "broken.docx",
            storedRelPath: "broken.docx",
            ext: "docx",
            sizeBytes: 1024,
            importStatus: "imported",
            createdAt: "",
            updatedAt: "",
          },
          conversions: [
            {
              id: "c-broken",
              projectFileId: "f9",
              srcLang: "en-US",
              tgtLang: "es-ES",
              version: "2.1",
              paragraph: true,
              embed: true,
              status: "failed",
              errorMessage: "Machine translation engine refused the document.",
              createdAt: "",
              updatedAt: "",
            },
          ],
        },
      ],
    };

    vi.mocked(getProjectDetails).mockResolvedValue(failingDetails);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings });

    renderWithProviders(<ProjectOverview projectSummary={projectSummary} />);

    expect(await screen.findByText(/error/i)).toBeInTheDocument();
    expect(screen.getByText(/machine translation engine refused the document/i)).toBeInTheDocument();
  });

  it("invokes IPC on add/remove actions", async () => {
    vi.mocked(getProjectDetails).mockResolvedValue(details);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings });
    vi.mocked(openDialog).mockResolvedValueOnce(["/abs/new.pptx"]);

    renderWithProviders(<ProjectOverview projectSummary={projectSummary} />);

    await screen.findByRole("table");

    // Add files flow
    const user = userEvent.setup();
    const browse = await screen.findByRole("button", { name: /browse files/i });
    await user.click(browse);

    await waitFor(() => expect(addFilesToProject).toHaveBeenCalled());

    // Remove file flow
    const remove = (await screen.findAllByRole("button", { name: /remove file/i }))[0];
    await user.click(remove);
  });

  it("shows tooltip title when auto-convert is disabled", async () => {
    vi.mocked(getProjectDetails).mockResolvedValue(details);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings, autoConvertOnOpen: false });

    renderWithProviders(<ProjectOverview projectSummary={projectSummary} />);

    await screen.findByText(/Auto-convert on open is disabled/i);
  });

  it("runs conversion plan when adding new files", async () => {
    const planWithTask: EnsureConversionsPlan = {
      ...basePlan,
      tasks: [
        {
          conversionId: "c-new",
          projectFileId: "f-new",
          inputAbsPath: "/projects/demo/new.docx",
          outputAbsPath: "/projects/demo/new.xliff",
          srcLang: "en-US",
          tgtLang: "it-IT",
          version: "2.1",
          paragraph: true,
          embed: true,
        },
      ],
    };

    vi.mocked(getProjectDetails).mockResolvedValue(details);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings });
    vi.mocked(openDialog).mockResolvedValueOnce(["/abs/new.docx"]);
    vi.mocked(ensureProjectConversionsPlan)
      .mockResolvedValueOnce({ ...basePlan, tasks: [] })
      .mockResolvedValue(planWithTask);

    renderWithProviders(<ProjectOverview projectSummary={projectSummary} />);

    await screen.findByRole("table");

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /browse files/i }));

    await waitFor(() => expect(addFilesToProject).toHaveBeenCalledWith(projectSummary.projectId, ["/abs/new.docx"]));
    await waitFor(() => expect(convertStream).toHaveBeenCalled());
    await waitFor(() => expect(validateStream).toHaveBeenCalled());
    await waitFor(() => expect(convertXliffToJliff).toHaveBeenCalled());
  });

  it("rebuilds conversions after confirmation", async () => {
    const planWithTask = {
      ...basePlan,
      tasks: [
        {
          conversionId: "c1",
          projectFileId: "f1",
          inputAbsPath: "/projects/demo/a.docx",
          outputAbsPath: "/projects/demo/a.xliff",
          srcLang: "en-US",
          tgtLang: "it-IT",
          version: "2.1",
          paragraph: true,
          embed: true,
        },
      ],
    } as EnsureConversionsPlan;

    vi.mocked(getProjectDetails).mockResolvedValue(details);
    vi.mocked(getAppSettings).mockResolvedValue({ ...baseSettings });
    vi.mocked(ensureProjectConversionsPlan)
      .mockResolvedValueOnce({ ...basePlan, tasks: [] })
      .mockResolvedValueOnce(planWithTask);

    renderWithProviders(<ProjectOverview projectSummary={projectSummary} />);

    await screen.findByRole("table");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /rebuild conversions for a\.docx/i }));

    const confirm = await screen.findByRole("button", { name: /^rebuild$/i });
    await user.click(confirm);

    await waitFor(() => {
      expect(updateConversionStatus).toHaveBeenCalledWith("c1", "pending");
    });

    await waitFor(() =>
      expect(convertStream).toHaveBeenCalledWith(
        expect.objectContaining({ file: planWithTask.tasks[0].inputAbsPath }),
        expect.objectContaining({
          onStdout: expect.any(Function) as unknown as (line: string) => void,
          onStderr: expect.any(Function) as unknown as (line: string) => void,
        }),
      ),
    );
    await waitFor(() => expect(validateStream).toHaveBeenCalled());

    expect(ensureProjectConversionsPlan).toHaveBeenCalledTimes(2);
  });
});
