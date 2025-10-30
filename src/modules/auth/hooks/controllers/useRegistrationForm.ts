/**
 * Coordinates multi-step registration state, field validation, VAT checks, and supporting adapters.
 * Intended for use by the registration form view and related step components.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEventHandler,
} from "react";
import { getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

import {
  FIELD_CONFIG_BY_KEY,
  REGISTRATION_FIELDS,
  STEP_FIELDS,
  STEP_SEQUENCE,
  type RegistrationField,
} from "@/modules/auth/utils/constants/registration";
import {
  createAllTouchedRegistrationTouched,
  createEmptyRegistrationValues,
  createInitialRegistrationErrors,
  createUntouchedRegistrationTouched,
  type RegistrationErrors,
  type RegistrationTouched,
  type RegistrationValidationOptions,
  type RegistrationValues,
  validateRegistrationValues,
} from "@/modules/auth/utils/validation/registration";
import { resolveDefaultCountry } from "@/modules/wizards/client/components/phoneUtils";
import { resolveLanguageCode } from "@/modules/wizards/client/components/addressUtils";
import {
  useAddressAutocomplete,
  type AddressSuggestion,
  type ResolvedAddressContext,
} from "@/modules/wizards/client/components/useAddressAutocomplete";
import {
  evaluatePassword,
  type PasswordEvaluationResult,
} from "@/modules/auth/utils/passwordPolicy";
import { createUserProfile, updateUserProfile } from "@/core/ipc/db/users";
import { logger } from "@/core/logging";
import {
  type NormalizedRegistrationPayload,
  type SubmissionError,
  type SubmissionPhase,
  useRegistrationSubmission,
} from "./useRegistrationSubmission";
import { useEmailStatusProbe } from "./useEmailStatusProbe";

export interface RegistrationAddressState {
  listId: string;
  suggestions: AddressSuggestion[];
  loading: boolean;
  error: string | null;
  lockedValue: string | null;
  showPanel: boolean;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  handleFocus: () => void;
  handleBlur: () => void;
  handleKeyDown: KeyboardEventHandler<HTMLInputElement>;
  handleSuggestionSelect: (suggestion: AddressSuggestion) => void;
  clearSelection: () => void;
  clearError: () => void;
}

export interface UseRegistrationFormResult {
  values: RegistrationValues;
  errors: RegistrationErrors;
  touched: RegistrationTouched;
  emailStatusProbe: ReturnType<typeof useEmailStatusProbe>;
  isSubmitting: boolean;
  isSubmissionLocked: boolean;
  stepIndex: number;
  currentStepKey: (typeof STEP_SEQUENCE)[number];
  currentStepBlockingLabels: string[];
  formBlockingLabels: string[];
  isFirstStep: boolean;
  isLastStep: boolean;
  isCurrentStepValid: boolean;
  isFormValid: boolean;
  continueTooltipMessage: string;
  submitTooltipMessage: string;
  phoneCountry: CountryCode | undefined;
  phoneValue: string | undefined;
  defaultPhoneCountry: CountryCode;
  phoneDialCode: string;
  phoneInputRef: React.MutableRefObject<HTMLInputElement | null>;
  addressInputRef: React.MutableRefObject<HTMLInputElement | null>;
  address: RegistrationAddressState;
  handleFieldChange: (field: RegistrationField) => (event: ChangeEvent<HTMLInputElement>) => void;
  handleFieldBlur: (field: RegistrationField) => void;
  handlePhoneChange: (value?: string) => void;
  handlePhoneCountryChange: (nextCountry?: CountryCode) => void;
  handleCompanyAddressChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleCompanyAddressClear: () => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleNextStep: () => void;
  handlePreviousStep: () => void;
  handleStepSelect: (index: number) => void;
  goToStep: (index: number) => void;
  getFieldError: (field: RegistrationField) => string;
  hasFieldBlockingError: (field: RegistrationField) => boolean;
  passwordEvaluation: PasswordEvaluationResult;
  submissionPhase: SubmissionPhase;
  submissionAttemptId: string | null;
  submissionError: SubmissionError | null;
  submissionResult: { accountUuid: string; userUuid: string; subscriptionUuid: string; payload: NormalizedRegistrationPayload } | null;
  handleManualVerificationCheck: () => Promise<void>;
  resetSubmission: () => void;
}

export function useRegistrationForm(): UseRegistrationFormResult {
  const [values, setValues] = useState<RegistrationValues>(() => createEmptyRegistrationValues());
  const [errors, setErrors] = useState<RegistrationErrors>(() => createInitialRegistrationErrors());
  const [touched, setTouched] = useState<RegistrationTouched>(() =>
    createUntouchedRegistrationTouched(),
  );
  const [taxCountryCode, setTaxCountryCode] = useState<string | null>(null);
  const submission = useRegistrationSubmission();
  const [stepIndex, setStepIndex] = useState(0);

  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const defaultPhoneCountry = useMemo<CountryCode>(() => resolveDefaultCountry(), []);
  const [phoneCountry, setPhoneCountry] = useState<CountryCode | undefined>(defaultPhoneCountry);
  const [phoneValue, setPhoneValue] = useState<string | undefined>(undefined);
  const phoneDialCode = useMemo(() => {
    const dialCodeCountry = phoneCountry ?? defaultPhoneCountry;
    if (!dialCodeCountry) {
      return "";
    }
    try {
      return `+${getCountryCallingCode(dialCodeCountry)}`;
    } catch (error) {
      logger.warn("Failed to resolve phone dial code", error, { phone_country: dialCodeCountry });
      return "";
    }
  }, [defaultPhoneCountry, phoneCountry]);
  const isSubmitting = submission.isSubmitting;
  const isSubmissionLocked = submission.isLocked;
  const submissionPhase = submission.phase;
  const submissionAttemptId = submission.attemptId;
  const submissionError = submission.error;
  const submissionResult = submission.result;
  const submitRegistration = submission.submit;
  const confirmVerification = submission.confirmVerification;
  const resetSubmission = submission.reset;
  const processedAttemptRef = useRef<string | null>(null);

  const emailStatusProbe = useEmailStatusProbe({
    email: values.adminEmail,
    attemptId: submissionAttemptId,
    enabled: touched.adminEmail,
  });

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

  const getHasPhoneDigits = useCallback((candidate?: string | null) => {
    if (typeof candidate === "string" && candidate.replace(/\D/g, "").length > 0) {
      return true;
    }
    const rawValue = phoneInputRef.current?.value ?? "";
    return rawValue.replace(/\D/g, "").length > 0;
  }, []);

  const evaluateErrors = useCallback(
    (nextValues: RegistrationValues, overrides?: RegistrationValidationOptions) => {
      const resolvedPhoneValue = overrides?.phoneValue ?? phoneValue;
      const candidatePhoneValue = resolvedPhoneValue ?? (nextValues.companyPhone || undefined);
      const resolvedHasDigits =
        overrides?.hasPhoneDigits ??
        getHasPhoneDigits(overrides?.phoneValue ?? resolvedPhoneValue);
      const derivedHasDigits =
        resolvedHasDigits || /\d/.test(nextValues.companyPhone ?? "");
      const hasOverrideTaxCountry = overrides ? "taxCountryCode" in overrides : false;
      const resolvedTaxCountry = hasOverrideTaxCountry
        ? overrides?.taxCountryCode ?? undefined
        : taxCountryCode ?? (phoneCountry ? phoneCountry.toUpperCase() : undefined);
      const evaluation = validateRegistrationValues(nextValues, {
        phoneValue: candidatePhoneValue,
        hasPhoneDigits: derivedHasDigits,
        taxCountryCode: resolvedTaxCountry,
      });
      if (evaluation.companyPhone && evaluation.companyPhone === "Company phone is required.") {
        logger.debug("Registration phone flagged as required", {
          hasDigits: derivedHasDigits,
          rawInputLength: nextValues.companyPhone.length,
          providedPhoneValue: Boolean(candidatePhoneValue),
          phoneCountry,
          taxCountryCode: resolvedTaxCountry,
        });
      }
      return evaluation;
    },
    [getHasPhoneDigits, phoneCountry, phoneValue, taxCountryCode],
  );

  const addressSuggestionListId = useId();
  const {
    suggestions: addressSuggestions,
    loading: addressLoading,
    error: addressError,
    lockedValue: addressLockedValue,
    clearError: clearAddressError,
    handleFocus: handleAddressFocus,
    handleBlur: handleAddressBlur,
    handleKeyDown: handleAddressKeyDown,
    handleSuggestionSelect,
    clearSelection: clearAddressSelection,
    activeIndex: addressActiveIndex,
    setActiveIndex: setAddressActiveIndex,
    showPanel: addressShowPanel,
  } = useAddressAutocomplete<HTMLInputElement>({
    query: values.companyAddress,
    language: languageCode,
    countryBias,
    fieldRef: addressInputRef,
    onResolve: (resolvedAddress: string, context?: ResolvedAddressContext) => {
      const inferredCountry = context?.countryCode?.toUpperCase() ?? null;
      setTaxCountryCode(inferredCountry);
      setValues((prev) => {
        const nextValues = { ...prev, companyAddress: resolvedAddress };
        setErrors(
          evaluateErrors(nextValues, {
            taxCountryCode: inferredCountry ?? undefined,
          }),
        );
        setTouched((prevTouched) => ({ ...prevTouched, companyAddress: true }));
        return nextValues;
      });
    },
  });

  const getFieldError = useCallback(
    (field: RegistrationField): string => errors[field],
    [errors],
  );

  const hasFieldBlockingError = useCallback(
    (field: RegistrationField): boolean => Boolean(errors[field]),
    [errors],
  );

  const handleFieldChange = useCallback(
    (field: RegistrationField) => (event: ChangeEvent<HTMLInputElement>) => {
      if (isSubmissionLocked) {
        return;
      }
      const rawValue = event.target.value;
      const value = field === "companyTaxNumber" ? rawValue.toUpperCase() : rawValue;
      if (field === "adminEmail") {
        emailStatusProbe.reset();
      }
      setValues((prev) => {
        const nextValues = { ...prev, [field]: value };
        setErrors(evaluateErrors(nextValues));
        return nextValues;
      });
    },
    [emailStatusProbe, evaluateErrors, isSubmissionLocked],
  );

  const handlePhoneChange = useCallback(
    (value?: string) => {
      if (isSubmissionLocked) {
        return;
      }
      const rawInput = phoneInputRef.current?.value ?? "";
      const normalizedRaw = rawInput.replace(/\u200b/g, "").trim();
      setPhoneValue(value);
      if (value) {
        const parsed = parsePhoneNumberFromString(value);
        const nextCountry = parsed?.country as CountryCode | undefined;
        if (nextCountry && nextCountry !== phoneCountry) {
          setPhoneCountry(nextCountry);
        }
      } else {
        const hasAnyDigits = /\d/.test(normalizedRaw);
        if (!hasAnyDigits && phoneCountry !== defaultPhoneCountry) {
          setPhoneCountry(defaultPhoneCountry);
        }
      }
      const hasDigits = getHasPhoneDigits(value ?? null);

      setValues((prev) => {
        const nextValues = { ...prev, companyPhone: value ?? normalizedRaw };
        setErrors(
          evaluateErrors(nextValues, { phoneValue: value, hasPhoneDigits: hasDigits }),
        );
        return nextValues;
      });
    },
    [defaultPhoneCountry, evaluateErrors, getHasPhoneDigits, isSubmissionLocked, phoneCountry],
  );

  const handlePhoneCountryChange = useCallback(
    (nextCountry?: CountryCode) => {
      if (isSubmissionLocked) {
        return;
      }
      setPhoneCountry(nextCountry ?? undefined);
      if (!nextCountry && phoneValue) {
        const parsed = parsePhoneNumberFromString(phoneValue);
        const inferredCountry = parsed?.country as CountryCode | undefined;
        if (inferredCountry) {
          setPhoneCountry(inferredCountry);
        }
      }
    },
    [isSubmissionLocked, phoneValue],
  );

  const handleCompanyAddressChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (isSubmissionLocked) {
        return;
      }
      const { value } = event.target;
      setTaxCountryCode(null);
      setValues((prev) => {
        const nextValues = { ...prev, companyAddress: value };
        setErrors(
          evaluateErrors(nextValues, {
            taxCountryCode: undefined,
          }),
        );
        return nextValues;
      });
      clearAddressError();
    },
    [clearAddressError, evaluateErrors],
  );

  const handleCompanyAddressClear = useCallback(() => {
    if (isSubmissionLocked) {
      return;
    }
    setTaxCountryCode(null);
    setValues((prev) => {
      if (!prev.companyAddress.length) {
        return prev;
      }
      const nextValues = { ...prev, companyAddress: "" };
      setErrors(
        evaluateErrors(nextValues, {
          taxCountryCode: undefined,
        }),
      );
      return nextValues;
    });
    setTouched((prev) => ({ ...prev, companyAddress: false }));
    clearAddressSelection();
    clearAddressError();
  }, [clearAddressError, clearAddressSelection, evaluateErrors, isSubmissionLocked]);

  const handleFieldBlur = useCallback(
    (field: RegistrationField) => {
      if (isSubmissionLocked) {
        return;
      }
      setTouched((prev) => {
        if (prev[field]) {
          return prev;
        }
        return { ...prev, [field]: true };
      });
    },
    [isSubmissionLocked, values],
  );

  const passwordEvaluation = useMemo(
    () => evaluatePassword(values.adminPassword ?? ""),
    [values.adminPassword],
  );

  const currentStepKey = STEP_SEQUENCE[stepIndex];
  const goToStep = useCallback((index: number) => {
    setStepIndex((prev) => {
      if (index === prev) {
        return prev;
      }
      return Math.max(0, Math.min(index, STEP_SEQUENCE.length - 1));
    });
  }, []);

  const attemptAdvance = useCallback(() => {
    if (isSubmissionLocked) {
      return false;
    }
    const nextErrors = evaluateErrors(values);
    const currentStep = STEP_SEQUENCE[stepIndex];
    const relevantFields = STEP_FIELDS[currentStep];

    setErrors(nextErrors);
    setTouched((prev) => {
      const updated: RegistrationTouched = { ...prev };
      for (const field of relevantFields) {
        updated[field] = true;
      }
      return updated;
    });

    const hasStepErrors = relevantFields.some((field) => Boolean(nextErrors[field]));
    return !hasStepErrors;
  }, [evaluateErrors, isSubmissionLocked, stepIndex, values]);

  const handleNextStep = useCallback(() => {
    if (isSubmissionLocked) {
      return;
    }
    if (!attemptAdvance()) {
      return;
    }
    goToStep(stepIndex + 1);
  }, [attemptAdvance, goToStep, isSubmissionLocked, stepIndex]);

  const handlePreviousStep = useCallback(() => {
    if (isSubmissionLocked) {
      return;
    }
    goToStep(stepIndex - 1);
  }, [goToStep, isSubmissionLocked, stepIndex]);

  const handleStepSelect = useCallback(
    (index: number) => {
      if (isSubmissionLocked) {
        return;
      }
      if (index === stepIndex) {
        return;
      }
      if (index < stepIndex) {
        goToStep(index);
        return;
      }
      if (attemptAdvance()) {
        goToStep(index);
      }
    },
    [attemptAdvance, goToStep, isSubmissionLocked, stepIndex],
  );

  const buildSubmissionPayload = useCallback((): NormalizedRegistrationPayload => {
    const companyName = values.companyName.trim();
    const companyEmail = values.companyEmail.trim().toLowerCase();
    const companyPhone = (phoneValue ?? values.companyPhone).trim();
    const companyTaxId = values.companyTaxNumber.trim();
    const adminEmail = values.adminEmail.trim().toLowerCase();
    const addressFreeform = (addressLockedValue ?? values.companyAddress).trim();
    const normalizedTaxCountry = taxCountryCode?.toUpperCase();

    return {
      admin: {
        email: adminEmail,
        password: values.adminPassword,
      },
      company: {
        name: companyName,
        email: companyEmail,
        phone: companyPhone,
        taxId: companyTaxId,
        taxCountryCode: normalizedTaxCountry ?? undefined,
        address: {
          freeform: addressFreeform,
          countryCode: normalizedTaxCountry ?? undefined,
        },
      },
    };
  }, [addressLockedValue, phoneValue, taxCountryCode, values]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmissionLocked) {
        return;
      }

      const hasDigits = getHasPhoneDigits();
      const validation = evaluateErrors(values, {
        phoneValue,
        hasPhoneDigits: hasDigits,
      });
      setErrors(validation);
      setTouched(() => createAllTouchedRegistrationTouched());

      const hasErrors = Object.values(validation).some((message) => Boolean(message));

      if (hasErrors) {
        return;
      }

      const probeResult = emailStatusProbe.result;
      const isVerified = emailStatusProbe.status === "registered_verified";
      const hasCompanyData = probeResult?.hasCompanyData ?? null;
      const shouldBlockVerified = isVerified && hasCompanyData === true;
      if (shouldBlockVerified) {
        return;
      }

      const payload = buildSubmissionPayload();
      void submitRegistration(payload);
    },
    [
      buildSubmissionPayload,
      evaluateErrors,
      getHasPhoneDigits,
      isSubmissionLocked,
      phoneValue,
      emailStatusProbe.status,
      emailStatusProbe.result?.hasCompanyData,
      submitRegistration,
      values,
    ],
  );

  const handleManualVerificationCheck = useCallback(
    () => confirmVerification({ manual: true }),
    [confirmVerification],
  );

  useEffect(() => {
    if (submissionPhase !== "succeeded" || !submissionResult || !submissionAttemptId) {
      return;
    }

    if (processedAttemptRef.current === submissionAttemptId) {
      return;
    }

    processedAttemptRef.current = submissionAttemptId;

    const payload = submissionResult.payload;
    const adminEmail = payload.admin.email;
    const username = adminEmail.split("@")[0] ?? adminEmail;

    const syncProfile = async () => {
      try {
        await createUserProfile({
          userUuid: submissionResult.userUuid,
          username,
          email: adminEmail,
          roles: ["owner"],
        });
        logger.info("Registration profile synced", {
          attempt_id: submissionAttemptId,
          user_uuid: submissionResult.userUuid,
          account_uuid: submissionResult.accountUuid,
        });
      } catch (error) {
        try {
          await updateUserProfile({
            userUuid: submissionResult.userUuid,
            username,
            email: adminEmail,
            roles: ["owner"],
          });
          logger.info("Registration profile updated", {
            attempt_id: submissionAttemptId,
            user_uuid: submissionResult.userUuid,
            account_uuid: submissionResult.accountUuid,
          });
        } catch (updateError) {
          logger.error("Failed to sync registration profile", updateError, {
            attempt_id: submissionAttemptId,
            user_uuid: submissionResult.userUuid,
            account_uuid: submissionResult.accountUuid,
          });
        }
      }
    };

    void syncProfile();
  }, [submissionAttemptId, submissionPhase, submissionResult]);

  const currentStepBlockingFields = useMemo(
    () => STEP_FIELDS[currentStepKey].filter((field) => hasFieldBlockingError(field)),
    [currentStepKey, hasFieldBlockingError],
  );

  const formBlockingFields = useMemo(
    () => REGISTRATION_FIELDS.filter((field) => hasFieldBlockingError(field)),
    [hasFieldBlockingError],
  );

  const emailStatusBlockingLabel = useMemo(() => {
    const probeResult = emailStatusProbe.result;
    if (
      emailStatusProbe.status === "registered_verified" &&
      (probeResult?.hasCompanyData ?? null) === true
    ) {
      return "Administrator email is already registered.";
    }
    return null;
  }, [emailStatusProbe.result?.hasCompanyData, emailStatusProbe.status]);

  const currentStepBlockingLabels = useMemo(() => {
    const labels = currentStepBlockingFields.map((field) => FIELD_CONFIG_BY_KEY[field].label);
    if (currentStepKey === "admin" && emailStatusBlockingLabel) {
      if (!labels.includes(emailStatusBlockingLabel)) {
        labels.push(emailStatusBlockingLabel);
      }
    }
    return labels;
  }, [currentStepBlockingFields, currentStepKey, emailStatusBlockingLabel]);

  const formBlockingLabels = useMemo(() => {
    const labels = formBlockingFields.map((field) => FIELD_CONFIG_BY_KEY[field].label);
    if (emailStatusBlockingLabel && !labels.includes(emailStatusBlockingLabel)) {
      labels.push(emailStatusBlockingLabel);
    }
    return labels;
  }, [formBlockingFields, emailStatusBlockingLabel]);

  const isCurrentStepValid = currentStepBlockingLabels.length === 0;
  const isFormValid = formBlockingLabels.length === 0;

  const continueTooltipMessage = currentStepBlockingLabels.length
    ? `Complete: ${currentStepBlockingLabels.join(", ")}.`
    : currentStepKey === "company"
      ? "Complete company details to continue."
      : "Complete admin account fields to continue.";

  const submitTooltipMessage = formBlockingLabels.length
    ? `Finish: ${formBlockingLabels.join(", ")}.`
    : "Double-check your organization details before submitting.";

  return {
    values,
    errors,
    touched,
    emailStatusProbe,
    isSubmitting,
    isSubmissionLocked,
    stepIndex,
    currentStepKey,
    currentStepBlockingLabels,
    formBlockingLabels,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === STEP_SEQUENCE.length - 1,
    isCurrentStepValid,
    isFormValid,
    continueTooltipMessage,
    submitTooltipMessage,
    phoneCountry,
    phoneValue,
    defaultPhoneCountry,
    phoneDialCode,
    phoneInputRef,
    addressInputRef,
    address: {
      listId: addressSuggestionListId,
      suggestions: addressSuggestions,
      loading: addressLoading,
      error: addressError,
      lockedValue: addressLockedValue,
      showPanel: addressShowPanel,
      activeIndex: addressActiveIndex,
      setActiveIndex: setAddressActiveIndex,
      handleFocus: handleAddressFocus,
      handleBlur: handleAddressBlur,
      handleKeyDown: handleAddressKeyDown,
      handleSuggestionSelect,
      clearSelection: clearAddressSelection,
      clearError: clearAddressError,
    },
    handleFieldChange,
    handleFieldBlur,
    handlePhoneChange,
    handlePhoneCountryChange,
    handleCompanyAddressChange,
    handleCompanyAddressClear,
    handleSubmit,
    handleNextStep,
    handlePreviousStep,
    handleStepSelect,
    goToStep,
    getFieldError,
    hasFieldBlockingError,
    passwordEvaluation,
    submissionPhase,
    submissionAttemptId,
    submissionError,
    submissionResult,
    handleManualVerificationCheck,
    resetSubmission,
  };
}
