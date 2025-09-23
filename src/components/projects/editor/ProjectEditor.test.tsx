import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProjectListItem } from "@/ipc";
import { ProjectEditor } from "./ProjectEditor";
import { ProjectEditorPlaceholder } from "./ProjectEditorPlaceholder";

const project: ProjectListItem = {
  projectId: "11111111-1111-1111-1111-111111111111",
  name: "Demo Project",
  slug: "demo-project",
  projectType: "translation" as const,
  status: "active" as const,
  fileCount: 2,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
};

describe("ProjectEditor", () => {
  it("renders editor header and selected file", () => {
    render(<ProjectEditor project={project} fileId="f1" />);

    expect(screen.getByText(/Editor workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus translations and agent-assisted edits/i)).toHaveTextContent(
      /Demo Project/,
    );
    expect(screen.getByText(/Active file/i)).toBeInTheDocument();
    expect(screen.getByText((content) => content.trim() === "f1")).toBeInTheDocument();
  });

  it("renders placeholder when context is missing", () => {
    render(<ProjectEditorPlaceholder projectId="missing" />);

    expect(screen.getByText(/Editor unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Project missing is not open yet/i)).toBeInTheDocument();
  });
});
