import { useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Separator } from "@/shared/ui/separator";
import type { CreateProjectResponse } from "@/core/ipc";

import { ProjectDetailsStep } from "./steps/ProjectDetailsStep";
import { ProjectFilesStep } from "./steps/ProjectFilesStep";
import { ProjectReviewStep } from "./steps/ProjectReviewStep";
import { CREATE_PROJECT_STEP_LABELS } from "./types";
import { useProjectWizard } from "./state/useProjectWizard";

interface CreateProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (project: CreateProjectResponse) => void;
}

const FINAL_STEP_INDEX = CREATE_PROJECT_STEP_LABELS.length - 1;

export function CreateProjectWizard({ open, onOpenChange, onProjectCreated }: CreateProjectWizardProps) {
  const requestClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const {
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
  } = useProjectWizard({
    onProjectCreated,
    onRequestClose: requestClose,
  });

  const handleClose = useCallback(() => {
    reset();
    requestClose();
  }, [reset, requestClose]);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }
      handleClose();
    },
    [handleClose, onOpenChange],
  );

  const bannerError = generalError ?? errors.general ?? null;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
            <span className="font-medium uppercase tracking-wide">
              Step {step + 1} of {CREATE_PROJECT_STEP_LABELS.length}
            </span>
            <span>{stepLabel}</span>
          </div>

          {/* Lightweight progress bar for clearer sense of progress */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-label="Wizard progress">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.round(((step + 1) / CREATE_PROJECT_STEP_LABELS.length) * 100)}%` }}
            />
          </div>

          {bannerError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to create project</AlertTitle>
              <AlertDescription>{bannerError}</AlertDescription>
            </Alert>
          ) : null}

          {step === 0 ? (
            <ProjectDetailsStep form={form} errors={errors} onChange={updateForm} />
          ) : null}

          {step === 1 ? (
            <ProjectFilesStep files={form.files} errors={errors} onFilesChange={updateFiles} />
          ) : null}

          {step === FINAL_STEP_INDEX ? <ProjectReviewStep form={form} /> : null}
        </div>

        <DialogFooter className="pt-4">
          <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isCreating}>
                Cancel
              </Button>
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={goBack} disabled={isCreating}>
                  Back
                </Button>
              ) : null}
            </div>
            {step < FINAL_STEP_INDEX ? (
              <Button type="button" onClick={goNext} disabled={nextDisabled || isCreating}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={isCreating}>
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
