import { memo } from "react";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiMailCheckLine,
  RiMailSendLine,
  RiRefreshLine,
} from "react-icons/ri";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

import type {
  NormalizedRegistrationPayload,
  SubmissionError,
  SubmissionPhase,
} from "@/modules/auth/hooks/controllers/useRegistrationSubmission";

import "../css/dialog/registration-verification-dialog.css";

interface RegistrationVerificationDialogProps {
  open: boolean;
  phase: SubmissionPhase;
  attemptId: string | null;
  error: SubmissionError | null;
  result: { companyId: string; adminUuid: string; payload: NormalizedRegistrationPayload } | null;
  canManualCheck: boolean;
  onManualCheck: () => Promise<void> | void;
  onClose: () => void;
  onOpenChange: (nextOpen: boolean) => void;
  organizationName?: string;
}

function resolveTitle(phase: SubmissionPhase): string {
  switch (phase) {
    case "awaitingVerification":
      return "Verify your email";
    case "verifying":
      return "Checking verification status";
    case "persisting":
      return "Finalizing organization";
    case "succeeded":
      return "Registration complete";
    case "failed":
      return "Registration issue";
    default:
      return "Registration status";
  }
}

function resolveDescription(phase: SubmissionPhase): string {
  switch (phase) {
    case "awaitingVerification":
      return "We sent a confirmation link to your email. Confirm it to continue.";
    case "verifying":
      return "Hold tight while we confirm your email verification.";
    case "persisting":
      return "We are creating your organization workspace. This only takes a moment.";
    case "succeeded":
      return "Your account is verified and ready. Continue to start using Weg Translator.";
    case "failed":
      return "Something went wrong. Review the details below and try again.";
    default:
      return "";
  }
}

function renderPhaseIcon(phase: SubmissionPhase) {
  const className = "registration-verification-dialog__status-icon";
  switch (phase) {
    case "awaitingVerification":
      return <RiMailSendLine className={className} aria-hidden="true" />;
    case "verifying":
      return <RiLoader4Line className={`${className} registration-verification-dialog__status-icon--spin`} aria-hidden="true" />;
    case "persisting":
      return <RiRefreshLine className={`${className} registration-verification-dialog__status-icon--spin`} aria-hidden="true" />;
    case "succeeded":
      return <RiCheckboxCircleLine className={className} aria-hidden="true" />;
    case "failed":
      return <RiErrorWarningLine className={className} aria-hidden="true" />;
    default:
      return <RiMailCheckLine className={className} aria-hidden="true" />;
  }
}

function renderBody(
  phase: SubmissionPhase,
  attemptId: string | null,
  error: SubmissionError | null,
  result: { companyId: string; adminUuid: string; payload: NormalizedRegistrationPayload } | null,
  organizationName?: string,
) {
  if (phase === "awaitingVerification") {
    return (
      <div className="registration-verification-dialog__body">
        <p className="registration-verification-dialog__copy">
          Open the confirmation email we just sent and click the verification link. Once you have confirmed it, select{" "}
          <strong>“I verified my email”</strong> below to continue.
        </p>
        <ul className="registration-verification-dialog__checklist">
          <li>Check your inbox and spam folders for “Weg Translator — confirm your email”.</li>
          <li>Click the verification button in the message to activate your account.</li>
          <li>Return here and choose “I verified my email”.</li>
        </ul>
        {attemptId ? (
          <p className="registration-verification-dialog__meta">
            Attempt ID: <code>{attemptId}</code>
          </p>
        ) : null}
      </div>
    );
  }

  if (phase === "verifying") {
    return (
      <div className="registration-verification-dialog__body">
        <p className="registration-verification-dialog__copy">
          Confirming your email status… This usually takes a couple of seconds.
        </p>
      </div>
    );
  }

  if (phase === "persisting") {
    return (
      <div className="registration-verification-dialog__body">
        <p className="registration-verification-dialog__copy">
          Your email is verified. We are creating your organization workspace and syncing profiles.
        </p>
      </div>
    );
  }

  if (phase === "succeeded") {
    return (
      <div className="registration-verification-dialog__body">
        <p className="registration-verification-dialog__copy">
          Welcome aboard! Your organization is ready and the admin account is linked to Supabase.
        </p>
        {result ? (
          <div className="registration-verification-dialog__result">
            {organizationName ?? result.payload.company.name ? (
              <p>
                <span className="registration-verification-dialog__label">Organization:</span>
                <span>{organizationName ?? result.payload.company.name}</span>
              </p>
            ) : null}
            <p>
              <span className="registration-verification-dialog__label">Company ID:</span>
              <code>{result.companyId}</code>
            </p>
            <p>
              <span className="registration-verification-dialog__label">Admin UUID:</span>
              <code>{result.adminUuid}</code>
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="registration-verification-dialog__body">
        <p className="registration-verification-dialog__copy registration-verification-dialog__copy--error">
          {error?.message ?? "Registration could not be completed. Try again or double-check the verification email."}
        </p>
        {attemptId ? (
          <p className="registration-verification-dialog__meta">
            Attempt ID: <code>{attemptId}</code>
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}

const RegistrationVerificationDialogComponent = ({
  open,
  phase,
  attemptId,
  error,
  result,
  canManualCheck,
  onManualCheck,
  onClose,
  onOpenChange,
  organizationName,
}: RegistrationVerificationDialogProps) => {
  const showManualVerifyAction = canManualCheck;
  const manualButtonLabel = phase === "failed" ? "Try verification again" : "I verified my email";
  const showDismissAction =
    phase === "awaitingVerification" || phase === "succeeded" || phase === "failed";
  const hideCloseButton = phase === "verifying" || phase === "persisting";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="registration-verification-dialog" hideCloseButton={hideCloseButton}>
        <DialogHeader className="registration-verification-dialog__header">
          <span className={`registration-verification-dialog__status registration-verification-dialog__status--${phase}`}>
            {renderPhaseIcon(phase)}
          </span>
          <DialogTitle className="registration-verification-dialog__title">{resolveTitle(phase)}</DialogTitle>
          <DialogDescription className="registration-verification-dialog__description">
            {resolveDescription(phase)}
          </DialogDescription>
        </DialogHeader>

        {renderBody(phase, attemptId, error, result, organizationName)}

        <DialogFooter className="registration-verification-dialog__footer">
          {showDismissAction ? (
            <Button
              type="button"
              variant="outline"
              className="registration-verification-dialog__button"
              onClick={onClose}
            >
              {phase === "succeeded" ? "Continue" : "Back to registration"}
            </Button>
          ) : null}
          {showManualVerifyAction ? (
            <Button
              type="button"
              className="registration-verification-dialog__button registration-verification-dialog__button--primary"
              onClick={() => {
                void onManualCheck();
              }}
            >
              {phase === "failed" ? (
                <>
                  <RiRefreshLine aria-hidden="true" />
                  {manualButtonLabel}
                </>
              ) : (
                <>
                  <RiMailCheckLine aria-hidden="true" />
                  {manualButtonLabel}
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const RegistrationVerificationDialog = memo(RegistrationVerificationDialogComponent);
