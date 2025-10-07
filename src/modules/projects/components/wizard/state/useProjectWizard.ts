import { useActionState, useCallback, useMemo, useState, useTransition } from "react";

import { createProject } from "@/core/ipc";
import type { CreateProjectResponse, ProjectType } from "@/core/ipc";

import {
  CREATE_PROJECT_STEP_LABELS,
  INITIAL_PROJECT_FORM,
  type CreateProjectStatus,
  type NewProjectForm,
  type ProjectFormErrors,
  type WizardStep,
} from "../types";
import { validateAll, validateDetails, validateFiles } from "../utils/validation";

interface UseProjectWizardParams {
  onProjectCreated?: (project: CreateProjectResponse) => void;
  onRequestClose: () => void;
}

export function useProjectWizard({ onProjectCreated, onRequestClose }: UseProjectWizardParams) {
  const [form, setForm] = useState<NewProjectForm>({ ...INITIAL_PROJECT_FORM });
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [step, setStep] = useState<WizardStep>(0);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [, startSubmitTransition] = useTransition();

  const reset = useCallback(() => {
    setForm({ ...INITIAL_PROJECT_FORM });
    setErrors({});
    setGeneralError(null);
    setStep(0);
  }, []);

  const [, dispatchCreate, isCreating] = useActionState<CreateProjectStatus, NewProjectForm>(
    async (_previous, payload) => {
      setGeneralError(null);
      const normalized = {
        ...payload,
        name: payload.name.trim(),
        files: Array.from(new Set(payload.files)),
      } satisfies NewProjectForm;

      const validation = validateAll(normalized);
      if (!validation.valid) {
        setErrors({ ...validation.errors, general: validation.message ?? undefined });
        setGeneralError(validation.message ?? null);
        return { error: validation.message } satisfies CreateProjectStatus;
      }

      try {
        const response = await createProject({
          name: normalized.name,
          projectType: normalized.type as ProjectType,
          defaultSrcLang: normalized.srcLang,
          defaultTgtLang: normalized.tgtLang,
          files: normalized.files,
        });

        onProjectCreated?.(response);
        reset();
        onRequestClose();
        return { error: null } satisfies CreateProjectStatus;
      } catch (unknownError) {
        const message =
          unknownError instanceof Error
            ? unknownError.message
            : "Failed to create project. Please try again.";
        setErrors((current) => ({ ...current, general: message }));
        setGeneralError(message);
        return { error: message } satisfies CreateProjectStatus;
      }
    },
    { error: null },
  );

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

  const updateForm = useCallback((patch: Partial<NewProjectForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current, general: undefined } satisfies ProjectFormErrors;
      if (patch.name !== undefined) next.name = undefined;
      if (patch.type !== undefined) next.type = undefined;
      if (patch.srcLang !== undefined) next.srcLang = undefined;
      if (patch.tgtLang !== undefined) next.tgtLang = undefined;
      if (patch.files !== undefined) next.files = undefined;
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
    setStep((current) => (current === 0 ? 1 : 2));
  }, [form, step]);

  const goBack = useCallback(() => {
    setStep((current) => (current === 2 ? 1 : 0));
  }, []);

  const submit = useCallback(() => {
    if (isCreating) return;
    startSubmitTransition(() => {
      dispatchCreate({ ...form, files: [...form.files] });
    });
  }, [dispatchCreate, form, isCreating, startSubmitTransition]);

  return {
    form,
    errors,
    step,
    stepLabel,
    nextDisabled,
    isCreating,
    generalError,
    updateForm,
    updateFiles,
    goNext,
    goBack,
    submit,
    reset,
  } as const;
}
