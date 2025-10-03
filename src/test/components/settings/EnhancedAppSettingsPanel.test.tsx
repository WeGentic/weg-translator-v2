import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ipc", () => ({
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
} from "@/ipc";
import { EnhancedAppSettingsPanel } from "@/components/settings/EnhancedAppSettingsPanel";

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
    vi.mocked(updateNotifications).mockImplementation(async (show, sound) => ({
      ...baseSettings,
      showNotifications: show,
      enableSoundNotifications: sound,
    }));
  });

  it("renders zones once settings load", async () => {
    render(<EnhancedAppSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/appearance/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search settings/i)).toBeInTheDocument();
    expect(screen.getByText(/resource location/i)).toBeInTheDocument();
  });

  it("updates theme via the auto-save flow", async () => {
    const user = userEvent.setup();
    render(<EnhancedAppSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/appearance/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /light/i }));
    await user.click(screen.getByRole("option", { name: /dark/i }));

    await waitFor(() => {
      expect(updateTheme).toHaveBeenCalledWith("dark");
      expect(screen.getByText(/theme updated successfully/i)).toBeInTheDocument();
    });
  });

  it("toggles notification switches", async () => {
    const user = userEvent.setup();
    render(<EnhancedAppSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/notifications/i)).toBeInTheDocument();
    });

    const soundToggle = screen.getAllByRole("switch")[1];
    await user.click(soundToggle);

    await waitFor(() => {
      expect(updateNotifications).toHaveBeenCalledWith(true, false);
    });
  });
});
