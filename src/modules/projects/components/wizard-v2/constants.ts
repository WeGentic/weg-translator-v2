/**
 * @file Centralised constants that describe the wizard vocabulary.
 *
 * Keeping the lookups here prevents circular dependencies between hooks and
 * components while providing a single place to tweak copy or business rules.
 */

import type { WizardProjectType, FileRoleValue } from "./types";

export const FILE_ROLE_LABELS: Record<FileRoleValue, string> = {
  processable: "Translation",
  reference: "Reference",
  instructions: "Instructions",
  image: "Image",
};

export const EDITABLE_FILE_ROLE_OPTIONS: ReadonlyArray<{
  value: Extract<FileRoleValue, "processable" | "reference" | "instructions">;
  label: string;
}> = [
  { value: "processable", label: FILE_ROLE_LABELS.processable },
  { value: "reference", label: FILE_ROLE_LABELS.reference },
  { value: "instructions", label: FILE_ROLE_LABELS.instructions },
] as const;

export const PROJECT_FIELDS = [
  { value: "marketing", label: "Marketing & Creative" },
  { value: "legal", label: "Legal" },
  { value: "technical", label: "Technical" },
  { value: "medical", label: "Medical" },
  { value: "finance", label: "Finance" },
  { value: "software", label: "Software & IT" },
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

export const DEFAULT_PROJECT_TYPE: WizardProjectType = "translation";
