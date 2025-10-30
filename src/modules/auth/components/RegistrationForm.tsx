/**
 * Registration form view composed from controller state and step-specific sections.
 * Handles only presentation concerns; business logic lives in `useRegistrationForm`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { RiLoader4Line, RiMailSendLine } from "react-icons/ri";

import LogoMark from "@/assets/LOGO-SVG.svg";
import { logger } from "@/core/logging";
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
    emailStatusProbe,
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
    goToStep,
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
  const [probeVerificationOpen, setProbeVerificationOpen] = useState(false);
  const [probeResendCooldown, setProbeResendCooldown] = useState(0);
  const { setMessage } = usePageTransition();
  const awaitingVerification = submissionPhase === "awaitingVerification";
  const submitButtonDisabled = isSubmissionLocked;
  const verificationDialogOpen =
    submissionAttemptId !== null && submissionPhase !== "idle" && submissionPhase !== "signingUp";
  const canManualVerification =
    submissionPhase === "awaitingVerification" || submissionPhase === "failed";
  const organizationName =
    submissionResult?.payload.company.name ?? values.companyName;

  useEffect(() => {
    if (emailStatusProbe.status === "registered_unverified") {
      setProbeVerificationOpen(true);
    } else if (emailStatusProbe.status !== "registered_unverified") {
      setProbeVerificationOpen(false);
    }
  }, [emailStatusProbe.status]);

  useEffect(() => {
    if (emailStatusProbe.status !== "registered_unverified") {
      setProbeResendCooldown(0);
    }
  }, [emailStatusProbe.status]);

  useEffect(() => {
    if (probeResendCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setProbeResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [probeResendCooldown]);

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

  const probeResendHint =
    probeResendCooldown > 0
      ? `You can resend again in ${probeResendCooldown}s.`
      : undefined;

  const handleNavigateToLogin = useCallback(() => {
    void logger.info("registration.email_probe.cta_login", {
      status: emailStatusProbe.status,
      attempt_id: emailStatusProbe.result?.attemptId ?? "<none>",
      correlation_id: emailStatusProbe.result?.correlationId ?? "<none>",
    });
    setMessage("Returning to login…");
    void navigate({ to: "/login" });
    setProbeVerificationOpen(false);
    setProbeResendCooldown(0);
    emailStatusProbe.reset();
  }, [emailStatusProbe, navigate, setMessage]);

  const handleRecoverPassword = useCallback(() => {
    void logger.info("registration.email_probe.cta_recover", {
      status: emailStatusProbe.status,
      attempt_id: emailStatusProbe.result?.attemptId ?? "<none>",
      correlation_id: emailStatusProbe.result?.correlationId ?? "<none>",
    });
    setMessage("Redirecting to login so you can recover your password.");
    void navigate({ to: "/login" });
    setProbeVerificationOpen(false);
    setProbeResendCooldown(0);
    emailStatusProbe.reset();
  }, [emailStatusProbe, navigate, setMessage]);

  const handleResumeVerification = useCallback(() => {
    if (emailStatusProbe.status === "registered_unverified") {
      void logger.info("registration.email_probe.cta_resume_verification", {
        attempt_id: emailStatusProbe.result?.attemptId ?? "<none>",
        correlation_id: emailStatusProbe.result?.correlationId ?? "<none>",
      });
      setProbeVerificationOpen(true);
      void emailStatusProbe.forceCheck();
      return;
    }

    const firstStepIndex = 0;
    void logger.info("registration.email_probe.cta_resume_registration", {
      status: emailStatusProbe.status,
      has_company_data: emailStatusProbe.result?.hasCompanyData ?? "<unknown>",
      attempt_id: emailStatusProbe.result?.attemptId ?? "<none>",
    });
    handleStepSelect(firstStepIndex);
    setMessage("Resume your registration by confirming organization details, then submit to finish.");
  }, [emailStatusProbe, handleStepSelect, setMessage]);

  const handleProbeManualCheck = useCallback(() => {
    void emailStatusProbe.forceCheck();
  }, [emailStatusProbe]);

  const handleProbeResend = useCallback(() => {
    if (probeResendCooldown > 0) {
      return;
    }
    void emailStatusProbe.resendVerification();
    setProbeResendCooldown(30);
  }, [emailStatusProbe, probeResendCooldown]);

  const isSubmissionDialogOpen = verificationDialogOpen;
  const isReturningDialogOpen = !verificationDialogOpen && probeVerificationOpen;
  const dialogOpen = isSubmissionDialogOpen || isReturningDialogOpen;
  const dialogContext = isSubmissionDialogOpen ? "registration" : "returning";
  const dialogPhase = isSubmissionDialogOpen ? submissionPhase : "awaitingVerification";
  const dialogAttemptId = isSubmissionDialogOpen
    ? submissionAttemptId
    : emailStatusProbe.result?.attemptId ?? null;
  const dialogManualCheck = isSubmissionDialogOpen
    ? handleManualVerificationCheck
    : handleProbeManualCheck;
  const dialogCanManualCheck = isSubmissionDialogOpen ? canManualVerification : true;
  const dialogError = isSubmissionDialogOpen ? submissionError : null;
  const dialogResult = isSubmissionDialogOpen ? submissionResult : null;
  const dialogOrganizationName = isSubmissionDialogOpen ? organizationName : undefined;
  const dialogPendingEmail = isReturningDialogOpen
    ? emailStatusProbe.lastCheckedEmail ?? undefined
    : undefined;
  const dialogOnClose = isSubmissionDialogOpen
    ? handleVerificationDialogClose
    : () => {
        setProbeVerificationOpen(false);
      };
  const dialogOnOpenChange = isSubmissionDialogOpen
    ? handleVerificationDialogOpenChange
    : (nextOpen: boolean) => {
        if (!nextOpen) {
          setProbeVerificationOpen(false);
        }
      };
  const dialogResend = isReturningDialogOpen ? handleProbeResend : undefined;
  const dialogResendDisabled = isReturningDialogOpen ? probeResendCooldown > 0 : false;
  const dialogResendHint = isReturningDialogOpen ? probeResendHint : undefined;

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
                emailStatusProbe={emailStatusProbe}
                onNavigateToLogin={handleNavigateToLogin}
                onRecoverPassword={handleRecoverPassword}
                onResumeVerification={handleResumeVerification}
                onResendVerification={handleProbeResend}
                isResendDisabled={probeResendCooldown > 0}
                resendHint={probeResendHint}
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
        open={dialogOpen}
        phase={dialogPhase}
        context={dialogContext}
        attemptId={dialogAttemptId}
        error={dialogError}
        result={dialogResult}
        canManualCheck={dialogCanManualCheck}
        onManualCheck={dialogManualCheck}
        onClose={dialogOnClose}
        onOpenChange={dialogOnOpenChange}
        organizationName={dialogOrganizationName}
        pendingEmail={dialogPendingEmail}
        onResend={dialogResend}
        resendDisabled={dialogResendDisabled}
        resendHint={dialogResendHint}
      />
    </Card>
  );
}
