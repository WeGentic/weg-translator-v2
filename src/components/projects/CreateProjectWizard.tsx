import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { createProject } from "@/ipc";
import type { CreateProjectResponse, ProjectType } from "@/ipc";

import { CreateProjectDetails } from "./CreateProjectDetails";
import { CreateProjectFiles } from "./CreateProjectFiles";
import { CreateProjectReview } from "./CreateProjectReview";
import {
  ALLOWED_EXTENSIONS,
  INITIAL_PROJECT_FORM,
  type NewProjectForm,
  type ProjectFormErrors,
  type WizardStep,
} from "./types";

interface CreateProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (project: CreateProjectResponse) => void;
}

type CreateProjectStatus = {
  error: string | null;
};

const STEP_LABELS = ["Project details", "Select files", "Review"] as const;

export function CreateProjectWizard({ open, onOpenChange, onProjectCreated }: CreateProjectWizardProps) {
  const [form, setForm] = useState<NewProjectForm>({ ...INITIAL_PROJECT_FORM });
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [step, setStep] = useState<WizardStep>(0);
  const [, startSubmitTransition] = useTransition();

  const [createStatus, dispatchCreate, isCreating] = useActionState<
    CreateProjectStatus,
    NewProjectForm
  >(
    async (_previous, payload) => {
      const normalized = {
        ...payload,
        name: payload.name.trim(),
        files: Array.from(new Set(payload.files)),
      } satisfies NewProjectForm;

      const validation = validateAll(normalized);
      if (!validation.valid) {
        setErrors(validation.errors);
        return { error: validation.message } satisfies CreateProjectStatus;
      }

      try {
        const response = await createProject({
          name: normalized.name,
          projectType: normalized.type as ProjectType,
          files: normalized.files,
        });

        onProjectCreated?.(response);
        resetState();
        onOpenChange(false);
        return { error: null } satisfies CreateProjectStatus;
      } catch (unknownError) {
        const message =
          unknownError instanceof Error
            ? unknownError.message
            : "Failed to create project. Please try again.";
        setErrors((current) => ({ ...current, general: message }));
        return { error: message } satisfies CreateProjectStatus;
      }
    },
    { error: null },
  );

  const resetState = useCallback(() => {
    setForm({ ...INITIAL_PROJECT_FORM });
    setErrors({});
    setStep(0);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const stepLabel = STEP_LABELS[step];
  const nextDisabled = useMemo(() => {
    if (step === 0) {
      return !validateDetails(form).valid;
    }
    if (step === 1) {
      return !validateFiles(form).valid;
    }
    return false;
  }, [form, step]);

  function handleFormChange(patch: Partial<NewProjectForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current, general: undefined } satisfies ProjectFormErrors;
      if (patch.name !== undefined) next.name = undefined;
      if (patch.type !== undefined) next.type = undefined;
      if (patch.files !== undefined) next.files = undefined;
      return next;
    });
  }

  function handleFilesChange(nextFiles: string[]) {
    handleFormChange({ files: nextFiles });
  }

  function handleNext() {
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
    setStep((current) => Math.min((current + 1) as WizardStep, 2));
  }

  function handleBack() {
    setStep((current) => Math.max((current - 1) as WizardStep, 0));
  }

  function handleClose() {
    resetState();
    onOpenChange(false);
  }

  function handleCreate() {
    if (isCreating) return;
    startSubmitTransition(() => {
      dispatchCreate({ ...form, files: [...form.files] });
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create new project</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Import files and configure metadata to start a new workspace.
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-2" />

        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Step {step + 1} of {STEP_LABELS.length}</span>
            <span>{stepLabel}</span>
          </div>

          {errors.general || createStatus.error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to create project</AlertTitle>
              <AlertDescription>{errors.general ?? createStatus.error}</AlertDescription>
            </Alert>
          ) : null}

          {step === 0 ? (
            <CreateProjectDetails form={form} errors={errors} onChange={handleFormChange} />
          ) : null}

          {step === 1 ? (
            <CreateProjectFiles files={form.files} errors={errors} onFilesChange={handleFilesChange} />
          ) : null}

          {step === 2 ? <CreateProjectReview form={form} /> : null}
        </div>

        <DialogFooter className="pt-4">
          <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isCreating}>
                Cancel
              </Button>
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={handleBack} disabled={isCreating}>
                  Back
                </Button>
              ) : null}
            </div>
            {step < 2 ? (
              <Button type="button" onClick={handleNext} disabled={nextDisabled || isCreating}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Creating…
                  </>
                ) : (
                  "Create project"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function validateDetails(form: NewProjectForm) {
  const errors: ProjectFormErrors = {};
  const trimmed = form.name.trim();
  if (trimmed.length < 2 || trimmed.length > 120) {
    errors.name = "Name must be between 2 and 120 characters.";
  } else if (!/[\p{Letter}\p{Number}]/u.test(trimmed)) {
    errors.name = "Name must include at least one letter or number.";
  }

  if (form.type !== "translation" && form.type !== "rag") {
    errors.type = "Select a project type.";
  }

  return { valid: Object.keys(errors).length === 0, errors } as const;
}

function validateFiles(form: NewProjectForm) {
  const errors: ProjectFormErrors = {};
  if (form.files.length === 0) {
    errors.files = "Add at least one file.";
  }

  const invalidExtension = form.files.find((filePath) => {
    const extension = filePath.split(".").pop()?.toLowerCase();
    return !extension || !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number]);
  });
  if (invalidExtension) {
    errors.files = "One or more files have unsupported extensions.";
  }

  return { valid: Object.keys(errors).length === 0, errors } as const;
}

function validateAll(form: NewProjectForm) {
  const details = validateDetails(form);
  const files = validateFiles(form);
  const merged: ProjectFormErrors = { ...details.errors, ...files.errors };
  const message = merged.name || merged.type || merged.files ? "Please fix the highlighted fields." : null;
  return { valid: details.valid && files.valid, errors: merged, message } as const;
}
