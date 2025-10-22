/**
 * @file Conversion planning helpers for the project wizard.
 *
 * Centralises logic that derives conversion tasks from backend responses so it
 * can be tested in isolation and reused by the finalize hook.
 */

import type {
  CreateProjectWithAssetsInput,
  CreateProjectWithAssetsResponse,
} from "@/shared/types/database";

import {
  extractFileName,
  extractFileStem,
  joinPathSegments,
} from "./utils";
import type {
  WizardConversionPlan,
  WizardConversionTask,
} from "./types";

export function deriveWizardConversionPlan(
  response: CreateProjectWithAssetsResponse,
  input: CreateProjectWithAssetsInput,
): WizardConversionPlan {
  const projectUuid = response.project.project.projectUuid;
  const projectDir = response.projectDir;
  const tasks: WizardConversionPlan["tasks"] = [];

  for (const asset of response.assets) {
    if (asset.role !== "processable") {
      continue;
    }

    if (!asset.storedRelPath) {
      console.warn(
        "[wizard] Skipping conversion planning for asset without stored path",
        asset,
      );
      continue;
    }

    const sourceAbsPath = joinPathSegments(projectDir, asset.storedRelPath);
    const fileStem = extractFileStem(asset.storedRelPath);

    for (const pair of input.languagePairs) {
      const languageFolder = `${pair.sourceLang}_${pair.targetLang}`;
      const outputRelPath = joinPathSegments(
        "Translations",
        languageFolder,
        `${fileStem}.xlf`,
      );
      const outputAbsPath = joinPathSegments(projectDir, outputRelPath);

      tasks.push({
        draftId: asset.draftId,
        fileUuid: asset.fileUuid ?? null,
        artifactUuid: null,
        jobType: "xliff_conversion",
        sourceLanguage: pair.sourceLang,
        targetLanguage: pair.targetLang,
        sourceAbsPath,
        outputAbsPath,
        outputRelPath,
      });
    }
  }

  if (tasks.length > 0) {
    console.debug(
      "[wizard] Prepared conversion tasks for project",
      projectUuid,
      tasks.map((task) => ({
        draftId: task.draftId,
        source: task.sourceAbsPath,
        target: task.outputAbsPath,
        pair: `${task.sourceLanguage}→${task.targetLanguage}`,
      })),
    );
  } else {
    console.debug(
      "[wizard] No conversion tasks generated for project (no processable assets or language pairs)",
      projectUuid,
    );
  }

  return {
    projectUuid,
    projectDir,
    tasks,
  };
}

export function mapConversionPlanFromResponse(
  response: CreateProjectWithAssetsResponse,
): WizardConversionPlan | null {
  const plan = response.conversionPlan;
  if (!plan) {
    return null;
  }

  const { projectUuid, tasks } = plan;
  const projectDir = response.projectDir;

  return {
    projectUuid,
    projectDir,
    tasks: tasks.map((task) => ({
      draftId: task.draftId,
      fileUuid: task.fileUuid ?? null,
      artifactUuid: task.artifactUuid ?? null,
      jobType: task.jobType ?? null,
      sourceLanguage: task.sourceLang,
      targetLanguage: task.targetLang,
      sourceAbsPath: task.sourcePath,
      outputRelPath: task.xliffRelPath,
      outputAbsPath: joinPathSegments(projectDir, task.xliffRelPath),
    })),
  };
}

export function describeConversionTask(task: WizardConversionTask, index: number, total: number): string {
  const fileName = extractFileName(task.sourceAbsPath);
  const position = `${index + 1} of ${total}`;
  return `Converting ${fileName} (${task.sourceLanguage} → ${task.targetLanguage}) — ${position}.`;
}
