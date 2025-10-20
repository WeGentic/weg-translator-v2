import { useMemo, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
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
import {
  createPhoneCountryOptions,
  evaluatePhone,
  FALLBACK_PHONE_COUNTRY,
  getPhoneCountryMeta,
  resolveDefaultCountry,
  type PhoneCountryMeta,
} from "./phoneUtils";
import { resolveLanguageCode } from "./addressUtils";
import { useAddressAutocomplete } from "./useAddressAutocomplete";
import { PhoneCountrySelect } from "./PhoneCountrySelect";

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

type PhoneState = {
  readonly raw: string;
  readonly national: string;
  readonly e164: string | null;
  readonly isValid: boolean;
  readonly country: CountryCode;
};

export function WizardNewClientDialog({ open, onOpenChange, initialName, onSubmit }: WizardNewClientDialogProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const addressInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [phoneState, setPhoneState] = useState<PhoneState>(() => {
    const country = resolveDefaultCountry();
    return { raw: "", national: "", e164: null, isValid: false, country };
  });
  const [fieldErrors, setFieldErrors] = useState<ClientFormErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const localeCandidates = useMemo<readonly string[]>(() => {
    if (typeof navigator !== "undefined" && navigator.language) {
      return [navigator.language, "en"] as const;
    }
    return ["en"] as const;
  }, []);

  const countryDisplayNames = useMemo(() => {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined") {
      return new Intl.DisplayNames(localeCandidates, { type: "region" });
    }
    return null;
  }, [localeCandidates]);

  const phoneCountryOptions = useMemo<PhoneCountryMeta[]>(() => {
    return createPhoneCountryOptions(countryDisplayNames, localeCandidates[0] ?? "en");
  }, [countryDisplayNames, localeCandidates]);

  const languageCode = useMemo(() => resolveLanguageCode(localeCandidates[0]), [localeCandidates]);

  const countryBias = useMemo<readonly string[] | undefined>(() => {
    return phoneState.country ? [phoneState.country] : undefined;
  }, [phoneState.country]);

  const selectedPhoneMeta = useMemo(() => {
    return (phoneCountryOptions.find((option) => option.code === phoneState.country) ??
      getPhoneCountryMeta(phoneState.country, countryDisplayNames));
  }, [phoneCountryOptions, phoneState.country, countryDisplayNames]);

  const phonePrefixLabel = selectedPhoneMeta.callingCode ? `+${selectedPhoneMeta.callingCode}` : `+${selectedPhoneMeta.code}`;

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
    textareaRef: addressInputRef,
    onResolve: setAddress,
  });

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const nameError = validateClientName(name);
    const emailValidation = validateEmail(email);
    const vatValidation = sanitizeVat(vatNumber);

    const hasPhoneValue = phoneState.raw.length > 0 || phoneState.national.length > 0 || Boolean(phoneState.e164);
    const phoneError =
      hasPhoneValue && (!phoneState.isValid || !phoneState.e164)
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
          phone: hasPhoneValue && phoneState.e164 ? phoneState.e164 : "",
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

  const handlePhoneInputChange = (value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    const evaluation = evaluatePhone(digits, phoneState.country);
    setPhoneState((prev) => ({
      ...prev,
      raw: evaluation.raw,
      national: evaluation.national,
      e164: evaluation.e164,
      isValid: evaluation.isValid,
    }));

    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handlePhoneBlur = () => {
    if (!phoneState.raw) {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
      return;
    }

    if (!phoneState.isValid) {
      setFieldErrors((prev) => ({
        ...prev,
        phone: "Enter a valid phone number for the selected country.",
      }));
    } else {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handlePhoneCountryChange = (value: CountryCode) => {
    const nextCountry = phoneCountryOptions.find((option) => option.code === value)?.code ?? FALLBACK_PHONE_COUNTRY;
    if (phoneState.country === nextCountry) {
      return;
    }

    const evaluation = evaluatePhone(phoneState.raw, nextCountry);
    setPhoneState({
      country: nextCountry,
      raw: evaluation.raw,
      national: evaluation.national,
      e164: evaluation.e164,
      isValid: evaluation.isValid,
    });

    setFieldErrors((prev) => {
      if (!evaluation.raw) {
        return { ...prev, phone: undefined };
      }
      return {
        ...prev,
        phone: evaluation.isValid ? undefined : "Enter a valid phone number for the selected country.",
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("wizard-v2-client-dialog")}>
        <DialogHeader>
          <DialogTitle>Add new client</DialogTitle>
          <DialogDescription>Provide basic information to create a client profile.</DialogDescription>
        </DialogHeader>
        <form className="wizard-v2-client-form" onSubmit={handleSubmit}>
          <div className="wizard-v2-client-body">
            <div className="wizard-v2-client-grid">
              <div className="wizard-v2-client-field">
                <label className="wizard-v2-client-label" htmlFor="wizard-v2-client-name">
                  Client name
                </label>
                <Input
                  id="wizard-v2-client-name"
                  value={name}
                  autoFocus
                  maxLength={MAX_CLIENT_NAME_LENGTH}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="Acme Corporation"
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
                <div className="wizard-v2-client-phone">
                  <PhoneCountrySelect
                    value={phoneState.country}
                    options={phoneCountryOptions}
                    currentLabel={selectedPhoneMeta}
                    disabled={pending}
                    onChange={handlePhoneCountryChange}
                  />
                  <div className="wizard-v2-phone-field">
                    <span className="wizard-v2-phone-prefix" aria-hidden="true" title={`Country calling code ${phonePrefixLabel}`}>
                      {phonePrefixLabel}
                    </span>
                    <Input
                      id="wizard-v2-client-phone"
                      className="wizard-v2-client-phone-input"
                      value={phoneState.national}
                      onChange={(event) => handlePhoneInputChange(event.target.value)}
                      onBlur={handlePhoneBlur}
                      placeholder="555 555 1234"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      aria-label={`Phone number (${phonePrefixLabel})`}
                      aria-invalid={fieldErrors.phone ? "true" : "false"}
                    />
                  </div>
                </div>
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
                  <Textarea
                    id="wizard-v2-client-address"
                    ref={addressInputRef}
                    value={address}
                    onChange={(event) => {
                      setAddress(event.target.value);
                      clearAddressError();
                    }}
                    onFocus={handleAddressFocus}
                    onBlur={handleAddressBlur}
                    onKeyDown={handleAddressKeyDown}
                    placeholder="123 Example Street, City, Country"
                    rows={3}
                    aria-autocomplete="list"
                    aria-expanded={addressShowPanel ? "true" : "false"}
                  />
                  {addressShowPanel ? (
                    <div className="wizard-v2-client-suggestions" role="listbox" aria-label="Address suggestions">
                      {addressLoading ? (
                        <div className="wizard-v2-client-suggestion-status">Searching addresses…</div>
                      ) : null}
                      {addressSuggestions.map((suggestion, index) => {
                        const isActive = index === addressActiveIndex;
                        return (
                          <button
                            key={suggestion.id}
                            type="button"
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
