/**
 * @file Visual overlay used to communicate progress or failure states.
 */

import { Loader2, XCircle } from "lucide-react";

import type { WizardFinalizeFeedback } from "../types";
import { cn } from "@/shared/utils/class-names";

interface WizardFeedbackOverlayProps {
  feedback: WizardFinalizeFeedback;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function WizardFeedbackOverlay({ feedback, onDismiss, onRetry }: WizardFeedbackOverlayProps) {
  if (feedback.status === "idle") {
    return null;
  }

  const isProgress = feedback.status === "progress";
  const headline = isProgress ? feedback.progress.headline : feedback.error.headline;
  const description = isProgress ? feedback.progress.description : feedback.error.description;
  const detail = !isProgress ? feedback.error.detail : undefined;
  const hint = !isProgress ? feedback.error.hint : undefined;
  const actionLabel = isProgress ? feedback.progress.actionLabel ?? "Working…" : "Dismiss";
  const canRetry = !isProgress && typeof onRetry === "function";

  return (
    <div className="wizard-v2-feedback-overlay" role="status" aria-live="polite">
      <div className={cn("wizard-v2-feedback-card", isProgress && "is-loading")} data-state={feedback.status}>
        <div className="wizard-v2-feedback-icon" aria-hidden="true">
          {isProgress ? <Loader2 className="h-8 w-8 animate-spin" /> : null}
          {!isProgress ? <XCircle className="h-8 w-8" /> : null}
        </div>
        <h3 className="wizard-v2-feedback-title">{headline}</h3>
        <p className="wizard-v2-feedback-message">{description}</p>
        {detail ? <p className="wizard-v2-feedback-detail">{detail}</p> : null}
        {hint ? <p className="wizard-v2-feedback-detail">{hint}</p> : null}
        <div className="wizard-v2-feedback-actions">
          {canRetry ? (
            <button type="button" className="wizard-v2-feedback-button" onClick={onRetry}>
              Try again
            </button>
          ) : null}
          <button type="button" className="wizard-v2-feedback-button" onClick={onDismiss} disabled={isProgress}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
