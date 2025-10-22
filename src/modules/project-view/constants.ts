import type { ProjectFileRoleValue } from "@/types/project-files";

export const PROJECT_FILE_ROLE_OPTIONS: ReadonlyArray<{ value: ProjectFileRoleValue; label: string }> = [
  { value: "processable", label: "Translation" },
  { value: "reference", label: "Reference" },
  { value: "instructions", label: "Instructions" },
  { value: "ocr", label: "OCR" },
  { value: "image", label: "Image" },
] as const;

export type { ProjectFileRoleValue } from "@/types/project-files";
