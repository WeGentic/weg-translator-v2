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

import { dashboardRouteComponent } from "@/modules/dashboard";
import { resourcesRouteComponent } from "@/modules/resources";
import { EnhancedAppSettingsPanel } from "@/modules/settings";
import { EditorPanel } from "@/modules/editor";

vi.mock("@/core/ipc", () => ({
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
  it("renders dashboard scaffolding", async () => {
    const DashboardComponent = dashboardRouteComponent;

    render(<DashboardComponent />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });

    const toolbar = document.querySelector<HTMLElement>(".dashboard-toolbar-zone");
    const main = document.querySelector<HTMLElement>("[aria-label='Dashboard main content']");

    expect(toolbar).not.toBeNull();
    expect(main).not.toBeNull();
  });

  it("renders resources scaffolding", async () => {
    const ResourcesComponent = resourcesRouteComponent;

    render(<ResourcesComponent />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /resources/i })).toBeInTheDocument();
    });

    const toolbar = document.querySelector<HTMLElement>(".resources-toolbar-zone");
    const main = document.querySelector<HTMLElement>("[aria-label='Resources main content']");

    expect(toolbar).not.toBeNull();
    expect(main).not.toBeNull();
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

  it("uses the shared main view container", () => {
    const DashboardComponent = dashboardRouteComponent;

    render(<DashboardComponent />);

    const container = document.querySelector<HTMLElement>("section.mainview-container");
    expect(container).not.toBeNull();
    expect(container?.getAttribute("role")).toBe("region");
  });
});
