import type { HTMLAttributes } from "react";
import { Children, useId, useMemo, useRef, useState } from "react";

import PhoneInput, { getCountryCallingCode, isValidPhoneNumber } from "react-phone-number-input";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/class-names";
import type { CountryCode } from "libphonenumber-js";

import {
  hasFieldErrors,
  MAX_CLIENT_NAME_LENGTH,
  sanitizeVat,
  validateClientName,
  validateEmail,
  type ClientFormErrors,
} from "./clientFormValidation";
import { resolveDefaultCountry } from "./phoneUtils";
import { resolveLanguageCode } from "./addressUtils";
import { useAddressAutocomplete } from "./useAddressAutocomplete";

import "../css/client-wizard-dialog.css";
import "../css/client-wizard-layout.css";
import "../css/client-wizard-phone.css";
import "../css/client-wizard-autocomplete.css";
import "../css/client-wizard-feedback.css";
import "../css/client-wizard-input.css";
import "react-phone-number-input/style.css";
import { X } from "lucide-react";

interface WizardPhoneContainerProps extends HTMLAttributes<HTMLDivElement> {
  countryCode?: string;
  disabled?: boolean;
}

function WizardPhoneContainer({ children, className, countryCode, disabled, ...rest }: WizardPhoneContainerProps) {
  const [countrySelect, input] = Children.toArray(children);

  return (
    <div
      {...rest}
      className={cn("wizard-v2-phone-container", className, disabled && "wizard-v2-phone-container--disabled")}
      aria-disabled={disabled ? true : undefined}
    >
      {countrySelect}
      <div className="wizard-v2-phone-input-shell">
        {countryCode ? (
          <>
            <span className="wizard-v2-phone-prefix" aria-hidden="true">
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

export interface WizardNewClientFormValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  vatNumber: string;
  note: string;
}

interface WizardNewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onSubmit: (values: WizardNewClientFormValues) => Promise<void>;
}

export function WizardNewClientDialog({ open, onOpenChange, initialName, onSubmit }: WizardNewClientDialogProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const defaultPhoneCountry = useMemo<CountryCode>(() => resolveDefaultCountry(), []);
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(defaultPhoneCountry);
  const [phoneValue, setPhoneValue] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<ClientFormErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const phoneDialCode = useMemo(() => `+${getCountryCallingCode(phoneCountry)}`, [phoneCountry]);

  const localeCandidates = useMemo<readonly string[]>(() => {
    if (typeof navigator !== "undefined" && navigator.language) {
      return [navigator.language, "en"] as const;
    }
    return ["en"] as const;
  }, []);

  const languageCode = useMemo(() => resolveLanguageCode(localeCandidates[0]), [localeCandidates]);

  const countryBias = useMemo<readonly string[] | undefined>(() => {
    return phoneCountry ? [phoneCountry] : undefined;
  }, [phoneCountry]);

  const {
    suggestions: addressSuggestions,
    loading: addressLoading,
    error: addressError,
    clearError: clearAddressError,
    handleFocus: handleAddressFocus,
    handleBlur: handleAddressBlur,
    handleKeyDown: handleAddressKeyDown,
    handleSuggestionSelect,
    activeIndex: addressActiveIndex,
    setActiveIndex: setAddressActiveIndex,
    showPanel: addressShowPanel,
  } = useAddressAutocomplete({
    query: address,
    language: languageCode,
    countryBias,
    fieldRef: addressInputRef,
    onResolve: setAddress,
  });
  const addressSuggestionListId = useId();

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const nameError = validateClientName(name);
    const emailValidation = validateEmail(email);
    const vatValidation = sanitizeVat(vatNumber);

    const hasPhoneValue = Boolean(phoneInputRef.current?.value.trim().length);
    const phoneError =
      hasPhoneValue && (!phoneValue || !isValidPhoneNumber(phoneValue))
        ? "Enter a valid phone number for the selected country."
        : undefined;

    const errors: ClientFormErrors = {
      name: nameError,
      email: emailValidation.error,
      phone: phoneError,
      vatNumber: vatValidation.error,
    };

    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setPending(true);
    setSubmissionError(null);

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const trimmedNotes = notes.trim();

    void (async () => {
      try {
        await onSubmit({
          name: trimmedName,
          email: emailValidation.normalized,
          phone: hasPhoneValue && phoneValue ? phoneValue : "",
          address: trimmedAddress,
          vatNumber: vatValidation.normalized,
          note: trimmedNotes,
        });
        onOpenChange(false);
      } catch (cause: unknown) {
        const message =
          cause instanceof Error && cause.message ? cause.message : "Unable to save client. Try again.";
        setSubmissionError(message);
      } finally {
        setPending(false);
      }
    })();
  };

  const handlePhoneBlur = () => {
    const hasPhoneDigits = Boolean(phoneInputRef.current?.value.trim().length);
    if (!hasPhoneDigits) {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
      return;
    }

    if (!phoneValue || !isValidPhoneNumber(phoneValue)) {
      setFieldErrors((prev) => ({
        ...prev,
        phone: "Enter a valid phone number for the selected country.",
      }));
    } else {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handlePhoneChange = (value?: string) => {
    setPhoneValue(value);
    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handlePhoneCountryChange = (nextCountry?: CountryCode) => {
    setPhoneCountry(nextCountry ?? defaultPhoneCountry);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("wizard-v2-client-dialog")}
        hideCloseButton
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
        }}
      >
        <div className="wizard-client-divider-bar">
          <h2 className="text-(--color-victorian-peacock-900) text-[20px]">Add new client</h2>
          <DialogClose type="button" className="wizard-v2-close" aria-label="Close wizard">
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogClose>
        </div>

        <form className="wizard-v2-client-form" onSubmit={handleSubmit}>
          <div className="wizard-client-divider"></div>
          <div className="wizard-v2-client-body">
            <div className="wizard-v2-client-grid">
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-name">
                  Client name
                </label>
                <Input
                  id="wizard-v2-client-name"
                  className="client-form-input"
                  value={name}
                  autoFocus
                  maxLength={MAX_CLIENT_NAME_LENGTH}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="Client name"
                  required
                  aria-invalid={fieldErrors.name ? "true" : "false"}
                  autoCapitalize="words"
                />
                {fieldErrors.name ? (
                  <p className="wizard-v2-client-field-error" role="alert">
                    {fieldErrors.name}
                  </p>
                ) : null}
              </div>
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-email">
                  Contact email
                </label>
                <Input
                  id="wizard-v2-client-email"
                  className="client-form-input"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  onBlur={() => {
                    const validation = validateEmail(email);
                    if (validation.normalized !== email) {
                      setEmail(validation.normalized);
                    }
                    setFieldErrors((prev) => ({
                      ...prev,
                      email: validation.error,
                    }));
                  }}
                  placeholder="hello@company.com"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  aria-invalid={fieldErrors.email ? "true" : "false"}
                />
                {fieldErrors.email ? (
                  <p className="wizard-v2-client-field-error" role="alert">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-phone">
                  Phone
                </label>
                <PhoneInput
                  id="wizard-v2-client-phone"
                  name="phone"
                  value={phoneValue}
                  onChange={handlePhoneChange}
                  onCountryChange={handlePhoneCountryChange}
                  defaultCountry={defaultPhoneCountry}
                  country={phoneCountry}
                  disabled={pending}
                  placeholder="555 555 1234"
                  autoComplete="tel"
                  aria-invalid={fieldErrors.phone ? true : undefined}
                  className={cn("wizard-v2-phone-control", fieldErrors.phone && "wizard-v2-phone-control--error")}
                  onBlur={handlePhoneBlur}
                  containerComponent={WizardPhoneContainer}
                  containerComponentProps={{
                    countryCode: phoneDialCode,
                    disabled: pending,
                  }}
                  countrySelectProps={{
                    className: "wizard-v2-phone-select",
                    disabled: pending,
                  }}
                  numberInputProps={{
                    className: "wizard-v2-phone-input",
                    inputMode: "tel",
                  }}
                  inputRef={(element: HTMLInputElement | null) => {
                    phoneInputRef.current = element;
                  }}
                />
                {fieldErrors.phone ? (
                  <p className="wizard-v2-client-field-error" role="alert">
                    {fieldErrors.phone}
                  </p>
                ) : null}
              </div>
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-vat">
                  VAT number
                </label>
                <Input
                  id="wizard-v2-client-vat"
                  className="client-form-input"
                  value={vatNumber}
                  onChange={(event) => {
                    setVatNumber(event.target.value);
                    if (fieldErrors.vatNumber) {
                      setFieldErrors((prev) => ({ ...prev, vatNumber: undefined }));
                    }
                  }}
                  placeholder="BE0123456789"
                  aria-invalid={fieldErrors.vatNumber ? "true" : "false"}
                />
                {fieldErrors.vatNumber ? (
                  <p className="wizard-v2-client-field-error" role="alert">
                    {fieldErrors.vatNumber}
                  </p>
                ) : null}
              </div>
              <div className="wizard-v2-client-field wizard-v2-client-field--address">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-address">
                  Address
                </label>
                <div className="wizard-v2-client-autocomplete">
                  <Input
                    id="wizard-v2-client-address"
                    ref={addressInputRef}
                    className="client-form-input wizard-v2-client-address-input"
                    type="text"
                    value={address}
                    onChange={(event) => {
                      setAddress(event.target.value);
                      clearAddressError();
                    }}
                    onFocus={handleAddressFocus}
                    onBlur={handleAddressBlur}
                    onKeyDown={handleAddressKeyDown}
                    placeholder="123 Example Street, City, Country"
                    autoComplete="street-address"
                    autoCapitalize="words"
                    spellCheck={false}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-expanded={addressShowPanel ? "true" : "false"}
                    aria-controls={addressShowPanel ? addressSuggestionListId : undefined}
                    aria-activedescendant={
                      addressShowPanel && addressActiveIndex >= 0
                        ? `${addressSuggestionListId}-option-${addressActiveIndex}`
                        : undefined
                    }
                  />
                  {addressShowPanel ? (
                    <div
                      id={addressSuggestionListId}
                      className="wizard-v2-client-suggestions"
                      role="listbox"
                      aria-label="Address suggestions"
                    >
                      {addressLoading ? (
                        <div className="wizard-v2-client-suggestion-status">Searching addresses…</div>
                      ) : null}
                      {addressSuggestions.map((suggestion, index) => {
                        const isActive = index === addressActiveIndex;
                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            id={`${addressSuggestionListId}-option-${index}`}
                            className={cn(
                              "wizard-v2-client-suggestion",
                              isActive && "wizard-v2-client-suggestion--active",
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleSuggestionSelect(suggestion);
                            }}
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => setAddressActiveIndex(index)}
                          >
                            <span className="wizard-v2-client-suggestion-primary">{suggestion.primaryText}</span>
                            {suggestion.secondaryText ? (
                              <span className="wizard-v2-client-suggestion-secondary">
                                {suggestion.secondaryText}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                      {!addressLoading && addressSuggestions.length === 0 && !addressError ? (
                        <div className="wizard-v2-client-suggestion-status">No matches found.</div>
                      ) : null}
                      {addressError ? (
                        <div className="wizard-v2-client-suggestion-error" role="alert">
                          {addressError}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="wizard-v2-client-field wizard-v2-client-field--notes">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-notes">
                  Notes
                </label>
                <Textarea
                  id="wizard-v2-client-notes"
                  value={notes}
                  className="client-form-input wizard-v2-client-notes-textarea"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Internal notes, key contacts, style guides…"
                  rows={4}
                />
              </div>
            </div>
          </div>
          {submissionError ? (
            <p className="wizard-v2-client-error" role="alert">
              {submissionError}
            </p>
          ) : null}
          <DialogFooter className="wizard-v2-client-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="
            bg-[var(--color-victorian-peacock-900)]
            text-[var(--color-neverything-50)]
            hover:bg-[var(--color-victorian-peacock-800)]
            focus-visible:ring-[var(--color-victorian-peacock-700)]
            ">
              {pending ? "Saving…" : "Save client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
