import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Route as DashboardRoute } from "@/routes/dashboard/index";
import { Route as ResourcesRoute } from "@/routes/resources/index";
import { EnhancedAppSettingsPanel } from "@/components/settings/EnhancedAppSettingsPanel";
import { EditorPanel } from "@/components/editor";

vi.mock("@/ipc", () => ({
  getAppSettings: vi.fn().mockResolvedValue({
    appFolder: "/tmp/app",
    appFolderExists: true,
    databasePath: "/tmp/app/db.sqlite",
    databaseExists: true,
    projectsPath: "/tmp/app/projects",
    projectsPathExists: true,
    settingsFile: "/tmp/app/settings.yaml",
    settingsFileExists: true,
    defaultAppFolder: "/tmp/app",
    isUsingDefaultLocation: true,
    autoConvertOnOpen: true,
    theme: "light",
    uiLanguage: "en",
    defaultSourceLanguage: "en-US",
    defaultTargetLanguage: "it-IT",
    defaultXliffVersion: "2.1",
    showNotifications: true,
    enableSoundNotifications: true,
    maxParallelConversions: 4,
  }),
  updateAppFolder: vi.fn(),
  updateAutoConvertOnOpen: vi.fn(),
  updateTheme: vi.fn(),
  updateUiLanguage: vi.fn(),
  updateDefaultLanguages: vi.fn(),
  updateXliffVersion: vi.fn(),
  updateNotifications: vi.fn(),
  updateMaxParallelConversions: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("workspace panels", () => {
  it("renders dashboard content after the initial skeleton and supports keyboard navigation", async () => {
    const DashboardComponent = DashboardRoute.options.component!;
    const user = userEvent.setup();

    render(<DashboardComponent />);

    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/activity timeline/i)).toBeInTheDocument();
    });

    await user.tab();
    expect(screen.getByRole("button", { name: /new project/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByPlaceholderText(/search dashboard/i)).toHaveFocus();
  });

  it("renders resources placeholders when data is loaded and allows keyboard focus of key controls", async () => {
    const ResourcesComponent = ResourcesRoute.options.component!;
    const user = userEvent.setup();

    render(<ResourcesComponent />);

    expect(screen.getByRole("heading", { name: /resources/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /resource overview/i })).toBeInTheDocument();
    });

    await user.tab();
    expect(screen.getByRole("button", { name: /^import$/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: /sync/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByPlaceholderText(/search resources/i)).toHaveFocus();
  });

  it("mounts the settings panel without crashing and exposes toolbar navigation", async () => {
    const user = userEvent.setup();

    render(<EnhancedAppSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reset/i })).not.toBeDisabled();
    });

    await user.tab();
    expect(screen.getByRole("button", { name: /reset/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("textbox", { name: /search settings/i })).toHaveFocus();
  });

  it("mounts the editor panel with header and toolbar", async () => {
    const user = userEvent.setup();

    render(
      <EditorPanel
        projectName="Demo Project"
        documentName="demo.docx"
        statusLabel="Draft"
        onCloseEditor={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: /demo.docx/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search segments/i)).toBeInTheDocument();
    expect(screen.getByText(/editor workspace preview/i)).toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole("button", { name: /close editor/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("textbox", { name: /search segments/i })).toHaveFocus();
  });

  it("reuses the ThreeZonePanel chrome for visual parity", () => {
    const DashboardComponent = DashboardRoute.options.component!;

    render(<DashboardComponent />);

    const panel = document.querySelector<HTMLElement>("[data-slot='panel']");
    expect(panel).not.toBeNull();
    expect(panel).toHaveClass(
      "three-zone-panel",
      "flex",
      "h-full",
      "flex-col",
      "overflow-hidden",
      "rounded-tl-xl",
      "rounded-bl-xl",
      "border-t",
      "border-l",
      "border-b",
      "border-border",
      "bg-popover",
      "shadow-sm",
    );

    const header = panel!.querySelector<HTMLElement>("[data-slot='header']");
    const toolbar = panel!.querySelector<HTMLElement>("[data-slot='toolbar']");

    expect(header).not.toBeNull();
    expect(header).toHaveClass("three-zone-panel__header");

    expect(toolbar).not.toBeNull();
    expect(toolbar).toHaveClass("three-zone-panel__toolbar");
  });
});
