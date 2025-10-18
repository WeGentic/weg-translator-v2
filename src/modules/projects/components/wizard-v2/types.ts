/**
 * @file Defines shared type contracts for the create project wizard feature.
 *
 * Splitting these types into a dedicated module keeps the UI components lean
 * while ensuring that all parts of the wizard share a single source of truth.
 */

import type { ProjectLanguagePair } from "@/shared/types/database";

import type { LanguageOption } from "../wizard/utils/languages";

/**
 * Wizard steps rendered by the state machine.
 * Each step is implemented as a dedicated component.
 */
export type WizardStep = "details" | "files";

/**
 * The only project type supported when creating a project from the wizard.
 */
export type WizardProjectType = "translation" | "rag";

/**
 * Extends the shared language option with a pre-computed short label that is
 * easier to reuse inside compact UI elements (chips, table cells, etc.)
 */
export type EnhancedLanguageOption = LanguageOption & {
  compactLabel: string;
};

/**
 * Tags used to describe how an uploaded asset will participate in the project.
 * These map to the options shown in the role dropdown.
 */
export type FileRoleValue = "processable" | "reference" | "instructions" | "image";

/**
 * Structure of a file queued for upload before the project is persisted.
 */
export interface DraftFileEntry {
  id: string;
  name: string;
  extension: string;
  role: FileRoleValue;
  path: string;
}

/**
 * Shape of the payload received from Tauri drag & drop events.
 */
export interface DragDropEventPayload {
  type?: string;
  paths?: string[];
}

/**
 * `File` objects forwarded by the drag & drop API include an optional `path`
 * property when running inside Tauri. The union keeps the TypeScript compiler
 * satisfied without needing to cast at every call site.
 */
export type FileWithPath = File & { path?: string };

export interface WizardFinalizeFileDescriptor {
  id: string;
  name: string;
  extension: string;
  role: FileRoleValue;
  path: string;
}

export interface WizardFinalizePayload {
  projectName: string;
  projectFolderName: string;
  projectType: WizardProjectType;
  userUuid: string;
  clientUuid: string | null;
  subjects: string[];
  notes: string | null;
  languagePairs: ProjectLanguagePair[];
  files: WizardFinalizeFileDescriptor[];
}

export interface WizardFinalizeValidationIssue {
  focusStep: WizardStep;
  message: string;
}

export type WizardFinalizeBuildResult =
  | { success: true; payload: WizardFinalizePayload }
  | { success: false; issue: WizardFinalizeValidationIssue };

export type WizardFinalizePhase =
  | "validating-input"
  | "creating-project-record"
  | "preparing-folders"
  | "copying-assets"
  | "registering-database"
  | "planning-conversions"
  | "running-conversions";

export type WizardFinalizeErrorCategory =
  | "validation"
  | "filesystem"
  | "database"
  | "conversion"
  | "unknown";

export interface WizardFinalizeProgressDescriptor {
  phase: WizardFinalizePhase;
  headline: string;
  description: string;
  actionLabel?: string;
}

export interface WizardFinalizeErrorDescriptor {
  category: WizardFinalizeErrorCategory;
  headline: string;
  description: string;
  detail?: string;
  hint?: string;
}

export type WizardFinalizeFeedback =
  | { status: "idle" }
  | { status: "progress"; progress: WizardFinalizeProgressDescriptor }
  | { status: "error"; error: WizardFinalizeErrorDescriptor };

export interface WizardFinalizeProgressEventPayload {
  phase: string;
  description?: string;
  actionLabel?: string;
  projectFolderName?: string;
  projectUuid?: string;
}

export interface WizardConversionTask {
  draftId: string;
  fileUuid: string | null;
  artifactUuid: string | null;
  jobType: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  sourceAbsPath: string;
  outputAbsPath: string;
  outputRelPath: string;
}

export interface WizardConversionPlan {
  projectUuid: string;
  projectDir: string;
  tasks: WizardConversionTask[];
}
