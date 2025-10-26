import clsx from "clsx";
import { Check, Circle } from "lucide-react";

import {
  PASSWORD_RULES,
  type PasswordRequirementStatus,
} from "@/modules/auth/utils/passwordPolicy";

export interface PasswordRequirementsPanelProps {
  requirements: PasswordRequirementStatus[];
  isVisible: boolean;
  className?: string;
  /**
   * Optional id applied to the checklist summary for aria-describedby references.
   */
  summaryId?: string;
}

function getRequirementCopy(
  requirements: PasswordRequirementStatus[],
): PasswordRequirementStatus[] {
  const byId = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  return PASSWORD_RULES.map((rule) => {
    const resolved = byId.get(rule.id);
    if (resolved) {
      return resolved;
    }
    return {
      id: rule.id,
      label: rule.label,
      description: rule.description,
      failureMessage: rule.failureMessage,
      met: false,
    };
  });
}

export function PasswordRequirementsPanel({
  requirements,
  isVisible,
  className,
}: PasswordRequirementsPanelProps) {
  const normalizedRequirements = getRequirementCopy(requirements);

  const liveRegionProps = isVisible
    ? ({
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "false",
      } as const)
    : ({ "aria-hidden": true } as const);

  return (
    <div
      className={clsx(
        "registration-form__password-panel",
        !isVisible && "registration-form__password-panel--hidden",
        className,
      )}
      {...liveRegionProps}
    >
      <ul className="registration-form__password-rule-list" aria-hidden={false}>
        {normalizedRequirements.map((requirement) => (
          <li
            key={requirement.id}
            className={clsx(
              "registration-form__password-rule",
              requirement.met && "registration-form__password-rule--met",
            )}
          >
            <span className="registration-form__password-rule-icon" aria-hidden="true">
              {requirement.met ? (
                <Check className="registration-form__password-rule-icon-graphic" size={16} />
              ) : (
                <Circle className="registration-form__password-rule-icon-graphic" size={16} />
              )}
            </span>
            <span className="registration-form__password-rule-text">
              <span className="registration-form__password-rule-label">{requirement.label}</span>
              <span className="registration-form__password-rule-description">
                {requirement.description}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
