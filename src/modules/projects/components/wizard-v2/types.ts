/**
 * @file Defines shared type contracts for the create project wizard feature.
 *
 * Splitting these types into a dedicated module keeps the UI components lean
 * while ensuring that all parts of the wizard share a single source of truth.
 */

import type { CreateProjectRequest } from "@/core/ipc";
import type { LanguageOption } from "../wizard/utils/languages";

/**
 * Wizard steps rendered by the state machine.
 * Each step is implemented as a dedicated component.
 */
export type WizardStep = "details" | "files";

/**
 * The only project type supported when creating a project from the wizard.
 */
export type WizardProjectType = CreateProjectRequest["projectType"];

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

/**
 * Lightweight state machine used to surface progress or errors while the
 * project creation request is in flight.
 */
export type WizardFeedbackState = "idle" | "loading" | "error";
