import type { ProjectType } from "@/ipc";
import { PROJECT_FILE_EXTENSIONS } from "@/lib/file-formats";

export type WizardStep = 0 | 1 | 2;

export interface NewProjectForm {
  name: string;
  type: ProjectType | "";
  srcLang: string;
  tgtLang: string;
  files: string[];
}

export interface ProjectFormErrors {
  name?: string;
  type?: string;
  srcLang?: string;
  tgtLang?: string;
  files?: string;
  general?: string;
}

export interface CreateProjectStatus {
  error: string | null;
}

export const INITIAL_PROJECT_FORM: NewProjectForm = {
  name: "",
  type: "",
  srcLang: "en-US",
  tgtLang: "it-IT",
  files: [],
};

export const ALLOWED_EXTENSIONS = PROJECT_FILE_EXTENSIONS;

export const CREATE_PROJECT_STEP_LABELS = [
  "Project details",
  "Select files",
  "Review",
] as const;

export type WizardStepLabel = (typeof CREATE_PROJECT_STEP_LABELS)[number];
