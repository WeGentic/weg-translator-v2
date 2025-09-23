import { render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getProjectDetails,
  readProjectArtifact,
  type ProjectDetails,
  type ProjectListItem,
} from "@/ipc";
import { ProjectEditor } from "./ProjectEditor";
import { ProjectEditorPlaceholder } from "./ProjectEditorPlaceholder";

vi.mock("@/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ipc")>("@/ipc");
  return {
    ...actual,
    getProjectDetails: vi.fn(),
    readProjectArtifact: vi.fn(),
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
      Source: "Hello",
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
          placeholders_in_order: [],
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProjectDetails).mockResolvedValue(details);
  vi.mocked(readProjectArtifact).mockImplementation(async (_projectId, relPath) => {
    if (relPath === "artifacts/demo.jliff.json") {
      return JSON.stringify(jliffArtifact);
    }
    if (relPath === "artifacts/demo.tag-map.json") {
      return JSON.stringify(tagMapArtifact);
    }
    throw new Error(`Unexpected artifact path: ${relPath}`);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProjectEditor", () => {
  it("renders editor header and hydrated artifact summary", async () => {
    render(<ProjectEditor project={baseProject} fileId="file-1" />);

    expect(screen.getByText(/Editor workspace/i)).toBeInTheDocument();

    await screen.findByText("Segments");

    expect(screen.getByText(/Focus translations and agent-assisted edits/i)).toHaveTextContent(
      /Demo Project/,
    );
    expect(screen.getByText(/Virtualized segments table renders here/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo Project/)).toBeInTheDocument();
    expect(screen.getByText("demo.xliff")).toBeInTheDocument();
    expect(screen.getByText(/Placeholder mismatches/i)).toBeInTheDocument();
    expect(screen.getByText("en-US")).toBeInTheDocument();
    expect(screen.getByText("de-DE")).toBeInTheDocument();

    const parityBadges = screen.getAllByText(/PH parity ok/i);
    expect(parityBadges).toHaveLength(2);
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

    render(<ProjectEditor project={baseProject} fileId="file-1" />);

    const errors = await screen.findAllByText(/No completed conversion with stored JLIFF artifacts/i);
    expect(errors).toHaveLength(2);
    expect(readProjectArtifact).not.toHaveBeenCalled();
  });

  it("renders placeholder when context is missing", async () => {
    render(<ProjectEditor project={baseProject} />);

    await waitFor(() => expect(getProjectDetails).toHaveBeenCalled());
    expect(screen.getByText(/Translation canvas/i)).toBeInTheDocument();
    const prompts = screen.getAllByText(/Select a file from the project overview to load it into the editor./i);
    expect(prompts.length).toBeGreaterThan(0);
  });

  it("renders fallback component when editor context missing", () => {
    render(<ProjectEditorPlaceholder projectId="missing" />);

    expect(screen.getByText(/Editor unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Project missing is not open yet/i)).toBeInTheDocument();
  });
});
