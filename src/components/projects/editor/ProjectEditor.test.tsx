import type { ReactElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getProjectDetails,
  readProjectArtifact,
  updateJliffSegment,
  type ProjectDetails,
  type ProjectListItem,
} from "@/ipc";
import { ToastProvider } from "@/components/ui/toast";
import { ProjectEditor } from "./ProjectEditor";
import { ProjectEditorPlaceholder } from "./ProjectEditorPlaceholder";

vi.mock("@/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ipc")>("@/ipc");
  return {
    ...actual,
    getProjectDetails: vi.fn(),
    readProjectArtifact: vi.fn(),
    updateJliffSegment: vi.fn(),
  };
});

vi.mock("./RowActions", () => {
  const MockRowActions = ({
    isDirty,
    canEdit,
    onCopySource,
    onReset,
    onInsertMissingPlaceholders,
    missingPlaceholderCount,
  }: {
    isDirty: boolean;
    canEdit: boolean;
    onCopySource: () => void;
    onReset: () => void;
    onInsertMissingPlaceholders: () => void;
    missingPlaceholderCount: number;
  }) => (
    <div data-testid="row-actions-mock">
      <button type="button" onClick={onCopySource} disabled={!canEdit}>
        Copy source
      </button>
      <button type="button" onClick={onReset} disabled={!canEdit}>
        Reset
      </button>
      <button
        type="button"
        onClick={onInsertMissingPlaceholders}
        disabled={!canEdit || missingPlaceholderCount === 0}
      >
        Insert missing
      </button>
      <button type="submit" disabled={!canEdit || !isDirty}>
        Save
      </button>
    </div>
  );
  return {
    __esModule: true,
    RowActions: MockRowActions,
    default: MockRowActions,
  };
});

const baseProject: ProjectListItem = {
  projectId: "11111111-1111-1111-1111-111111111111",
  name: "Demo Project",
  slug: "demo-project",
  projectType: "translation",
  status: "active",
  fileCount: 2,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
};

const jliffArtifact = {
  Project_name: "Demo Project",
  Project_ID: "proj-1",
  File: "demo.xliff",
  User: "tester",
  Source_language: "en-US",
  Target_language: "de-DE",
  Transunits: [
    {
      "unit id": "1",
      transunit_id: "seg-1",
      Source: "Hello {{ph:ph1}}",
      Target_translation: "",
    },
    {
      "unit id": "1",
      transunit_id: "seg-2",
      Source: "World",
      Target_translation: "Welt",
    },
  ],
};

const tagMapArtifact = {
  file_id: "demo",
  original_path: "demo.xliff",
  source_language: "en-US",
  target_language: "de-DE",
  placeholder_style: "double-curly",
  units: [
    {
      unit_id: "1",
          segments: [
            {
              segment_id: "seg-1",
              placeholders_in_order: [
                {
                  placeholder: "{{ph:ph1}}",
                  elem: "ph",
                  id: "seg-1-ph1",
                  attrs: {
                    id: "ph1",
                  },
                },
              ],
              originalData_bucket: {},
            },
            {
              segment_id: "seg-2",
          placeholders_in_order: [],
          originalData_bucket: {},
        },
      ],
    },
  ],
};

const details: ProjectDetails = {
  id: baseProject.projectId,
  name: baseProject.name,
  slug: baseProject.slug,
  defaultSrcLang: "en-US",
  defaultTgtLang: "de-DE",
  rootPath: "/projects/demo",
  files: [
    {
      file: {
        id: "file-1",
        originalName: "demo.xliff",
        storedRelPath: "stored/demo.xliff",
        ext: ".xliff",
        sizeBytes: 24,
        importStatus: "imported",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      },
      conversions: [
        {
          id: "conv-1",
          projectFileId: "file-1",
          srcLang: "en-US",
          tgtLang: "de-DE",
          version: "1.0",
          paragraph: false,
          embed: false,
          xliffRelPath: "conversions/demo.xliff",
          jliffRelPath: "artifacts/demo.jliff.json",
          tagMapRelPath: "artifacts/demo.tag-map.json",
          status: "completed",
          startedAt: "2024-01-02T10:00:00Z",
          completedAt: "2024-01-02T11:00:00Z",
          failedAt: undefined,
          errorMessage: undefined,
          createdAt: "2024-01-02T09:00:00Z",
          updatedAt: "2024-01-02T11:00:00Z",
        },
      ],
    },
  ],
};

