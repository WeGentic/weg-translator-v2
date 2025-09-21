import type { ProjectType } from "@/ipc";

export type WizardStep = 0 | 1 | 2;

export interface NewProjectForm {
  name: string;
  type: ProjectType | "";
  files: string[];
}

export interface ProjectFormErrors {
  name?: string;
  type?: string;
  files?: string;
  general?: string;
}

export interface WizardStepState {
  index: WizardStep;
  canProceed: boolean;
}

export const INITIAL_PROJECT_FORM: NewProjectForm = {
  name: "",
  type: "",
  files: [],
};

export const ALLOWED_EXTENSIONS = ["docx", "doc", "xliff", "mqxliff", "sdlxliff"] as const;
