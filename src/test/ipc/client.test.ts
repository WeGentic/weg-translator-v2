import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

import {
  clearTranslationHistory,
  getAppSettings,
  listTranslationHistory,
  startTranslation,
  updateAppFolder,
  updateAutoConvertOnOpen,
} from "@/core/ipc/client";
import type { AppSettings } from "@/core/ipc/types";
import type { TranslationHistoryRecord, TranslationRequest } from "@/core/ipc/types";

const invokeMock = vi.mocked(invoke);

describe("ipc/client", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("invokes start_translation with the expected payload", async () => {
    const request: TranslationRequest = {
      sourceLanguage: "en",
      targetLanguage: "fr",
      text: "hello world",
      metadata: { documentName: "test.txt" },
    };

    const response = { jobId: "abc123", queued: true };
    invokeMock.mockResolvedValueOnce(response);

    const result = await startTranslation(request);

    expect(invokeMock).toHaveBeenCalledWith("start_translation", { request });
    expect(result).toEqual(response);
  });

  it("passes only defined query params when listing history", async () => {
    const records: TranslationHistoryRecord[] = [];
    invokeMock.mockResolvedValueOnce(records);

    await listTranslationHistory({ limit: 25 });

    expect(invokeMock).toHaveBeenCalledWith("list_translation_history", { limit: 25 });
  });

  it("wraps backend rejection errors with contextual information", async () => {
    invokeMock.mockRejectedValueOnce(new Error("SQL failed"));

    await expect(clearTranslationHistory()).rejects.toThrow(
      "[IPC] clear_translation_history failed: SQL failed",
    );
  });

  it("fetches application settings", async () => {
    const settings: AppSettings = {
      appFolder: "/tmp/app",
      appFolderExists: true,
      databasePath: "/tmp/app/db.sqlite",
      databaseExists: true,
      projectsPath: "/tmp/app/projects",
      projectsPathExists: true,
      settingsFile: "/config/settings.yaml",
      settingsFileExists: true,
      defaultAppFolder: "/tmp/default",
      isUsingDefaultLocation: false,
      autoConvertOnOpen: true,
      theme: "auto",
      uiLanguage: "en",
      defaultSourceLanguage: "en-US",
      defaultTargetLanguage: "es-ES",
      defaultXliffVersion: "2.1",
      showNotifications: true,
      enableSoundNotifications: false,
      maxParallelConversions: 4,
    };
    invokeMock.mockResolvedValueOnce(settings);

    const result = await getAppSettings();

    expect(invokeMock).toHaveBeenCalledWith("get_app_settings", undefined);
    expect(result).toBe(settings);
  });

  it("updates the application folder", async () => {
    const payload = { appFolder: "/tmp/new" };
    invokeMock.mockResolvedValueOnce(payload);

    const result = await updateAppFolder("/tmp/new");

    expect(invokeMock).toHaveBeenCalledWith("update_app_folder", { new_folder: "/tmp/new" });
    expect(result).toBe(payload);
  });

  it("updates auto-convert on open", async () => {
    const settings: AppSettings = {
      appFolder: "/tmp/app",
      appFolderExists: true,
      databasePath: "/tmp/app/db.sqlite",
      databaseExists: true,
      projectsPath: "/tmp/app/projects",
      projectsPathExists: true,
      settingsFile: "/config/settings.yaml",
      settingsFileExists: true,
      defaultAppFolder: "/tmp/default",
      isUsingDefaultLocation: false,
      autoConvertOnOpen: false,
      theme: "auto",
      uiLanguage: "en",
      defaultSourceLanguage: "en-US",
      defaultTargetLanguage: "es-ES",
      defaultXliffVersion: "2.1",
      showNotifications: true,
      enableSoundNotifications: false,
      maxParallelConversions: 4,
    };
    invokeMock.mockResolvedValueOnce(settings);

    const result = await updateAutoConvertOnOpen(true);

    expect(invokeMock).toHaveBeenCalledWith("update_auto_convert_on_open", { enabled: true });
    expect(result).toBe(settings);
  });
});
