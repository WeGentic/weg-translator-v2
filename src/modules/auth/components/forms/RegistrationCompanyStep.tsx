/**
 * Company information step rendering field rows plus VAT, address, and phone interactions.
 * Receives all controller callbacks/refs to keep the JSX declarative.
 */
import {
  Children,
  useEffect,
  useRef,
  type ChangeEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import PhoneInput from "react-phone-number-input";
import type { CountryCode } from "libphonenumber-js";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/class-names";
import {
  COMPANY_FIELD_ROWS,
  COMPANY_NAME_MAX_LENGTH,
  FIELD_CONFIG_BY_KEY,
  type RegistrationField,
  type RegistrationFieldConfig,
} from "@/modules/auth/utils/constants/registration";
import {
  type RegistrationTouched,
  type RegistrationValues,
} from "@/modules/auth/utils/validation/registration";
import type {
  RegistrationAddressState,
} from "@/modules/auth/hooks/controllers/useRegistrationForm";
import { RegistrationLockedAddressField } from "./RegistrationLockedAddressField";

interface RegistrationPhoneContainerProps {
  children: ReactNode;
  className?: string;
  countryCode?: string;
  disabled?: boolean;
}

function RegistrationPhoneContainer({
  children,
  className,
  countryCode,
  disabled,
}: RegistrationPhoneContainerProps) {
  const nodes = Children.toArray(children);
  const countrySelect = nodes[0] ?? null;
  const input = nodes[1] ?? null;

  return (
    <div
      className={cn(
        "registration-form__phone-container",
        className,
        disabled && "registration-form__phone-container--disabled",
      )}
      aria-disabled={disabled ? true : undefined}
    >
      {countrySelect}
      <div className="registration-form__phone-input-shell">
        {countryCode ? (
          <>
            <span className="registration-form__phone-prefix" aria-hidden="true">
              {countryCode}
            </span>
            <span className="sr-only">Selected country code {countryCode}</span>
          </>
        ) : null}
        {input}
      </div>
    </div>
  );
}

export interface RegistrationCompanyStepProps {
  values: RegistrationValues;
  touched: RegistrationTouched;
  isSubmitting: boolean;
  phoneValue: string | undefined;
  phoneCountry: CountryCode | undefined;
  defaultPhoneCountry: CountryCode;
  phoneDialCode: string;
  phoneInputRef: MutableRefObject<HTMLInputElement | null>;
  addressInputRef: MutableRefObject<HTMLInputElement | null>;
  address: RegistrationAddressState;
  handleFieldChange: (field: RegistrationField) => (event: ChangeEvent<HTMLInputElement>) => void;
  handleFieldBlur: (field: RegistrationField) => void;
  handlePhoneChange: (value?: string) => void;
  handlePhoneCountryChange: (nextCountry?: CountryCode) => void;
  handleCompanyAddressChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleCompanyAddressClear: () => void;
  getFieldError: (field: RegistrationField) => string;
}

export function RegistrationCompanyStep({
  values,
  touched,
  isSubmitting,
  phoneValue,
  phoneCountry,
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
  getFieldError,
}: RegistrationCompanyStepProps) {
  const addressClearButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!address.lockedValue) {
      return;
    }

    const focusButton = () => {
      addressClearButtonRef.current?.focus();
    };

    if (typeof window === "undefined") {
      focusButton();
      return;
    }

    const frameId = window.requestAnimationFrame(focusButton);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [address.lockedValue]);

  const focusAddressInputAfterClear = () => {
    const restoreFocus = () => {
      addressInputRef.current?.focus();
      address.handleFocus();
    };

    if (typeof window === "undefined") {
      restoreFocus();
      return;
    }

    window.requestAnimationFrame(restoreFocus);
  };

  const renderCompanyNameField = (field: RegistrationFieldConfig) => {
    const fieldError = touched.companyName ? getFieldError("companyName") : "";
    const errorId = fieldError ? `${field.id}-error` : undefined;
    const counterId = `${field.id}-counter`;
    const describedBy = [errorId, counterId].filter(Boolean).join(" ") || undefined;
    const currentLength = Array.from(values.companyName).length;

    return (
      <div key={field.key} className="registration-form__field">
        <Label htmlFor={field.id} className="registration-form__label">
          {field.label}
        </Label>
        <div className="registration-form__input-shell registration-form__input-shell--counter">
          <Input
            id={field.id}
            name={field.name}
            type={field.type}
            value={values.companyName}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            className="registration-form__input registration-form__input--with-counter"
            maxLength={field.maxLength}
            onChange={handleFieldChange(field.key)}
            onBlur={() => handleFieldBlur(field.key)}
            aria-invalid={fieldError ? true : undefined}
            aria-required="true"
            aria-describedby={describedBy}
          />
          <span
            id={counterId}
            className="registration-form__counter"
            aria-live="polite"
            role="status"
          >
            {currentLength}/{COMPANY_NAME_MAX_LENGTH}
          </span>
        </div>
        {fieldError ? (
          <p id={errorId} className="registration-form__field-error" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>
    );
  };

  const renderCompanyAddressField = (field: RegistrationFieldConfig) => {
    const fieldError = touched.companyAddress ? getFieldError("companyAddress") : "";
    const errorId = fieldError ? `${field.id}-error` : undefined;
    const labelId = `${field.id}-label`;
    const activeOptionId =
      address.showPanel && address.activeIndex >= 0
        ? `${address.listId}-option-${address.activeIndex}`
        : undefined;
    const describedBy = errorId ?? undefined;

    return (
      <div key={field.key} className="registration-form__field registration-form__field--address">
        <Label id={labelId} htmlFor={field.id} className="registration-form__label">
          {field.label}
        </Label>
        {address.lockedValue ? (
          <RegistrationLockedAddressField
            id={field.id}
            value={address.lockedValue}
            labelledBy={labelId}
            describedBy={describedBy}
            onClear={() => {
              handleCompanyAddressClear();
              focusAddressInputAfterClear();
            }}
            ref={addressClearButtonRef}
          />
        ) : (
          <div className="registration-form__autocomplete">
            {/* Maintain combobox semantics (aria-expanded, active-descendant) so screen readers interpret the suggestion panel correctly. */}
            <Input
              id={field.id}
              ref={addressInputRef}
              name={field.name}
              type={field.type}
              value={values.companyAddress}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              className="registration-form__input registration-form__input--address"
              onChange={handleCompanyAddressChange}
              onFocus={address.handleFocus}
              onBlur={() => {
                address.handleBlur();
                handleFieldBlur(field.key);
              }}
              onKeyDown={address.handleKeyDown}
              aria-invalid={fieldError ? true : undefined}
              aria-required="true"
              aria-describedby={describedBy}
              aria-labelledby={labelId}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={address.showPanel ? "true" : "false"}
              aria-controls={address.showPanel ? address.listId : undefined}
              aria-activedescendant={address.showPanel ? activeOptionId : undefined}
              spellCheck={false}
            />
            {address.showPanel ? (
              <div
                id={address.listId}
                className="registration-form__autocomplete-panel"
                role="listbox"
                aria-label="Address suggestions"
              >
                {address.loading ? (
                  <div className="registration-form__autocomplete-status">Searching addresses…</div>
                ) : null}
                {address.suggestions.map((suggestion, index) => {
                  const isActive = index === address.activeIndex;
                  return (
                    <button
                      key={suggestion.id}
                      id={`${address.listId}-option-${index}`}
                      type="button"
                      className={cn(
                        "registration-form__autocomplete-option",
                        isActive && "registration-form__autocomplete-option--active",
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        address.handleSuggestionSelect(suggestion);
                      }}
                      onMouseEnter={() => address.setActiveIndex(index)}
                      role="option"
                      aria-selected={isActive}
                    >
                      <span className="registration-form__autocomplete-option-primary">
                        {suggestion.primaryText}
                      </span>
                      {suggestion.secondaryText ? (
                        <span className="registration-form__autocomplete-option-secondary">
                          {suggestion.secondaryText}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {!address.loading && address.suggestions.length === 0 && !address.error ? (
                  <div className="registration-form__autocomplete-status">No matches found.</div>
                ) : null}
                {address.error ? (
                  <div className="registration-form__autocomplete-error" role="alert">
                    {address.error}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        {fieldError ? (
          <p id={errorId} className="registration-form__field-error" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>
    );
  };

  const renderCompanyTaxField = (field: RegistrationFieldConfig) => {
    const fieldError = touched.companyTaxNumber ? getFieldError("companyTaxNumber") : "";
    const errorId = fieldError ? `${field.id}-error` : undefined;
    const describedBy = errorId ?? undefined;

    return (
      <div key={field.key} className="registration-form__field">
        <Label htmlFor={field.id} className="registration-form__label">
          {field.label}
        </Label>
        <Input
          id={field.id}
          name={field.name}
          type={field.type}
          value={values.companyTaxNumber}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          className="registration-form__input"
          onChange={handleFieldChange(field.key)}
          onBlur={() => handleFieldBlur(field.key)}
          aria-invalid={fieldError ? true : undefined}
          aria-required="true"
          aria-describedby={describedBy}
        />
        {fieldError ? (
          <p id={errorId} className="registration-form__field-error" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>
    );
  };

  const renderPhoneField = (field: RegistrationFieldConfig) => {
    const fieldError = touched.companyPhone ? getFieldError("companyPhone") : "";
    const errorId = fieldError ? `${field.id}-error` : undefined;

    return (
      <div key={field.key} className="registration-form__field registration-form__field--phone">
        <Label htmlFor={field.id} className="registration-form__label">
          {field.label}
        </Label>
        <PhoneInput
          id={field.id}
          name={field.name}
          value={phoneValue}
          onChange={handlePhoneChange}
          onCountryChange={handlePhoneCountryChange}
          defaultCountry={defaultPhoneCountry}
          country={phoneCountry}
          placeholder={field.placeholder}
          autoComplete="tel"
          aria-invalid={fieldError ? true : undefined}
          aria-required="true"
          aria-describedby={errorId}
          containerComponent={RegistrationPhoneContainer}
          containerComponentProps={{
            countryCode: phoneDialCode,
            disabled: isSubmitting,
          }}
          countrySelectProps={{
            className: "registration-form__phone-select",
            disabled: isSubmitting,
          }}
          numberInputProps={{
            className: "registration-form__phone-input",
            inputMode: "tel",
            disabled: isSubmitting,
            name: field.name,
          }}
          className={cn(
            "registration-form__phone-control",
            fieldError && "registration-form__phone-control--error",
          )}
          inputRef={phoneInputRef}
        />
        {fieldError ? (
          <p id={errorId} className="registration-form__field-error" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>
    );
  };

  const renderCompanyEmailField = (field: RegistrationFieldConfig) => {
    const fieldError = touched.companyEmail ? getFieldError("companyEmail") : "";
    const errorId = fieldError ? `${field.id}-error` : undefined;
    const helperId = `${field.id}-helper`;
    const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

    return (
      <div key={field.key} className="registration-form__field">
        <Label htmlFor={field.id} className="registration-form__label">
          {field.label}
        </Label>
        <Input
          id={field.id}
          name={field.name}
          type={field.type}
          value={values.companyEmail}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          className="registration-form__input"
          onChange={handleFieldChange(field.key)}
          onBlur={() => handleFieldBlur(field.key)}
          aria-invalid={fieldError ? true : undefined}
          aria-required="true"
          aria-describedby={describedBy}
        />
        <p id={helperId} className="text-sm text-muted-foreground mt-1">
          This email will be unique across all accounts
        </p>
        {fieldError ? (
          <p id={errorId} className="registration-form__field-error" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>
    );
  };

  const renderField = (field: RegistrationFieldConfig) => {
    if (field.key === "companyPhone") {
      return renderPhoneField(field);
    }
    if (field.key === "companyName") {
      return renderCompanyNameField(field);
    }
    if (field.key === "companyAddress") {
      return renderCompanyAddressField(field);
    }
    if (field.key === "companyTaxNumber") {
      return renderCompanyTaxField(field);
    }
    if (field.key === "companyEmail") {
      return renderCompanyEmailField(field);
    }
    const fieldError = touched[field.key] ? getFieldError(field.key) : "";
    const errorId = fieldError ? `${field.id}-error` : undefined;
    const describedBy = errorId ?? undefined;

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
          onBlur={() => handleFieldBlur(field.key)}
          maxLength={field.maxLength}
          aria-invalid={fieldError ? true : undefined}
          aria-required="true"
          aria-describedby={describedBy}
        />
        {fieldError && (
          <p id={errorId} className="registration-form__field-error" role="alert">
            {fieldError}
          </p>
        )}
      </div>
    );
  };

  const renderFieldRow = (fieldKeys: readonly RegistrationField[]) => {
    const rowFields = fieldKeys.map((fieldKey) => FIELD_CONFIG_BY_KEY[fieldKey]);
    const columns = rowFields.length;
    return (
      <div key={fieldKeys.join("-")} className="registration-form__field-row" data-columns={columns}>
        {rowFields.map((config) => renderField(config))}
      </div>
    );
  };

  return (
    <fieldset className="registration-form__fieldset">
      <div className="registration-form__legend mb-4">Company information</div>
      {COMPANY_FIELD_ROWS.map((row) => renderFieldRow(row))}
    </fieldset>
  );
}