function renderWithProviders(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProjectDetails).mockResolvedValue(details);
  vi.mocked(readProjectArtifact).mockImplementation((_projectId, relPath) => {
    if (relPath === "artifacts/demo.jliff.json") {
      return Promise.resolve(JSON.stringify(jliffArtifact));
    }
    if (relPath === "artifacts/demo.tag-map.json") {
      return Promise.resolve(JSON.stringify(tagMapArtifact));
    }
    return Promise.reject(new Error(`Unexpected artifact path: ${relPath}`));
  });
  vi.mocked(updateJliffSegment).mockResolvedValue({
    updatedCount: 1,
    updatedAt: "2024-01-02T12:00:00Z",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProjectEditor", () => {
  it("renders editor header and hydrated artifact summary", async () => {
    renderWithProviders(<ProjectEditor project={baseProject} fileId="file-1" />);

    expect(screen.getByText(/Editor workspace/i)).toBeInTheDocument();

    await screen.findByText("Segments");

    expect(screen.getByText(/Focus translations and agent-assisted edits/i)).toHaveTextContent(/Demo Project/);
    expect(screen.getByLabelText("Search segments")).toBeInTheDocument();
    expect(screen.getByText(/Demo Project/)).toBeInTheDocument();
    expect(screen.getByText("demo.xliff")).toBeInTheDocument();
    expect(screen.getByText(/Placeholder mismatches/i)).toBeInTheDocument();
    expect(screen.getByText("en-US")).toBeInTheDocument();
    expect(screen.getByText("de-DE")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("filters segments by placeholder mismatches", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProjectEditor project={baseProject} fileId="file-1" />);

    const mismatchToggle = await screen.findByRole("checkbox", { name: /Only mismatches/i });

    expect(screen.getByText("u1-sseg-1")).toBeInTheDocument();
    expect(screen.getByText("u1-sseg-2")).toBeInTheDocument();

    await user.click(mismatchToggle);

    await waitFor(() => {
      expect(screen.queryByText("u1-sseg-2")).not.toBeInTheDocument();
    });

    expect(screen.getByText("u1-sseg-1")).toBeInTheDocument();
    expect(mismatchToggle).toHaveAttribute("aria-checked", "true");
  });

  it("shows error when no completed conversion is available", async () => {
    vi.mocked(getProjectDetails).mockResolvedValue({
      ...details,
      files: [
        {
          ...details.files[0],
          conversions: [
            {
              ...details.files[0].conversions[0],
              status: "pending",
              jliffRelPath: undefined,
              tagMapRelPath: undefined,
            },
          ],
        },
      ],
    });

    renderWithProviders(<ProjectEditor project={baseProject} fileId="file-1" />);

    const errors = await screen.findAllByText(/No completed conversion with stored JLIFF artifacts/i);
    expect(errors).toHaveLength(2);
    expect(readProjectArtifact).not.toHaveBeenCalled();
  });

  it("renders placeholder when context is missing", async () => {
    renderWithProviders(<ProjectEditor project={baseProject} />);

    await waitFor(() => expect(getProjectDetails).toHaveBeenCalled());
    expect(screen.getByText(/Translation canvas/i)).toBeInTheDocument();
    const prompts = screen.getAllByText(/Select a file from the project overview to load it into the editor./i);
    expect(prompts.length).toBeGreaterThan(0);
  });

  it("saves target translation and updates summary", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProjectEditor project={baseProject} fileId="file-1" />);

    const actionButtons = await screen.findAllByRole("button", { name: /edit/i });
    await user.click(actionButtons[0]);

    const textarea = await screen.findByLabelText(/Target translation/i);
    await user.clear(textarea);
    await user.type(textarea, "Hallo");

    const form = textarea.closest("form");
    expect(form).not.toBeNull();
    const saveButton = within(form as HTMLFormElement).getByRole("button", { name: "Save" });
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateJliffSegment).toHaveBeenCalledWith({
        projectId: baseProject.projectId,
        jliffRelPath: "artifacts/demo.jliff.json",
        transunitId: "seg-1",
        newTarget: "Hallo",
      });
    });

    const untranslatedCard = screen.getByText("Untranslated").parentElement as HTMLElement;
    await waitFor(() => {
      expect(untranslatedCard).toHaveTextContent("0");
    });

    expect(screen.getByLabelText(/Target translation/i)).toHaveValue("Hallo");
  });

  it("renders fallback component when editor context missing", () => {
    renderWithProviders(<ProjectEditorPlaceholder projectId="missing" />);

    expect(screen.getByText(/Editor unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Project missing is not open yet/i)).toBeInTheDocument();
  });
});
