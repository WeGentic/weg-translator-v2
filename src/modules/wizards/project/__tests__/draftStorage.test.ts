import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearWizardDraftSnapshot,
  loadWizardDraftSnapshot,
  persistWizardDraftSnapshot,
} from "../draftStorage";
import type { WizardDraftSnapshot } from "../types";

const STORAGE_KEY = "weg-translator:wizard:create-project:draft";

describe("wizard draft storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("returns null when no snapshot exists", () => {
    expect(loadWizardDraftSnapshot()).toBeNull();
  });

  it("round-trips a persisted snapshot", () => {
    const snapshot: WizardDraftSnapshot = {
      step: "files",
      projectName: "Demo",
      clientName: "Client A",
      selectedClientUuid: "uuid-1",
      projectField: "Legal",
      notes: "Needs rush delivery",
      sourceLanguage: "en-US",
      targetLanguages: ["fr-FR", "de-DE"],
      files: [
        {
          id: "file-1",
          name: "contract.docx",
          extension: "DOCX",
          role: "processable",
          path: "/tmp/contract.docx",
        },
      ],
      updatedAt: 1700000000000,
    };

    persistWizardDraftSnapshot(snapshot);

    const restored = loadWizardDraftSnapshot();

    expect(restored).not.toBeNull();
    expect(restored).toEqual(snapshot);
  });

  it("sanitizes malformed data when loading", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        snapshot: {
          step: "unknown-step",
          projectName: 42,
          clientName: "  ",
          selectedClientUuid: "   ",
          projectField: null,
          notes: 15,
          sourceLanguage: "en-GB",
          targetLanguages: ["", " fr-CA ", 12, "fr-CA"],
          files: [
            {
              id: "file-1",
              name: "brief.pdf",
              extension: "PDF",
              role: "processable",
              path: "/tmp/brief.pdf",
            },
            {
              id: "file-2",
              name: "duplicate.pdf",
              extension: "PDF",
              role: "reference",
              path: "/tmp/brief.pdf",
            },
            {
              id: "",
              name: "bad",
              extension: "TXT",
              role: "image",
              path: "",
            },
          ],
          updatedAt: "invalid",
        },
      }),
    );

    const restored = loadWizardDraftSnapshot();
    expect(restored).not.toBeNull();
    expect(restored?.step).toBe("details");
    expect(restored?.projectName).toBe("");
    expect(restored?.clientName).toBe("  ");
    expect(restored?.selectedClientUuid).toBeNull();
    expect(restored?.projectField).toBe("");
    expect(restored?.notes).toBe("");
    expect(restored?.sourceLanguage).toBe("en-GB");
    expect(restored?.targetLanguages).toEqual(["fr-CA"]);
    expect(restored?.files).toEqual([
      {
        id: "file-1",
        name: "brief.pdf",
        extension: "PDF",
        role: "processable",
        path: "/tmp/brief.pdf",
      },
    ]);
    expect(restored?.updatedAt).toBe(new Date("2024-01-01T00:00:00.000Z").getTime());
    vi.useRealTimers();
  });

  it("clears the snapshot from storage", () => {
    const snapshot: WizardDraftSnapshot = {
      step: "details",
      projectName: "Demo",
      clientName: "",
      selectedClientUuid: null,
      projectField: "",
      notes: "",
      sourceLanguage: null,
      targetLanguages: [],
      files: [],
      updatedAt: 0,
    };

    persistWizardDraftSnapshot(snapshot);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

    clearWizardDraftSnapshot();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
