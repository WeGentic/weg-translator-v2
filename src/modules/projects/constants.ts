import type { ProjectFileRoleValue } from "@/types/project-files";

export const PROJECT_SUBJECT_OPTIONS = [
  { value: "marketing", label: "Marketing & Creative" },
  { value: "legal", label: "Legal" },
  { value: "technical", label: "Technical" },
  { value: "medical", label: "Medical" },
  { value: "finance", label: "Finance" },
  { value: "software", label: "Software & IT" },
] as const;

const SUBJECT_LABEL_LOOKUP: Map<string, string> = new Map(
  PROJECT_SUBJECT_OPTIONS.map((option) => [option.value, option.label]),
);

export function resolveProjectSubjectLabel(subject: string | null | undefined): string | null {
  if (!subject) {
    return null;
  }
  return SUBJECT_LABEL_LOOKUP.get(subject) ?? subject;
}

export const PROJECT_FILE_ROLE_OPTIONS: ReadonlyArray<{ value: ProjectFileRoleValue; label: string }> = [
  { value: "processable", label: "Translation" },
  { value: "reference", label: "Reference" },
  { value: "instructions", label: "Instructions" },
  { value: "image", label: "Image" },
] as const;

export type { ProjectFileRoleValue } from "@/types/project-files";
