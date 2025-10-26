import clsx from "clsx";

import {
  type PasswordEvaluationResult,
  type PasswordStrengthTier,
} from "@/modules/auth/utils/passwordPolicy";

export interface PasswordStrengthMeterProps {
  evaluation: PasswordEvaluationResult;
  isVisible: boolean;
  className?: string;
  summaryId?: string;
}

const SEGMENT_COUNT = 4;

const TIER_TO_SEGMENT_INDEX: Record<PasswordStrengthTier, number> = {
  weak: 1,
  fair: 2,
  strong: 3,
  excellent: 4,
};

const TIER_TO_CLASS: Record<PasswordStrengthTier, string> = {
  weak: "registration-form__password-strength--weak",
  fair: "registration-form__password-strength--fair",
  strong: "registration-form__password-strength--strong",
  excellent: "registration-form__password-strength--excellent",
};

export function PasswordStrengthMeter({
  evaluation,
  isVisible,
  className,
  summaryId,
}: PasswordStrengthMeterProps) {
  const activeSegments = TIER_TO_SEGMENT_INDEX[evaluation.strength.tier] ?? 1;

  const liveRegionProps = isVisible
    ? ({
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
      } as const)
    : ({ "aria-hidden": true } as const);

  return (
    <div
      className={clsx(
        "registration-form__password-strength",
        !isVisible && "registration-form__password-strength--hidden",
        TIER_TO_CLASS[evaluation.strength.tier],
        className,
      )}
      {...liveRegionProps}
    >
      <div className="registration-form__password-strength-header">
        <span className="registration-form__password-strength-label">Password strength</span>
        <span id={summaryId} className="registration-form__password-strength-value">
          {evaluation.strength.label}
        </span>
      </div>
      <div
        className="registration-form__password-strength-bar"
        role="presentation"
        aria-hidden="true"
      >
        {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
          <span
            key={index}
            className={clsx(
              "registration-form__password-strength-segment",
              index < activeSegments && "registration-form__password-strength-segment--active",
            )}
          />
        ))}
      </div>
      <p className="registration-form__password-strength-message">{evaluation.strength.message}</p>
    </div>
  );
}
