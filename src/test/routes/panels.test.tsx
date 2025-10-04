import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

if (typeof window !== "undefined" && window.matchMedia == null) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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
  if (typeof window !== "undefined") {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

describe("workspace panels", () => {
  it("renders dashboard content after the initial skeleton and supports keyboard navigation", async () => {
    const DashboardComponent = DashboardRoute.options.component!;
    const user = userEvent.setup();

    render(<DashboardComponent />);

    await waitFor(() => {
      expect(screen.getByText(/project manager/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector("[data-component='projects-host-shell']")).not.toBeNull();
    });
    const host = document.querySelector<HTMLElement>("[data-component='projects-host-shell']");
    expect(host).not.toBeNull();
    expect(host).toHaveClass("flex", "h-full", "flex-col", "overflow-hidden");
    expect(host?.querySelector(".projects-table-toolbar-zone")).not.toBeNull();

    await user.tab();
    expect(screen.getByRole("button", { name: /new project/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByPlaceholderText(/search projects/i)).toHaveFocus();
  });

  it("renders resources placeholders when data is loaded and allows keyboard focus of key controls", async () => {
    const ResourcesComponent = ResourcesRoute.options.component!;
    const user = userEvent.setup();

    render(<ResourcesComponent />);

    await waitFor(() => {
      expect(screen.getByText(/project manager/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector("[data-component='projects-host-shell']")).not.toBeNull();
    });
    const host = document.querySelector<HTMLElement>("[data-component='projects-host-shell']");
    expect(host).not.toBeNull();
    expect(host?.querySelector("[data-slot='footer']")).not.toBeNull();

    await user.tab();
    expect(screen.getByRole("button", { name: /new project/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByPlaceholderText(/search projects/i)).toHaveFocus();
  });

  it("mounts the settings panel without crashing and exposes toolbar navigation", async () => {
    const user = userEvent.setup();

    render(<EnhancedAppSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reset/i })).not.toBeDisabled();
    });

    await waitFor(() => {
      expect(document.querySelector("[data-component='projects-host-shell']")).not.toBeNull();
    });
    const host = document.querySelector<HTMLElement>("[data-component='projects-host-shell']");
    expect(host).not.toBeNull();
    expect(host?.querySelector(".projects-table-header-zone")).toHaveTextContent(/settings/i);

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

    const host = document.querySelector<HTMLElement>("[data-component='projects-host-shell']");
    expect(host).not.toBeNull();
    expect(host?.querySelector("[data-slot='footer']")).not.toBeNull();

    await user.tab();
    expect(screen.getByRole("button", { name: /close editor/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("textbox", { name: /search segments/i })).toHaveFocus();
  });

  it("reuses the Projects host shell chrome for visual parity", async () => {
    const DashboardComponent = DashboardRoute.options.component!;

    render(<DashboardComponent />);

    await waitFor(() => {
      expect(document.querySelector(".projects-table-main-zone")).not.toBeNull();
    });

    const host = document.querySelector<HTMLElement>("[data-component='projects-host-shell']");
    expect(host).not.toBeNull();
    expect(host).toHaveClass(
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

    const header = host!.querySelector<HTMLElement>(".projects-table-header-zone");
    const toolbar = host!.querySelector<HTMLElement>(".projects-table-toolbar-zone");

    expect(header).not.toBeNull();
    expect(toolbar).not.toBeNull();
    expect(host!.querySelector<HTMLElement>("[data-slot='footer']")).not.toBeNull();
  });
});
