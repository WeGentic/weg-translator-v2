/**
 * @file Centralised constants that describe the wizard vocabulary.
 *
 * Keeping the lookups here prevents circular dependencies between hooks and
 * components while providing a single place to tweak copy or business rules.
 */

import type { AssignableFileRoleValue, FileRoleValue, WizardProjectType } from "./types";

export const FILE_ROLE_LABELS: Record<FileRoleValue, string> = {
  undefined: "Role required",
  processable: "Translation",
  reference: "Reference",
  instructions: "Instructions",
  image: "Image",
  ocr: "OCR",
};

export type FileRoleOptionDefinition = {
  value: AssignableFileRoleValue;
  label: string;
  /**
   * Returns true when the option should be shown for the provided extension.
   * When omitted, the option is available for every file.
   */
  isEligible?: (extension: string) => boolean;
};

export const EDITABLE_FILE_ROLE_OPTIONS: ReadonlyArray<FileRoleOptionDefinition> = [
  { value: "processable", label: FILE_ROLE_LABELS.processable },
  { value: "reference", label: FILE_ROLE_LABELS.reference },
  { value: "instructions", label: FILE_ROLE_LABELS.instructions },
  {
    value: "ocr",
    label: FILE_ROLE_LABELS.ocr,
    isEligible: (extension) => OCR_ELIGIBLE_EXTENSIONS.has(extension),
  },
  {
    value: "image",
    label: FILE_ROLE_LABELS.image,
    isEligible: (extension) => IMAGE_EXTENSIONS.has(extension),
  },
] as const;

/**
 * Extensions used to infer the default "image" role for newly added files.
 * The list is normalised to uppercase to simplify lookups.
 */
export const IMAGE_EXTENSIONS = new Set([
  "PNG",
  "JPG",
  "JPEG",
  "GIF",
  "BMP",
  "SVG",
  "WEBP",
  "TIFF",
]);

export const OCR_ELIGIBLE_EXTENSIONS = new Set<string>([
  ...IMAGE_EXTENSIONS,
  "PDF",
]);

export const DEFAULT_PROJECT_TYPE: WizardProjectType = "translation";

export const PROJECT_CREATE_PROGRESS_EVENT = "project:create:progress";

export const XLIFF_TARGET_VERSION = "2.0" as const;
