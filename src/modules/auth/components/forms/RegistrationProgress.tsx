import type { RegistrationStepKey } from "@/modules/auth/utils/constants/registration";

export interface RegistrationProgressStepState {
  key: RegistrationStepKey;
  label: string;
  isSelected: boolean;
  isCompleted: boolean;
}

export interface RegistrationProgressProps {
  steps: RegistrationProgressStepState[];
  onStepSelect: (index: number) => void;
}

/**
 * Stepper displayed at the top of the registration flow.
 * Delegates navigation logic back to the controller via `onStepSelect`.
 */
export function RegistrationProgress({ steps, onStepSelect }: RegistrationProgressProps) {
  return (
    <nav className="registration-form__stepper" aria-label="Registration progress">
      <ol className="registration-form__stepper-list" role="list">
        {steps.map((step, index) => {
          const state = step.isSelected
            ? step.isCompleted
              ? "selected-completed"
              : "selected-incomplete"
            : step.isCompleted
              ? "not-selected-completed"
              : "not-selected-incomplete";
          return (
            <li key={step.key} className="registration-form__stepper-item">
              <button
                type="button"
                className="registration-form__stepper-trigger"
                data-state={state}
                onClick={() => onStepSelect(index)}
                aria-current={step.isSelected ? "step" : undefined}
              >
                <span className="registration-form__stepper-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="registration-form__stepper-text">
                  <span className="registration-form__stepper-label">{step.label}</span>
                  {step.isCompleted ? (
                    <span className="registration-form__stepper-status">(complete)</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
