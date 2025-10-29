import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { RiAlertLine, RiCheckLine, RiLoader4Line } from "react-icons/ri";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useToast } from "@/shared/ui/use-toast";

import {
  requestCleanupCode,
  validateAndCleanup,
  CleanupError,
} from "../utils/cleanupOrphanedUser";
import { logger } from "@/core/logging/logger";

import "./css/recovery-form.css";

interface RecoveryFormProps {
  initialEmail: string;
  reason: "orphaned" | "failed" | "incomplete";
  correlationId?: string;
}

type RecoveryStep = "choice" | "cleanup" | "success";

/**
 * Recovery Form Component
 *
 * Guides users through the recovery process for orphaned auth accounts.
 *
 * Flow:
 * 1. Choice Step: User selects "Start Fresh" (cleanup) or "Continue Registration" (resume)
 * 2. Cleanup Step: User enters 6-digit verification code sent to their email
 * 3. Success Step: Confirmation message and redirect to registration
 *
 * Requirements: Req 7 (Recovery Route and UI Components), NFR-6 (Usability)
 * Related: Task 4.3 (Create Recovery Route Scaffold)
 */
export function RecoveryForm({ initialEmail, reason, correlationId }: RecoveryFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<RecoveryStep>("choice");
  const [email] = useState(initialEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [activeCorrelationId, setActiveCorrelationId] = useState(correlationId || "");

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Get reason-specific messaging
  const reasonMessages = {
    orphaned: {
      title: "Let's Complete Your Registration",
      description:
        "We detected that your previous registration wasn't completed. You can start fresh by cleaning up the old account, or continue from where you left off.",
    },
    failed: {
      title: "Registration Encountered an Issue",
      description:
        "Your registration experienced a technical issue. You can start fresh or try continuing.",
    },
    incomplete: {
      title: "Incomplete Registration Detected",
      description:
        "Your registration is incomplete. You can start fresh or resume the process.",
    },
  };

  const currentMessage = reasonMessages[reason];

  const handleStartFresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info("User initiated account cleanup", {
        email,
        reason,
        correlationId: activeCorrelationId,
      });

      // Call cleanup edge function to request verification code
      const response = await requestCleanupCode(email, activeCorrelationId || undefined);

      // Update correlation ID from response
      setActiveCorrelationId(response.correlationId);

      // Start 60-second cooldown for resend
      setResendCooldown(60);

      // Move to cleanup step where user enters verification code
      setStep("cleanup");

      // Show success toast
      toast({
        title: "Verification code sent",
        description: `Check your email at ${email} for the 6-digit code.`,
        duration: 5000,
      });

      logger.info("Verification code sent successfully", {
        email,
        correlationId: response.correlationId,
      });
    } catch (err) {
      const errorMessage =
        err instanceof CleanupError ? err.getUserFriendlyMessage() : "Failed to send verification code. Please try again.";

      setError(errorMessage);

      logger.error("Failed to request cleanup code", err, {
        email,
        correlationId: activeCorrelationId,
        errorCode: err instanceof CleanupError ? err.code : "UNKNOWN",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueRegistration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info("User attempting to continue registration", {
        email,
        reason,
        correlationId: activeCorrelationId,
      });

      // Check current email status to determine recovery path
      // This calls the enhanced check-email-status edge function which includes
      // isOrphaned and hasCompanyData fields for classification
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase configuration missing");
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/check-email-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(`Email status check failed: ${response.statusText}`);
      }

      const statusData = await response.json() as {
        status: "not_registered" | "registered_verified" | "registered_unverified";
        hasCompanyData?: boolean | null;
        isOrphaned?: boolean | null;
        verifiedAt?: string | null;
        correlationId: string;
      };

      logger.info("Email status check complete", {
        email,
        status: statusData.status,
        isOrphaned: statusData.isOrphaned,
        hasCompanyData: statusData.hasCompanyData,
        correlationId: statusData.correlationId,
      });

      // Route based on orphan classification
      // Case 1.1: registered_unverified with no company data - need to verify email first
      // Case 1.2: registered_verified with no company data - can proceed to company data entry
      // Not orphaned: has company data - should log in instead

      if (statusData.status === "not_registered") {
        // User was already cleaned up or never existed
        // Redirect to normal registration
        logger.info("User not registered - redirecting to registration", { email });
        void navigate({ to: "/register", search: { email } });
        return;
      }

      if (statusData.isOrphaned === true) {
        // Orphaned user - redirect to registration with recovery context
        if (statusData.status === "registered_unverified") {
          // Case 1.1: Need to complete email verification
          logger.info("Case 1.1 detected - redirecting to registration for email verification", {
            email,
            correlationId: statusData.correlationId,
          });

          toast({
            title: "Email verification required",
            description: "You'll need to verify your email before continuing.",
            duration: 5000,
          });

          // Navigate to registration with email pre-filled and recovery context
          void navigate({
            to: "/register",
            search: { email, recovery: "case-1-1" },
          });
        } else if (statusData.status === "registered_verified") {
          // Case 1.2: Email verified, need company data only
          logger.info("Case 1.2 detected - redirecting to registration for company data", {
            email,
            correlationId: statusData.correlationId,
          });

          toast({
            title: "Complete your registration",
            description: "Your email is verified. Enter your company information to continue.",
            duration: 5000,
          });

          // Navigate to registration with email pre-filled and recovery context
          void navigate({
            to: "/register",
            search: { email, recovery: "case-1-2" },
          });
        }
      } else {
        // Not orphaned - user has company data, should log in instead
        logger.warn("User not orphaned - has company data, redirecting to login", {
          email,
          hasCompanyData: statusData.hasCompanyData,
        });

        setError("This email is already fully registered. Please log in instead.");

        toast({
          title: "Already registered",
          description: "This account is fully registered. Please use the login page.",
          variant: "destructive",
          duration: 5000,
        });

        // Wait 2 seconds then redirect to login
        setTimeout(() => {
          void navigate({ to: "/login" });
        }, 2000);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check email status. Please try again.";

      setError(errorMessage);

      logger.error("Failed to continue registration", err, {
        email,
        correlationId: activeCorrelationId,
      });

      toast({
        title: "Unable to continue",
        description: "We couldn't check your registration status. Please try again or start fresh.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndCleanup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info("User attempting to validate cleanup code", {
        email,
        correlationId: activeCorrelationId,
      });

      // Call cleanup edge function to validate code and delete user
      const response = await validateAndCleanup(
        email,
        verificationCode,
        activeCorrelationId || undefined,
      );

      logger.info("Cleanup validation successful - user deleted", {
        email,
        correlationId: response.correlationId,
        deletedUserId: response.data.deletedUserId,
        orphanClassification: response.data.orphanClassification,
      });

      // Move to success step
      setStep("success");

      // Show success toast
      toast({
        title: "Account cleanup complete",
        description: "You can now register again with the same email address.",
        duration: 5000,
      });

      // Redirect to registration after 2 seconds
      setTimeout(() => {
        void navigate({ to: "/register" });
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof CleanupError ? err.getUserFriendlyMessage() : "Failed to verify code. Please try again.";

      setError(errorMessage);

      logger.error("Failed to validate cleanup code", err, {
        email,
        correlationId: activeCorrelationId,
        errorCode: err instanceof CleanupError ? err.code : "UNKNOWN",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) {
      setError(`Please wait ${resendCooldown} seconds before requesting a new code.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info("User requested to resend cleanup code", {
        email,
        correlationId: activeCorrelationId,
      });

      // Call cleanup edge function to request new verification code
      const response = await requestCleanupCode(email, activeCorrelationId || undefined);

      // Update correlation ID from response
      setActiveCorrelationId(response.correlationId);

      // Start 60-second cooldown
      setResendCooldown(60);

      // Clear verification code input
      setVerificationCode("");

      // Show success toast
      toast({
        title: "New code sent",
        description: `A new verification code has been sent to ${email}.`,
        duration: 5000,
      });

      logger.info("Verification code resent successfully", {
        email,
        correlationId: response.correlationId,
      });
    } catch (err) {
      const errorMessage =
        err instanceof CleanupError ? err.getUserFriendlyMessage() : "Failed to resend code. Please try again.";

      setError(errorMessage);

      logger.error("Failed to resend cleanup code", err, {
        email,
        correlationId: activeCorrelationId,
        errorCode: err instanceof CleanupError ? err.code : "UNKNOWN",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Choice Step: User selects recovery path
  if (step === "choice") {
    return (
      <div className="registration-form">
        <header className="registration-form__header">
          <h1 className="registration-form__title">{currentMessage.title}</h1>
          <p className="registration-form__subtitle">{currentMessage.description}</p>
        </header>

        <div className="recovery-form__info">
          <div className="recovery-form__info-icon">
            <RiAlertLine aria-hidden="true" />
          </div>
          <div className="recovery-form__info-content">
            <p className="recovery-form__info-email">
              <strong>Email:</strong> {email}
            </p>
            {correlationId ? (
              <p className="recovery-form__info-correlation">
                <small>Correlation ID: {correlationId}</small>
              </p>
            ) : null}
          </div>
        </div>

        <div className="recovery-form__actions">
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={handleStartFresh}
            disabled={isLoading}
            className="recovery-form__action-button"
          >
            {isLoading ? (
              <>
                <RiLoader4Line className="animate-spin" aria-hidden="true" />
                Sending verification code…
              </>
            ) : (
              "Start Fresh"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleContinueRegistration}
            disabled={isLoading}
            className="recovery-form__action-button"
          >
            Continue Registration
          </Button>
        </div>

        {error ? (
          <div className="registration-form__error" role="alert">
            <RiAlertLine aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="recovery-form__help">
          <p>
            <strong>Start Fresh:</strong> Delete your old account and register again. You'll
            receive a verification code via email.
          </p>
          <p>
            <strong>Continue Registration:</strong> Resume your registration from where you left
            off.
          </p>
        </div>
      </div>
    );
  }

  // Cleanup Step: User enters verification code
  if (step === "cleanup") {
    return (
      <div className="registration-form">
        <header className="registration-form__header">
          <h1 className="registration-form__title">Enter Verification Code</h1>
          <p className="registration-form__subtitle">
            We've sent a 6-digit code to <strong>{email}</strong>. Enter it below to confirm
            account cleanup.
          </p>
        </header>

        <div className="recovery-form__code-input">
          <Label htmlFor="verification-code">Verification Code</Label>
          <Input
            id="verification-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            disabled={isLoading}
            autoFocus
            className="recovery-form__code-field"
          />
          <p className="recovery-form__code-hint">
            This code expires in 10 minutes. Didn't receive it?{" "}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isLoading || resendCooldown > 0}
              className="recovery-form__resend-link"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
          </p>
        </div>

        <div className="recovery-form__actions">
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={handleVerifyAndCleanup}
            disabled={isLoading || verificationCode.length !== 6}
            className="recovery-form__action-button"
          >
            {isLoading ? (
              <>
                <RiLoader4Line className="animate-spin" aria-hidden="true" />
                Verifying…
              </>
            ) : (
              "Verify and Continue"
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setStep("choice")}
            disabled={isLoading}
            className="recovery-form__action-button"
          >
            Back
          </Button>
        </div>

        {error ? (
          <div className="registration-form__error" role="alert">
            <RiAlertLine aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="recovery-form__warning">
          <RiAlertLine aria-hidden="true" />
          <p>
            <strong>Warning:</strong> This will permanently delete your old account. You'll need
            to register again with your company information.
          </p>
        </div>
      </div>
    );
  }

  // Success Step: Confirmation and redirect
  return (
    <div className="registration-form">
      <header className="registration-form__header">
        <div className="recovery-form__success-icon">
          <RiCheckLine aria-hidden="true" />
        </div>
        <h1 className="registration-form__title">Account Cleanup Complete</h1>
        <p className="registration-form__subtitle">
          Your old account has been successfully removed. You can now register again with the same
          email address.
        </p>
      </header>

      <div className="recovery-form__success-message">
        <p>Redirecting you to the registration page…</p>
        <RiLoader4Line className="animate-spin recovery-form__spinner" aria-hidden="true" />
      </div>
    </div>
  );
}
