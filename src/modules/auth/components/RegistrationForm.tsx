/**
 * Registration form view composed from controller state and step-specific sections.
 * Handles only presentation concerns; business logic lives in `useRegistrationForm`.
 */
import { useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { RiLoader4Line, RiMailSendLine } from "react-icons/ri";

import LogoMark from "@/assets/LOGO-SVG.svg";
import { RegistrationCompanyStep } from "./forms/RegistrationCompanyStep";
import { RegistrationAdminStep } from "./forms/RegistrationAdminStep";
import {
  RegistrationProgress,
  type RegistrationProgressStepState,
} from "./forms/RegistrationProgress";
import { RegistrationVerificationDialog } from "./dialog/RegistrationVerificationDialog";
import {
  useRegistrationForm,
  type UseRegistrationFormResult,
} from "@/modules/auth/hooks/controllers/useRegistrationForm";
import { usePageTransition } from "@/shared/transitions/PageTransitionProvider";
import {
  STEP_FIELDS,
  STEP_LABELS,
  STEP_SEQUENCE,
} from "@/modules/auth/utils/constants/registration";

import "./css/forms/registration/registration-form.css";
import "react-phone-number-input/style.css";

export function RegistrationForm() {
  const navigate = useNavigate();
  const {
    values,
    touched,
    isSubmitting,
    isSubmissionLocked,
    stepIndex,
    currentStepKey,
    currentStepBlockingLabels,
    formBlockingLabels,
    isFirstStep,
    isLastStep,
    isCurrentStepValid,
    isFormValid,
    continueTooltipMessage,
    submitTooltipMessage,
    phoneCountry,
    phoneValue,
    defaultPhoneCountry,
    phoneDialCode,
    phoneInputRef,
    addressInputRef,
    address,
    handleFieldChange,
    handleFieldBlur,
    handlePhoneChange,
    handlePhoneCountryChange,
    handleCompanyAddressChange,
    handleCompanyAddressClear,
    handleSubmit,
    handleNextStep,
    handlePreviousStep,
    handleStepSelect,
    getFieldError,
    hasFieldBlockingError,
    passwordEvaluation,
    submissionPhase,
    submissionAttemptId,
    submissionError,
    submissionResult,
    handleManualVerificationCheck,
    resetSubmission,
  }: UseRegistrationFormResult = useRegistrationForm();
  const { setMessage } = usePageTransition();
  const awaitingVerification = submissionPhase === "awaitingVerification";
  const submitButtonDisabled = isSubmissionLocked;
  const verificationDialogOpen =
    submissionAttemptId !== null && submissionPhase !== "idle" && submissionPhase !== "signingUp";
  const canManualVerification =
    submissionPhase === "awaitingVerification" || submissionPhase === "failed";
  const organizationName =
    submissionResult?.payload.company.name ?? values.companyName;

  const handleVerificationDialogClose = useCallback(() => {
    if (submissionPhase === "succeeded") {
      setMessage("Registration complete! Please sign in to continue.");
      void navigate({ to: "/login" });
    }
    resetSubmission();
  }, [navigate, resetSubmission, setMessage, submissionPhase]);

  const handleVerificationDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        if (submissionPhase === "verifying" || submissionPhase === "persisting") {
          return;
        }
        handleVerificationDialogClose();
      }
    },
    [handleVerificationDialogClose, submissionPhase],
  );

  const progressSteps = useMemo<RegistrationProgressStepState[]>(() => {
    return STEP_SEQUENCE.map((stepKey, index) => {
      const fields = STEP_FIELDS[stepKey];
      const isCompleted = fields.every((field) => !hasFieldBlockingError(field));
      return {
        key: stepKey,
        label: STEP_LABELS[stepKey],
        isSelected: index === stepIndex,
        isCompleted,
      };
    });
  }, [hasFieldBlockingError, stepIndex]);

  const currentStepTooltip = useMemo(
    () =>
      currentStepBlockingLabels.length
        ? `Complete: ${currentStepBlockingLabels.join(", ")}.`
        : continueTooltipMessage,
    [continueTooltipMessage, currentStepBlockingLabels],
  );
  const formBlockingTooltip = useMemo(
    () =>
      formBlockingLabels.length
        ? `Finish: ${formBlockingLabels.join(", ")}.`
        : submitTooltipMessage,
    [formBlockingLabels, submitTooltipMessage],
  );

  const handleNavigateToLogin = () => {
    setMessage("Returning to login…");
    void navigate({ to: "/login" });
  };

  return (
    <Card className="registration-form-card">
      <CardHeader className="registration-form__header">
        <CardTitle className="registration-form__title">
          <img
            src={LogoMark}
            alt="Tr-entic logo"
            className="registration-page__hero-logo"
            width={80}
            height={80}
            loading="eager"
          />
          <div className="ml-4">Create your organization Account</div>
        </CardTitle>
        <CardDescription
          id="registration-form-description"
          className="registration-form__description"
        />
      </CardHeader>
      <CardContent className="registration-form__content">
        <form
          className="registration-form"
          noValidate
          aria-describedby="registration-form-description"
          onSubmit={handleSubmit}
          data-registration-attempt-id={submissionAttemptId ?? undefined}
          aria-busy={isSubmissionLocked ? true : undefined}
        >
          <RegistrationProgress steps={progressSteps} onStepSelect={handleStepSelect} />

          {currentStepKey === "company" ? (
            <RegistrationCompanyStep
              values={values}
              touched={touched}
              isSubmitting={isSubmissionLocked}
              phoneValue={phoneValue}
              phoneCountry={phoneCountry}
              defaultPhoneCountry={defaultPhoneCountry}
              phoneDialCode={phoneDialCode}
              phoneInputRef={phoneInputRef}
              addressInputRef={addressInputRef}
              address={address}
              handleFieldChange={handleFieldChange}
              handleFieldBlur={handleFieldBlur}
              handlePhoneChange={handlePhoneChange}
              handlePhoneCountryChange={handlePhoneCountryChange}
              handleCompanyAddressChange={handleCompanyAddressChange}
              handleCompanyAddressClear={handleCompanyAddressClear}
              getFieldError={getFieldError}
            />
          ) : null}

          {currentStepKey === "admin" ? (
            <>
              <RegistrationAdminStep
                values={values}
                touched={touched}
                getFieldError={getFieldError}
                handleFieldChange={handleFieldChange}
                handleFieldBlur={handleFieldBlur}
                passwordEvaluation={passwordEvaluation}
              />
            </>
          ) : null}

          <div className="registration-form__actions">
            <div className="registration-form__actions-side">
              {isFirstStep ? (
                <Button
                  type="button"
                  variant="outline"
                  className="registration-form__nav-button"
                  onClick={handleNavigateToLogin}
                  disabled={isSubmissionLocked}
                >
                  Back to login
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="registration-form__nav-button"
                  onClick={handlePreviousStep}
                  disabled={isSubmissionLocked}
                >
                  Back
                </Button>
              )}
            </div>
            {isLastStep ? (
              isFormValid || isSubmitting || awaitingVerification ? (
                <Button
                  type="submit"
                  className="registration-form__submit"
                  disabled={submitButtonDisabled}
                  aria-disabled={submitButtonDisabled ? true : undefined}
                  aria-describedby="registration-form-helper"
                >
                  {isSubmitting ? (
                    <>
                      <RiLoader4Line aria-hidden="true" className="registration-form__submit-spinner" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <RiMailSendLine aria-hidden="true" className="registration-form__submit-icon" />
                      {awaitingVerification ? "Check your email" : "Request organization access"}
                    </>
                  )}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="registration-form__tooltip-anchor">
                      <Button
                        type="button"
                        className="registration-form__submit"
                        disabled
                        aria-disabled="true"
                      >
                        Request organization access
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent align="end">{formBlockingTooltip}</TooltipContent>
                </Tooltip>
              )
            ) : isCurrentStepValid ? (
              <Button
                type="button"
                className="registration-form__submit"
                onClick={handleNextStep}
                disabled={isSubmissionLocked}
              >
                Continue...
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="registration-form__tooltip-anchor">
                    <Button
                      type="button"
                      className="registration-form__submit"
                      disabled
                      aria-disabled="true"
                    >
                      Continue...
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent align="end">{currentStepTooltip}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </form>
      </CardContent>
      <RegistrationVerificationDialog
        open={verificationDialogOpen}
        phase={submissionPhase}
        attemptId={submissionAttemptId}
        error={submissionError}
        result={submissionResult}
        canManualCheck={canManualVerification}
        onManualCheck={handleManualVerificationCheck}
        onClose={handleVerificationDialogClose}
        onOpenChange={handleVerificationDialogOpenChange}
        organizationName={organizationName}
      />
    </Card>
  );
}
