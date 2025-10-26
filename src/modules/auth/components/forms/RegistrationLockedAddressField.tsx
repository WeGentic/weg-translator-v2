import { forwardRef } from "react";

import { X } from "lucide-react";

import { cn } from "@/shared/utils/class-names";

export interface RegistrationLockedAddressFieldProps {
  id: string;
  value: string;
  labelledBy: string;
  describedBy?: string;
  className?: string;
  onClear: () => void;
}

/**
 * Non-editable address preview rendered after the user confirms an autocomplete suggestion.
 * Displays the resolved address text and exposes a trailing clear action to restore the input.
 */
export const RegistrationLockedAddressField = forwardRef<HTMLButtonElement, RegistrationLockedAddressFieldProps>(
  ({ id, value, labelledBy, describedBy, className, onClear }, ref) => {
    return (
      <div
        id={id}
        role="textbox"
        aria-readonly="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn("registration-form__locked-address", className)}
      >
        <span className="registration-form__locked-text">{value}</span>
        <button
          type="button"
          className="registration-form__locked-clear"
          onClick={onClear}
          aria-label="Clear selected address"
          ref={ref}
        >
          <X className="registration-form__locked-clear-icon" aria-hidden="true" />
        </button>
      </div>
    );
  },
);

RegistrationLockedAddressField.displayName = "RegistrationLockedAddressField";

