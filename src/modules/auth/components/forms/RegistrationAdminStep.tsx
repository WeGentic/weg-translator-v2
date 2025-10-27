/**
 * Admin account step presenting credential fields fed by the registration controller hook.
 */
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  ADMIN_FIELD_ROWS,
  FIELD_CONFIG_BY_KEY,
  type RegistrationField,
  type RegistrationFieldConfig,
} from "@/modules/auth/utils/constants/registration";
import {
  type RegistrationTouched,
  type RegistrationValues,
} from "@/modules/auth/utils/validation/registration";
import type { PasswordEvaluationResult } from "@/modules/auth/utils/passwordPolicy";
import type { EmailStatusProbeApi } from "@/modules/auth/hooks/controllers/useEmailStatusProbe";
import { PasswordRequirementsPanel } from "./PasswordRequirementsPanel";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { EmailStatusBanner } from "./EmailStatusBanner";

export interface RegistrationAdminStepProps {
  values: RegistrationValues;
  touched: RegistrationTouched;
  emailStatusProbe: EmailStatusProbeApi;
  onNavigateToLogin: () => void;
  onRecoverPassword: () => void;
  onResumeVerification: () => void;
  onResendVerification: () => void;
  isResendDisabled: boolean;
  resendHint?: string;
  getFieldError: (field: RegistrationField) => string;
  handleFieldChange: (field: RegistrationField) => (event: ChangeEvent<HTMLInputElement>) => void;
  handleFieldBlur: (field: RegistrationField) => void;
  passwordEvaluation: PasswordEvaluationResult;
}

export function RegistrationAdminStep({
  values,
  touched,
  emailStatusProbe,
  onNavigateToLogin,
  onRecoverPassword,
  onResumeVerification,
  onResendVerification,
  isResendDisabled,
  resendHint,
  getFieldError,
  handleFieldChange,
  handleFieldBlur,
  passwordEvaluation,
}: RegistrationAdminStepProps) {
  const [isPasswordFieldFocused, setPasswordFieldFocused] = useState(false);
  const guidanceId = useId();
  const requirementsSummaryId = `${guidanceId}-requirements`;
  const strengthSummaryId = `${guidanceId}-strength`;
  const emailStatusRef = useRef<HTMLDivElement | null>(null);

  const trimmedPassword = values.adminPassword.trim();
  const shouldShowStrength = isPasswordFieldFocused || trimmedPassword.length > 0;

  const handlePasswordFocus = () => {
    setPasswordFieldFocused(true);
  };

  const handlePasswordBlur = () => {
    setPasswordFieldFocused(false);
  };

  useEffect(() => {
    if (emailStatusProbe.status === "registered_verified") {
      emailStatusRef.current?.focus();
    }
  }, [emailStatusProbe.status]);

  const renderField = (field: RegistrationFieldConfig) => {
    const fieldError = touched[field.key] ? getFieldError(field.key) : "";
    const errorId = fieldError ? `${field.id}-error` : undefined;
    const describedByReferences: string[] = [];
    if (errorId) {
      describedByReferences.push(errorId);
    }
    if (field.key === "adminPassword") {
      describedByReferences.push(requirementsSummaryId);
      if (shouldShowStrength) {
        describedByReferences.push(strengthSummaryId);
      }
    }
    const describedBy =
      describedByReferences.length > 0 ? describedByReferences.filter(Boolean).join(" ") : undefined;

    const onFieldBlur = () => {
      handleFieldBlur(field.key);
      if (field.key === "adminPassword") {
        handlePasswordBlur();
      }
    };

    return (
      <div key={field.key} className="registration-form__field">
        <Label htmlFor={field.id} className="registration-form__label">
          {field.label}
        </Label>
        <Input
          id={field.id}
          name={field.name}
          type={field.type}
          value={values[field.key]}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          inputMode={field.inputMode}
          className="registration-form__input"
          onChange={handleFieldChange(field.key)}
          onBlur={onFieldBlur}
          onFocus={field.key === "adminPassword" ? handlePasswordFocus : undefined}
          maxLength={field.maxLength}
          aria-invalid={fieldError ? true : undefined}
          aria-required="true"
          aria-describedby={describedBy}
        />
        {fieldError ? (
          <p id={errorId} className="registration-form__field-error" role="alert">
            {fieldError}
          </p>
        ) : null}
        {field.key === "adminEmail" ? (
          <EmailStatusBanner
            probe={emailStatusProbe}
            onLogin={onNavigateToLogin}
            onRecover={onRecoverPassword}
            onResumeVerification={onResumeVerification}
            onResend={onResendVerification}
            resendDisabled={isResendDisabled}
            resendHint={resendHint}
            ref={emailStatusRef}
          />
        ) : null}
      </div>
    );
  };

  return (
    <fieldset className="registration-form__fieldset">
      <div className="registration-form__legend">Admin account</div>
      {ADMIN_FIELD_ROWS.map((row) => {
        const rowFields = row.map((fieldKey) => FIELD_CONFIG_BY_KEY[fieldKey]);
        const columns = rowFields.length;

        return (
          <div
            key={row.join("-")}
            className="registration-form__field-row"
            data-columns={columns}
          >
            {rowFields.map((field) => renderField(field))}
          </div>
        );
      })}
      <PasswordRequirementsPanel
        requirements={passwordEvaluation.requirements}
        isVisible
        summaryId={requirementsSummaryId}
      />
      <PasswordStrengthMeter
        evaluation={passwordEvaluation}
        isVisible={shouldShowStrength}
        summaryId={strengthSummaryId}
      />
    </fieldset>
  );
}
