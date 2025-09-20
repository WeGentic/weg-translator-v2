import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

import {
  clearTranslationHistory,
  listTranslationHistory,
  startTranslation,
} from "./client";
import type { TranslationHistoryRecord, TranslationRequest } from "./types";

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
});
