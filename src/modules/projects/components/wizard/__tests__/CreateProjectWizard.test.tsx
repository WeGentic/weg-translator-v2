import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/core/ipc", () => ({
  createProject: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { createProject } from "@/core/ipc";
import { open } from "@tauri-apps/plugin-dialog";

import { CreateProjectWizard } from "@/modules/projects/components/wizard/CreateProjectWizard";

afterEach(() => {
  vi.clearAllMocks();
});

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(window.Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
});

describe("CreateProjectWizard", () => {
  it("disables Next until details are valid", async () => {
    const user = userEvent.setup();
    render(<CreateProjectWizard open onOpenChange={() => {}} />);

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    const nameInput = screen.getByLabelText(/project name/i);
    await user.type(nameInput, "Marketing Launch");
    expect(nextButton).toBeDisabled();

    const typeTrigger = screen.getByLabelText(/project type/i);
    await user.click(typeTrigger);
    const translationOption = await screen.findByRole("option", { name: /translation/i });
    await user.click(translationOption);

    expect(nextButton).not.toBeDisabled();
  });

  it("submits form after review", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onProjectCreated = vi.fn();
    const createProjectMock = vi.mocked(createProject);
    createProjectMock.mockResolvedValue({
      projectId: "123",
      slug: "marketing-launch",
      folder: "/projects/123",
      fileCount: 1,
    });

    const openDialogMock = vi.mocked(open);
    openDialogMock.mockResolvedValueOnce(["/Users/test/launch.docx"]);

    render(
      <CreateProjectWizard
        open
        onOpenChange={onOpenChange}
        onProjectCreated={onProjectCreated}
      />,
    );

    const nameInput = screen.getByLabelText(/project name/i);
    await user.type(nameInput, "Marketing Launch");

    const typeTrigger = screen.getByLabelText(/project type/i);
    await user.click(typeTrigger);
    await user.click(await screen.findByRole("option", { name: /translation/i }));

    await user.click(screen.getByRole("button", { name: /next/i }));

    await user.click(screen.getByRole("button", { name: /add files/i }));
    await waitFor(() => expect(openDialogMock).toHaveBeenCalled());
    await screen.findByText("launch.docx");

    await user.click(screen.getByRole("button", { name: /next/i }));

    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => expect(createProjectMock).toHaveBeenCalledTimes(1));
    expect(createProjectMock).toHaveBeenCalledWith({
      name: "Marketing Launch",
      projectType: "translation",
      defaultSrcLang: "en-US",
      defaultTgtLang: "it-IT",
      files: ["/Users/test/launch.docx"],
    });

    await waitFor(() => expect(onProjectCreated).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
