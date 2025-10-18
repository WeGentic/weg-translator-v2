/**
 * @file Shared footer actions for the wizard.
 *
 * The footer varies depending on the active step but the layout remains
 * consistent, so concentrating the logic here keeps the main component tidy.
 */

import { ArrowLeft, ArrowRight, Loader2, RotateCcw } from "lucide-react";

import type { WizardStep } from "../types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

interface WizardFooterProps {
  step: WizardStep;
  canClear: boolean;
  onClear: () => void;
  onNext: () => void;
  isNextEnabled: boolean;
  onBack: () => void;
  finalizeDisabled: boolean;
  finalizeReason: string | null;
  onFinalize: () => void;
  finalizeBusy: boolean;
  submissionPending: boolean;
}

export function WizardFooter({
  step,
  canClear,
  onClear,
  onNext,
  isNextEnabled,
  onBack,
  finalizeDisabled,
  finalizeReason,
  onFinalize,
  finalizeBusy,
  submissionPending,
}: WizardFooterProps) {
  if (step === "details") {
    return (
      <footer className="wizard-v2-actions">
        <button
          type="button"
          className="wizard-v2-action wizard-v2-action--clear"
          onClick={onClear}
          disabled={!canClear}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Clear</span>
        </button>

        {isNextEnabled ? (
          <button type="button" className="wizard-v2-action wizard-v2-action--next" onClick={onNext}>
            <span>Next</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="wizard-v2-tooltip-anchor">
                <button
                  type="button"
                  className="wizard-v2-action wizard-v2-action--next"
                  onClick={onNext}
                  disabled
                  aria-disabled="true"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent align="end">Complete all required fields to continue.</TooltipContent>
          </Tooltip>
        )}
      </footer>
    );
  }

  return (
    <footer className="wizard-v2-actions">
      <button type="button" className="wizard-v2-action wizard-v2-action--back" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back</span>
      </button>

      {finalizeDisabled ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="wizard-v2-tooltip-anchor">
              <button
                type="button"
                className="wizard-v2-action wizard-v2-action--next"
                disabled
                aria-disabled="true"
              >
                <span>Finalize</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent align="end">
            {finalizeReason ?? "Complete the remaining fields before finalizing the project."}
          </TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          className="wizard-v2-action wizard-v2-action--next"
          onClick={onFinalize}
          disabled={submissionPending || finalizeBusy}
        >
          <span>{submissionPending || finalizeBusy ? "Finalizing…" : "Finalize"}</span>
          {submissionPending || finalizeBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}
    </footer>
  );
}
