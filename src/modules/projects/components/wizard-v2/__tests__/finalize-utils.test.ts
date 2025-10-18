import { describe, expect, it } from "vitest";

import {
  buildWizardFinalizePayload,
  buildCreateProjectWithAssetsInput,
  resolveFinalizeError,
  mapConversionPlanFromResponse,
  describeConversionTask,
} from "../CreateProjectWizardV2";

import type { CreateProjectWithAssetsResponse } from "@/shared/types/database";

describe("buildWizardFinalizePayload", () => {
  const baseParams = {
    projectName: " Example Project ",
    projectType: "translation" as const,
    userUuid: "local-user",
    clientUuid: null,
    projectField: "Legal",
    notes: "Some notes",
    sourceLanguage: "en-US",
    targetLanguages: ["fr-FR"],
    files: [
      {
        id: "draft-1",
        name: "file.docx",
        extension: "docx",
        role: "processable" as const,
        path: "/tmp/file.docx",
      },
    ],
    existingFolderNames: ["example-project"],
  };

  it("returns a successful payload with sanitized folder name", () => {
    const result = buildWizardFinalizePayload({ ...baseParams, projectName: "Example Project" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unexpected failure");

    expect(result.payload.projectFolderName).toMatch(/^example-project-\d+$/);
    expect(result.payload.files).toHaveLength(1);
    expect(result.payload.languagePairs).toEqual([
      { sourceLang: "en-US", targetLang: "fr-FR" },
    ]);
  });

  it("fails when no files have valid paths", () => {
    const result = buildWizardFinalizePayload({
      ...baseParams,
      files: [{ ...baseParams.files[0], path: "   " }],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected validation failure");
    expect(result.issue.focusStep).toBe("files");
  });
});

describe("buildCreateProjectWithAssetsInput", () => {
  it("maps wizard payload into command dto", () => {
    const finalizeResult = buildWizardFinalizePayload({
      projectName: "Demo",
      projectType: "translation",
      userUuid: "local-user",
      clientUuid: null,
      projectField: "Legal",
      notes: "",
      sourceLanguage: "en-US",
      targetLanguages: ["fr-FR"],
      files: [
        {
          id: "draft-1",
          name: "file.docx",
          extension: "docx",
          role: "processable",
          path: "/tmp/file.docx",
        },
      ],
      existingFolderNames: [],
    });

    if (!finalizeResult.success) throw new Error("unexpected failure");
    const commandInput = buildCreateProjectWithAssetsInput(finalizeResult.payload);
    expect(commandInput.assets[0]).toMatchObject({ draftId: "draft-1", role: "processable" });
    expect(commandInput.projectFolderName).toBe("demo");
  });
});

describe("resolveFinalizeError", () => {
  it("maps known error codes to categories", () => {
    const feedback = resolveFinalizeError({
      code: "FS_COPY_FAILED",
      message: "Could not copy file",
    });
    expect(feedback.status).toBe("error");
    if (feedback.status === "error") {
      expect(feedback.error.category).toBe("filesystem");
      expect(feedback.error.description).toContain("Could not copy file");
    }
  });
});

describe("mapConversionPlanFromResponse", () => {
  const response: CreateProjectWithAssetsResponse = {
    project: {
      project: {
        projectUuid: "project-uuid",
        projectName: "Project",
        creationDate: "now",
        updateDate: "now",
        projectStatus: "active",
        userUuid: "local-user",
        clientUuid: null,
        type: "translation",
        notes: null,
      },
      subjects: [],
      languagePairs: [],
      files: [],
      jobs: [],
    },
    projectDir: "/tmp/project",
    assets: [],
    conversionPlan: {
      projectUuid: "project-uuid",
      tasks: [
        {
          draftId: "draft-1",
          fileUuid: "file-uuid",
          artifactUuid: "artifact-uuid",
          jobType: "xliff_conversion",
          sourceLang: "en",
          targetLang: "fr",
          sourcePath: "/tmp/source/test.txt",
          xliffRelPath: "Translations/en_fr/test.xlf",
        },
      ],
    },
  };

  it("derives absolute path and carries artifact/job metadata", () => {
    const plan = mapConversionPlanFromResponse(response);
    expect(plan).not.toBeNull();
    if (!plan) throw new Error("expected plan");
    expect(plan.tasks[0].outputAbsPath).toBe("/tmp/project/Translations/en_fr/test.xlf");
    expect(plan.tasks[0].artifactUuid).toBe("artifact-uuid");
    expect(plan.tasks[0].jobType).toBe("xliff_conversion");
  });
});

describe("describeConversionTask", () => {
  it("formats user friendly message", () => {
    const text = describeConversionTask(
      {
        draftId: "draft-1",
        fileUuid: "file-uuid",
        artifactUuid: "artifact-uuid",
        jobType: "xliff_conversion",
        sourceLanguage: "en",
        targetLanguage: "fr",
        sourceAbsPath: "/tmp/source/test.txt",
        outputAbsPath: "/tmp/out/test.xlf",
        outputRelPath: "Translations/en_fr/test.xlf",
      },
      0,
      2,
    );

    expect(text).toContain("Converting test.txt (en → fr)");
    expect(text).toContain("1 of 2");
  });
});
