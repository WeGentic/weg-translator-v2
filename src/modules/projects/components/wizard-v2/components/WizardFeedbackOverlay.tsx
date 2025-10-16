/**
 * @file Visual overlay used to communicate progress or failure states.
 */

import { Loader2, XCircle } from "lucide-react";

import type { WizardFeedbackState } from "../types";
import { cn } from "@/shared/utils/class-names";

interface WizardFeedbackOverlayProps {
  state: WizardFeedbackState;
  message: string;
  onDismiss: () => void;
}

export function WizardFeedbackOverlay({ state, message, onDismiss }: WizardFeedbackOverlayProps) {
  if (state === "idle") {
    return null;
  }

  const isLoading = state === "loading";

  return (
    <div className="wizard-v2-feedback-overlay" role="status" aria-live="polite">
      <div className={cn("wizard-v2-feedback-card", isLoading && "is-loading")} data-state={state}>
        <div className="wizard-v2-feedback-icon" aria-hidden="true">
          {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : null}
          {state === "error" ? <XCircle className="h-8 w-8" /> : null}
        </div>
        <h3 className="wizard-v2-feedback-title">
          {isLoading ? "Creating project" : "Something went wrong"}
        </h3>
        <p className="wizard-v2-feedback-message">{message}</p>
        <div className="wizard-v2-feedback-actions">
          <button type="button" className="wizard-v2-feedback-button" onClick={onDismiss} disabled={isLoading}>
            {isLoading ? "Creating…" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
