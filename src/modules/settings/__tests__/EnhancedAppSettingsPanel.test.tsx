import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/ipc", () => ({
  getAppSettings: vi.fn(),
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

import {
  getAppSettings,
  updateTheme,
  updateNotifications,
  type AppSettings,
} from "@/core/ipc";
import { EnhancedAppSettingsPanel } from "@/modules/settings";

const baseSettings: AppSettings = {
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
};

describe("EnhancedAppSettingsPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAppSettings).mockResolvedValue(baseSettings);
    vi.mocked(updateTheme).mockResolvedValue({ ...baseSettings, theme: "dark" });
    vi.mocked(updateNotifications).mockImplementation((show, sound) =>
      Promise.resolve({
        ...baseSettings,
        showNotifications: show,
        enableSoundNotifications: sound,
      }),
    );

    if (typeof window !== "undefined") {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("(prefers-color-scheme: dark)"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }

    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = () => {};
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {};
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  it("renders zones once settings load", async () => {
    render(<EnhancedAppSettingsPanel />);

    const settingsHeading = await screen.findByRole("heading", { level: 1, name: /settings/i });

    expect(settingsHeading).toBeInTheDocument();
    expect(screen.getByText(/appearance/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search settings/i)).toBeInTheDocument();
    expect(
      screen.getByText(/control how and when you receive notifications/i),
    ).toBeInTheDocument();
  });

  it("updates theme via the auto-save flow", async () => {
    const user = userEvent.setup();
    render(<EnhancedAppSettingsPanel />);

    await screen.findByText(/appearance/i);

    const themeCombobox = screen
      .getAllByRole("combobox")
      .find((element) => element.textContent?.match(/light/i));
    expect(themeCombobox).toBeDefined();
    await user.click(themeCombobox!);
    await user.click(screen.getByRole("option", { name: /dark/i }));

    await waitFor(() => {
      expect(updateTheme).toHaveBeenCalledWith("dark");
      expect(screen.getByText(/theme updated successfully/i)).toBeInTheDocument();
    });
  });

  it("toggles notification switches", async () => {
    const user = userEvent.setup();
    render(<EnhancedAppSettingsPanel />);

    const notificationsDescription = await screen.findByText(
      /Control how and when you receive notifications/i,
    );
    const notificationsCard = notificationsDescription.closest("[data-slot='card']");
    expect(notificationsCard).not.toBeNull();

    const switches = within(notificationsCard as HTMLElement).getAllByRole("switch");
    const soundToggle = switches[1];
    await user.click(soundToggle);

    await waitFor(() => {
      expect(updateNotifications).toHaveBeenCalledWith(true, false);
    });
  });
});
