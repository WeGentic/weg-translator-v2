import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FileListItem } from "@/modules/projects/ui/overview/components/files/FileListItem";

const conversion = {
  id: "c1",
  projectFileId: "f1",
  srcLang: "en",
  tgtLang: "it",
  version: "2.1",
  paragraph: true,
  embed: true,
  status: "completed" as const,
  createdAt: "",
  updatedAt: "",
};

describe("FileListItem", () => {
  it("renders file metadata and actions", () => {
    render(
      <FileListItem
        name="demo.docx"
        ext="docx"
        size={1024}
        importStatus="imported"
        conversions={[conversion]}
        onOpenEditor={vi.fn()}
        onRebuild={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("demo.docx")).toBeInTheDocument();
    expect(screen.getAllByText("DOCX").length).toBeGreaterThan(0);
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open .* in editor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rebuild conversions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove file/i })).toBeInTheDocument();
  });

  it("invokes callbacks when buttons are clicked", async () => {
    const handleOpen = vi.fn();
    const handleRebuild = vi.fn();
    const handleRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <FileListItem
        name="demo.docx"
        ext="docx"
        size={1024}
        importStatus="imported"
        conversions={[conversion]}
        onOpenEditor={handleOpen}
        onRebuild={handleRebuild}
        onRemove={handleRemove}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open .* in editor/i }));
    await user.click(screen.getByRole("button", { name: /rebuild conversions/i }));
    await user.click(screen.getByRole("button", { name: /remove file/i }));

    expect(handleOpen).toHaveBeenCalledTimes(1);
    expect(handleRebuild).toHaveBeenCalledTimes(1);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });
});
