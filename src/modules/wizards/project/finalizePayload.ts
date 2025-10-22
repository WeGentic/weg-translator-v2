/**
 * @file Builders that transform wizard state into backend-ready payloads.
 *
 * These helpers keep the component free from validation minutiae while
 * enforcing a single source of truth for payload structure.
 */

import type {
  CreateProjectWithAssetsInput,
} from "@/shared/types/database";

import {
  buildLanguagePairs,
  LanguagePairError,
} from "./utils/languagePairs";
import {
  generateUniqueProjectFolderName,
  sanitizeProjectFolderName,
} from "./utils/projectFolder";
import type {
  DraftFileEntry,
  WizardFinalizeBuildResult,
  WizardFinalizePayload,
  WizardProjectType,
} from "./types";

interface BuildWizardFinalizePayloadParams {
  projectName: string;
  projectType: WizardProjectType;
  userUuid: string;
  clientUuid: string | null;
  projectField: string;
  notes: string;
  sourceLanguage: string | null;
  targetLanguages: readonly string[];
  files: readonly DraftFileEntry[];
  existingFolderNames?: readonly string[];
}

export function buildWizardFinalizePayload(params: BuildWizardFinalizePayloadParams): WizardFinalizeBuildResult {
  const trimmedProjectName = params.projectName.trim();
  if (!trimmedProjectName) {
    return {
      success: false,
      issue: {
        focusStep: "details",
        message: "Provide a project name in the Details step before finalizing.",
      },
    };
  }

  const baseFolderName = sanitizeProjectFolderName(trimmedProjectName);
  if (!baseFolderName) {
    return {
      success: false,
      issue: {
        focusStep: "details",
        message: "Project name must include valid characters for a folder name.",
      },
    };
  }

  const existingFolderNames = params.existingFolderNames ?? [];
  const projectFolderName =
    existingFolderNames.length > 0
      ? generateUniqueProjectFolderName(trimmedProjectName, { existingNames: existingFolderNames })
      : baseFolderName;

  const resolvedFolderName = projectFolderName || baseFolderName;

  if (!params.sourceLanguage) {
    return {
      success: false,
      issue: {
        focusStep: "details",
        message: "Select a source language to continue.",
      },
    };
  }

  let languagePairs: WizardFinalizePayload["languagePairs"] = [];

  try {
    languagePairs = buildLanguagePairs(params.sourceLanguage, params.targetLanguages);
  } catch (cause) {
    const message =
      cause instanceof LanguagePairError
        ? cause.message
        : "Check language selections before continuing.";
    return {
      success: false,
      issue: {
        focusStep: "details",
        message,
      },
    };
  }

  if (params.files.length === 0) {
    return {
      success: false,
      issue: {
        focusStep: "files",
        message: "Add at least one file to finalize the project.",
      },
    };
  }

  const files: WizardFinalizePayload["files"] = [];

  for (const file of params.files) {
    const trimmedPath = file.path.trim();
    if (trimmedPath.length === 0) {
      return {
        success: false,
        issue: {
          focusStep: "files",
          message: `Resolve the missing path for ${file.name} before finalizing.`,
        },
      };
    }

    files.push({
      id: file.id,
      name: file.name,
      extension: file.extension,
      role: file.role,
      path: trimmedPath,
    });
  }

  const trimmedNotes = params.notes.trim();
  const subject = params.projectField.trim();

  return {
    success: true,
    payload: {
      projectName: trimmedProjectName,
      projectFolderName: resolvedFolderName,
      projectType: params.projectType,
      userUuid: params.userUuid,
      clientUuid: params.clientUuid,
      subjects: subject ? [subject] : [],
      notes: trimmedNotes ? trimmedNotes : null,
      languagePairs,
      files,
    },
  };
}

export function buildCreateProjectWithAssetsInput(
  payload: WizardFinalizePayload,
): CreateProjectWithAssetsInput {
  return {
    projectName: payload.projectName,
    projectFolderName: payload.projectFolderName,
    projectStatus: "active",
    userUuid: payload.userUuid,
    clientUuid: payload.clientUuid ?? undefined,
    type: payload.projectType,
    notes: payload.notes ?? undefined,
    subjects: payload.subjects,
    languagePairs: payload.languagePairs,
    assets: payload.files.map((file) => ({
      draftId: file.id,
      name: file.name,
      extension: file.extension,
      role: file.role,
      path: file.path,
    })),
  };
}
