import { useTransition } from "react";

/**
 * TODO: Legacy wizard hook awaiting replacement with the v2 project workflow.
 * Returning minimal shape to keep the UI compiling until the new flow lands.
 */
export function useProjectWizard(): {
  form: Record<string, never>;
  errors: Record<string, never>;
  step: number;
  stepLabel: string;
  nextDisabled: boolean;
  isCreating: boolean;
  generalError: string | null;
  updateForm: () => void;
  updateFiles: () => void;
  goNext: () => void;
  goBack: () => void;
  submit: () => void;
  reset: () => void;
} {
  const [isCreating] = useTransition();

  const fail = () => {
    throw new Error("TODO: Rebuild the legacy wizard on top of the v2 schema");
  };

  return {
    form: {},
    errors: {},
    step: 0,
    stepLabel: "Project details",
    nextDisabled: true,
    isCreating,
    generalError: "TODO",
    updateForm: fail,
    updateFiles: fail,
    goNext: fail,
    goBack: fail,
    submit: fail,
    reset: fail,
  };
}
