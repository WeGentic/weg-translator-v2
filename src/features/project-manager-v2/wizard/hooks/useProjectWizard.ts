import { useCallback, useMemo, useState, useTransition } from "react";

import type { CreateProjectResponse } from "@/ipc";

import type { CreateProjectActionPayload } from "../../actions/createProjectAction";
import { useCreateProjectAction } from "../../actions/createProjectAction";
import {
  INITIAL_PROJECT_FORM,
  CREATE_PROJECT_STEP_LABELS,
  type WizardStep,
  type NewProjectForm,
  type ProjectFormErrors,
} from "../types";
import { validateAll, validateDetails, validateFiles } from "../utils/validation";

interface UseProjectWizardParams {
  onProjectCreated?: (project: CreateProjectResponse) => void;
  onRequestClose: () => void;
}

interface UseProjectWizardResult {
  form: NewProjectForm;
  errors: ProjectFormErrors;
  step: WizardStep;
  stepLabel: string;
  nextDisabled: boolean;
  isCreating: boolean;
  generalError: string | null;
  updateForm: (patch: Partial<NewProjectForm>) => void;
  updateFiles: (files: string[]) => void;
  goNext: () => void;
  goBack: () => void;
  submit: () => void;
  reset: () => void;
}

const FINAL_STEP_INDEX = CREATE_PROJECT_STEP_LABELS.length - 1;

export function useProjectWizard({ onProjectCreated, onRequestClose }: UseProjectWizardParams): UseProjectWizardResult {
  const [form, setForm] = useState<NewProjectForm>({ ...INITIAL_PROJECT_FORM });
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>(0);
  const [, startTransition] = useTransition();

  const { action, isPending } = useCreateProjectAction({
    onSuccess: (response) => {
      onProjectCreated?.(response);
      reset();
      onRequestClose();
    },
    onError: (message) => {
      setGeneralError(message);
      setErrors((current) => ({ ...current, general: message }));
    },
  });

  const reset = useCallback(() => {
    setForm({ ...INITIAL_PROJECT_FORM });
    setErrors({});
    setGeneralError(null);
    setStep(0);
  }, []);

  const updateForm = useCallback((patch: Partial<NewProjectForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current } satisfies ProjectFormErrors;
      if (patch.name !== undefined) next.name = undefined;
      if (patch.type !== undefined) next.type = undefined;
      if (patch.srcLang !== undefined) next.srcLang = undefined;
      if (patch.tgtLang !== undefined) next.tgtLang = undefined;
      if (patch.files !== undefined) next.files = undefined;
      if (patch.defaultXliffVersion !== undefined) next.defaultXliffVersion = undefined;
      next.general = undefined;
      return next;
    });
    setGeneralError(null);
  }, []);

  const updateFiles = useCallback(
    (files: string[]) => {
      updateForm({ files });
    },
    [updateForm],
  );

  const goNext = useCallback(() => {
    if (step === 0) {
      const validation = validateDetails(form);
      if (!validation.valid) {
        setErrors((current) => ({ ...current, ...validation.errors }));
        return;
      }
    }

    if (step === 1) {
      const validation = validateFiles(form);
      if (!validation.valid) {
        setErrors((current) => ({ ...current, ...validation.errors }));
        return;
      }
    }

    setStep((current) => Math.min(current + 1, FINAL_STEP_INDEX));
  }, [form, step]);

  const goBack = useCallback(() => {
    setStep((current) => Math.max(current - 1, 0));
  }, []);

  const submit = useCallback(() => {
    if (isPending) return;

    const validation = validateAll(form);
    if (!validation.valid) {
      setErrors((current) => ({ ...current, ...validation.errors }));
      setGeneralError(validation.message ?? null);
      return;
    }

    const payload: CreateProjectActionPayload = {
      name: form.name.trim(),
      projectType: form.type,
      srcLang: form.srcLang.trim(),
      tgtLang: form.tgtLang.trim(),
      files: [...new Set(form.files)],
    } satisfies CreateProjectActionPayload;

    startTransition(() => {
      action(payload);
    });
  }, [action, form, isPending, startTransition]);

  const stepLabel = CREATE_PROJECT_STEP_LABELS[step];

  const nextDisabled = useMemo(() => {
    if (step === 0) {
      return !validateDetails(form).valid;
    }
    if (step === 1) {
      return !validateFiles(form).valid;
    }
    return false;
  }, [form, step]);

  return {
    form,
    errors,
    step,
    stepLabel,
    nextDisabled,
    isCreating: isPending,
    generalError,
    updateForm,
    updateFiles,
    goNext,
    goBack,
    submit,
    reset,
  };
}
