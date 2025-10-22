import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachProjectFile,
  updateProjectBundle,
} from "../projects";
import { safeInvoke } from "../../request";

vi.mock("../../request", () => ({
  safeInvoke: vi.fn(),
}));

const mockSafeInvoke = vi.mocked(safeInvoke);

const PROJECT_UUID = "project-123";

function resetMocks() {
  vi.clearAllMocks();
  mockSafeInvoke.mockReset();
}

describe("ipc/db/projects", () => {
  beforeEach(resetMocks);

  describe("attachment payloads", () => {
    it("forwards explicit fileUuid and size fields when defined", async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        file: {
          projectUuid: PROJECT_UUID,
          fileUuid: "file-123",
          filename: "demo.xliff",
          storedAt: "Translations/demo.xliff",
          type: "processable",
        },
        info: {
          fileUuid: "file-123",
          ext: "xliff",
          type: "processable",
          sizeBytes: 1024,
          segmentCount: 20,
          tokenCount: 500,
          notes: "attachment",
        },
        languagePairs: [],
        artifacts: [],
      });

      await attachProjectFile({
        projectUuid: PROJECT_UUID,
        fileUuid: "file-123",
        filename: "demo.xliff",
        storedAt: "Translations/demo.xliff",
        type: "processable",
        ext: "xliff",
        sizeBytes: 1024,
        segmentCount: 20,
        tokenCount: 500,
        notes: "attachment",
        languagePairs: [],
      });

      expect(mockSafeInvoke).toHaveBeenCalledWith(
        "attach_project_file_v2",
        expect.objectContaining({
          payload: expect.objectContaining({
            projectUuid: PROJECT_UUID,
            fileUuid: "file-123",
            sizeBytes: 1024,
            segmentCount: 20,
            tokenCount: 500,
          }),
        }),
      );
    });

    it("omits undefined optional file fields", async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        file: {
          projectUuid: PROJECT_UUID,
          fileUuid: "file-xyz",
          filename: "reference.pdf",
          storedAt: "References/reference.pdf",
          type: "reference",
        },
        info: {
          fileUuid: "file-xyz",
          ext: "pdf",
          type: "reference",
          sizeBytes: null,
          segmentCount: null,
          tokenCount: null,
          notes: null,
        },
        languagePairs: [],
        artifacts: [],
      });

      await attachProjectFile({
        projectUuid: PROJECT_UUID,
        filename: "reference.pdf",
        storedAt: "References/reference.pdf",
        type: "reference",
        ext: "pdf",
        languagePairs: [],
      });

      const [, args] = mockSafeInvoke.mock.calls.at(-1) ?? [];
      expect(args?.payload).toMatchObject({
        projectUuid: PROJECT_UUID,
        filename: "reference.pdf",
        storedAt: "References/reference.pdf",
        type: "reference",
        ext: "pdf",
      });
      expect(args?.payload).not.toHaveProperty("fileUuid");
      expect(args?.payload).not.toHaveProperty("sizeBytes");
      expect(args?.payload).not.toHaveProperty("segmentCount");
      expect(args?.payload).not.toHaveProperty("tokenCount");
    });
  });

  describe("update payloads", () => {
    it("preserves explicit nulls for nullable fields", async () => {
      mockSafeInvoke.mockResolvedValueOnce(null);

      await updateProjectBundle({
        projectUuid: PROJECT_UUID,
        notes: null,
        clientUuid: null,
        projectName: "Updated",
      });

      const [, args] = mockSafeInvoke.mock.calls.at(-1) ?? [];
      expect(args?.payload).toMatchObject({
        projectUuid: PROJECT_UUID,
        notes: null,
        clientUuid: null,
        projectName: "Updated",
      });
      expect(Object.prototype.hasOwnProperty.call(args?.payload ?? {}, "notes")).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(args?.payload ?? {}, "clientUuid")).toBe(true);
    });

    it("omits fields left undefined", async () => {
      mockSafeInvoke.mockResolvedValueOnce(null);

      await updateProjectBundle({
        projectUuid: PROJECT_UUID,
        projectStatus: "active",
      });

      const [, args] = mockSafeInvoke.mock.calls.at(-1) ?? [];
      expect(args?.payload).toEqual({
        projectUuid: PROJECT_UUID,
        projectStatus: "active",
      });
    });
  });
});
