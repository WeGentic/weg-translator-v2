import { forwardRef } from "react";
import { RiAlertLine, RiCheckLine, RiInformationLine, RiLoader4Line } from "react-icons/ri";
import { Button } from "@/shared/ui/button";
import type { EmailStatusProbeApi } from "@/modules/auth/hooks/controllers/useEmailStatusProbe";

interface EmailStatusBannerProps {
  probe: EmailStatusProbeApi;
  onLogin: () => void;
  onRecover: () => void;
  onResumeVerification: () => void;
  onResend: () => void;
  resendDisabled?: boolean;
  resendHint?: string;
}

export const EmailStatusBanner = forwardRef<HTMLDivElement, EmailStatusBannerProps>(
({
  probe,
  onLogin,
  onRecover,
  onResumeVerification,
  onResend,
  resendDisabled = false,
  resendHint,
}, ref) => {
  const { status, isLoading, error, result } = probe;

  if (isLoading) {
    return (
      <div
        className="registration-form__email-status registration-form__email-status--loading"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        ref={ref}
        tabIndex={-1}
      >
        <RiLoader4Line aria-hidden="true" className="registration-form__email-status-icon" />
        <div className="registration-form__email-status-content">
          <p className="registration-form__email-status-title">Checking email status…</p>
          <p className="registration-form__email-status-description">
            We’re verifying whether this administrator email is already registered.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="registration-form__email-status registration-form__email-status--warning"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        ref={ref}
        tabIndex={-1}
      >
        <RiAlertLine aria-hidden="true" className="registration-form__email-status-icon" />
        <div className="registration-form__email-status-content">
          <p className="registration-form__email-status-title">We couldn’t verify this email.</p>
          <p className="registration-form__email-status-description">
            {error.message}
            {error.retryAfterSeconds
              ? ` Try again in about ${Math.ceil(error.retryAfterSeconds / 60)} minute(s).`
              : ""}
          </p>
        </div>
        <div className="registration-form__email-status-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void probe.forceCheck();
            }}
          >
            Retry check
          </Button>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  if (status === "not_registered") {
    return (
      <div
        className="registration-form__email-status registration-form__email-status--success"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        ref={ref}
        tabIndex={-1}
      >
        <RiCheckLine aria-hidden="true" className="registration-form__email-status-icon" />
        <div className="registration-form__email-status-content">
          <p className="registration-form__email-status-title">You’re good to go.</p>
          <p className="registration-form__email-status-description">
            This email hasn’t been used yet for an administrator account. Continue with
            registration.
          </p>
        </div>
      </div>
    );
  }

  if (status === "registered_verified") {
    return (
      <div
        className="registration-form__email-status registration-form__email-status--error"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        ref={ref}
        tabIndex={-1}
      >
        <RiAlertLine aria-hidden="true" className="registration-form__email-status-icon" />
        <div className="registration-form__email-status-content">
          <p className="registration-form__email-status-title">This email already has access.</p>
          <p className="registration-form__email-status-description">
            Sign in to the existing account or recover the password to continue.
          </p>
        </div>
        <div className="registration-form__email-status-actions">
          <Button type="button" variant="outline" size="sm" onClick={onLogin}>
            Log in
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRecover}>
            Recover password
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="registration-form__email-status registration-form__email-status--info"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      ref={ref}
      tabIndex={-1}
    >
      <RiInformationLine aria-hidden="true" className="registration-form__email-status-icon" />
      <div className="registration-form__email-status-content">
        <p className="registration-form__email-status-title">Finish verifying your email.</p>
        <p className="registration-form__email-status-description">
          We’ve seen this email before but the account hasn’t been verified yet. You can resend the
          confirmation message or continue verification.
        </p>
      </div>
      <div className="registration-form__email-status-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resendDisabled}
          aria-disabled={resendDisabled ? true : undefined}
          onClick={onResend}
        >
          Resend email
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onResumeVerification}>
          Resume verification
        </Button>
      </div>
      {resendHint ? (
        <p className="registration-form__email-status-hint" aria-live="polite">
          {resendHint}
        </p>
      ) : null}
    </div>
  );
});

EmailStatusBanner.displayName = "EmailStatusBanner";
